import { BLOCKED_GAME_IDS } from "../lib/gamepix.js";

const SITE_URL = "https://brainrotgames.me";
const FEED = "https://feeds.gamepix.com/v2/json?sid=E158N&pagination=12&page=";
const MAX_PAGES = 10;
const CACHE_TTL = 1800;

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[character]));
}
function slug(value = "") {
  return String(value).toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
function categoryMatches(game, requested) {
  const wanted = slug(requested);
  const values = [game?.category, ...(Array.isArray(game?.categories) ? game.categories : []), ...(Array.isArray(game?.tags) ? game.tags : [])];
  return values.some(value => {
    const current = slug(typeof value === "object" ? value?.slug || value?.name || "" : value);
    return current === wanted || current === `${wanted}s` || wanted === `${current}s`;
  });
}
function getItems(payload) {
  return Array.isArray(payload?.items) ? payload.items : Array.isArray(payload?.games) ? payload.games : Array.isArray(payload) ? payload : [];
}
async function findGames(category) {
  const found = []; const seen = new Set();
  const pages = Array.from({ length: MAX_PAGES }, (_, index) => index + 1);
  const results = await Promise.all(pages.map(async page => {
    try { const response = await fetch(FEED + page, { headers: { Accept: "application/json" }, cf: { cacheTtl: 900, cacheEverything: true } }); return response.ok ? getItems(await response.json()) : []; }
    catch { return []; }
  }));
  for (const games of results) for (const game of games) {
    const id = String(game?.id ?? game?.namespace ?? "");
    if (!id || BLOCKED_GAME_IDS.has(id) || seen.has(id) || !categoryMatches(game, category)) continue;
    seen.add(id); found.push(game);
    if (found.length === 24) return found;
  }
  return found;
}
function gameCard(game) {
  const id = String(game?.id ?? game?.namespace ?? "");
  const title = String(game?.title || "Browser game");
  const category = String(game?.category || "Browser game");
  const image = game?.banner_image || game?.image || game?.thumbnailUrl || game?.thumbnail_url || "";
  const url = new URL("/play", SITE_URL); url.searchParams.set("id", id); url.searchParams.set("title", slug(title));
  return `<article class="game-card"><a href="${escapeHtml(url.toString())}" aria-label="Open ${escapeHtml(title)}"><div class="thumb"><div class="fallback">🎮</div>${image ? `<img src="${escapeHtml(image)}" alt="${escapeHtml(title)}" loading="lazy" decoding="async" referrerpolicy="no-referrer">` : ""}</div><div class="card-body"><div class="game-title">${escapeHtml(title)}</div><div class="game-meta"><span>${escapeHtml(category)}</span><span>Play online</span></div><span class="play-btn">Open game</span></div></a></article>`;
}

export async function onRequestGet(context) {
  const requestUrl = new URL(context.request.url);
  const categorySlug = slug(context.params.category || "");
  if (!categorySlug) return Response.redirect(`${SITE_URL}/games`, 301);

  const cacheKey = new Request(`${requestUrl.origin}/__catalogue-category-v3/${categorySlug}`, { method: "GET" });
  const cache = caches.default; const cached = await cache.match(cacheKey);
  if (cached) return cached;

  const category = categorySlug.replace(/-/g, " ").replace(/\b\w/g, character => character.toUpperCase());
  const games = await findGames(categorySlug);
  const cards = games.length ? games.map(gameCard).join("\n") : '<div class="empty"><strong>No matching games are available right now.</strong><br><br><a href="/games">Browse another catalogue category</a>.</div>';
  const canonical = `${SITE_URL}/games/${categorySlug}`;
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,follow"><meta name="description" content="Browse the current ${escapeHtml(category)} games in the BrainrotGames catalogue."><title>${escapeHtml(category)} Games | BrainrotGames</title><link rel="canonical" href="${escapeHtml(canonical)}"><link rel="stylesheet" href="/styles.css"></head><body><header class="site-header"><div class="container nav"><a class="brand" href="/" aria-label="BrainrotGames home"><span class="brand-mark">BG</span><span>Brainrot<span>Games</span></span></a><nav aria-label="Main navigation"><a href="/">Home</a><a href="/#games">Games</a><a href="/games">Categories</a><a href="/guides/">Guides</a></nav></div></header><main class="container section"><div class="breadcrumbs" style="display:flex;gap:8px;align-items:center;color:var(--muted);font-size:13px;margin-bottom:24px"><a href="/">Home</a><span>/</span><a href="/games">Categories</a><span>/</span><span>${escapeHtml(category)}</span></div><div class="section-head"><div><p class="eyebrow">CATALOGUE FILTER</p><h1>${escapeHtml(category)} games</h1></div></div><p class="section-intro">These results match a category supplied by the game distributor. A category is a browsing aid; read each game’s current instructions for its specific controls and rules.</p><div class="game-grid">${cards}</div><p class="article-note" style="margin-top:30px"><a href="/guides/how-to-evaluate-a-browser-game.html">Use the two-minute game check</a> before committing to an unfamiliar title.</p></main><footer class="site-footer"><div class="container footer-inner"><div class="footer-brand"><strong>BrainrotGames</strong><span>Free browser games and practical play guides.</span></div><nav class="footer-links" aria-label="Footer navigation"><a href="/about.html">About</a><a href="/contact.html">Contact</a><a href="/privacy.html">Privacy</a><a href="/terms.html">Terms</a></nav></div></footer></body></html>`;
  const response = new Response(html, { status: 200, headers: { "content-type": "text/html; charset=utf-8", "cache-control": `public, max-age=60, s-maxage=${CACHE_TTL}, stale-while-revalidate=86400` } });
  context.waitUntil(cache.put(cacheKey, response.clone()));
  return response;
}
