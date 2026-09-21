import { GAMEPIX_FEED_BASE, GAMEPIX_SID, slug, normalizeGame } from "../lib/gamepix.js";

const CACHE_TTL = 900;
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

async function findGame(id, requestedTitle) {
  const targetTitle = slug(requestedTitle);
  const pages = Array.from({ length: 10 }, (_, i) => i + 1);
  const results = await Promise.all(pages.map(async page => {
    try {
      const feedUrl = new URL(GAMEPIX_FEED_BASE);
      feedUrl.searchParams.set("sid", GAMEPIX_SID);
      feedUrl.searchParams.set("pagination", "12");
      feedUrl.searchParams.set("page", String(page));
      const response = await fetch(feedUrl.toString(), { headers: { Accept: "application/json" }, cf: { cacheTtl: CACHE_TTL, cacheEverything: true } });
      if (!response.ok) return [];
      const data = await response.json();
      return Array.isArray(data.items) ? data.items : Array.isArray(data.games) ? data.games : Array.isArray(data.data) ? data.data : Array.isArray(data.results) ? data.results : Array.isArray(data) ? data : [];
    } catch { return []; }
  }));
  for (const games of results) for (const raw of games) {
    const rawId = String(raw?.id ?? raw?.namespace ?? "");
    const rawTitle = slug(raw?.title || "");
    if (BLOCKED_GAME_IDS.has(rawId)) continue;
    if (rawId === id || rawTitle === targetTitle || String(raw?.namespace || "") === targetTitle) return normalizeGame(raw);
  }
  return null;
}
async function validateGamePixEmbed(embedUrl) {
  if (!embedUrl) return false;
  try {
    const response = await fetch(embedUrl, {
      method: "GET",
      redirect: "follow",
      headers: { Accept: "text/html,application/xhtml+xml" },
      signal: AbortSignal.timeout(5000),
      cf: { cacheTtl: CACHE_TTL, cacheEverything: true }
    });
    if (!response.ok) return false;
    const finalUrl = new URL(response.url);
    if (finalUrl.protocol !== "https:" || !finalUrl.hostname.endsWith("gamepix.com")) return false;
    const xFrame = (response.headers.get("x-frame-options") || "").toLowerCase();
    if (xFrame === "deny" || xFrame === "sameorigin") return false;
    const csp = (response.headers.get("content-security-policy") || "").toLowerCase();
    if (/frame-ancestors\s+[^;]*(?:'none'|\bself\b)/i.test(csp)) return false;
    return true;
  } catch {
    return false;
  }
}

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const id = String(url.searchParams.get("id") || "").trim();
  const requestedTitle = String(url.searchParams.get("title") || "").trim();

  if (!id || BLOCKED_GAME_IDS.has(id) || !requestedTitle) {
    return json({ error: "Game not found or unavailable" }, 404, 60);
  }

  const cacheKey = new Request(`${url.toString()}&cache=feed-backed-v2`, { method: "GET" });
  const cache = caches.default;
  const cached = await cache.match(cacheKey);
  if (cached) return cached;

  const game = await findGame(id, requestedTitle);
  if (!game || !game.url || !(await validateGamePixEmbed(game.url))) {
    return json({ error: "Game not found or unavailable" }, 404, 60);
  }

  const result = json({
    id: String(game.id),
    namespace: String(game.namespace || slug(game.title)),
    title: String(game.title || requestedTitle),
    description: String(game.description || `Play ${game.title || requestedTitle} online for free on BrainrotGames.`),
    category: String(game.category || "Other"),
    image: String(game.image || ""),
    url: game.url
  });

  context.waitUntil(cache.put(cacheKey, result.clone()));
  return result;
}
