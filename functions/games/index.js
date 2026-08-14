const SITE_URL = "https://brainrotgames.me";
const CATEGORIES = [
"2048","Action","Addictive","Adventure","Airplane","Animal","Anime","Arcade","Archery","Ball","Baseball","Basketball","Battle","Battle Royale","Bejeweled","Bike","Block","Board","Bowling","Boxing","Brain","Bubble Shooter","Building","Car","Card","Casual","Cats","Checkers","Chess","Christmas","City Building","Classics","Clicker","Coco","Coding","Coloring","Cooking","Cool","Crazy","Cricket","Dinosaur","Dirt Bike","Dragons","Drawing","Dress Up","Drifting","Driving","Educational","Escape","Family","Farming","Fashion","Fighting","Fire And Water","First Person Shooter","Fishing","Flash","Flight","Fun","Games For Girls","Gangster","Gdevelop","Golf","Granny","Gun","Hair Salon","Halloween","Helicopter","Hidden Object","Hockey","Horror","Horse","Hunting","Hyper Casual","Idle","Io","Jewel","Jigsaw Puzzles","Jumping","Knight","Mahjong","Makeup","Management","Mario","Match 3","Math","Memory","Minecraft","Mining","Mmorpg","Mobile","Money","Monster","Multiplayer","Music","Naval","Ninja","Ninja Turtle","Offroad","Open World","Parking","Parkour","Piano","Pirates","Pixel","Platformer","Police","Pool","Puzzle","Racing","Restaurant","Retro","Robots","Rpg","Runner","Scary","Scrabble","Sharks","Shooter","Simulation","Skateboard","Skibidi Toilet","Skill","Snake","Sniper","Soccer","Solitaire","Spinner","Sports","Stickman","Strategy","Surgery","Survival","Sword","Tanks","Tap","Tetris","Trivia","Truck","Two Player","Tycoon","War","Word","World Cup","Worm","Wrestling","Zombie"
];

const FEATURED = [
  ["Puzzle", "🧩", "Logic, matching and brain games"],
  ["Action", "⚔️", "Fast-paced challenges"],
  ["Racing", "🏎️", "Cars, speed and drifting"],
  ["Sports", "🏀", "Competitive sports games"],
  ["Adventure", "🗺️", "Explore and overcome challenges"],
  ["Casual", "🎮", "Quick games, easy to start"]
];

