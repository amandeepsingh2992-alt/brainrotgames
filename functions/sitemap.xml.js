const FEED = "https://feeds.gamepix.com/v2/json?sid=E158N&pagination=12&page=";
const SITE_URL = "https://brainrotgames.me";
const MAX_PAGES = 100;
const CATEGORY_NAMES = ["2048","Action","Addictive","Adventure","Airplane","Animal","Anime","Arcade","Archery","Ball","Baseball","Basketball","Battle","Battle Royale","Bejeweled","Bike","Block","Board","Bowling","Boxing","Brain","Bubble Shooter","Building","Car","Card","Casual","Cats","Checkers","Chess","Christmas","City Building","Classics","Clicker","Coco","Coding","Coloring","Cooking","Cool","Crazy","Cricket","Dinosaur","Dirt Bike","Dragons","Drawing","Dress Up","Drifting","Driving","Educational","Escape","Family","Farming","Fashion","Fighting","Fire And Water","First Person Shooter","Fishing","Flash","Flight","Fun","Games For Girls","Gangster","Gdevelop","Golf","Granny","Gun","Hair Salon","Halloween","Helicopter","Hidden Object","Hockey","Horror","Horse","Hunting","Hyper Casual","Idle","Io","Jewel","Jigsaw Puzzles","Jumping","Knight","Mahjong","Makeup","Management","Mario","Match 3","Math","Memory","Minecraft","Mining","Mmorpg","Mobile","Money","Monster","Multiplayer","Music","Naval","Ninja","Ninja Turtle","Offroad","Open World","Parking","Parkour","Piano","Pirates","Pixel","Platformer","Police","Pool","Puzzle","Racing","Restaurant","Retro","Robots","Rpg","Runner","Scary","Scrabble","Sharks","Shooter","Simulation","Skateboard","Skibidi Toilet","Skill","Snake","Sniper","Soccer","Solitaire","Spinner","Sports","Stickman","Strategy","Surgery","Survival","Sword","Tanks","Tap","Tetris","Trivia","Truck","Two Player","Tycoon","War","Word","World Cup","Worm","Wrestling","Zombie"];

function escapeXml(value = "") {
  return String(value).replace(/[<>&'\"]/g, char => ({"<":"&lt;",">":"&gt;","&":"&amp;","'":"&apos;","\"":"&quot;"}[char]));
}
function slug(value = "") {
  return String(value).toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export async function onRequestGet(context) {
  const urls = [
    `${SITE_URL}/`,
    `${SITE_URL}/games`,
    ...CATEGORY_NAMES.map(category => `${SITE_URL}/games/${slug(category)}`),
    `${SITE_URL}/about`, `${SITE_URL}/contact`, `${SITE_URL}/privacy`, `${SITE_URL}/cookies`, `${SITE_URL}/terms`
  ];
  const seen = new Set(urls);

  try {
    for (let page = 1; page <= MAX_PAGES; page++) {
      const response = await fetch(`${FEED}${page}`, { headers: { Accept: "application/json" }, cf: { cacheTtl: 1800, cacheEverything: true } });
      if (!response.ok) break;
      const data = await response.json();
      const items = Array.isArray(data.items) ? data.items : [];
      for (const game of items) {
        const id = game.id ?? game.namespace ?? "";
        if (!id) continue;
        // Keep only the stable game-ID URL in the sitemap. The optional title query parameter is intentionally omitted because /play canonicalizes to the ID-only URL.
        const gameUrl = new URL("/play", SITE_URL);
        gameUrl.searchParams.set("id", String(id));
        const url = gameUrl.toString();
        if (!seen.has(url)) { seen.add(url); urls.push(url); }
      }
      if (!data.next_page_url && !data.next_url && items.length < 12) break;
    }
  } catch (error) { console.error("Sitemap GamePix fetch failed:", error); }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(url => `  <url>\n    <loc>${escapeXml(url)}</loc>\n  </url>`).join("\n")}\n</urlset>`;
  return new Response(xml, { status: 200, headers: { "content-type": "application/xml; charset=utf-8", "cache-control": "public, max-age=300, s-maxage=1800, stale-while-revalidate=86400" } });
}
