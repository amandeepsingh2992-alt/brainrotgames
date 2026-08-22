import { GAMEPIX_FEED_BASE, GAMEPIX_SID, buildEmbedUrl, normalizeGame, slug } from "../lib/gamepix.js";

const CACHE_TTL = 900;
const MAX_FEED_PAGES = 100;
const BATCH = 10;
const BLOCKED_GAME_IDS = new Set(["7RU2YF", "011ODI", "ANMAR4"]);

function json(data, status = 200, cache = CACHE_TTL) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": `public, max-age=60, s-maxage=${cache}, stale-while-revalidate=86400`
    }
  });
}
function extractItems(data) {
  return Array.isArray(data?.items) ? data.items
    : Array.isArray(data?.games) ? data.games
    : Array.isArray(data?.results) ? data.results
    : Array.isArray(data?.data) ? data.data
    : Array.isArray(data) ? data : [];
}
function isSafeGameUrl(value) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" && (parsed.hostname === "play.gamepix.com" || parsed.hostname === "games.gamepix.com");
  } catch {
    return false;
  }
}
async function isUnavailableGame(game) {
  const id = String(game.id ?? game.namespace ?? "");
  const gameUrl = String(game.url || game.game_url || "").trim();
  if (!id || BLOCKED_GAME_IDS.has(id) || !isSafeGameUrl(gameUrl)) return true;
  try {
    const response = await fetch(gameUrl, {
      method: "GET",
      redirect: "follow",
      headers: { Accept: "text/html,application/xhtml+xml" },
      signal: AbortSignal.timeout(4000),
      cf: { cacheTtl: CACHE_TTL, cacheEverything: true }
    });
    if (response.status === 404 || response.status === 410) return true;
    const xFrame = (response.headers.get("x-frame-options") || "").toLowerCase();
    if (xFrame === "deny" || xFrame === "sameorigin") return true;
    const csp = (response.headers.get("content-security-policy") || "").toLowerCase();
    if (/frame-ancestors\s+[^;]*(?:'none'|\bself\b)/i.test(csp)) return true;
    return false;
  } catch {
    return false;
  }
}
async function fetchPage(page) {
  try {
    const feedUrl = new URL(GAMEPIX_FEED_BASE);
    feedUrl.searchParams.set("sid", GAMEPIX_SID);
    feedUrl.searchParams.set("pagination", "12");
    feedUrl.searchParams.set("page", String(page));
    const response = await fetch(feedUrl.toString(), {
      headers: { Accept: "application/json" },
      cf: { cacheTtl: CACHE_TTL, cacheEverything: true }
    });
    if (!response.ok) return [];
    return extractItems(await response.json());
  } catch {
    return [];
  }
}
async function findGame(id, requestedTitle = "") {
  const targetId = String(id).trim();
  const targetTitle = slug(requestedTitle);
  for (let start = 1; start <= MAX_FEED_PAGES; start += BATCH) {
    const pages = Array.from({ length: Math.min(BATCH, MAX_FEED_PAGES - start + 1) }, (_, i) => start + i);
    const results = await Promise.all(pages.map(fetchPage));
    for (const games of results) {
      const exactId = games.find(game => String(game?.id ?? "") === targetId);
      if (exactId) return exactId;
    }
    // ID is authoritative. Title is only a diagnostic fallback if an upstream
    // record is temporarily missing its ID field.
    if (targetTitle) {
      for (const games of results) {
        const titleMatch = games.find(game => slug(game?.title || "") === targetTitle);
        if (titleMatch && String(titleMatch.id ?? "") === targetId) return titleMatch;
      }
    }
  }
  return null;
}

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const id = url.searchParams.get("id");
  const requestedTitle = url.searchParams.get("title") || "";
  if (!id) return json({ error: "Missing id" }, 400, 30);
  if (BLOCKED_GAME_IDS.has(String(id))) return json({ error: "Game not found or unavailable" }, 404, 60);

  const cacheKey = new Request(`${url.toString()}&cache=canonical-id-v3`, { method: "GET" });
  const cache = caches.default;
  const cached = await cache.match(cacheKey);
  if (cached) return cached;

  try {
    const sourceGame = await findGame(id, requestedTitle);
    if (!sourceGame) return json({ error: "Game not found or unavailable" }, 404, 60);

    const game = normalizeGame(sourceGame);
    if (await isUnavailableGame(game)) return json({ error: "Game not found or unavailable" }, 404, 60);

    const result = json({
      ...game,
      // These are authoritative values from GamePix; the incoming title query
      // is never used to construct the provider embed URL.
      id: sourceGame.id ?? sourceGame.namespace ?? "",
      namespace: sourceGame.namespace ?? "",
      title: sourceGame.title ?? "Untitled game",
      url: buildEmbedUrl(sourceGame)
    });
    context.waitUntil(cache.put(cacheKey, result.clone()));
    return result;
  } catch (error) {
    console.error("Game lookup error:", error);
    return json({ error: "Game lookup failed" }, 502, 30);
  }
}