function escapeHtml(value = "") {
  return String(value).replace(/[&<>\"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[c]));
}
function slug(value = "") {
  return String(value).toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export async function onRequestGet(context) {
  const requestUrl = new URL(context.request.url);
  // Version the internal cache key so the redesigned directory is not served from the previous cached HTML.
  const cacheKey = new Request(`${requestUrl.origin}/__category-directory-v2${requestUrl.pathname}`, { method: "GET" });
  const cache = caches.default;
  const cached = await cache.match(cacheKey);
  if (cached) return cached;

  const featured = FEATURED.map(([name, icon, description]) => `
    <a class="category-feature" href="/games/${slug(name)}">
      <span class="category-feature-icon" aria-hidden="true">${icon}</span>
      <span class="category-feature-copy"><strong>${escapeHtml(name)} Games</strong><span>${escapeHtml(description)}</span></span>
      <span class="category-feature-arrow" aria-hidden="true">→</span>
    </a>`).join("");

  const groups = {};
  for (const category of CATEGORIES) {
    const key = /^[0-9]/.test(category) ? "0–9" : category.charAt(0).toUpperCase();
    (groups[key] ||= []).push(category);
  }
  const groupOrder = Object.keys(groups).sort((a, b) => a === "0–9" ? -1 : b === "0–9" ? 1 : a.localeCompare(b));
  const directory = groupOrder.map(letter => `
    <section class="category-group" data-group="${letter}" aria-labelledby="category-${slug(letter)}">
      <h2 id="category-${slug(letter)}">${escapeHtml(letter)}</h2>
      <div class="category-group-list">
        ${groups[letter].map(category => `<a class="category-link" data-category="${escapeHtml(category.toLowerCase())}" href="/games/${slug(category)}"><span>${escapeHtml(category)} Games</span><span aria-hidden="true">→</span></a>`).join("")}
      </div>
    </section>`).join("");

  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="index,follow"><meta name="description" content="Browse all 147 BrainrotGames categories and discover free online browser games."><title>Game Categories - Free Online Browser Games | BrainrotGames</title><link rel="canonical" href="${SITE_URL}/games"><link rel="stylesheet" href="/styles.css"><style>
.category-directory-page{padding-bottom:72px}.category-hero{max-width:820px;margin:0 auto 34px;text-align:center}.category-hero h1{margin:4px 0 10px;font-size:clamp(42px,6vw,72px);line-height:1.02;letter-spacing:-.045em}.category-hero .section-intro{max-width:720px;margin:0 auto;color:var(--muted);font-size:17px}.category-search{max-width:720px;margin:26px auto 0;position:relative}.category-search input{width:100%;min-height:52px;padding:0 18px 0 46px;border:1px solid var(--border);border-radius:14px;background:var(--panel);color:var(--text);outline:none;box-shadow:0 12px 35px rgba(0,0,0,.18)}.category-search input:focus{border-color:var(--border-hover);box-shadow:0 0 0 3px rgba(109,93,252,.14)}.category-search svg{position:absolute;left:17px;top:50%;transform:translateY(-50%);width:18px;height:18px;color:var(--muted);pointer-events:none}.category-search-meta{display:flex;justify-content:space-between;gap:12px;margin-top:9px;color:var(--muted);font-size:12px}.category-featured{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin:0 0 46px}.category-feature{display:flex;align-items:center;gap:12px;min-height:78px;padding:14px 15px;border:1px solid var(--border);border-radius:16px;background:linear-gradient(145deg,rgba(19,29,49,.95),rgba(15,22,38,.9));transition:transform .16s ease,border-color .16s ease,background .16s ease}.category-feature:hover{transform:translateY(-2px);border-color:var(--border-hover);background:var(--panel2)}.category-feature-icon{display:grid;place-items:center;width:42px;height:42px;flex:0 0 42px;border-radius:12px;background:rgba(109,93,252,.12);font-size:21px}.category-feature-copy{min-width:0;display:grid;gap:2px}.category-feature-copy strong{font-size:15px}.category-feature-copy span{font-size:12px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.category-feature-arrow{margin-left:auto;color:var(--accent2);font-size:17px}.category-directory-head{display:flex;align-items:end;justify-content:space-between;gap:20px;margin-bottom:16px}.category-directory-head h2{margin:0;font-size:25px;letter-spacing:-.02em}.category-directory-head p{margin:0;color:var(--muted);font-size:13px}.category-groups{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}.category-group{padding:15px;border:1px solid var(--border);border-radius:15px;background:rgba(15,22,38,.68);min-width:0}.category-group h2{margin:0 0 8px;padding-bottom:8px;border-bottom:1px solid var(--border);font-size:14px;color:var(--accent2);letter-spacing:.08em}.category-group-list{display:grid;gap:2px}.category-link{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:6px 7px;border-radius:8px;color:var(--muted);font-size:13px;line-height:1.3}.category-link span:first-child{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.category-link span:last-child{color:#64748b;opacity:0;transition:opacity .15s ease}.category-link:hover{background:rgba(109,93,252,.08);color:var(--text)}.category-link:hover span:last-child{opacity:1}.category-group.is-hidden{display:none}.category-empty{display:none;padding:32px 18px;border:1px dashed var(--border);border-radius:15px;text-align:center;color:var(--muted)}.category-empty.is-visible{display:block}.category-empty strong{display:block;color:var(--text);margin-bottom:5px}.category-info{margin-top:42px}.category-info p{color:var(--muted)}@media(max-width:900px){.category-groups{grid-template-columns:repeat(3,minmax(0,1fr))}.category-featured{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:640px){.category-directory-page{padding-bottom:42px}.category-hero{text-align:left}.category-hero h1{font-size:42px}.category-hero .section-intro{font-size:15px}.category-featured{grid-template-columns:1fr;margin-bottom:34px}.category-feature{min-height:70px}.category-groups{grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}.category-group{padding:11px}.category-group h2{font-size:13px}.category-link{font-size:12px;padding:6px 5px}.category-directory-head{align-items:start;display:block}.category-directory-head p{margin-top:4px}.category-search-meta{font-size:11px}}@media(max-width:390px){.category-groups{grid-template-columns:1fr}}
</style></head><body>
<header class="site-header"><div class="container nav"><a class="brand" href="/" aria-label="BrainrotGames home"><span class="brand-mark">BG</span><span>Brainrot<span>Games</span></span></a><nav aria-label="Main navigation"><a href="/">Home</a><a href="/#games">Games</a><a href="/games" aria-current="page">Categories</a><a href="/#about">About</a></nav></div></header>
<main class="container section category-directory-page">
  <section class="category-hero"><p class="eyebrow">BROWSE GAMES</p><h1>Find Your Game</h1><p class="section-intro">Choose a genre below or search all 147 categories. Everything is grouped alphabetically so you can find what you want quickly.</p>
    <div class="category-search"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="7"></circle><path d="m20 20-3.5-3.5"></path></svg><label class="sr-only" for="category-search-input">Search game categories</label><input id="category-search-input" type="search" placeholder="Search categories…" autocomplete="off" spellcheck="false"></div>
    <div class="category-search-meta"><span id="category-result-count">147 categories</span><span>Press a category to start browsing</span></div>
  </section>

  <section aria-labelledby="popular-categories"><div class="category-directory-head"><div><h2 id="popular-categories">Popular categories</h2><p>Start here if you want the quickest route to a game.</p></div></div><div class="category-featured">${featured}</div></section>

  <section aria-labelledby="all-categories"><div class="category-directory-head"><div><h2 id="all-categories">All categories</h2><p>Browse alphabetically across the full GamePix category feed.</p></div></div><div class="category-groups" id="category-groups">${directory}</div><div class="category-empty" id="category-empty"><strong>No categories found</strong><span>Try a shorter search such as “car”, “puzzle” or “sport”.</span></div></section>

  <section class="content-panel category-info"><p class="eyebrow">BRAINROTGAMES</p><h2>Play Free Browser Games</h2><p>Choose a category to discover matching games. Supported games open directly in your browser without a separate installation.</p><p>Game availability and content may change because games are supplied through third-party publishers and distributors.</p></section>
</main>
<footer class="site-footer"><div class="container footer-inner"><div class="footer-brand"><strong>BrainrotGames</strong><span>Free browser games, available to play online.</span></div><nav class="footer-links" aria-label="Footer navigation"><a href="/about.html">About Us</a><a href="/contact.html">Contact Us</a><a href="/privacy.html">Privacy Policy</a><a href="/cookies.html">Cookie Policy</a><a href="/terms.html">Terms of Service</a></nav></div></footer>
<script>
(() => {
  const input = document.getElementById('category-search-input');
  const count = document.getElementById('category-result-count');
  const empty = document.getElementById('category-empty');
  const groups = [...document.querySelectorAll('.category-group')];
  const links = [...document.querySelectorAll('.category-link')];
  const update = () => {
    const query = input.value.trim().toLowerCase();
    let matches = 0;
    groups.forEach(group => {
      let groupMatches = 0;
      group.querySelectorAll('.category-link').forEach(link => {
        const show = !query || link.dataset.category.includes(query);
        link.hidden = !show;
        if (show) groupMatches++;
      });
      group.classList.toggle('is-hidden', groupMatches === 0);
      matches += groupMatches;
    });
    count.textContent = `${matches} categor${matches === 1 ? 'y' : 'ies'}`;
    empty.classList.toggle('is-visible', matches === 0);
  };
  input.addEventListener('input', update);
})();
</script></body></html>`;

  const response = new Response(html, { status: 200, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=60, s-maxage=1800, stale-while-revalidate=86400" } });
  context.waitUntil(cache.put(cacheKey, response.clone()));
  return response;
}
