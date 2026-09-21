const SITE_URL = "https://brainrotgames.me";
const FEED = "https://feeds.gamepix.com/v2/json?sid=E158N&pagination=12&page=";
const MAX_FEED_PAGES = 10;
const BATCH = 5;
const CACHE_TTL = 1800;
// Confirmed broken by live-site QA/user reports. Keep this list conservative.
const BLOCKED_GAME_IDS = new Set(["7RU2YF", "011ODI", "ANMAR4"]);

const CURATED_CATEGORIES = new Set(["action","adventure","arcade","casual","puzzle","racing","sports","strategy","simulation","board","card","word"]);
const CATEGORY_COPY = {
  action: "Fast-paced browser games with combat, reflexes, timing and quick challenges. They are a good fit when you want active play and short feedback loops.",
  adventure: "Browser games built around exploration, discovery, objectives and progression. They can suit longer sessions when you want a sense of moving through a world or sequence of challenges.",
  arcade: "Quick-play browser games focused on reflexes, timing, score chasing and repeatable challenges. They are often easy to start and useful for short sessions.",
  casual: "Easy-to-start browser games for relaxed sessions, simple controls and low setup. This category can be useful when you want to play without spending much time learning a ruleset.",
  puzzle: "Brain teasers, matching, logic and problem-solving browser games. These are useful when you want a focused session where decisions and patterns matter more than reaction speed.",
  racing: "Browser racing games featuring cars, speed, drifting, timing and driving challenges. Look at the control style before choosing a game because precision can vary significantly between titles.",
  sports: "Browser sports games covering competitive and arcade-style play. They range from quick skill challenges to games with more involved controls and match structure.",
  strategy: "Browser strategy games built around planning, tactics, resource decisions and deliberate choices. They can reward patience more than rapid reactions.",
  simulation: "Browser simulation games that let you manage, build, organize and experiment. These are often better suited to players who enjoy systems and gradual progress.",
  board: "Classic and modern board-style browser games you can play online. They can work well for deliberate play, familiar rules and shared sessions.",
  card: "Browser card games for quick matches, familiar mechanics and strategic decision-making. Individual games can vary from casual play to deeper rulesets.",
  word: "Word and vocabulary browser games for quick brain-training sessions, pattern recognition and language-based challenges."
};
const CATEGORY_EDITORIAL = {"action":{"sections":[["What Action Browser Games Are Like","Action games emphasize movement, timing, quick decisions and immediate feedback. The category includes combat, platforming, survival, shooting, escaping and short reflex challenges, so individual titles can feel very different."],["How to Choose an Action Game","Decide whether you want a short reflex challenge or a longer session with more systems to learn. Check controls before starting: precise keyboard and mouse input may suit desktop, while simpler titles can work well with touch."],["Tips for a Better Session","Learn the basic movement and one core action first. In fast games, consistent positioning and timing usually matter more than constant input. If controls feel awkward on a phone, try a larger screen."],["Related Reading","Use the controls and short-session guides on BrainrotGames when comparing action games with other browser-game formats."]]},"adventure":{"sections":[["What Adventure Browser Games Are Like","Adventure games emphasize exploration, objectives, discovery and progression. Some are compact experiences with puzzles, while others use longer sequences of movement and interaction."],["How to Choose an Adventure Game","Think about available time and whether you want exploration or a quick challenge. Read the individual description and check controls before starting, especially when choosing between desktop and touch."],["Tips for Playing","Read objective text carefully and pay attention to environmental clues before repeating an action. For longer sessions, a larger screen can make menus, maps and small interactive elements easier to understand."],["Related Reading","Our game-selection and mobile-gaming guides explain how session length, controls and device choice affect browser gaming."]]},"arcade":{"sections":[["What Arcade Browser Games Are Like","Arcade games usually revolve around a compact loop: react, score, survive, match, dodge, jump or repeat. They are often easy to start, although difficulty can rise quickly."],["How to Choose an Arcade Game","For a short break, look for a clear objective and little setup. For longer play, choose a title with room to improve through scoring or increasing difficulty. Control precision also matters."],["Tips for Arcade Play","Use short practice runs to learn timing before chasing a high score. Identify repeatable actions rather than relying on luck, and use deliberate inputs as the game speeds up."],["Related Reading","See the short-break and casual-versus-arcade guides for practical ways to choose an arcade game."]]},"casual":{"sections":[["What Casual Browser Games Are Like","Casual games are often easy to start and require little setup. They can include puzzles, matching, simple arcade loops, click-based systems and simulations, so challenge and session length vary."],["How to Choose a Casual Game","Decide whether you want relaxation, a quick distraction or gradual progression. Look at the objective and controls before opening several titles. Simple visuals do not necessarily mean simple interaction."],["Tips for a Relaxed Session","Choose a pace that matches your attention and available time. On mobile, check whether important buttons and text remain visible. If a game requires rapid input but you want low-pressure play, try another title."],["Related Reading","The session-planning and casual-versus-arcade guides help narrow the catalogue by mood, time and challenge."]]},"puzzle":{"sections":[["What Puzzle Browser Games Are Like","Puzzle games focus on reasoning, patterns, matching, sequencing, memory, spatial decisions or problem solving. Some fit a few minutes; others build increasingly difficult challenges."],["How to Choose a Puzzle Game","Choose the type of thinking you enjoy: matching, logic, wordplay, memory or spatial tasks. Check the interface too; detailed boards and instructions can be easier to read on a larger screen."],["Tips for Better Decisions","Before making a move, consider what options it creates next. When stuck, look for a different pattern instead of repeating the same action. Short pauses can prevent mistakes caused by acting too quickly."],["Related Reading","Our puzzle strategy guide goes deeper into planning, pattern recognition and avoiding common decision-making mistakes."]]},"racing":{"sections":[["What Racing Browser Games Are Like","Browser racing games range from top-down challenges to driving games built around steering, braking, drifting and lap times. The control model can matter as much as the game format."],["How to Choose a Racing Game","Check whether the game emphasizes speed, drifting, obstacle avoidance or laps. Desktop can help with precise steering, while mobile titles should have clear touch controls and enough screen space for upcoming turns."],["Tips for Improving","Learn braking points before maximizing speed. A consistent racing line is usually more useful than taking every corner aggressively. Test controls over several short runs before changing your device."],["Related Reading","The browser racing and controls guides cover lap consistency, steering, braking and input methods."]]},"sports":{"sections":[["What Sports Browser Games Are Like","Sports games can reproduce a match, simplify a sport into an arcade challenge or focus on a skill such as shooting, batting, bowling or scoring. Individual titles can therefore vary considerably."],["How to Choose a Sports Game","Choose between a quick skill test, head-to-head match or structured simulation. Check controls before starting. Touch-friendly games can suit phones, while precise timing may be easier on desktop."],["Tips for Playing","Learn the scoring condition first and spend a short practice round understanding timing. Change one strategy at a time so you can tell what improved the result. For shared play, agree on controls first."],["Related Reading","Use the device-selection and game-selection guides when deciding whether a sports title suits your phone, tablet or desktop."]]},"strategy":{"sections":[["What Strategy Browser Games Are Like","Strategy games emphasize planning, trade-offs, positioning, resources or deliberate choices. Turn-based and real-time titles both reward understanding how early decisions affect later options."],["How to Choose a Strategy Game","Consider the commitment you want. A tactical puzzle can fit a break, while management or progression games may need more time. Many-panel interfaces can also be more comfortable on desktop."],["Tips for Better Decisions","Identify the win condition before spending resources. Preserve future options until you understand the system, and change one decision at a time while learning its consequences."],["Related Reading","Our game-selection and session-planning guides help match strategy games to the time and attention available."]]},"simulation":{"sections":[["What Simulation Browser Games Are Like","Simulation games model systems you can manage, build or experiment with, including businesses, cities, farming, vehicles and other structured activities. Their appeal often comes from seeing how decisions change later results."],["How to Choose a Simulation","Check how much setup the game requires and whether it expects a longer session. Management-heavy titles can benefit from a larger screen and uninterrupted time."],["Tips for Learning the System","Start with the main objective and understand one system at a time. Make a small change, observe the result and then adjust. This makes cause and effect easier to learn."],["Related Reading","The game-selection and session-planning guides help decide whether a simulation fits your time, device and attention."]]},"board":{"sections":[["What Board Browser Games Are Like","Board games in a browser can recreate familiar tabletop rules or introduce digital variations. They generally reward planning and careful decisions rather than reaction speed."],["How to Choose a Board Game","If you know the traditional game, check whether the digital version follows familiar rules. If it is new, read the objective and turn structure first. A larger screen can improve readability."],["Tips for Better Play","Consider the next position rather than only the immediate gain. Track which options remain available and check consequences before committing. For shared play, agree on rules first."],["Related Reading","Our session-planning and game-selection guides provide practical advice for choosing board games by time and device."]]},"card":{"sections":[["What Card Browser Games Are Like","Card games can be quick and casual or highly strategic. Digital versions may automate dealing, scoring and turn order, leaving players to focus on decisions and the information available."],["How to Choose a Card Game","Start with a ruleset you understand or a title with a clear introductory objective. Check whether it is intended for solo or multiplayer use. Touch works well for many card interfaces."],["Tips for Learning","Understand the purpose and value of each card before advanced tactics. Pay attention to visible information and use short practice matches when rules are unfamiliar."],["Related Reading","The session-planning and browser-game selection guides help match card games to available time and preferred complexity."]]},"word":{"sections":[["What Word Browser Games Are Like","Word games use vocabulary, spelling, patterns, clues or letter manipulation. Some are fast and score-focused, while others reward careful deduction, making them useful for short focused sessions."],["How to Choose a Word Game","Choose between clues, anagrams, pattern matching, spelling or timed challenges. Keyboard input can be faster for direct typing on desktop, while touch can suit selecting letters or tiles."],["Tips for Solving","Read the full clue before guessing and use known letter patterns to reduce possibilities. On mobile, rotate the device when that makes the board or keyboard easier to read."],["Related Reading","The browser-game selection guide covers how to match games to challenge, session length and device."]]}};

