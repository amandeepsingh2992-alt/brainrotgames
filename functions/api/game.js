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
function extractItems(data) {
  return Array.isArray(data?.items) ? data.items
    : Array.isArray(data?.games) ? data.games
    : Array.isArray(data?.results) ? data.results
    : Array.isArray(data?.data) ? data.data
    : [];
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

  const cacheKey = new Request(url.toString(), { method: "GET" });
  const cache = caches.default;
  const cached = await cache.match(cacheKey);
  if (cached) return cached;

  try {
    // Fast path: five pages concurrently. Fall back to pages 6-10 only when needed.
    let game = await findInPages(1, 5, id);
    if (!game) game = await findInPages(6, 10, id);
    if (!game) return json({ error: "Game not found" }, 404, 60);

    const result = json({
      id: game.id ?? game.namespace ?? "",
      title: game.title ?? "Untitled game",
      category: game.category ?? "Other",
      description: game.description ?? "",
      image: game.banner_image || game.image || game.thumbnailUrl || game.thumbnailUrl100 || "",
      url: game.url || "",
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
