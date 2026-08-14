const SITE_URL = "https://brainrotgames.me";
const FEED = "https://feeds.gamepix.com/v2/json?sid=E158N&pagination=12&page=";
const MAX_FEED_PAGES = 30;
const BATCH = 5;

const CATEGORY_COPY = {
  action: "Fast-paced browser games with combat, reflexes and quick challenges.",
  adventure: "Explore browser games built around discovery, exploration and challenges.",
  arcade: "Quick-play browser games focused on skill, reflexes and score chasing.",
  casual: "Easy-to-start browser games for quick sessions and relaxed play.",
  puzzle: "Brain teasers, matching, logic and problem-solving browser games.",
  racing: "Browser racing games featuring cars, speed, drifting and driving challenges.",
  sports: "Browser sports games covering competitive and arcade-style play.",
  strategy: "Browser strategy games built around planning, tactics and decisions.",
  simulation: "Browser simulation games that let you manage, build and experiment.",
  board: "Classic and modern board-style browser games you can play online.",
  card: "Browser card games for quick matches and strategic play.",
  word: "Word and vocabulary browser games for quick brain-training sessions."
};

function escapeHtml(value = "") {
  return String(value).replace(/[&<>\"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#039;"
  }[c]));
}

function slug(value = "") {
  return String(value).toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function categoryEquivalent(a, b) {
  a = slug(a); b = slug(b);
  if (!a || !b) return false;
  if (a === b) return true;
  if (a === `${b}s` || b === `${a}s`) return true;
  if (a.endsWith("ies") && `${a.slice(0, -3)}y` === b) return true;
  if (b.endsWith("ies") && `${b.slice(0, -3)}y` === a) return true;
  return false;
}

function categoryValues(game) {
  const values = [];
  const add = value => {
    if (typeof value === "string") values.push(value);
    else if (value && typeof value === "object") {
      values.push(value.slug, value.name, value.title, value.category);
    }
  };
  add(game?.category);
  for (const key of ["categories", "tags", "genres"]) {
    const value = game?.[key];
    if (Array.isArray(value)) value.forEach(add);
    else add(value);
  }
  return values.filter(Boolean);
}

function matches(game, requested) {
  return categoryValues(game).some(value => {
    const s = slug(value);
    const r = slug(requested);
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
    const response = await fetch(url.toString(), { headers: { Accept: "application/json" } });
    if (!response.ok) return [];
    return extractGames(await response.json());
  } catch (error) {
    console.error("GamePix feed error:", error);
    return [];
  }
}

async function fetchCategoryGames(requested) {
  const seen = new Set();
  const found = [];

  // First ask GamePix directly for the requested category. This is important
  // for sparse categories that may not occur in the first feed pages.
  for (let start = 1; start <= MAX_FEED_PAGES; start += BATCH) {
    const pages = [];
    for (let p = start; p < start + BATCH && p <= MAX_FEED_PAGES; p++) pages.push(p);
    const results = await Promise.all(pages.map(p => fetchPage(p, requested)));

    for (const games of results) {
      for (const game of games) {
        const id = String(game?.id ?? game?.namespace ?? "");
        if (!id || seen.has(id)) continue;
        seen.add(id);
        if (matches(game, requested)) found.push(game);
        if (found.length >= 24) return found;
      }
    }
  }

  // Fallback: some feed versions ignore the category parameter. Search the
  // unfiltered feed too, using all known category/tag/genre fields.
  if (!found.length) {
    for (let start = 1; start <= MAX_FEED_PAGES; start += BATCH) {
      const pages = [];
      for (let p = start; p < start + BATCH && p <= MAX_FEED_PAGES; p++) pages.push(p);
      const results = await Promise.all(pages.map(p => fetchPage(p)));
      for (const games of results) {
        for (const game of games) {
          const id = String(game?.id ?? game?.namespace ?? "");
          if (!id || seen.has(id)) continue;
          seen.add(id);
          if (matches(game, requested)) found.push(game);
          if (found.length >= 24) return found;
        }
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
  const title = game.title || "Untitled game";
  const category = game.category || "Browser Game";
  const image = game.banner_image || game.image || game.thumbnailUrl || game.thumbnailUrl100 || game.thumbnail_url || "";
  return `<article class="game-card"><a href="${escapeHtml(gameUrl(game))}" aria-label="Play ${escapeHtml(title)}"><div class="thumb"><div class="fallback">🎮</div>${image ? `<img src="${escapeHtml(image)}" alt="${escapeHtml(title)}" loading="lazy" referrerpolicy="no-referrer">` : ""}</div><div class="card-body"><div class="game-title">${escapeHtml(title)}</div><div class="game-meta"><span>${escapeHtml(category)}</span><span>▶ Play</span></div><div class="play-btn">Play Now</div></div></a></article>`;
}

export async function onRequestGet(context) {
  const categorySlug = slug(context.params.category || "");
  if (!categorySlug) return Response.redirect(`${SITE_URL}/games`, 301);

  const category = categorySlug.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase());
  const description = CATEGORY_COPY[categorySlug] || `Browse ${category} browser games and play them online for free.`;
  let games = [];
  try { games = await fetchCategoryGames(categorySlug); }
  catch (error) { console.error("Category page error:", error); }

  const title = `${category} Games - Play Free Online | BrainrotGames`;
  const canonical = `${SITE_URL}/games/${categorySlug}`;
  const gameMarkup = games.length ? games.map(gameCard).join("\n") : `<div class="empty"><strong>No games are available in this category right now.</strong><br><br>Check back soon or browse another category.</div>`;

  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="index,follow"><meta name="description" content="${escapeHtml(description)}"><title>${escapeHtml(title)}</title><link rel="canonical" href="${escapeHtml(canonical)}"><link rel="stylesheet" href="/styles.css"></head><body>
<header class="site-header"><div class="container nav"><a class="brand" href="/" aria-label="BrainrotGames home"><span class="brand-mark">BG</span><span>Brainrot<span>Games</span></span></a><nav aria-label="Main navigation"><a href="/">Home</a><a href="/games">Categories</a><a href="/#games">Games</a></nav></div></header>
<main class="container section"><div class="breadcrumbs" style="display:flex;gap:8px;align-items:center;color:var(--muted);font-size:13px;margin-bottom:24px"><a href="/">Home</a><span>/</span><a href="/games">Categories</a><span>/</span><span>${escapeHtml(category)}</span></div><div class="section-head"><div><p class="eyebrow">BROWSER GAMES</p><h1>${escapeHtml(category)} Games</h1></div></div><p class="section-intro">${escapeHtml(description)} Discover free games below and start playing directly in your browser.</p><div class="game-grid">${gameMarkup}</div><section class="content-panel" style="margin-top:40px"><p class="eyebrow">ABOUT THIS CATEGORY</p><h2>Free ${escapeHtml(category)} Browser Games</h2><p>${escapeHtml(description)} BrainrotGames makes it easy to discover browser games without installing a separate game client.</p><p>Choose a game above to view its details and start playing online. Game availability, descriptions and artwork may change as the third-party game catalogue is updated.</p></section></main>
<footer class="site-footer"><div class="container footer-inner"><div class="footer-brand"><strong>BrainrotGames</strong><span>Free browser games, available to play online.</span></div><nav class="footer-links" aria-label="Footer navigation"><a href="/about.html">About Us</a><a href="/contact.html">Contact Us</a><a href="/privacy.html">Privacy Policy</a><a href="/cookies.html">Cookie Policy</a><a href="/terms.html">Terms of Service</a></nav></div></footer></body></html>`;

  return new Response(html, { status: 200, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=300" } });
}
