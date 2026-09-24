import { GAMEPIX_FEED_BASE, GAMEPIX_SID, BLOCKED_GAME_IDS, slug, normalizeGame } from "../lib/gamepix.js";

const CACHE_TTL = 900;

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

  // Resolve the exact GamePix ID first. The catalogue feed is paginated and a
  // valid game can move beyond the first few pages as the provider catalogue
  // changes. GamePix exposes a single-game endpoint specifically for this case.
  try {
    const gameUrl = new URL("https://games.gamepix.com/game");
    gameUrl.searchParams.set("sid", GAMEPIX_SID);
    gameUrl.searchParams.set("gid", id);
    const response = await fetch(gameUrl.toString(), {
      headers: { Accept: "application/json" },
      cf: { cacheTtl: CACHE_TTL, cacheEverything: true }
    });
    if (response.ok) {
      const payload = await response.json();
      const candidates = Array.isArray(payload)
        ? payload
        : Array.isArray(payload?.data)
          ? payload.data
          : Array.isArray(payload?.games)
            ? payload.games
            : Array.isArray(payload?.results)
              ? payload.results
              : payload?.data && typeof payload.data === "object"
                ? [payload.data]
                : payload?.game && typeof payload.game === "object"
                  ? [payload.game]
                  : [payload];
      for (const raw of candidates) {
        if (!raw || typeof raw !== "object") continue;
        const rawId = String(raw.id ?? raw.gid ?? id);
        if (BLOCKED_GAME_IDS.has(rawId)) continue;
        if (rawId !== id && String(raw.namespace || "") !== id) continue;
        const title = String(raw.title || requestedTitle);
        const normalized = normalizeGame({
          ...raw,
          id: raw.id ?? id,
          // The single-game endpoint may omit namespace; GamePix embeds use
          // the title slug in that situation.
          namespace: raw.namespace || slug(title)
        });
        if (normalized.url) return normalized;
      }
    }
  } catch {}

  // Fallback: use GamePix's documented large catalogue endpoint instead of
  // scanning only the first 10 feed pages. This matters when a valid game
  // appears deep in the catalogue but the single-game endpoint is incomplete.
  const offsets = [0, 1000];
  const results = await Promise.all(offsets.map(async offset => {
    try {
      const catalogueUrl = new URL("https://games.gamepix.com/games");
      catalogueUrl.searchParams.set("sid", GAMEPIX_SID);
      catalogueUrl.searchParams.set("limit", "1000");
      catalogueUrl.searchParams.set("offset", String(offset));
      const response = await fetch(catalogueUrl.toString(), {
        headers: { Accept: "application/json" },
        cf: { cacheTtl: CACHE_TTL, cacheEverything: true }
      });
      if (!response.ok) return [];
      const data = await response.json();
      return Array.isArray(data?.items) ? data.items
        : Array.isArray(data?.games) ? data.games
        : Array.isArray(data?.data) ? data.data
        : Array.isArray(data?.results) ? data.results
        : Array.isArray(data) ? data : [];
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
