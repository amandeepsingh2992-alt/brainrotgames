import fs from "node:fs";

const read = path => fs.readFileSync(path, "utf8");
const fail = message => { throw new Error(message); };
const assert = (condition, message) => condition || fail(message);

const home = read("index.html");
for (const required of [
  'id="game-grid"', 'id="search"', 'href="/guides/"',
  'href="/guides/how-we-select-games"', 'third-party distribution feed',
  'game’s own instructions remain the source of truth'
]) assert(home.includes(required), `Homepage is missing the required reader-facing element: ${required}`);
for (const retired of ["What Are Browser Games?", "BrainrotGames Overview", "loadExploreGames", "explore-game-grid"]) {
  assert(!home.includes(retired), `Homepage still contains retired duplicate-content material: ${retired}`);
}

const play = read("play.html");
assert(/noindex,follow/i.test(play), "Game player must remain noindex,follow");
assert(!play.includes("adsbygoogle.js"), "Noindex game player must not load the AdSense script");
for (const retired of ["About This Game", "What to Expect", "Gameplay Overview", "Who Is This Game For", "How to Get More", "Tips for"]) {
  assert(!play.includes(retired), `Game player still contains fabricated per-game editorial copy: ${retired}`);
}

const category = read("functions/games/[category].js");
assert(category.includes('content="noindex,follow"'), "Catalogue category pages must be noindex,follow");
assert(!category.includes("CATEGORY_EDITORIAL"), "Catalogue category pages must not generate generic editorial sections");
assert(!category.includes("adsbygoogle.js"), "Catalogue category pages must not contain AdSense code");
assert(category.includes("BLOCKED_GAME_IDS"), "Catalogue category pages must use the shared game blocklist");

const guideRouter = read("functions/guides/[slug].js");
for (const slug of ["brainrot-clicker-progression", "finding-browser-games-without-downloads", "browser-game-session-planning"]) {
  assert(guideRouter.includes(`"${slug}"`), `Legacy guide redirect is missing: ${slug}`);
}
assert(guideRouter.includes('slugValue !== "how-we-select-games"'), "Guide router must keep the one catalogue-transparency page");

const sitemap = read("functions/sitemap.xml.js");
for (const path of ["brainrot-games.html", "how-we-select-games", "browser-game-controls-guide.html", "browser-game-safety-and-privacy.html"]) {
  assert(sitemap.includes(path), `Sitemap is missing retained editorial URL: ${path}`);
}
for (const retired of ["brainrot-clicker-progression", "casual-arcade-puzzle-games", '"/games/']) {
  assert(!sitemap.includes(retired), `Sitemap still advertises retired or thin URL: ${retired}`);
}

const gameApi = read("functions/api/game.js");
assert(gameApi.includes("validateGamePixEmbed"), "Game route must validate provider embeds");
assert(!gameApi.includes("Fast deterministic fallback"), "Game route must not invent provider records from a slug");
assert(!gameApi.includes("Play ${requestedTitle} online for free on BrainrotGames."), "Game route must not fabricate a generic listing description");

const routes = JSON.parse(read("_routes.json"));
for (const route of ["/api/*", "/play", "/games", "/games/*", "/guides/*", "/sitemap.xml"]) {
  assert(routes.include.includes(route), `Missing function route: ${route}`);
}
const workflow = read(".github/workflows/game-qa.yml");
assert(workflow.includes("scripts/site-structure-qa.mjs"), "Workflow must run structural editorial QA");
assert(workflow.includes("scripts/full-site-qa.mjs"), "Workflow must run full site QA");

console.log("EDITORIAL STRUCTURE QA: PASS");
console.log("Indexed content is scoped to original guides and essential site pages.");
console.log("Catalogue, category, and player routes keep their utility role without fabricated editorial claims.");
