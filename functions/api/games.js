const FEED = "https://feeds.gamepix.com/v2/json?sid=E158N&pagination=12&page=";
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

    const items = sourceGames.map((g) => ({
      id: g.id ?? g.namespace ?? "",
      title: g.title ?? "Untitled game",
      description: g.description ?? "",
      category: g.category ?? "Other",
      image: g.banner_image || g.image || g.thumbnailUrl || g.thumbnailUrl100 || g.thumbnail_url || "",
      url: g.url || g.game_url || "",
      width: g.width,
      height: g.height
    }));

    const responseOut = json({
      items,
      next_page_url: data.next_page_url || null,
      next_url: data.next_url || null,
      page,
      category,
      total: data.total ?? items.length
    });

    context.waitUntil(cache.put(cacheKey, responseOut.clone()));
    return responseOut;
  } catch (error) {
    console.error("GamePix API error:", error);
    return json({ error: "Unable to connect to GamePix" }, 502, 30);
  }
}
