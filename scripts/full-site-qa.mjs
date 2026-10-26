import fs from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";

const ROOT = process.cwd();
const SITE_URL = "https://brainrotgames.me";
const failures = [];
const warnings = [];
const checked = { files: 0, html: 0, js: 0, links: 0 };

function fail(scope, message, extra = {}) { failures.push({ scope, message, ...extra }); }
function warn(scope, message, extra = {}) { warnings.push({ scope, message, ...extra }); }
function assert(condition, scope, message, extra = {}) { if (!condition) fail(scope, message, extra); }
async function read(file) { return fs.readFile(path.join(ROOT, file), "utf8"); }

async function walk(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if ([".git", "node_modules", "qa-results"].includes(entry.name)) continue;
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walk(full));
    else files.push(path.relative(ROOT, full).replaceAll(path.sep, "/"));
  }
  return files;
}

const files = await walk(ROOT);
const textFiles = files.filter(file => /\.(html?|js|mjs|css|json|txt|xml|yml|yaml|md)$/i.test(file));
for (const file of textFiles) {
  checked.files++;
  const source = await read(file);
  assert(!source.includes("\0"), "encoding", `NUL byte in ${file}`);
  if (/\r\n/.test(source)) warn("format", `CRLF line endings in ${file}`);
  if (/\.(js|mjs)$/.test(file)) {
    checked.js++;
    const result = spawnSync(process.execPath, ["--check", file], { encoding: "utf8" });
    assert(result.status === 0, "javascript-syntax", `Node syntax check failed for ${file}`, { detail: (result.stderr || result.stdout).trim().slice(0, 1200) });
  }
}

const routes = JSON.parse(await read("_routes.json"));
assert(routes.version === 1, "routing", "_routes.json version must be 1");
for (const route of ["/api/*", "/play", "/games", "/games/*", "/guides/*", "/sitemap.xml"]) {
  assert(routes.include.includes(route), "routing", `Missing Function route ${route}`);
}
assert(Array.isArray(routes.exclude) && routes.exclude.length === 0, "routing", "Unexpected excluded Function route");

const redirects = (await read("_redirects")).split(/\r?\n/).map(line => line.trim()).filter(Boolean);
for (const line of redirects) {
  const fields = line.split(/\s+/);
  assert(fields.length >= 2 && fields.length <= 3, "redirects", `Malformed redirect: ${line}`);
  if (fields.length === 3) assert(/^30[12378]$/.test(fields[2]), "redirects", `Invalid redirect status: ${line}`);
}
assert(redirects.some(line => line.startsWith("/play.html /play 301")), "redirects", "Legacy play route must redirect to /play");

const headers = await read("_headers");
assert(headers.includes("X-Content-Type-Options: nosniff"), "headers", "Missing nosniff header");
assert(headers.includes("Referrer-Policy:"), "headers", "Missing Referrer-Policy header");
assert(headers.includes("X-Robots-Tag: noindex"), "headers", "Missing noindex header for preview deployment");
const robots = await read("robots.txt");
assert(/^User-agent:\s*\*/m.test(robots), "robots", "robots.txt has no wildcard rule");
assert(/Sitemap:\s*https:\/\/brainrotgames\.me\/sitemap\.xml/i.test(robots), "robots", "robots.txt sitemap is incorrect");
assert((await read("ads.txt")).includes("pub-1559302511010806"), "adsense", "ads.txt publisher ID is missing");

