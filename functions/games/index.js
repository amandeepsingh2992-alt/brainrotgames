const SITE_URL = "https://brainrotgames.me";
const CATEGORIES = [
"2048","Action","Addictive","Adventure","Airplane","Animal","Anime","Arcade","Archery","Ball","Baseball","Basketball","Battle","Battle Royale","Bejeweled","Bike","Block","Board","Bowling","Boxing","Brain","Bubble Shooter","Building","Car","Card","Casual","Cats","Checkers","Chess","Christmas","City Building","Classics","Clicker","Coco","Coding","Coloring","Cooking","Cool","Crazy","Cricket","Dinosaur","Dirt Bike","Dragons","Drawing","Dress Up","Drifting","Driving","Educational","Escape","Family","Farming","Fashion","Fighting","Fire And Water","First Person Shooter","Fishing","Flash","Flight","Fun","Games For Girls","Gangster","Gdevelop","Golf","Granny","Gun","Hair Salon","Halloween","Helicopter","Hidden Object","Hockey","Horror","Horse","Hunting","Hyper Casual","Idle","Io","Jewel","Jigsaw Puzzles","Jumping","Knight","Mahjong","Makeup","Management","Mario","Match 3","Math","Memory","Minecraft","Mining","Mmorpg","Mobile","Money","Monster","Multiplayer","Music","Naval","Ninja","Ninja Turtle","Offroad","Open World","Parking","Parkour","Piano","Pirates","Pixel","Platformer","Police","Pool","Puzzle","Racing","Restaurant","Retro","Robots","Rpg","Runner","Scary","Scrabble","Sharks","Shooter","Simulation","Skateboard","Skibidi Toilet","Skill","Snake","Sniper","Soccer","Solitaire","Spinner","Sports","Stickman","Strategy","Surgery","Survival","Sword","Tanks","Tap","Tetris","Trivia","Truck","Two Player","Tycoon","War","Word","World Cup","Worm","Wrestling","Zombie"
];

function escapeHtml(value = "") {
  return String(value).replace(/[&<>\"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[c]));
}
function slug(value = "") {
  return String(value).toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export async function onRequestGet(context) {
  const requestUrl = new URL(context.request.url);
  const cacheKey = new Request(requestUrl.toString(), { method: "GET" });
  const cache = caches.default;
  const cached = await cache.match(cacheKey);
  if (cached) return cached;

  const cards = CATEGORIES.map(category => {
    const href = `/games/${slug(category)}`;
    return `<a class="category" href="${href}"><strong>${escapeHtml(category)} Games</strong><span class="category-arrow" aria-hidden="true">→</span></a>`;
  }).join("");

  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="index,follow"><meta name="description" content="Browse all 147 BrainrotGames categories and discover free online browser games."><title>Game Categories - Free Online Browser Games | BrainrotGames</title><link rel="canonical" href="${SITE_URL}/games"><link rel="stylesheet" href="/styles.css"></head><body>
<header class="site-header"><div class="container nav"><a class="brand" href="/" aria-label="BrainrotGames home"><span class="brand-mark">BG</span><span>Brainrot<span>Games</span></span></a><nav aria-label="Main navigation"><a href="/">Home</a><a href="/#games">Games</a><a href="/games" aria-current="page">Categories</a><a href="/#about">About</a></nav></div></header>
<main class="container section"><p class="eyebrow">BROWSE</p><h1>Game Categories</h1><p class="section-intro">Explore free browser games across all 147 categories available in the GamePix category feed. Category pages are rendered server-side and cached at the edge.</p><div class="category-directory" aria-label="All game categories">${cards}</div><section class="content-panel" style="margin-top:40px"><p class="eyebrow">BRAINROTGAMES</p><h2>Play Free Browser Games</h2><p>Choose a category to discover matching games. Supported games open directly in your browser without a separate installation.</p></section></main>
<footer class="site-footer"><div class="container footer-inner"><div class="footer-brand"><strong>BrainrotGames</strong><span>Free browser games, available to play online.</span></div><nav class="footer-links" aria-label="Footer navigation"><a href="/about.html">About Us</a><a href="/contact.html">Contact Us</a><a href="/privacy.html">Privacy Policy</a><a href="/cookies.html">Cookie Policy</a><a href="/terms.html">Terms of Service</a></nav></div></footer></body></html>`;

  const response = new Response(html, { status: 200, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=60, s-maxage=1800, stale-while-revalidate=86400" } });
  context.waitUntil(cache.put(cacheKey, response.clone()));
  return response;
}
