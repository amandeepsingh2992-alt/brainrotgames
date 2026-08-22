const FEED = "https://feeds.gamepix.com/v2/json?sid=E158N&pagination=12&page=";
const CACHE_TTL = 900;
const GAMEPIX_SID = "E158N";
// Confirmed broken by live-site QA/user reports. Keep this list conservative.
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
    : [];
}
function isSafeGameUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && (url.hostname === "play.gamepix.com" || url.hostname === "games.gamepix.com");
  } catch {
    return false;
  }
}
function buildEmbedUrl(game) {
  const namespace = String(game.namespace || "").trim();
  const sourceUrl = String(game.url || game.game_url || "").trim();
  if (!namespace) return sourceUrl;

  let sid = GAMEPIX_SID;
  try {
    const parsed = new URL(sourceUrl);
    sid = parsed.searchParams.get("sid") || GAMEPIX_SID;
  } catch {}

  return `https://play.gamepix.com/${encodeURIComponent(namespace)}/embed?sid=${encodeURIComponent(sid)}`;
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
async function findInPages(start, end, id) {
  const responses = await Promise.all(
    Array.from({ length: end - start + 1 }, (_, i) => fetch(FEED + (start + i), {
      headers: { Accept: "application/json" },
      cf: { cacheTtl: CACHE_TTL, cacheEverything: true }
    }).catch(() => null))
  );
  for (const response of responses) {
    if (!response?.ok) continue;
    const game = extractItems(await response.json()).find(g => String(g.id ?? g.namespace ?? "") === String(id));
    if (game) return game;
  }
  return null;
}
export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const id = url.searchParams.get("id");
  if (!id) return json({ error: "Missing id" }, 400, 30);
  if (BLOCKED_GAME_IDS.has(String(id))) return json({ error: "Game not found or unavailable" }, 404, 60);
  const cacheKey = new Request(url.toString(), { method: "GET" });
  const cache = caches.default;
  const cached = await cache.match(cacheKey);
  if (cached) return cached;
  try {
    let game = await findInPages(1, 5, id);
    if (!game) game = await findInPages(6, 10, id);
    if (!game || !isSafeGameUrl(String(game.url || game.game_url || "").trim()) || await isUnavailableGame({ ...game, url: buildEmbedUrl(game) })) {
      return json({ error: "Game not found or unavailable" }, 404, 60);
    }
    const result = json({
      id: game.id ?? game.namespace ?? "",
      namespace: game.namespace ?? "",
      title: game.title ?? "Untitled game",
      category: game.category ?? "Other",
      description: game.description ?? "",
      image: game.banner_image || game.image || game.thumbnailUrl || game.thumbnailUrl100 || "",
      url: buildEmbedUrl(game),
      width: game.width,
      height: game.height
    });
    context.waitUntil(cache.put(cacheKey, result.clone()));
    return result;
  } catch (error) {
    console.error("Game lookup error:", error);
    return json({ error: "Game lookup failed" }, 502, 30);
  }
}
