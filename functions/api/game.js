const FEED = "https://feeds.gamepix.com/v2/json?sid=E158N&pagination=12&page=";

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const id = url.searchParams.get("id");

  if (!id) {
    return new Response(
      JSON.stringify({ error: "Missing id" }),
      {
        status: 400,
        headers: { "content-type": "application/json" }
      }
    );
  }

  // Search the first several GamePix pages.
  // This keeps each request small and avoids the 100-game timeout.
  for (let page = 1; page <= 10; page++) {
    try {
      const upstream = new URL(FEED + page);

      const response = await fetch(upstream.toString(), {
        headers: {
          "Accept": "application/json"
        }
      });

      if (!response.ok) {
        continue;
      }

      const data = await response.json();
      const items = Array.isArray(data.items) ? data.items : [];

      const game = items.find(
        g => String(g.id ?? g.namespace) === String(id)
      );

      if (game) {
        return new Response(
          JSON.stringify({
            id: game.id ?? game.namespace,
            title: game.title,
            category: game.category,
            description: game.description,
            image: game.banner_image || game.image,
            url: game.url
          }),
          {
            status: 200,
            headers: {
              "content-type": "application/json; charset=utf-8",
              "cache-control": "public, max-age=300"
            }
          }
        );
      }

      // If GamePix says there is no next page, stop searching.
      if (!data.next_page_url && !data.next_url && items.length < 12) {
        break;
      }

    } catch (error) {
      // Try the next page rather than failing the entire request.
      continue;
    }
  }

  return new Response(
    JSON.stringify({ error: "Game not found" }),
    {
      status: 404,
      headers: {
        "content-type": "application/json; charset=utf-8"
      }
    }
  );
}
