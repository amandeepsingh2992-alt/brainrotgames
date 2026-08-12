const FEED = "https://feeds.gamepix.com/v2/json?sid=E158N&pagination=12&page=";

export async function onRequestGet(context) {
  const url = new URL(context.request.url);

  const page = Math.max(
    1,
    Number(url.searchParams.get("page")) || 1
  );

  const category = url.searchParams.get("category") || "All";

  const upstream = new URL(FEED + page);

  if (category && category !== "All") {
    upstream.searchParams.set("category", category);
  }

  const response = await fetch(upstream.toString(), {
    headers: {
      Accept: "application/json"
    }
  });

  if (!response.ok) {
    return new Response(
      JSON.stringify({
        error: "GamePix feed unavailable",
        status: response.status
      }),
      {
        status: 502,
        headers: {
          "content-type": "application/json",
          "cache-control": "no-store"
        }
      }
    );
  }

  const raw = await response.json();

  const sourceGames = Array.isArray(raw)
    ? raw
    : raw.games || raw.data || raw.results || [];

  const games = sourceGames.map(g => ({
    id: g.id || g.namespace || "",
    title: g.title || "Untitled game",
    description: g.description || "",
    category: g.category || "Other",

    image:
      g.thumbnailUrl ||
      g.thumbnailUrl100 ||
      g.thumbnail_url ||
      g.image ||
      g.banner_image ||
      "",

    url: g.url || g.game_url || "",

    width: g.width || 800,
    height: g.height || 600
  }));

  return new Response(
    JSON.stringify(games),
    {
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "public, max-age=300"
      }
    }
  );
}
