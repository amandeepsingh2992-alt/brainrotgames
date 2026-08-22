import { chromium } from "playwright";
import fs from "node:fs/promises";

const BASE_URL = process.env.BASE_URL || "https://brainrotgames.me";
const FEED = "https://feeds.gamepix.com/v2/json?sid=E158N&pagination=12&page=";
const START_PAGE = Number(process.env.START_PAGE || 1);
const END_PAGE = Number(process.env.END_PAGE || process.env.MAX_PAGES || 100);
const CONCURRENCY = Number(process.env.CONCURRENCY || 12);
const RETRIES = Number(process.env.RETRIES || 2);
const LOAD_WAIT = Number(process.env.LOAD_WAIT || 4000);
const GAME_TIMEOUT = Number(process.env.GAME_TIMEOUT || 12000);
const OUTPUT_PREFIX = process.env.OUTPUT_PREFIX || "game-qa";

async function getGames() {
  const all = [];
  for (let page = START_PAGE; page <= END_PAGE; page++) {
    const response = await fetch(FEED + page, { headers: { Accept: "application/json" } });
    if (!response.ok) break;
    const data = await response.json();
    const items = Array.isArray(data?.items) ? data.items : Array.isArray(data?.games) ? data.games : Array.isArray(data?.results) ? data.results : Array.isArray(data?.data) ? data.data : [];
    all.push(...items);
    if (items.length < 12) break;
  }
  const seen = new Set();
  return all.map((g) => ({ id: String(g.id ?? g.namespace ?? ""), title: String(g.title ?? "Untitled game"), url: String(g.url || g.game_url || "") }))
    .filter((g) => g.id && g.url && !seen.has(g.id) && seen.add(g.id));
}

async function probeSiteAccess(browser) {
  const context = await browser.newContext({ viewport: { width: 1365, height: 900 } });
  const page = await context.newPage();
  try {
    const response = await page.goto(`${BASE_URL}/play?id=737HCH`, { waitUntil: "domcontentloaded", timeout: 15000 });
    return { status: response?.status() ?? null, ok: Boolean(response?.ok()) };
  } catch (error) {
    return { status: null, ok: false, error: error.message };
  } finally { await context.close().catch(() => {}); }
}

async function inspectFrame(frame) {
  return await frame.evaluate(() => {
    const body = document.body;
    const text = (body?.innerText || "").replace(/\s+/g, " ").trim();
    const canvases = [...document.querySelectorAll("canvas")];
    const canvasInfo = canvases.map((canvas) => {
      let webgl = false;
      try { webgl = Boolean(canvas.getContext("webgl") || canvas.getContext("webgl2")); } catch {}
      const rect = canvas.getBoundingClientRect();
      return { width: canvas.width, height: canvas.height, visibleWidth: rect.width, visibleHeight: rect.height, webgl };
    });
    const selectors = ["canvas", "video", "#game", "#game-container", ".game", "[id*='game' i]", "[class*='game' i]", "[id*='unity' i]", "[class*='unity' i]", "[id*='phaser' i]", "[class*='phaser' i]", "[id*='pixi' i]", "[class*='pixi' i]", "[id*='construct' i]", "[class*='construct' i]"];
    const selectorHits = {};
    for (const selector of selectors) selectorHits[selector] = document.querySelectorAll(selector).length;
    const largeVisibleElements = [...document.querySelectorAll("body *")].filter((el) => {
      const r = el.getBoundingClientRect(); const style = getComputedStyle(el);
      return r.width >= 300 && r.height >= 200 && style.display !== "none" && style.visibility !== "hidden";
    }).length;
    return { url: location.href, htmlLength: body?.innerHTML?.length || 0, textLength: text.length, textSample: text.slice(0, 300), canvasInfo, selectorHits, largeVisibleElements };
  });
}

async function inspectGame(page) {
  await page.waitForTimeout(LOAD_WAIT);
  const reports = [];
  for (const frame of page.frames()) {
    try { reports.push(await inspectFrame(frame)); } catch (error) { reports.push({ url: frame.url(), error: error.message }); }
  }
  const canvases = reports.flatMap((r) => r.canvasInfo || []);
  const hasUsableCanvas = canvases.some((c) => c.width >= 100 && c.height >= 100 && c.visibleWidth >= 100 && c.visibleHeight >= 100);
  const hasWebGL = canvases.some((c) => c.webgl && c.visibleWidth >= 100 && c.visibleHeight >= 100);
  const hasGameSelector = reports.some((r) => Object.entries(r.selectorHits || {}).some(([selector, count]) => count > 0 && /game|unity|phaser|pixi|construct/i.test(selector)));
  const hasLargeContent = reports.some((r) => r.largeVisibleElements >= 1);
  const hasMeaningfulBody = reports.some((r) => r.textLength >= 120);
  const hasRealGameSignal = hasUsableCanvas || hasWebGL || (hasGameSelector && hasLargeContent && hasMeaningfulBody);
  return { frames: reports.length, hasUsableCanvas, hasWebGL, hasGameSelector, hasLargeContent, hasMeaningfulBody, hasRealGameSignal, frameReports: reports };
}

