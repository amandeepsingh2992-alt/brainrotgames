const FEED = "https://feeds.gamepix.com/v2/json?sid=E158N&pagination=12&page=";

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const page = Math.max(1, Number(url.searchParams.get("page") || 1));
  const category = url.searchParams.get("category") || "All";

  const upstream = new URL(FEED + page);
  if (category && category !== "All") upstream.searchParams.set("category", category);

  const response = await fetch(upstream.toString(), {
    headers: { "Accept": "application/json" }
  });

  if (!response.ok) {
    return new Response(JSON.stringify({error:"GamePix feed unavailable", status:response.status}), {
      status: 502,
      headers: {"content-type":"application/json","cache-control":"no-store"}
    });
  }

  const data = await response.json();
  return new Response(JSON.stringify(data), {
    headers: {
      "content-type":"application/json; charset=utf-8",
      "cache-control":"public, max-age=300"
    }
  });
}