const CATEGORY_GUIDES = {
  action: [["How to Choose a Browser Game for a Short Break","/guides/browser-games-for-short-breaks.html"],["Keyboard and Mouse Controls: A Quick Reference","/guides/keyboard-mouse-controls"]],
  adventure: [["How to Choose a Browser Game You’ll Actually Enjoy","/guides/choose-browser-game"],["Playing Browser Games on a Phone or Tablet","/guides/mobile-browser-gaming"]],
  arcade: [["How to Choose a Browser Game for a Short Break","/guides/browser-games-for-short-breaks.html"],["Casual vs Arcade vs Puzzle Browser Games","/guides/casual-arcade-puzzle-games.html"]],
  casual: [["Casual vs Arcade vs Puzzle Browser Games","/guides/casual-arcade-puzzle-games.html"],["How to Pick a Browser Game for Your Mood and Available Time","/guides/browser-game-session-planning.html"]],
  puzzle: [["Better Puzzle-Game Decisions: A Simple Strategy Guide","/guides/puzzle-game-strategy"],["How to Choose a Browser Game You’ll Actually Enjoy","/guides/choose-browser-game"]],
  racing: [["Browser Racing Games: Improve Your Lap Times","/guides/browser-racing-tips"],["Browser Game Controls: Keyboard, Mouse and Touch","/guides/browser-game-controls-guide.html"]],
  sports: [["How to Choose a Browser Game You’ll Actually Enjoy","/guides/choose-browser-game"],["How to Choose Browser Games for Desktop, Tablet or Phone","/guides/choosing-browser-games-by-device.html"]],
  strategy: [["How to Choose a Browser Game You’ll Actually Enjoy","/guides/choose-browser-game"],["How to Pick a Browser Game for Your Mood and Available Time","/guides/browser-game-session-planning.html"]],
  simulation: [["How to Choose a Browser Game You’ll Actually Enjoy","/guides/choose-browser-game"],["How to Pick a Browser Game for Your Mood and Available Time","/guides/browser-game-session-planning.html"]],
  board: [["How to Pick a Browser Game for Your Mood and Available Time","/guides/browser-game-session-planning.html"],["How to Choose a Browser Game You’ll Actually Enjoy","/guides/choose-browser-game"]],
  card: [["How to Pick a Browser Game for Your Mood and Available Time","/guides/browser-game-session-planning.html"],["How to Choose a Browser Game You’ll Actually Enjoy","/guides/choose-browser-game"]],
  word: [["How to Choose a Browser Game You’ll Actually Enjoy","/guides/choose-browser-game"],["How to Pick a Browser Game for Your Mood and Available Time","/guides/browser-game-session-planning.html"]]
};

