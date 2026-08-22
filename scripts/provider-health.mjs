import fs from "node:fs/promises";

const FEED = "https://feeds.gamepix.com/v2/json?sid=E158N&pagination=12&page=";
const MAX_PAGES = Number(process.env.MAX_PAGES || 100);
const CONCURRENCY = Number(process.env.CONCURRENCY || 25);
const TIMEOUT_MS = Number(process.env.TIMEOUT_MS || 6000);
const MIN_SCANNED = Number(process.env.MIN_SCANNED || 1000);
const FILES = ["functions/api/games.js", "functions/api/game.js"];
const REPORT = "qa-results/provider-health.json";

function extractItems(data) {
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.games)) return data.games;
  if (Array.isArray(data?.results)) return data.results;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data)) return data;
  return [];
}

function idOf(game) { return String(game?.id ?? game?.namespace ?? "").trim(); }
function urlOf(game) { return String(game?.url || game?.game_url || "").trim(); }
function safeUrl(value) {
  try {
    const u = new URL(value);
    return u.protocol === "https:" && (u.hostname === "games.gamepix.com" || u.hostname.endsWith(".gamepix.com"));
  } catch { return false; }
}

function extractBlocked(source) {
  const match = source.match(/BLOCKED_GAME_IDS\s*=\s*new Set\(\[([^\]]*)\]\)/);
  if (!match) return [];
  return [...match[1].matchAll(/["']([^"']+)["']/g)].map(m => m[1]);
}

async function fetchPage(page) {
  try {
    const response = await fetch(FEED + page, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!response.ok) return { page, ok: false, items: [], status: response.status };
    return { page, ok: true, items: extractItems(await response.json()), status: response.status };
  } catch (error) {
    return { page, ok: false, items: [], status: null, error: error.message };
  }
}

async function inspect(game) {
  const id = idOf(game);
  const gameUrl = urlOf(game);
  if (!id) return { id, title: game?.title || "Untitled", status: "definite-failure", reason: "missing-id" };
  if (!safeUrl(gameUrl)) return { id, title: game?.title || "Untitled", status: "definite-failure", reason: "unsafe-or-missing-game-url", url: gameUrl };
  try {
    const response = await fetch(gameUrl, {
      method: "GET",
      redirect: "follow",
      headers: { Accept: "text/html,application/xhtml+xml" },
      signal: AbortSignal.timeout(TIMEOUT_MS)
    });
    const xFrame = (response.headers.get("x-frame-options") || "").toLowerCase();
    const csp = (response.headers.get("content-security-policy") || "").toLowerCase();
    const frameBlocked = xFrame === "deny" || xFrame === "sameorigin" || /frame-ancestors\s+[^;]*(?:'none'|\bself\b)/i.test(csp);
    if (response.status === 404 || response.status === 410) return { id, title: game?.title || "Untitled", status: "definite-failure", reason: `http-${response.status}`, url: gameUrl };
    if (frameBlocked) return { id, title: game?.title || "Untitled", status: "definite-failure", reason: "iframe-blocked", url: gameUrl, xFrame, csp: csp.slice(0, 500) };
    return { id, title: game?.title || "Untitled", status: "healthy-provider", httpStatus: response.status, url: gameUrl };
  } catch (error) {
    return { id, title: game?.title || "Untitled", status: "transient", reason: error.message, url: gameUrl };
  }
}

async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let next = 0;
  async function worker() {
    while (true) {
      const i = next++;
      if (i >= items.length) return;
      out[i] = await fn(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

async function main() {
  const pageResults = [];
  for (let start = 1; start <= MAX_PAGES; start += CONCURRENCY) {
    const pages = Array.from({ length: Math.min(CONCURRENCY, MAX_PAGES - start + 1) }, (_, i) => start + i);
    pageResults.push(...await Promise.all(pages.map(fetchPage)));
  }

  const sourceGames = pageResults.flatMap(p => p.items.map(g => ({ ...g, _page: p.page })));
  const byId = new Map();
  for (const game of sourceGames) {
    const id = idOf(game);
    if (id && !byId.has(id)) byId.set(id, game);
  }
  const games = [...byId.values()];
  const results = await mapLimit(games, CONCURRENCY, inspect);
  const definite = results.filter(r => r.status === "definite-failure");
  const transient = results.filter(r => r.status === "transient");
  const healthy = results.filter(r => r.status === "healthy-provider");

  const existing = new Set();
  for (const file of FILES) existing.add(...extractBlocked(await fs.readFile(file, "utf8")));
  const nextBlocked = new Set(existing);
  for (const r of definite) nextBlocked.add(r.id);

  const report = {
    generatedAt: new Date().toISOString(),
    pagesRequested: MAX_PAGES,
    pagesSucceeded: pageResults.filter(p => p.ok).length,
    pagesFailed: pageResults.filter(p => !p.ok).length,
    gamesScanned: games.length,
    healthyProvider: healthy.length,
    definiteFailures: definite.length,
    transient: transient.length,
    existingBlocked: [...existing],
    newlyBlocked: definite.map(r => r.id),
    completeEnoughForAutoQuarantine: games.length >= MIN_SCANNED && pageResults.filter(p => p.ok).length >= Math.floor(MAX_PAGES * 0.9),
    definiteFailureDetails: definite
  };

  await fs.mkdir("qa-results", { recursive: true });
  await fs.writeFile(REPORT, JSON.stringify(report, null, 2));

  if (!report.completeEnoughForAutoQuarantine) {
    console.log(`SAFE STOP: only ${games.length} games scanned across ${report.pagesSucceeded}/${MAX_PAGES} pages. No automatic catalogue changes.`);
    return;
  }

  if (!definite.length) {
    console.log(`COMPLETE: ${games.length} games checked; no new definite failures.`);
    return;
  }

  const sorted = [...nextBlocked].sort();
  const literal = `new Set([${sorted.map(id => JSON.stringify(id)).join(", ")}])`;
  for (const file of FILES) {
    const source = await fs.readFile(file, "utf8");
    const updated = source.replace(/new Set\(\[[^\]]*\]\)/, literal);
    if (updated !== source) await fs.writeFile(file, updated);
  }
  console.log(`AUTO-QUARANTINED ${definite.length} definite provider failures: ${definite.map(r => r.id).join(", ")}`);
}

main().catch(error => { console.error(error); process.exit(1); });
