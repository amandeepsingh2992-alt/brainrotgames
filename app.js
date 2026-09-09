const state = { page: 1, category: "All", search: "", games: [], loading: false, hasMore: true, searchRun: 0 };
const $ = id => document.getElementById(id);
const grid = $("game-grid");
const statusEl = $("status");
const searchEl = $("search");
const categoryRow = $("category-row");
const titleEl = $("games-title");
const loadMore = $("load-more");
const clearFilter = $("clear-filter");

function esc(value = "") {
  return String(value).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}
function slug(value = "") {
  return value.toString().toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
function normalizeGame(g = {}) {
  return {
    id: g.id ?? g.namespace ?? Math.random().toString(36).slice(2),
    namespace: g.namespace ?? "",
    title: g.title ?? "Untitled game",
    description: g.description ?? "",
    category: g.category ?? "Other",
    image: g.banner_image || g.image || g.thumbnailUrl || g.thumbnailUrl100 || g.thumbnail_url || "",
    url: g.url || g.game_url || "",
    width: g.width,
    height: g.height
  };
}
function buildPlayUrl(game) {
  const id = String(game.id ?? game.namespace ?? "").trim();
  const titleSlug = slug(game.title || game.namespace || "game");
  return `/play?id=${encodeURIComponent(id)}&title=${encodeURIComponent(titleSlug)}`;
}
async function fetchGames(page = 1, category = "All") {
  const params = new URLSearchParams({ page: String(page), category });
  const res = await fetch(`/api/games?${params.toString()}`, { headers: { Accept: "application/json" }, cache: "force-cache" });
  if (!res.ok) throw new Error(`Feed request failed (${res.status})`);
  return res.json();
}

function appendGames(data) {
  const incoming = Array.isArray(data.items) ? data.items.map(normalizeGame) : [];
  const seen = new Set(state.games.map(game => String(game.id)));
  for (const game of incoming) {
    const id = String(game.id);
    if (!seen.has(id)) {
      state.games.push(game);
      seen.add(id);
    }
  }
  return incoming.length;
}

function renderCategories() {
  if (!categoryRow) return;
  categoryRow.querySelectorAll("a.category").forEach(link => {
    const isAll = link.getAttribute("href") === "/#games" || link.textContent.trim() === "All Games";
    const active = isAll ? state.category === "All" : false;
    link.classList.toggle("active", active);
    link.setAttribute("aria-current", active ? "page" : "false");
  });
}
function filteredGames() {
  const q = state.search.trim().toLowerCase();
  return state.games.filter(game => {
    const categoryMatches = state.category === "All" || game.category === state.category;
    const searchMatches = !q || `${game.title} ${game.description} ${game.category}`.toLowerCase().includes(q);
    return categoryMatches && searchMatches;
  });
}
function render() {
  const games = filteredGames();
  if (!games.length) {
    grid.innerHTML = `<div class="empty"><strong>No games found.</strong><br><br>Try another search or category.</div>`;
    return;
  }
  grid.innerHTML = games.map((game, index) => {
    const gameUrl = buildPlayUrl(game);
    const dimensions = game.width && game.height ? ` width="${Number(game.width)}" height="${Number(game.height)}"` : "";
    const loading = index < 2 ? "eager" : "lazy";
    const priority = index === 0 ? " fetchpriority=\"low\"" : "";
    return `<article class="game-card"><a href="${gameUrl}" aria-label="Play ${esc(game.title)}"><div class="thumb"><div class="fallback">🎮</div>${game.image ? `<img src="${esc(game.image)}" alt="${esc(game.title)}" loading="${loading}" decoding="async"${priority}${dimensions} referrerpolicy="no-referrer" onerror="this.style.display='none'">` : ""}</div><div class="card-body"><div class="game-title">${esc(game.title)}</div><div class="game-meta"><span>${esc(game.category)}</span><span>▶ Play</span></div><div class="play-btn">Play Now</div></div></a></article>`;
  }).join("");
}

async function load() {
  if (state.loading || !state.hasMore) return;
  state.loading = true;
  statusEl.textContent = state.page === 1 ? "Loading games…" : "Loading more…";
  try {
    const data = await fetchGames(state.page, state.category);
    const incomingLength = appendGames(data);
    state.hasMore = Boolean(data.next_page_url || data.next_url || incomingLength >= 12);
    if (state.page === 1) renderCategories();
    render();
    statusEl.textContent = state.games.length === 1 ? "1 game available" : `${state.games.length} games loaded`;
    loadMore.style.display = state.hasMore ? "" : "none";
  } catch (err) {
    console.error("Game feed error:", err);
    statusEl.textContent = "Game feed unavailable";
    if (!state.games.length) grid.innerHTML = `<div class="empty"><strong>Game library couldn't be loaded.</strong><br><br>Please refresh the page and try again.</div>`;
  } finally {
    state.loading = false;
  }
}

async function searchAllGames(runId) {
  if (!state.search.trim() || state.hasMore === false) return;
  while (state.loading && runId === state.searchRun) await new Promise(resolve => setTimeout(resolve, 50));
  let nextPage = state.page + 1;
  let keepSearching = true;
  while (keepSearching && runId === state.searchRun && state.search.trim()) {
    try {
      statusEl.textContent = `Searching… ${state.games.length} games checked`;
      const data = await fetchGames(nextPage, state.category);
      const incomingLength = appendGames(data);
      state.page = nextPage;
      state.hasMore = Boolean(data.next_page_url || data.next_url || incomingLength >= 12);
      render();
      const matches = filteredGames().length;
      if (matches > 0) statusEl.textContent = matches === 1 ? "1 game found" : `${matches} games found`;
      keepSearching = state.hasMore && incomingLength > 0;
      nextPage += 1;
    } catch (err) {
      console.error("Search feed error:", err);
      keepSearching = false;
    }
  }
  if (runId === state.searchRun && state.search.trim()) {
    const matches = filteredGames().length;
    statusEl.textContent = matches === 1 ? "1 game found" : `${matches} games found`;
    loadMore.style.display = state.hasMore ? "" : "none";
  }
}

let searchTimer;
if (searchEl) {
  searchEl.addEventListener("input", event => {
    state.search = event.target.value;
    state.searchRun += 1;
    const runId = state.searchRun;
    clearTimeout(searchTimer);
    searchTimer = setTimeout(async () => {
      render();
      if (state.search.trim()) await searchAllGames(runId);
      else statusEl.textContent = state.games.length === 1 ? "1 game available" : `${state.games.length} games loaded`;
    }, 80);
  }, { passive: true });
}
if (clearFilter) {
  clearFilter.addEventListener("click", () => {
    state.category = "All"; state.page = 1; state.games = []; state.hasMore = true; state.searchRun += 1;
    clearFilter.hidden = true; titleEl.textContent = "Popular Browser Games"; grid.innerHTML = ""; statusEl.textContent = "Loading games…"; load();
  });
}
if (loadMore) {
  loadMore.addEventListener("click", () => {
    if (state.loading || !state.hasMore) return;
    state.page += 1;
    load();
  });
}

// Make the original editorial section visible from the main navigation and add a compact homepage entry point.
const mainNav = document.querySelector('.site-header nav');
if (mainNav && !mainNav.querySelector('a[href="/guides/"]')) {
  const link = document.createElement('a');
  link.href = '/guides/';
  link.textContent = 'Guides';
  mainNav.appendChild(link);
}
const discoverySection = document.querySelector('.discovery-section');
if (discoverySection && !document.getElementById('editorial-guides-home')) {
  const section = document.createElement('section');
  section.id = 'editorial-guides-home';
  section.className = 'container section';
  section.innerHTML = `<div class="section-head"><div><p class="eyebrow">ORIGINAL GUIDES</p><h2>Gaming Advice From BrainrotGames</h2></div><a class="ghost-btn" href="/guides/">View all guides</a></div><p class="section-intro">Practical advice for choosing games, improving browser performance, playing on mobile and getting better at popular genres.</p><div class="discovery-grid"><a class="discovery-card" href="/guides/choose-browser-game"><span class="discovery-icon">🎯</span><div><strong>Choose the Right Game</strong><span>Match games to your time, device and play style</span></div><span class="discovery-arrow">→</span></a><a class="discovery-card" href="/guides/browser-game-performance"><span class="discovery-icon">⚡</span><div><strong>Improve Performance</strong><span>Troubleshoot loading, lag and browser issues</span></div><span class="discovery-arrow">→</span></a><a class="discovery-card" href="/guides/how-we-select-games"><span class="discovery-icon">🔎</span><div><strong>How We Select Games</strong><span>See how the catalogue and editorial content work</span></div><span class="discovery-arrow">→</span></a></div>`;
  discoverySection.insertAdjacentElement('afterend', section);
}
load();
