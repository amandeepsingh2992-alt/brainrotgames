import { chromium } from "playwright";
import fs from "node:fs/promises";

const BASE_URL = process.env.BASE_URL || "https://brainrotgames.me";
const FEED = "https://feeds.gamepix.com/v2/json?sid=E158N&pagination=12&page=";
const MAX_PAGES = Number(process.env.MAX_PAGES || 100);
const CONCURRENCY = Number(process.env.CONCURRENCY || 4);
const RETRIES = Number(process.env.RETRIES || 2);
const LOAD_WAIT = Number(process.env.LOAD_WAIT || 8000);

function extractItems(data) {
  return Array.isArray(data?.items) ? data.items
    : Array.isArray(data?.games) ? data.games
    : Array.isArray(data?.results) ? data.results
    : Array.isArray(data?.data) ? data.data
    : [];
}

async function getGames() {
  const all = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const response = await fetch(FEED + page, { headers: { Accept: "application/json" } });
    if (!response.ok) break;
    const data = await response.json();
    const items = extractItems(data);
    all.push(...items);
    if (!data.next_page_url && !data.next_url && items.length < 12) break;
  }
  const seen = new Set();
  return all.map((g) => ({
    id: String(g.id ?? g.namespace ?? ""),
    title: String(g.title ?? "Untitled game"),
    url: String(g.url || g.game_url || "")
  })).filter((g) => g.id && g.url && !seen.has(g.id) && seen.add(g.id));
}

async function probeSiteAccess(browser) {
  const context = await browser.newContext({ viewport: { width: 1365, height: 900 } });
  const page = await context.newPage();
  try {
    const response = await page.goto(`${BASE_URL}/play?id=737HCH`, { waitUntil: "domcontentloaded", timeout: 20000 });
    return { status: response?.status() ?? null, ok: Boolean(response?.ok()) };
  } catch (error) {
    return { status: null, ok: false, error: error.message };
  } finally {
    await context.close().catch(() => {});
  }
}

async function checkEmbeddedGame(browser, game) {
  for (let attempt = 1; attempt <= RETRIES; attempt++) {
    const context = await browser.newContext({ viewport: { width: 1365, height: 900 } });
    const page = await context.newPage();
    const errors = [];
    const failedRequests = [];
    const iframeResponses = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("requestfailed", (request) => {
      if (request.frame() !== page.mainFrame()) failedRequests.push(`${request.url()} :: ${request.failure()?.errorText || "failed"}`);
    });
    page.on("response", (response) => {
      if (response.url() === game.url || response.request().resourceType() === "document") {
        iframeResponses.push({ url: response.url(), status: response.status() });
      }
    });

    try {
      // Use a real cross-origin iframe so the test matches how GamePix is embedded by BrainrotGames.
      await page.setContent(`<!doctype html><html><body style="margin:0;background:#050810"><iframe id="game-frame" src="${game.url.replace(/"/g, "&quot;")}" style="width:100vw;height:100vh;border:0" allow="autoplay; fullscreen; gamepad; clipboard-read; clipboard-write" allowfullscreen></iframe></body></html>`, { waitUntil: "domcontentloaded" });

      const iframe = page.locator("#game-frame");
      await iframe.waitFor({ state: "attached", timeout: 5000 });
      await page.waitForTimeout(LOAD_WAIT);

      const frame = page.frames().find((candidate) => candidate !== page.mainFrame() && candidate.url().startsWith(new URL(game.url).origin));
      if (!frame) throw new Error("iframe-did-not-initialize");

      const bodyHtmlLength = await frame.locator("body").innerHTML({ timeout: 5000 }).then((x) => x.length).catch(() => 0);
      const hasCanvas = await frame.locator("canvas").count().catch(() => 0);
      const hasGameContent = await frame.locator("canvas, #game, #game-container, .game, [class*=game], [id*=game]").count().catch(() => 0);
      const bodyText = await frame.locator("body").innerText({ timeout: 3000 }).catch(() => "");
      const fatal = errors.some((e) => /uncaught|cannot read|undefined|null|syntaxerror|failed to load/i.test(e));
      const response403 = iframeResponses.some((r) => r.status === 403);
      const response404 = iframeResponses.some((r) => r.status === 404 || r.status === 410);

      if (response404) throw new Error("provider-status-404");
      if (response403) throw new Error("provider-status-403");
      if (bodyHtmlLength < 100 && !hasCanvas) throw new Error("embedded-game-empty");
      if (!hasCanvas && !hasGameContent && bodyText.trim().length < 20 && bodyHtmlLength < 500) throw new Error("embedded-game-no-content");
      if (fatal && !hasCanvas && bodyHtmlLength < 500) throw new Error("embedded-game-script-error");
      if (failedRequests.length > 20 && !hasCanvas && !hasGameContent) throw new Error("embedded-game-network-failures");

      await context.close();
      return {
        ...game,
        status: "pass",
        attempts: attempt,
        check: "embedded",
        hasCanvas: Boolean(hasCanvas),
        hasGameContent: Boolean(hasGameContent),
        bodyHtmlLength
      };
    } catch (error) {
      await context.close().catch(() => {});
      if (attempt === RETRIES) return {
        ...game,
        status: "fail",
        reason: error.message,
        attempts: attempt,
        check: "embedded"
      };
    }
  }
}

async function main() {
  const games = await getGames();
  const browser = await chromium.launch({ headless: true });
  const siteProbe = await probeSiteAccess(browser);
  const siteBlocked = siteProbe.status === 403;

  if (siteBlocked) console.warn("BrainrotGames returned HTTP 403 to the GitHub Actions runner. This does not affect direct iframe QA; games are tested against their GamePix URLs in a real browser iframe.");

  const results = [];
  let cursor = 0;

  async function worker() {
    while (cursor < games.length) {
      const game = games[cursor++];
      const result = await checkEmbeddedGame(browser, game);
      result.siteProbe = siteProbe;
      result.siteCheck = siteBlocked ? "blocked-403" : (siteProbe.ok ? "reachable" : "unverified");
      results.push(result);
      console.log(`${result.status.toUpperCase()} ${result.id} ${result.title}${result.reason ? ` — ${result.reason}` : ""}${siteBlocked ? " — site 403; embedded provider checked" : ""}`);
    }
  }

  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, games.length) }, worker));
  await browser.close();

  results.sort((a, b) => a.id.localeCompare(b.id));
  const failed = results.filter((r) => r.status === "fail");

  await fs.mkdir("qa-results", { recursive: true });
  await fs.writeFile("qa-results/game-qa.json", JSON.stringify({
    generatedAt: new Date().toISOString(),
    mode: "real-browser-cross-origin-iframe",
    total: results.length,
    passed: results.length - failed.length,
    failed: failed.length,
    environmentBlocked: siteBlocked,
    siteProbe,
    results
  }, null, 2));
  await fs.writeFile("qa-results/blocked-ids.txt", failed.map((r) => r.id).join("\n") + (failed.length ? "\n" : ""));
  await fs.writeFile("qa-results/environment.txt", siteBlocked
    ? `BrainrotGames returned HTTP 403 to the GitHub Actions runner. This was treated only as an environment signal. Game QA used real Chromium cross-origin iframes against GamePix URLs.\n`
    : `BrainrotGames site probe status: ${siteProbe.status ?? "unknown"}.\n`);

  console.log(`Embedded QA scanned ${results.length} games; ${results.length - failed.length} passed and ${failed.length} failed after ${RETRIES} attempts.`);
  if (siteBlocked) console.log("QA NOTE: site-level 403 detected; it did not affect game classification.");
  if (failed.length) process.exitCode = 2;
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
