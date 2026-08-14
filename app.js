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


/* =========================
   HELPERS
========================= */

function esc(value = "") {
  return String(value).replace(
    /[&<>"']/g,
    (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    })[char]
  );
}


function slug(value = "") {
  return value
    .toString()
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}


/* =========================
   NORMALIZE GAME DATA
========================= */

function normalizeGame(g) {
  return {
    id:
      g.id ??
      g.namespace ??
      "",

    title:
      g.title ??
      "Untitled game",

    description:
      g.description ??
      "",

    category:
      g.category ??
      "Other",

    image:
      g.banner_image ||
      g.image ||
      g.thumbnailUrl ||
      g.thumbnailUrl100 ||
      "",

    url:
      g.url ||
      g.game_url ||
      "",

    width: g.width,
    height: g.height
  };
}


/* =========================
   FETCH GAMEPIX FEED
========================= */

async function fetchGames(page = 1, category = "All") {
  const params = new URLSearchParams({
    page: String(page),
    category
  });

  const res = await fetch(
    `/api/games?${params.toString()}`,
    {
      headers: {
        Accept: "application/json"
      }
    }
  );

  if (!res.ok) {
    throw new Error(
      `Feed request failed (${res.status})`
    );
  }

  return res.json();
}


/* =========================
   CATEGORY NAVIGATION
========================= */

let cachedCategories = [];


function renderCategories(games) {
  const categories = [
    "All",
    ...new Set(
      games
        .map((g) => g.category)
        .filter(Boolean)
    )
  ].slice(0, 18);

  categoryRow.innerHTML = categories
    .map((category) => {

      const active =
        category === state.category;

      return `
        <button
          type="button"
          class="category ${active ? "active" : ""}"
          data-category="${esc(category)}"
        >
          ${esc(
            category === "All"
              ? "All Games"
              : category
          )}
        </button>
      `;
    })
    .join("");


  categoryRow
    .querySelectorAll(".category")
    .forEach((btn) => {

      btn.addEventListener("click", () => {

        const selectedCategory =
          btn.dataset.category;

        state.category =
          selectedCategory;

        state.page = 1;
        state.games = [];
        state.hasMore = true;

        clearFilter.hidden =
          state.category === "All";

        titleEl.textContent =
          state.category === "All"
            ? "Popular Browser Games"
            : `${state.category} Games`;

        grid.innerHTML = "";

        statusEl.textContent =
          "Loading games…";

        /*
         * Keep category buttons visible
         * while the new feed loads.
         */
        renderCategories(
          cachedCategories.length
            ? cachedCategories
            : games
        );

        load();
      });

    });
}


/* =========================
   FILTERING
========================= */

function filteredGames() {
  const q =
    state.search
      .trim()
      .toLowerCase();

  return state.games.filter((game) => {

    const categoryMatches =
      state.category === "All" ||
      game.category === state.category;

    const searchMatches =
      !q ||
      `${game.title} ${game.description} ${game.category}`
        .toLowerCase()
        .includes(q);

    return (
      categoryMatches &&
      searchMatches
    );
  });
}


/* =========================
   RENDER GAME CARDS
========================= */

function render() {
  const games =
    filteredGames();

  if (!games.length) {

    grid.innerHTML = `
      <div class="empty">
        <strong>
          No games found.
        </strong>

        <br><br>

        Try another search or category.
      </div>
    `;

    return;
  }


  grid.innerHTML = games
    .map((game) => {

      /*
       * IMPORTANT:
       * Game pages use /play.html
       */
      const gameUrl =
        `/play.html?id=${encodeURIComponent(
          game.id
        )}&title=${encodeURIComponent(
          slug(game.title)
        )}`;


      return `
        <article class="game-card">

          <a
            href="${gameUrl}"
            aria-label="Play ${esc(game.title)}"
          >

            <div class="thumb">

              <div class="fallback">
                🎮
              </div>

              ${
                game.image
                  ? `
                    <img
                      src="${esc(game.image)}"
                      alt="${esc(game.title)}"
                      loading="lazy"
                      referrerpolicy="no-referrer"
                      onerror="this.style.display='none'"
                    >
                  `
                  : ""
              }

            </div>


            <div class="card-body">

              <div class="game-title">
                ${esc(game.title)}
              </div>


              <div class="game-meta">

                <span>
                  ${esc(game.category)}
                </span>

                <span>
                  ▶ Play
                </span>

              </div>


              <div class="play-btn">
                Play Now
              </div>

            </div>

          </a>

        </article>
      `;
    })
    .join("");
}


/* =========================
   LOAD GAMES
========================= */

async function load() {

  if (
    state.loading ||
    !state.hasMore
  ) {
    return;
  }

  state.loading = true;

  statusEl.textContent =
    state.page === 1
      ? "Loading games…"
      : "Loading more…";


  try {

    const data =
      await fetchGames(
        state.page,
        state.category
      );


    const incoming =
      Array.isArray(data.items)
        ? data.items.map(normalizeGame)
        : [];


    /*
     * Prevent duplicate games.
     */
    const seen =
      new Set(
        state.games.map(
          (game) => String(game.id)
        )
      );


    for (const game of incoming) {

      /*
       * Ignore malformed records
       * without an identifier.
       */
      if (!game.id) {
        continue;
      }

      const key =
        String(game.id);


      if (!seen.has(key)) {

        state.games.push(game);

        seen.add(key);
      }
    }


    /*
     * Keep a copy of games available
     * for category navigation.
     */
    cachedCategories =
      state.games.slice();


    /*
     * Determine whether another page exists.
     */
    state.hasMore =
      Boolean(
        data.next_page_url ||
        data.next_url ||
        incoming.length >= 12
      );


    /*
     * Render categories on initial
     * catalogue load.
     */
    if (state.page === 1) {

      renderCategories(
        state.games
      );
    }


    render();


    statusEl.textContent =
      state.games.length === 1
        ? "1 game available"
        : `${state.games.length} games loaded`;


    /*
     * Hide Load More when there
     * are no additional games.
     */
    loadMore.style.display =
      state.hasMore
        ? ""
        : "none";

  } catch (err) {

    console.error(err);

    statusEl.textContent =
      "Game feed unavailable";


    if (!state.games.length) {

      grid.innerHTML = `
        <div class="empty">

          <strong>
            Game library couldn't be loaded.
          </strong>

          <br><br>

          Please refresh the page and try again.

        </div>
      `;
    }

  } finally {

    state.loading = false;
  }
}


/* =========================
   SEARCH
========================= */

searchEl.addEventListener(
  "input",
  (event) => {

    state.search =
      event.target.value;

    render();
  }
);


/* =========================
   CLEAR CATEGORY FILTER
========================= */

clearFilter.addEventListener(
  "click",
  () => {

    state.category = "All";

    state.page = 1;

    state.games = [];

    state.hasMore = true;

    clearFilter.hidden = true;

    titleEl.textContent =
      "Popular Browser Games";

    grid.innerHTML = "";

    statusEl.textContent =
      "Loading games…";


    renderCategories(
      cachedCategories
    );


    load();
  }
);


/* =========================
   LOAD MORE
========================= */

loadMore.addEventListener(
  "click",
  () => {

    if (
      state.loading ||
      !state.hasMore
    ) {
      return;
    }

    state.page += 1;

    load();
  }
);


/* =========================
   INITIAL LOAD
========================= */

load();
