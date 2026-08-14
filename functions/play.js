export async function onRequestGet(context) {
  const requestUrl = new URL(context.request.url);

  const gameId = requestUrl.searchParams.get("id");
  const title = requestUrl.searchParams.get("title");

  // Get the original static play page from Cloudflare Pages.
  const assetUrl = new URL(requestUrl);

  assetUrl.pathname = "/play.html";
  assetUrl.search = "";

  const assetResponse = await context.env.ASSETS.fetch(assetUrl);

  if (!assetResponse.ok) {
    return new Response("Unable to load play.html", {
      status: 502,
      headers: {
        "content-type": "text/plain; charset=utf-8"
      }
    });
  }

  let html = await assetResponse.text();

  /*
   * Build the canonical URL for this game.
   *
   * Example:
   * /play?id=5G91RE&title=garden-master
   */
  if (gameId) {
    const canonicalUrl = new URL("/play", requestUrl.origin);

    canonicalUrl.searchParams.set("id", gameId);

    if (title) {
      canonicalUrl.searchParams.set("title", title);
    }

    /*
     * Replace the canonical URL that exists
     * in the original play.html.
     */
    html = html.replace(
      /(<link\s+rel=["']canonical["'][^>]*\bid=["']canonical-url["'][^>]*\bhref=["'])[^"']*(["'])/i,
      `$1${canonicalUrl.toString()}$2`
    );
  }

  return new Response(html, {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "public, max-age=300"
    }
  });
}
