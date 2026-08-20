const FEED = "https://feeds.gamepix.com/v2/json?sid=E158N&pagination=12&page=";
const CACHE_TTL = 900;
const BLOCKED_GAME_IDS = new Set(["7RU2YF"]);

function json(data, status = 200, cache = CACHE_TTL) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": `public, max-age=60, s-maxage=${cache}, stale-while-revalidate=86400`
    }
  });
}

function isSafeGameUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && (url.hostname === "games.gamepix.com" || url.hostname.endsWith(".gamepix.com"));
  } catch {
    return false;
  }
}

async function isUnavailableGame(game) {
  const id = String(game.id ?? game.namespace ?? "");
  const gameUrl = String(game.url || "").trim();
  if (!id || BLOCKED_GAME_IDS.has(id) || !isSafeGameUrl(gameUrl)) return true;

  try {
    const response = await fetch(gameUrl, {
      method: "GET",
      redirect: "follow",
      headers: { Accept: "text/html,application/xhtml+xml" },
      signal: AbortSignal.timeout(4000),
      cf: { cacheTtl: 900, cacheEverything: true }
    });

    if (response.status === 404 || response.status === 410) return true;

    const xFrame = (response.headers.get("x-frame-options") || "").toLowerCase();
    if (xFrame === "deny" || xFrame === "sameorigin") return true;

    const csp = (response.headers.get("content-security-policy") || "").toLowerCase();
    if (/frame-ancestors\s+[^;]*(?:'none'|\bself\b)/i.test(csp)) return true;

    return false;
  } catch {
    // Network/timeouts can be transient. Keep the game rather than falsely deleting it.
    return false;
  }
}

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
  const category = url.searchParams.get("category") || "All";
  const cacheKey = new Request(url.toString(), { method: "GET" });
  const cache = caches.default;

  const cached = await cache.match(cacheKey);
  if (cached) return cached;

  const upstream = new URL(FEED + page);
  if (category !== "All") upstream.searchParams.set("category", category);

  try {
    const response = await fetch(upstream.toString(), {
      headers: { Accept: "application/json" },
      cf: { cacheTtl: CACHE_TTL, cacheEverything: true }
    });

    if (!response.ok) return json({ error: "GamePix feed unavailable", status: response.status }, 502, 30);

    const data = await response.json();
    const sourceGames = Array.isArray(data.items) ? data.items
      : Array.isArray(data.games) ? data.games
      : Array.isArray(data.data) ? data.data
      : Array.isArray(data.results) ? data.results
      : Array.isArray(data) ? data : [];

    const rawItems = sourceGames.map((g) => ({
      id: g.id ?? g.namespace ?? "",
      title: g.title ?? "Untitled game",
      description: g.description ?? "",
      category: g.category ?? "Other",
      image: g.banner_image || g.image || g.thumbnailUrl || g.thumbnailUrl100 || g.thumbnail_url || "",
      url: g.url || g.game_url || "",
      width: g.width,
      height: g.height
    }));

    // Remove only games we can positively identify as unavailable or unsafe.
    const availability = await Promise.all(rawItems.map(async (game) => ({ game, unavailable: await isUnavailableGame(game) })));
    const items = availability.filter(({ unavailable }) => !unavailable).map(({ game }) => game);

    const responseOut = json({
      items,
      next_page_url: data.next_page_url || null,
      next_url: data.next_url || null,
      page,
      category,
      total: items.length
    });

    context.waitUntil(cache.put(cacheKey, responseOut.clone()));
    return responseOut;
  } catch (error) {
    console.error("GamePix API error:", error);
    return json({ error: "Unable to connect to GamePix" }, 502, 30);
  }
}