const htmlFiles = files.filter(file => file.endsWith(".html"));
const staticPaths = new Set(files.filter(file => !file.startsWith("functions/")).map(file => `/${file}`));
for (const route of ["/", "/guides/", "/games", "/play", "/sitemap.xml", "/robots.txt", "/404"]) staticPaths.add(route);
function knownRoute(pathname) {
  return staticPaths.has(pathname) || ["/about", "/contact", "/privacy", "/cookies", "/terms", "/games/"].includes(pathname) || /^\/(?:guides|games)\/[^/]+\/?$/.test(pathname) || /^\/api\/(?:game|games)$/.test(pathname);
}
for (const file of htmlFiles) {
  checked.html++;
  const html = await read(file);
  const ids = [...html.matchAll(/\bid=["']([^"']+)["']/gi)].map(match => match[1]);
  assert(ids.length === new Set(ids).size, "html-id", `Duplicate id in ${file}`);
  const titles = html.match(/<title(?:\s[^>]*)?>[\s\S]*?<\/title>/gi) || [];
  const descriptions = html.match(/<meta\s+[^>]*name=["']description["'][^>]*>/gi) || [];
  const canonicals = html.match(/<link\s+[^>]*rel=["']canonical["'][^>]*>/gi) || [];
  assert(titles.length === 1, "html-meta", `${file} must have one title`);
  assert(descriptions.length === 1, "html-meta", `${file} must have one meta description`);
  assert(file === "404.html" ? canonicals.length === 0 : canonicals.length === 1, "html-meta", `${file} has the wrong canonical count`);
  for (const raw of [...html.matchAll(/\b(?:href|src)=["']([^"']+)["']/gi)].map(match => match[1])) {
    if (/^(data:|mailto:|tel:|javascript:|#)/i.test(raw)) continue;
    if (raw.includes("${")) continue;
    let url; try { url = new URL(raw, SITE_URL); } catch { fail("html-url", `Invalid URL ${raw} in ${file}`); continue; }
    if (url.origin !== SITE_URL) continue;
    checked.links++;
    const pathname = decodeURIComponent(url.pathname).replace(/\/index\.html$/, "/");
    assert(knownRoute(pathname), "broken-local-link", `${file} links to unknown route ${pathname}`, { raw });
  }
  const adsCount = (html.match(/adsbygoogle\.js\?client=ca-pub-1559302511010806/gi) || []).length;
  assert(adsCount <= 1, "adsense", `${file} contains duplicate AdSense scripts`);
  if (["index.html", "brainrot-games.html", "about.html", "contact.html", "privacy.html", "cookies.html", "terms.html", "guides/index.html"].includes(file)) assert(adsCount === 1, "adsense", `${file} is missing the verification script`);
}

const home = await read("index.html");
for (const required of ["third-party distribution feed", "What BrainrotGames checks, and what it does not claim", "id=\"game-grid\"", "href=\"/guides/how-we-select-games\""]) {
  assert(home.includes(required), "editorial-home", `Homepage is missing ${required}`);
}
for (const retired of ["loadExploreGames", "explore-game-grid", "What Are Browser Games?", "BrainrotGames Overview"]) {
  assert(!home.includes(retired), "editorial-home", `Homepage retains generic duplicate section: ${retired}`);
}

const player = await read("play.html");
assert(/noindex,follow/i.test(player), "player", "Game player must be noindex,follow");
assert(!player.includes("adsbygoogle.js"), "player", "Noindex game player must not include AdSense");
for (const invented of ["Gameplay Overview", "Who Is This Game For", "How to Get More", "Tips for"]) assert(!player.includes(invented), "player", `Game player contains invented per-game advice: ${invented}`);

const category = await read("functions/games/[category].js");
assert(category.includes('content="noindex,follow"'), "category", "Catalogue category pages must be noindex,follow");
assert(!category.includes("CATEGORY_EDITORIAL"), "category", "Catalogue category pages must not create generic editorial copy");
assert(category.includes("BLOCKED_GAME_IDS"), "category", "Catalogue categories must use the shared game blocklist");

const gameApi = await read("functions/api/game.js");
assert(gameApi.includes("validateGamePixEmbed"), "game-api", "Game embeds must be validated");
assert(gameApi.includes("Game information is supplied by the third-party distributor."), "game-api", "Fallback game records must disclose their third-party source");
assert(!gameApi.includes("Play ${requestedTitle} online for free on BrainrotGames."), "game-api", "Game API must not fabricate a description");
const playFunction = await read("functions/play.js");
assert(playFunction.includes("/api/game"), "play-function", "Game player must resolve through the validated API");

const sitemap = await read("functions/sitemap.xml.js");
for (const retained of ["how-we-select-games", "browser-game-loading-errors.html", "browser-game-controls-guide.html", "browser-game-safety-and-privacy.html"]) assert(sitemap.includes(retained), "sitemap", `Missing retained guide ${retained}`);
for (const retired of ["brainrot-clicker-progression", "casual-arcade-puzzle-games", '"/games/']) assert(!sitemap.includes(retired), "sitemap", `Sitemap includes retired or non-indexable content: ${retired}`);

const guideRouter = await read("functions/guides/[slug].js");
for (const legacy of ["brainrot-clicker-progression", "finding-browser-games-without-downloads", "browser-game-session-planning"]) assert(guideRouter.includes(`"${legacy}"`), "guide-redirects", `Missing legacy redirect ${legacy}`);

const workflow = await read(".github/workflows/game-qa.yml");
for (const required of ["scripts/site-structure-qa.mjs", "scripts/full-site-qa.mjs", "scripts/provider-health.mjs", "wrangler pages dev"]) assert(workflow.includes(required), "workflow", `Workflow missing ${required}`);

console.log(JSON.stringify({ status: failures.length ? "FAIL" : "PASS", checked, warnings: warnings.length, failures: failures.length, failureDetails: failures.slice(0, 100) }, null, 2));
if (failures.length) process.exitCode = 1;
