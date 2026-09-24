import { chromium } from "playwright";
import fs from "node:fs/promises";

const BASE_URL = (process.env.BASE_URL || "https://brainrotgames.me").replace(/\/$/, "");
const FEED = "https://feeds.gamepix.com/v2/json?sid=E158N&pagination=12&page=";
const START_PAGE = Number(process.env.START_PAGE || 1);
const END_PAGE = Number(process.env.END_PAGE || process.env.MAX_PAGES || 100);
const CONCURRENCY = Number(process.env.CONCURRENCY || 12);
const RETRIES = Number(process.env.RETRIES || 2);
const LOAD_WAIT = Number(process.env.LOAD_WAIT || 3500);
const GAME_TIMEOUT = Number(process.env.GAME_TIMEOUT || 12000);
const BROWSER_SAMPLE = Number(process.env.BROWSER_SAMPLE || 60);
const BROWSER_ALL = process.env.BROWSER_ALL === "1";
const BROWSER_IDS = new Set((process.env.BROWSER_IDS || "MI991T").split(",").map(x => x.trim()).filter(Boolean));
const OUTPUT_PREFIX = process.env.OUTPUT_PREFIX || "game-qa";
const failures = [];

function slug(value = "") {
  return String(value).toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
function siteUrl(pathname, params = {}) {
  const u = new URL(BASE_URL + pathname);
  for (const [key, value] of Object.entries(params)) u.searchParams.set(key, value);
  return u.toString();
}
async function fetchWithTimeout(url, init = {}, timeout = 15000) {
  return fetch(url, { ...init, signal: AbortSignal.timeout(timeout) });
}
async function getGames() {
  const all = [];
  for (let page = START_PAGE; page <= END_PAGE; page++) {
    const response = await fetchWithTimeout(FEED + page, { headers: { Accept: "application/json" } }, 15000);
    if (!response.ok) throw new Error("GamePix feed page " + page + " returned HTTP " + response.status);
    const data = await response.json();
    const items = Array.isArray(data?.items) ? data.items
      : Array.isArray(data?.games) ? data.games
      : Array.isArray(data?.results) ? data.results
      : Array.isArray(data?.data) ? data.data : [];
    all.push(...items);
    if (items.length < 12) break;
  }
  const seen = new Set();
  return all.map(g => ({
    id: String(g.id ?? g.namespace ?? ""),
    namespace: String(g.namespace || ""),
    title: String(g.title ?? "Untitled game"),
    url: String(g.url || g.game_url || "")
  })).filter(g => g.id && !seen.has(g.id) && seen.add(g.id));
}

async function checkSiteAccess() {
  const response = await fetchWithTimeout(BASE_URL + "/", { headers: { Accept: "text/html", "User-Agent": "BrainrotGames-Live-QA/1.0" } }, 15000);
  return { status: response.status, ok: response.ok, finalUrl: response.url };
}

async function checkSiteGame(game) {
  const api = siteUrl("/api/game", { id: game.id, title: slug(game.title) });
  const play = siteUrl("/play", { id: game.id, title: slug(game.title) });
  for (let attempt = 1; attempt <= RETRIES; attempt++) {
    try {
      const apiResponse = await fetchWithTimeout(api, { headers: { Accept: "application/json", "User-Agent": "BrainrotGames-Live-QA/1.0" } }, 15000);
      const apiText = await apiResponse.text();
      if (!apiResponse.ok) throw new Error("site-api-http-" + apiResponse.status);
      let data;
      try { data = JSON.parse(apiText); } catch { throw new Error("site-api-invalid-json"); }
      if (String(data.id) !== game.id) throw new Error("site-api-id-mismatch");
      if (!data.title || !data.url) throw new Error("site-api-missing-game-fields");
      if (!/^https:\/\/(?:games\.gamepix\.com|[^/]+\.gamepix\.com)\//i.test(data.url)) throw new Error("site-api-unsafe-provider-url");

      const playResponse = await fetchWithTimeout(play, { headers: { Accept: "text/html", "User-Agent": "BrainrotGames-Live-QA/1.0" } }, 15000);
      const playHtml = await playResponse.text();
      if (!playResponse.ok) throw new Error("play-http-" + playResponse.status);
      if (/^Game not found\s*$/im.test(playHtml)) throw new Error("play-returned-game-not-found");
      if (!playHtml.includes("id=\"game-content\"")) throw new Error("play-missing-game-content");
      if (!playHtml.includes(String(data.title))) throw new Error("play-missing-resolved-title");
      return { ...game, status: "pass", attempts: attempt, apiStatus: apiResponse.status, playStatus: playResponse.status };
    } catch (error) {
      if (attempt === RETRIES) return { ...game, status: "fail", attempts: attempt, reason: error.message };
    }
  }
}

async function inspectFrame(frame) {
  return await frame.evaluate(() => {
    const body = document.body;
    const text = (body?.innerText || "").replace(/\s+/g, " ").trim();
    const canvases = [...document.querySelectorAll("canvas")];
    const canvasInfo = canvases.map(canvas => {
      let webgl = false;
      try { webgl = Boolean(canvas.getContext("webgl") || canvas.getContext("webgl2")); } catch {}
      const rect = canvas.getBoundingClientRect();
      return { width: canvas.width, height: canvas.height, visibleWidth: rect.width, visibleHeight: rect.height, webgl };
    });
    const selectors = ["canvas", "video", "#game", "#game-container", ".game", "[id*='game' i]", "[class*='game' i]", "[id*='unity' i]", "[class*='unity' i]", "[id*='phaser' i]", "[class*='phaser' i]", "[id*='pixi' i]", "[class*='pixi' i]", "[id*='construct' i]"];
    const selectorHits = {};
    for (const selector of selectors) selectorHits[selector] = document.querySelectorAll(selector).length;
    const largeVisibleElements = [...document.querySelectorAll("body *")].filter(el => {
      const r = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      return r.width >= 300 && r.height >= 200 && style.display !== "none" && style.visibility !== "hidden";
    }).length;
    return { url: location.href, htmlLength: body?.innerHTML?.length || 0, textLength: text.length, textSample: text.slice(0, 300), canvasInfo, selectorHits, largeVisibleElements };
  });
}

async function inspectGame(page) {
  await page.waitForTimeout(LOAD_WAIT);
  const reports = [];
  for (const frame of page.frames()) {
    try { reports.push(await inspectFrame(frame)); }
    catch (error) { reports.push({ url: frame.url(), error: error.message }); }
  }
  const canvases = reports.flatMap(r => r.canvasInfo || []);
  const hasUsableCanvas = canvases.some(c => c.width >= 100 && c.height >= 100 && c.visibleWidth >= 100 && c.visibleHeight >= 100);
  const hasWebGL = canvases.some(c => c.webgl && c.visibleWidth >= 100 && c.visibleHeight >= 100);
  const hasGameSelector = reports.some(r => Object.entries(r.selectorHits || {}).some(([selector, count]) => count > 0 && /game|unity|phaser|pixi|construct/i.test(selector)));
  const hasLargeContent = reports.some(r => r.largeVisibleElements >= 1);
  const hasMeaningfulBody = reports.some(r => r.textLength >= 120);
  return { frames: reports.length, hasUsableCanvas, hasWebGL, hasGameSelector, hasLargeContent, hasMeaningfulBody, hasRealGameSignal: hasUsableCanvas || hasWebGL || (hasGameSelector && hasLargeContent && hasMeaningfulBody), frameReports: reports };
}

async function checkEmbeddedGame(browser, game) {
  for (let attempt = 1; attempt <= RETRIES; attempt++) {
    const context = await browser.newContext({ viewport: { width: 1365, height: 900 } });
    const page = await context.newPage();
    const errors = [];
    const failedRequests = [];
    const iframeResponses = [];
    page.on("pageerror", error => errors.push(error.message));
    page.on("requestfailed", request => {
      if (request.frame() !== page.mainFrame()) failedRequests.push(request.url() + " :: " + (request.failure()?.errorText || "failed"));
    });
    page.on("response", response => {
      if (response.request().resourceType() === "document") iframeResponses.push({ url: response.url(), status: response.status() });
    });
    try {
      await page.setContent('<!doctype html><html><body style="margin:0;background:#050810"><iframe id="game-frame" src="' +
        game.url.replace(/"/g, "&quot;") +
        '" style="width:100vw;height:100vh;border:0" allow="autoplay; fullscreen; gamepad; clipboard-read; clipboard-write" allowfullscreen></iframe></body></html>',
        { waitUntil: "domcontentloaded", timeout: 10000 });
      const inspection = await Promise.race([
        inspectGame(page),
        new Promise((_, reject) => setTimeout(() => reject(new Error("game-timeout")), GAME_TIMEOUT))
      ]);
      const response404 = iframeResponses.some(r => r.status === 404 || r.status === 410);
      const response403 = iframeResponses.some(r => r.status === 403);
      if (response404) throw new Error("provider-status-404");
      if (response403) throw new Error("provider-status-403");
      if (!inspection.hasRealGameSignal) throw new Error(
        "game-not-initialized; frames=" + inspection.frames +
        "; canvas=" + inspection.hasUsableCanvas +
        "; webgl=" + inspection.hasWebGL +
        "; gameSelector=" + inspection.hasGameSelector
      );
      await context.close();
      return { ...game, status: "pass", attempts: attempt, check: "browser", ...inspection, pageErrors: errors.slice(0, 10), failedRequests: failedRequests.slice(0, 10) };
    } catch (error) {
      await context.close().catch(() => {});
      if (attempt === RETRIES) return { ...game, status: "fail", reason: error.message, attempts: attempt, check: "browser", pageErrors: errors.slice(0, 10), failedRequests: failedRequests.slice(0, 10) };
    }
  }
}

async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let next = 0;
  async function worker() {
    while (true) {
      const index = next++;
      if (index >= items.length) return;
      out[index] = await fn(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

await fs.mkdir("qa-results", { recursive: true });
const games = await getGames();
const siteProbe = await checkSiteAccess();
if (!siteProbe.ok) {
  const report = { generatedAt: new Date().toISOString(), baseUrl: BASE_URL, total: games.length, siteProbe, environmentBlocked: true };
  await fs.writeFile("qa-results/" + OUTPUT_PREFIX + ".json", JSON.stringify(report, null, 2));
  throw new Error("LIVE SITE QA BLOCKED: " + BASE_URL + " returned HTTP " + siteProbe.status);
}

const siteResults = await mapLimit(games, CONCURRENCY, checkSiteGame);
const siteFailures = siteResults.filter(r => r.status === "fail");

const browserGames = BROWSER_ALL
  ? games
  : [...new Map(games.filter(game => BROWSER_IDS.has(game.id)).concat(games.slice(0, Math.min(BROWSER_SAMPLE, games.length))).map(game => [game.id, game])).values()];
const browser = await chromium.launch({ headless: true });
const browserResults = await mapLimit(browserGames, Math.min(6, CONCURRENCY), game => checkEmbeddedGame(browser, game));
await browser.close();
const browserFailures = browserResults.filter(r => r.status === "fail");

const report = {
  generatedAt: new Date().toISOString(),
  mode: "live-site-integration-and-browser",
  baseUrl: BASE_URL,
  totalGames: games.length,
  siteApiPlay: { checked: siteResults.length, passed: siteResults.length - siteFailures.length, failed: siteFailures.length },
  browser: { checked: browserResults.length, passed: browserResults.length - browserFailures.length, failed: browserFailures.length, allCatalog: BROWSER_ALL },
  siteProbe,
  failures: { site: siteFailures, browser: browserFailures }
};
await fs.writeFile("qa-results/" + OUTPUT_PREFIX + ".json", JSON.stringify(report, null, 2));
await fs.writeFile("qa-results/" + OUTPUT_PREFIX + "-failed-site-ids.txt", siteFailures.map(r => r.id).join("\n") + (siteFailures.length ? "\n" : ""));
await fs.writeFile("qa-results/" + OUTPUT_PREFIX + "-failed-browser-ids.txt", browserFailures.map(r => r.id).join("\n") + (browserFailures.length ? "\n" : ""));
console.log(JSON.stringify({
  status: siteFailures.length || browserFailures.length ? "FAIL" : "PASS",
  baseUrl: BASE_URL,
  totalGames: games.length,
  siteApiPlay: report.siteApiPlay,
  browser: report.browser,
  siteProbe
}, null, 2));
if (siteFailures.length || browserFailures.length) process.exitCode = 2;
