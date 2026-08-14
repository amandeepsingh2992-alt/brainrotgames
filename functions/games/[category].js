const SITE_URL = "https://brainrotgames.me";
const FEED = "https://feeds.gamepix.com/v2/json?sid=E158N&pagination=12&page=";
const MAX_FEED_PAGES = 30;
const PAGE_BATCH_SIZE = 5;

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
  return String(value).replace(/[&<>\"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '\"': "&quot;",
    "'": "&#039;"
  }[char]));
}

function slug(value = "") {
  return String(value)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function categoryMatches(gameCategory = "", requestedSlug = "") {
  const gameSlug = slug(gameCategory);
  if (!gameSlug || !requestedSlug) return false;

  // Exact match first.
  if (gameSlug === requestedSlug) return true;

  // Match common GamePix variants such as word-games, puzzle-game, sports-games, etc.
  const gameParts = gameSlug.split("-");
  const requestedParts = requestedSlug.split("-");

  if (requestedParts.every((part) => gameParts.includes(part))) return true;
  if (gameSlug.startsWith(`${requestedSlug}-`)) return true;
  if (gameSlug.endsWith(`-${requestedSlug}`)) return true;
  if (gameSlug.includes(`-${requestedSlug}-`)) return true;

  return false;
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
  const image = game.banner_image || game.image || game.thumbnailUrl || game.thumbnailUrl100 || "";

  return `
    <article class="game-card">
      <a href="${escapeHtml(gameUrl(game))}" aria-label="Play ${escapeHtml(title)}">
        <div class="thumb">
          <div class="fallback">🎮</div>
          ${image ? `<img src="${escapeHtml(image)}" alt="${escapeHtml(title)}" loading="lazy" referrerpolicy="no-referrer">` : ""}
        </div>
        <div class="card-body">
          <div class="game-title">${escapeHtml(title)}</div>
          <div class="game-meta">
            <span>${escapeHtml(category)}</span>
            <span>▶ Play</span>
          </div>
          <div class="play-btn">Play Now</div>
        </div>
      </a>
    </article>
  `;
}

async function fetchFeedPage(page) {
  try {
    const response = await fetch(`${FEED}${page}`, {
      headers: { Accept: "application/json" }
    });

    if (!response.ok) return [];

    const data = await response.json();
    return Array.isArray(data.items) ? data.items : [];
  } catch (error) {
    console.error(`GamePix category fetch failed for page ${page}:`, error);
    return [];
  }
}

async function fetchCategoryGames(requestedSlug) {
  const seen = new Set();
  const matches = [];

  // Search the feed in small parallel batches. This gives sparse categories
  // (especially Word/Card/Board) enough depth without firing 30 requests at once.
  for (let start = 1; start <= MAX_FEED_PAGES; start += PAGE_BATCH_SIZE) {
    const pages = [];

    for (
      let page = start;
      page < start + PAGE_BATCH_SIZE && page <= MAX_FEED_PAGES;
      page += 1
    ) {
      pages.push(page);
    }

    const pageResults = await Promise.all(pages.map(fetchFeedPage));

    for (const pageItems of pageResults) {
      for (const game of pageItems) {
        const id = String(game.id ?? game.namespace ?? "");
        if (!id || seen.has(id)) continue;
        seen.add(id);

        if (categoryMatches(game.category, requestedSlug)) {
          matches.push(game);
        }

        if (matches.length >= 24) return matches;
      }
    }
  }

  return matches;
}

export async function onRequestGet(context) {
  const rawCategory = String(context.params.category || "").trim();
  const categorySlug = slug(rawCategory);
  const category = categorySlug
    .replace(/-/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());

  if (!categorySlug) {
    return Response.redirect(`${SITE_URL}/games`, 301);
  }

  const description = CATEGORY_COPY[categorySlug] || `Browse ${category} browser games and play them online for free.`;
  let games = [];

  try {
    games = await fetchCategoryGames(categorySlug);
  } catch (error) {
    console.error("Category page feed error:", error);
  }

  const title = `${category} Games - Play Free Online | BrainrotGames`;
  const canonical = `${SITE_URL}/games/${categorySlug}`;
  const gameMarkup = games.length
    ? games.map(gameCard).join("\n")
    : `<div class="empty"><strong>No games are available in this category right now.</strong><br><br>Check back soon or browse another category.</div>`;

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="robots" content="index,follow">
  <meta name="description" content="${escapeHtml(description)}">
  <title>${escapeHtml(title)}</title>
  <link rel="canonical" href="${escapeHtml(canonical)}">
  <link rel="stylesheet" href="/styles.css">
</head>
<body>
  <header class="site-header">
    <div class="container nav">
      <a class="brand" href="/" aria-label="BrainrotGames home">
        <span class="brand-mark">BG</span>
        <span>Brainrot<span>Games</span></span>
      </a>
      <nav aria-label="Main navigation">
        <a href="/">Home</a>
        <a href="/games">Categories</a>
        <a href="/#games">Games</a>
      </nav>
    </div>
  </header>

  <main class="container section">
    <div class="breadcrumbs" style="display:flex;gap:8px;align-items:center;color:var(--muted);font-size:13px;margin-bottom:24px;">
      <a href="/">Home</a><span>/</span><a href="/games">Categories</a><span>/</span><span>${escapeHtml(category)}</span>
    </div>

    <div class="section-head">
      <div>
        <p class="eyebrow">BROWSER GAMES</p>
        <h1>${escapeHtml(category)} Games</h1>
      </div>
    </div>

    <p class="section-intro">${escapeHtml(description)} Discover free games below and start playing directly in your browser.</p>

    <div class="game-grid">
      ${gameMarkup}
    </div>

    <section class="content-panel" style="margin-top:40px;">
      <p class="eyebrow">ABOUT THIS CATEGORY</p>
      <h2>Free ${escapeHtml(category)} Browser Games</h2>
      <p>${escapeHtml(description)} BrainrotGames makes it easy to discover browser games without installing a separate game client.</p>
      <p>Choose a game above to view its details and start playing online. Game availability, descriptions and artwork may change as the third-party game catalogue is updated.</p>
    </section>
  </main>

  <footer class="site-footer">
    <div class="container footer-inner">
      <div class="footer-brand"><strong>BrainrotGames</strong><span>Free browser games, available to play online.</span></div>
      <nav class="footer-links" aria-label="Footer navigation">
        <a href="/about.html">About Us</a>
        <a href="/contact.html">Contact Us</a>
        <a href="/privacy.html">Privacy Policy</a>
        <a href="/cookies.html">Cookie Policy</a>
        <a href="/terms.html">Terms of Service</a>
      </nav>
    </div>
  </footer>
</body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "public, max-age=300"
    }
  });
}
