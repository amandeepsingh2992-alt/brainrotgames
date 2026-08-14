const state = { page: 1, category: "All", search: "", games: [], loading: false, hasMore: true };
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
    title: g.title ?? "Untitled game",
    description: g.description ?? "",
    category: g.category ?? "Other",
    image: g.banner_image || g.image || g.thumbnailUrl || g.thumbnailUrl100 || g.thumbnail_url || "",
    url: g.url || g.game_url || "",
    width: g.width,
    height: g.height
  };
}
async function fetchGames(page = 1, category = "All") {
  const params = new URLSearchParams({ page: String(page), category });
  const res = await fetch(`/api/games?${params.toString()}`, { headers: { Accept: "application/json" }, cache: "force-cache" });
  if (!res.ok) throw new Error(`Feed request failed (${res.status})`);
  return res.json();
}

function renderCategories() {
  // Keep the complete category directory server-rendered in index.html.
  // Only update its active state; never replace the full category list.
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
    const gameUrl = `/play?id=${encodeURIComponent(game.id)}&title=${encodeURIComponent(slug(game.title))}`;
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
    const incoming = Array.isArray(data.items) ? data.items.map(normalizeGame) : [];
    const seen = new Set(state.games.map(game => String(game.id)));
    for (const game of incoming) {
      const id = String(game.id);
      if (!seen.has(id)) { state.games.push(game); seen.add(id); }
    }
    state.hasMore = Boolean(data.next_page_url || data.next_url || incoming.length >= 12);
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

let searchTimer;
if (searchEl) {
  searchEl.addEventListener("input", event => {
    state.search = event.target.value;
    clearTimeout(searchTimer);
    searchTimer = setTimeout(render, 80);
  }, { passive: true });
}
if (clearFilter) {
  clearFilter.addEventListener("click", () => {
    state.category = "All"; state.page = 1; state.games = []; state.hasMore = true;
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
load();
