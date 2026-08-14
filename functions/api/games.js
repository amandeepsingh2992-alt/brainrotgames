const FEED =
  "https://feeds.gamepix.com/v2/json?sid=E158N&pagination=12&page=";

export async function onRequestGet(context) {
  const url = new URL(context.request.url);

  const page = Math.max(
    1,
    Number(url.searchParams.get("page")) || 1
  );

  const category =
    url.searchParams.get("category") || "All";

  const upstream = new URL(FEED + page);

  if (category && category !== "All") {
    upstream.searchParams.set(
      "category",
      category
    );
  }

  try {
    const response = await fetch(
      upstream.toString(),
      {
        headers: {
          Accept: "application/json"
        }
      }
    );

    if (!response.ok) {
      return new Response(
        JSON.stringify({
          error: "GamePix feed unavailable",
          status: response.status
        }),
        {
          status: 502,
          headers: {
            "content-type":
              "application/json; charset=utf-8",
            "cache-control": "no-store"
          }
        }
      );
    }

    const data = await response.json();

    /*
     * GamePix normally returns the games
     * inside "items".
     *
     * These fallbacks make the endpoint
     * more tolerant if the response structure
     * changes.
     */
    const sourceGames =
      Array.isArray(data.items)
        ? data.items
        : Array.isArray(data.games)
        ? data.games
        : Array.isArray(data.data)
        ? data.data
        : Array.isArray(data.results)
        ? data.results
        : Array.isArray(data)
        ? data
        : [];

    const games = sourceGames.map((g) => ({
      id:
        g.id ??
        g.namespace ??
        "",

      title:
        g.title ??
        "Untitled game",

      description:
        g.description ??
        "",

      category:
        g.category ??
        "Other",

      image:
        g.banner_image ||
        g.image ||
        g.thumbnailUrl ||
        g.thumbnailUrl100 ||
        g.thumbnail_url ||
        "",

      url:
        g.url ||
        g.game_url ||
        "",

      width: g.width,
      height: g.height
    }));

    /*
     * IMPORTANT:
     * Return normalized games as "items"
     * because app.js reads data.items.
     */
    return new Response(
      JSON.stringify({
        items: games,

        next_page_url:
          data.next_page_url || null,

        next_url:
          data.next_url || null,

        page,

        category,

        total:
          data.total ??
          games.length
      }),
      {
        status: 200,
        headers: {
          "content-type":
            "application/json; charset=utf-8",

          "cache-control":
            "public, max-age=300"
        }
      }
    );
  } catch (error) {
    console.error(
      "GamePix API error:",
      error
    );

    return new Response(
      JSON.stringify({
        error:
          "Unable to connect to GamePix"
      }),
      {
        status: 502,
        headers: {
          "content-type":
            "application/json; charset=utf-8",
          "cache-control": "no-store"
        }
      }
    );
  }
}
