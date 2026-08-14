export async function onRequestGet(context) {
  const requestUrl = new URL(context.request.url);

  const gameId = requestUrl.searchParams.get("id");
  const requestedTitle = requestUrl.searchParams.get("title");

  // Fetch the original static play page.
  const pageUrl = new URL("/play.html", requestUrl.origin);

  const response = await fetch(pageUrl.toString(), {
    headers: {
      "Accept": "text/html"
    }
  });

  if (!response.ok) {
    return new Response("Unable to load game page.", {
      status: 502,
      headers: {
        "content-type": "text/plain; charset=utf-8"
      }
    });
  }

  let html = await response.text();

  /*
   * Build the canonical URL for this game.
   *
   * Example:
   * https://brainrotgames.me/play?id=5G91RE&title=garden-master
   */
  if (gameId) {
    const canonicalUrl = new URL("/play", requestUrl.origin);

    canonicalUrl.searchParams.set("id", gameId);

    if (requestedTitle) {
      canonicalUrl.searchParams.set(
        "title",
        requestedTitle
      );
    }

    const canonicalHref = canonicalUrl.toString();

    /*
     * Replace the existing canonical URL in the
     * server-generated HTML.
     */
    html = html.replace(
      /(<link\s+rel=["']canonical["'][^>]*\bid=["']canonical-url["'][^>]*href=["'])[^"']*(["'])/i,
      `$1${canonicalHref}$2`
    );
  }

  return new Response(html, {
    status: response.status,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "public, max-age=300"
    }
  });
}
