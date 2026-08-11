const FEED = "https://feeds.gamepix.com/v2/json?sid=E158N&pagination=100&page=1";

export async function onRequestGet(context) {
  const id = new URL(context.request.url).searchParams.get("id");
  if (!id) return new Response(JSON.stringify({error:"Missing id"}), {status:400, headers:{"content-type":"application/json"}});

  const response = await fetch(FEED, {headers:{"Accept":"application/json"}});
  if (!response.ok) return new Response(JSON.stringify({error:"GamePix feed unavailable"}), {status:502, headers:{"content-type":"application/json"}});

  const data = await response.json();
  const items = Array.isArray(data.items) ? data.items : [];
  const game = items.find(g => String(g.id ?? g.namespace) === String(id));

  if (!game) return new Response(JSON.stringify({error:"Game not found"}), {status:404, headers:{"content-type":"application/json"}});
  return new Response(JSON.stringify({
    id: game.id ?? game.namespace,
    title: game.title,
    category: game.category,
    description: game.description,
    image: game.banner_image || game.image,
    url: game.url
  }), {
    headers: {"content-type":"application/json; charset=utf-8","cache-control":"public, max-age=300"}
  });
}