function escapeHtml(value = "") { return String(value).replace(/[&<>\"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#039;" }[c])); }
function slug(value = "") { return String(value).toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); }
function categoryEquivalent(a, b) {
  a = slug(a); b = slug(b);
  if (!a || !b) return false;
  if (a === b || a === `${b}s` || b === `${a}s`) return true;
  if (a.endsWith("ies") && `${a.slice(0, -3)}y` === b) return true;
  if (b.endsWith("ies") && `${b.slice(0, -3)}y` === a) return true;
  return false;
}
function categoryValues(game) {
  const values = [];
  const add = value => {
    if (typeof value === "string") values.push(value);
    else if (value && typeof value === "object") values.push(value.slug, value.name, value.title, value.category);
  };
  add(game?.category);
  for (const key of ["categories", "tags", "genres"]) { const value = game?.[key]; if (Array.isArray(value)) value.forEach(add); else add(value); }
  return values.filter(Boolean);
}
function matches(game, requested) {
  return categoryValues(game).some(value => {
    const s = slug(value), r = slug(requested);
    if (categoryEquivalent(s, r)) return true;
    return s.includes(`-${r}-`) || s.startsWith(`${r}-`) || s.endsWith(`-${r}`);
  });
}
function extractGames(data) {
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.games)) return data.games;
  if (Array.isArray(data?.results)) return data.results;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data)) return data;
  return [];
}
async function fetchPage(page, requested = "") {
  try {
    const url = new URL(FEED + page);
    if (requested) url.searchParams.set("category", requested);
    const response = await fetch(url.toString(), { headers: { Accept: "application/json" }, cf: { cacheTtl: 900, cacheEverything: true } });
    if (!response.ok) return [];
    return extractGames(await response.json());
  } catch (error) { console.error("GamePix feed error:", error); return []; }
}
async function fetchCategoryGames(requested) {
  const seen = new Set(); const found = [];
  for (let start = 1; start <= MAX_FEED_PAGES; start += BATCH) {
    const pages = Array.from({ length: Math.min(BATCH, MAX_FEED_PAGES - start + 1) }, (_, i) => start + i);
    const results = await Promise.all(pages.map(p => fetchPage(p, requested)));
    for (const games of results) for (const game of games) {
      const id = String(game?.id ?? game?.namespace ?? "");
      if (!id || BLOCKED_GAME_IDS.has(id) || seen.has(id)) continue;
      seen.add(id);
      if (matches(game, requested)) found.push(game);
      if (found.length >= 24) return found;
    }
  }
  if (!found.length) {
    for (let start = 1; start <= MAX_FEED_PAGES; start += BATCH) {
      const pages = Array.from({ length: Math.min(BATCH, MAX_FEED_PAGES - start + 1) }, (_, i) => start + i);
      const results = await Promise.all(pages.map(p => fetchPage(p)));
      for (const games of results) for (const game of games) {
        const id = String(game?.id ?? game?.namespace ?? "");
        if (!id || BLOCKED_GAME_IDS.has(id) || seen.has(id)) continue;
        seen.add(id);
        if (matches(game, requested)) found.push(game);
        if (found.length >= 24) return found;
      }
    }
  }
  return found;
}
function gameUrl(game) {
  const url = new URL("/play", SITE_URL);
  url.searchParams.set("id", String(game.id ?? game.namespace ?? ""));
  if (game.title) url.searchParams.set("title", slug(game.title));
  return url.toString();
}
function gameCard(game) {
  const title = game.title || "Untitled game"; const category = game.category || "Browser Game";
  const image = game.banner_image || game.image || game.thumbnailUrl || game.thumbnailUrl100 || game.thumbnail_url || "";
  const dimensions = game.width && game.height ? ` width="${Number(game.width)}" height="${Number(game.height)}"` : "";
  return `<article class="game-card"><a href="${escapeHtml(gameUrl(game))}" aria-label="Play ${escapeHtml(title)}"><div class="thumb"><div class="fallback">🎮</div>${image ? `<img src="${escapeHtml(image)}" alt="${escapeHtml(title)}" loading="lazy" decoding="async"${dimensions} referrerpolicy="no-referrer">` : ""}</div><div class="card-body"><div class="game-title">${escapeHtml(title)}</div><div class="game-meta"><span>${escapeHtml(category)}</span><span>▶ Play</span></div><div class="play-btn">Play Now</div></div></a></article>`;
}
function injectJsonLd(source, id, data) {
  const json = JSON.stringify(data).replace(/</g, "\\u003c");
  const script = `<script type="application/ld+json" id="${id}">${json}</script>`;
  const existing = new RegExp(`<script[^>]+id=["']${id}["'][^>]*>[\\s\\S]*?<\\/script>`, "i");
  if (existing.test(source)) return source.replace(existing, script);
  return source.replace(/<\/head>/i, `${script}\n</head>`);
}
export async function onRequestGet(context) {
  const requestUrl = new URL(context.request.url); const categorySlug = slug(context.params.category || "");
  if (!categorySlug) return Response.redirect(`${SITE_URL}/games`, 301);
  const cacheKey = new Request(requestUrl.toString(), { method: "GET" }); const cache = caches.default; const cached = await cache.match(cacheKey);
  if (cached) return cached;
  const category = categorySlug.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase());
  const description = CATEGORY_COPY[categorySlug] || `Browse ${category} browser games and explore titles from this part of the catalogue. Use the game pages for individual descriptions and controls.`;
  const categoryRobots = CURATED_CATEGORIES.has(categorySlug) ? "index,follow" : "noindex,follow";
  let games = []; try { games = await fetchCategoryGames(categorySlug); } catch (error) { console.error("Category page error:", error); }
  const title = `${category} Games - Play Free Online | BrainrotGames`; const canonical = `${SITE_URL}/games/${categorySlug}`;
  const gameMarkup = games.length ? games.map(gameCard).join("\n") : `<div class="empty"><strong>No games are available in this category right now.</strong><br><br>Check back soon or browse another category.</div>`;
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="${categoryRobots}"><meta name="description" content="${escapeHtml(description)}"><title>${escapeHtml(title)}</title><link rel="canonical" href="${escapeHtml(canonical)}"><link rel="stylesheet" href="/styles.css"></head><body><header class="site-header"><div class="container nav"><a class="brand" href="/" aria-label="BrainrotGames home"><span class="brand-mark">BG</span><span>Brainrot<span>Games</span></span></a><nav aria-label="Main navigation"><a href="/">Home</a><a href="/games">Categories</a><a href="/#games">Games</a><a href="/guides/">Guides</a></nav></div></header><main class="container section"><div class="breadcrumbs" style="display:flex;gap:8px;align-items:center;color:var(--muted);font-size:13px;margin-bottom:24px"><a href="/">Home</a><span>/</span><a href="/games">Categories</a><span>/</span><span>${escapeHtml(category)}</span></div><div class="section-head"><div><p class="eyebrow">BROWSER GAMES</p><h1>${escapeHtml(category)} Games</h1></div></div><p class="section-intro">${escapeHtml(description)} Discover free games below and start playing directly in your browser.</p><div class="game-grid">${gameMarkup}</div><section class="content-panel" style="margin-top:40px"><p class="eyebrow">CATEGORY GUIDE</p><h2>How to Explore ${escapeHtml(category)} Browser Games</h2>${(CATEGORY_EDITORIAL[categorySlug]?.sections || []).map(([heading,text]) => `<section style="margin-top:28px"><h3>${escapeHtml(heading)}</h3><p>${escapeHtml(text)}</p></section>`).join("")}<p style="margin-top:28px">Use this catalogue as a starting point rather than a guarantee that every game will feel the same. Titles can differ in controls, pace, difficulty, screen layout and device support even when they share a category. Open an individual game page for the available title information and gameplay context before starting.</p>${CURATED_CATEGORIES.has(categorySlug) ? `<div style="margin-top:26px"><p class="eyebrow">RELATED BRAINROTGAMES GUIDES</p><div class="sidebar-links">${(CATEGORY_GUIDES[categorySlug] || []).map(([label,url]) => `<a href="${url}">${escapeHtml(label)} →</a>`).join("")}</div></div>` : `<p class="article-note" style="margin-top:24px">This is a catalogue category. Our main editorial guides cover game selection, performance, mobile play, controls and other practical topics.</p>`}</section></main><footer class="site-footer"><div class="container footer-inner"><div class="footer-brand"><strong>BrainrotGames</strong><span>Free browser games, available to play online.</span></div><nav class="footer-links" aria-label="Footer navigation"><a href="/about.html">About Us</a><a href="/contact.html">Contact Us</a><a href="/privacy.html">Privacy Policy</a><a href="/cookies.html">Cookie Policy</a><a href="/terms.html">Terms of Service</a></nav></div></footer></body></html>`;
  const breadcrumbSchema = { "@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": [ { "@type": "ListItem", "position": 1, "name": "Home", "item": `${SITE_URL}/` }, { "@type": "ListItem", "position": 2, "name": "Categories", "item": `${SITE_URL}/games` }, { "@type": "ListItem", "position": 3, "name": `${category} Games`, "item": canonical } ] };
  const renderedHtml = injectJsonLd(html, "breadcrumb-schema-server", breadcrumbSchema);
  const response = new Response(renderedHtml, { status: 200, headers: { "content-type": "text/html; charset=utf-8", "cache-control": `public, max-age=60, s-maxage=${CACHE_TTL}, stale-while-revalidate=86400` } });
  context.waitUntil(cache.put(cacheKey, response.clone())); return response;
}