async function checkEmbeddedGame(browser, game) {
  for (let attempt = 1; attempt <= RETRIES; attempt++) {
    const context = await browser.newContext({ viewport: { width: 1365, height: 900 } });
    const page = await context.newPage();
    const errors = [];
    const failedRequests = [];
    const iframeResponses = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("requestfailed", (request) => { if (request.frame() !== page.mainFrame()) failedRequests.push(`${request.url()} :: ${request.failure()?.errorText || "failed"}`); });
    page.on("response", (response) => { if (response.request().resourceType() === "document") iframeResponses.push({ url: response.url(), status: response.status() }); });
    try {
      await page.setContent(`<!doctype html><html><body style="margin:0;background:#050810"><iframe id="game-frame" src="${game.url.replace(/"/g, "&quot;")}" style="width:100vw;height:100vh;border:0" allow="autoplay; fullscreen; gamepad; clipboard-read; clipboard-write" allowfullscreen></iframe></body></html>`, { waitUntil: "domcontentloaded", timeout: 5000 });
      const inspection = await Promise.race([
        inspectGame(page),
        new Promise((_, reject) => setTimeout(() => reject(new Error("game-timeout")), GAME_TIMEOUT))
      ]);
      const fatal = errors.some((e) => /uncaught|syntaxerror|out of memory|cannot read properties|is not defined|failed to load/i.test(e));
      const response404 = iframeResponses.some((r) => r.status === 404 || r.status === 410);
      const response403 = iframeResponses.some((r) => r.status === 403);
      if (response404) throw new Error("provider-status-404");
      if (response403) throw new Error("provider-status-403");
      if (!inspection.hasRealGameSignal) throw new Error(`game-not-initialized; frames=${inspection.frames}; canvas=${inspection.hasUsableCanvas}; webgl=${inspection.hasWebGL}; gameSelector=${inspection.hasGameSelector}; largeContent=${inspection.hasLargeContent}; meaningfulBody=${inspection.hasMeaningfulBody}`);
      if (fatal && !inspection.hasUsableCanvas && !inspection.hasWebGL) throw new Error(`fatal-game-script-error: ${errors.slice(0, 2).join(" | ")}`);
      await context.close();
      return { ...game, status: "pass", attempts: attempt, check: "embedded", ...inspection, pageErrors: errors.slice(0, 10), failedRequests: failedRequests.slice(0, 10) };
    } catch (error) {
      await context.close().catch(() => {});
      if (attempt === RETRIES) return { ...game, status: "fail", reason: error.message, attempts: attempt, check: "embedded", pageErrors: errors.slice(0, 10), failedRequests: failedRequests.slice(0, 10) };
    }
  }
}

async function main() {
  await fs.mkdir("qa-results", { recursive: true });
  const games = await getGames();
  const browser = await chromium.launch({ headless: true });
  const siteProbe = await probeSiteAccess(browser);
  const siteBlocked = siteProbe.status === 403;
  const results = []; let cursor = 0;
  async function worker() {
    while (cursor < games.length) {
      const game = games[cursor++];
      try {
        const result = await checkEmbeddedGame(browser, game);
        result.siteProbe = siteProbe; result.siteCheck = siteBlocked ? "blocked-403" : (siteProbe.ok ? "reachable" : "unverified"); results.push(result);
        console.log(`${result.status.toUpperCase()} ${result.id} ${result.title}${result.reason ? ` — ${result.reason}` : ""}`);
      } catch (error) {
        results.push({ ...game, status: "fail", reason: `qa-runtime-error: ${error.message}`, attempts: RETRIES, check: "embedded", siteProbe, siteCheck: siteBlocked ? "blocked-403" : "unverified" });
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, games.length || 1) }, worker));
  await browser.close();
  results.sort((a, b) => a.id.localeCompare(b.id));
  const failed = results.filter((r) => r.status === "fail");
  const report = { generatedAt: new Date().toISOString(), mode: "real-browser-cross-origin-iframe", startPage: START_PAGE, endPage: END_PAGE, total: results.length, passed: results.length - failed.length, failed: failed.length, environmentBlocked: siteBlocked, siteProbe, results };
  await fs.writeFile(`qa-results/${OUTPUT_PREFIX}.json`, JSON.stringify(report, null, 2));
  await fs.writeFile(`qa-results/${OUTPUT_PREFIX}-blocked-ids.txt`, failed.map((r) => r.id).join("\n") + (failed.length ? "\n" : ""));
  await fs.writeFile(`qa-results/${OUTPUT_PREFIX}-environment.txt`, siteBlocked ? "BrainrotGames returned HTTP 403 to the GitHub Actions runner. This is an environment signal only; game classification used direct GamePix URLs in Chromium iframes.\n" : `BrainrotGames site probe status: ${siteProbe.status ?? "unknown"}.\n`);
  console.log(`BATCH QA: pages=${START_PAGE}-${END_PAGE} scanned=${results.length} passed=${report.passed} failed=${report.failed}`);
  if (failed.length) process.exitCode = 2;
}
main().catch(async (error) => { await fs.mkdir("qa-results", { recursive: true }); await fs.writeFile(`qa-results/${OUTPUT_PREFIX}-runtime-error.txt`, String(error?.stack || error)); console.error(error); process.exitCode = 1; });
