const state = {
  page: 1,
  category: "All",
  search: "",
  games: [],
  loading: false,
  hasMore: true
};

const $ = (id) => document.getElementById(id);
const grid = $("game-grid");
const statusEl = $("status");
const searchEl = $("search");
const categoryRow = $("category-row");
const titleEl = $("games-title");
const loadMore = $("load-more");
const clearFilter = $("clear-filter");

function esc(value="") {
  return String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
}

function slug(value="") {
  return value.toString().toLowerCase().trim().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");
}

function normalizeGame(g) {
  return {
    id: g.id ?? g.namespace ?? Math.random().toString(36).slice(2),
    title: g.title ?? "Untitled game",
    description: g.description ?? "",
    category: g.category ?? "Other",
    image: g.thumbnailUrl || g.thumbnailUrl100 || g.banner_image || g.image || "",
    url: g.url || g.game_url || "",
    width: g.width,
    height: g.height
  };
}

async function fetchGames(page=1, category="All") {
  const params = new URLSearchParams({page:String(page), category});
  const res = await fetch(`/api/games?${params.toString()}`, {headers:{Accept:"application/json"}});
  if (!res.ok) throw new Error(`Feed request failed (${res.status})`);
  return res.json();
}

function renderCategories(games) {
  const categories = ["All", ...new Set(games.map(g => g.category).filter(Boolean))].slice(0,18);
  categoryRow.innerHTML = categories.map(c =>
    `<button class="category ${c===state.category?'active':''}" data-category="${esc(c)}">${esc(c)}</button>`
  ).join("");
  categoryRow.querySelectorAll(".category").forEach(btn => btn.addEventListener("click", () => {
    state.category = btn.dataset.category;
    state.page = 1;
    state.games = [];
    clearFilter.hidden = state.category === "All";
    titleEl.textContent = state.category === "All" ? "Top games" : state.category;
    renderCategories(state.games.length ? state.games : cachedCategories);
    load();
  }));
}

let cachedCategories = [];

function filteredGames() {
  const q = state.search.trim().toLowerCase();
  return state.games.filter(g => {
    const catOk = state.category === "All" || g.category === state.category;
    const qOk = !q || `${g.title} ${g.description} ${g.category}`.toLowerCase().includes(q);
    return catOk && qOk;
  });
}

function render() {
  const games = filteredGames();
  if (!games.length) {
    grid.innerHTML = `<div class="empty">No games found. Try another search or category.</div>`;
    return;
  }
  grid.innerHTML = games.map(g => `
    <article class="game-card">
      <a href="/play.html?id=${encodeURIComponent(g.id)}&title=${encodeURIComponent(slug(g.title))}">
        <div class="thumb">
          <div class="fallback">🎮</div>
          ${g.image ? `<img src="${esc(g.image)}" alt="${esc(g.title)}" loading="lazy" onerror="this.remove()">` : ""}
        </div>
        <div class="card-body">
          <div class="game-title">${esc(g.title)}</div>
          <div class="game-meta"><span>${esc(g.category)}</span><span>▶ Play</span></div>
          <div class="play-btn">Play now</div>
        </div>
      </a>
    </article>
  `).join("");
}

async function load() {
  if (state.loading || !state.hasMore) return;
  state.loading = true;
  statusEl.textContent = state.page === 1 ? "Loading games…" : "Loading more…";
  try {
    const data = await fetchGames(state.page, state.category);
    const incoming = Array.isArray(data.items) ? data.items.map(normalizeGame) : [];
    const seen = new Set(state.games.map(g => String(g.id)));
    for (const g of incoming) if (!seen.has(String(g.id))) state.games.push(g);
    cachedCategories = state.games.slice();
    state.hasMore = Boolean(data.next_page_url || data.next_url || incoming.length >= 12);
    if (state.page === 1) renderCategories(state.games);
    render();
    statusEl.textContent = `${state.games.length} games loaded`;
  } catch (err) {
    console.error(err);
    statusEl.textContent = "Feed unavailable";
    if (!state.games.length) {
      grid.innerHTML = `<div class="empty"><strong>Game feed couldn't be loaded.</strong><br><br>Please check the GamePix publisher feed and try again.</div>`;
    }
  } finally {
    state.loading = false;
  }
}

searchEl.addEventListener("input", e => {
  state.search = e.target.value;
  render();
});
clearFilter.addEventListener("click", () => {
  state.category = "All";
  state.page = 1;
  state.games = [];
  clearFilter.hidden = true;
  titleEl.textContent = "Top games";
  load();
});
loadMore.addEventListener("click", () => {
  state.page += 1;
  load();
});

load();
