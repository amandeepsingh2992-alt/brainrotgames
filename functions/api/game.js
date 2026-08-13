const FEED =
  "https://feeds.gamepix.com/v2/json?sid=E158N&pagination=12&page=";

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const id = url.searchParams.get("id");

  if (!id) {
    return new Response(
      JSON.stringify({ error: "Missing id" }),
      {
        status: 400,
        headers: {
          "content-type": "application/json; charset=utf-8"
        }
      }
    );
  }

  // Search the first 10 GamePix pages for the requested game.
  for (let page = 1; page <= 10; page++) {
    try {
      const upstream = FEED + page;

      const response = await fetch(upstream, {
        headers: {
          Accept: "application/json"
        }
      });

      if (!response.ok) {
        continue;
      }

      const data = await response.json();

      const items = Array.isArray(data.items)
        ? data.items
        : [];

      const game = items.find(
        (g) =>
          String(g.id ?? g.namespace ?? "") === String(id)
      );

      if (game) {
        return new Response(
          JSON.stringify({
            id: game.id ?? game.namespace ?? "",
            title: game.title ?? "Untitled game",
            category: game.category ?? "Other",
            description: game.description ?? "",
            image:
              game.banner_image ||
              game.image ||
              game.thumbnailUrl ||
              "",
            url: game.url || "",
            width: game.width,
            height: game.height
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

      // Stop if GamePix has no more pages.
      if (
        !data.next_page_url &&
        !data.next_url &&
        items.length < 12
      ) {
        break;
      }
    } catch (error) {
      // Try the next GamePix page.
      continue;
    }
  }

  return new Response(
    JSON.stringify({
      error: "Game not found"
    }),
    {
      status: 404,
      headers: {
        "content-type": "application/json; charset=utf-8"
      }
    }
  );
}
