import { chromium } from "playwright";
import fs from "node:fs/promises";

const BASE_URL = process.env.BASE_URL || "https://brainrotgames.me";
const FEED = "https://feeds.gamepix.com/v2/json?sid=E158N&pagination=12&page=";
const MAX_PAGES = Number(process.env.MAX_PAGES || 100);
const CONCURRENCY = Number(process.env.CONCURRENCY || 6);
const RETRIES = Number(process.env.RETRIES || 2);

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

async function checkGameProvider(browser, game) {
  for (let attempt = 1; attempt <= RETRIES; attempt++) {
    const context = await browser.newContext({ viewport: { width: 1365, height: 900 } });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    try {
      const response = await page.goto(game.url, { waitUntil: "domcontentloaded", timeout: 20000 });
      if (!response || !response.ok()) throw new Error(`provider-status-${response?.status() ?? "none"}`);
      await page.waitForTimeout(6000);

      const hasCanvas = await page.locator("canvas").count().catch(() => 0);
      const bodyText = await page.locator("body").innerText({ timeout: 3000 }).catch(() => "");
      const bodyHtmlLength = await page.locator("body").innerHTML({ timeout: 3000 }).then((x) => x.length).catch(() => 0);
      const fatal = errors.some((e) => /uncaught|cannot read|undefined|null|failed to load|syntaxerror/i.test(e));

      if (fatal && !hasCanvas && bodyHtmlLength < 500) throw new Error("fatal-game-script-error");
      if (!hasCanvas && bodyHtmlLength < 100) throw new Error("game-frame-empty");

      await context.close();
      return { ...game, status: "pass", attempts: attempt, check: "provider" };
    } catch (error) {
      await context.close().catch(() => {});
      if (attempt === RETRIES) return { ...game, status: "fail", reason: error.message, attempts: attempt, check: "provider" };
    }
  }
}

async function main() {
  const games = await getGames();
  const browser = await chromium.launch({ headless: true });
  const siteProbe = await probeSiteAccess(browser);
  const siteBlocked = siteProbe.status === 403;

  if (siteBlocked) {
    console.warn(`BrainrotGames returned HTTP 403 to the GitHub Actions runner. This is an environment/access issue, not evidence that games are broken. Testing the upstream GamePix URLs directly instead.`);
  }

  const results = [];
  let cursor = 0;

  async function worker() {
    while (cursor < games.length) {
      const game = games[cursor++];
      const result = await checkGameProvider(browser, game);
      result.siteProbe = siteProbe;
      result.siteCheck = siteBlocked ? "blocked-403" : (siteProbe.ok ? "reachable" : "unverified");
      results.push(result);
      console.log(`${result.status.toUpperCase()} ${result.id} ${result.title}${result.reason ? ` — ${result.reason}` : ""}${siteBlocked ? " — site 403; provider checked" : ""}`);
    }
  }

  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, games.length) }, worker));
  await browser.close();

  results.sort((a, b) => a.id.localeCompare(b.id));
  const failed = results.filter((r) => r.status === "fail");
  const environmentBlocked = siteBlocked;

  await fs.mkdir("qa-results", { recursive: true });
  await fs.writeFile("qa-results/game-qa.json", JSON.stringify({
    generatedAt: new Date().toISOString(),
    total: results.length,
    failed: failed.length,
    environmentBlocked,
    siteProbe,
    results
  }, null, 2));
  await fs.writeFile("qa-results/blocked-ids.txt", failed.map((r) => r.id).join("\n") + (failed.length ? "\n" : ""));
  await fs.writeFile("qa-results/environment.txt", environmentBlocked
    ? `BrainrotGames returned HTTP 403 to the GitHub Actions runner. Provider-level game QA was used instead. Site status: 403.\n`
    : `BrainrotGames site probe status: ${siteProbe.status ?? "unknown"}.\n`);

  console.log(`Scanned ${results.length} games; ${failed.length} provider-level game failures after ${RETRIES} attempts.`);
  if (environmentBlocked) console.log("QA NOTE: site-level 403 detected; no game was marked broken because of that 403.");
  if (failed.length) process.exitCode = 2;
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
