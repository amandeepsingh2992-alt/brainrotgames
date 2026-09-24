import fs from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";

const ROOT = process.cwd();
const BASE_URL = (process.env.BASE_URL || "https://brainrotgames.me").replace(/\/$/, "");
const FAIL_FAST = process.env.FAIL_FAST === "1";
const failures = [];
const warnings = [];
const checked = { files: 0, js: 0, html: 0, links: 0 };

function fail(scope, message, extra = {}) {
  failures.push({ scope, message, ...extra });
  if (FAIL_FAST) throw new Error(scope + ": " + message);
}
function warn(scope, message, extra = {}) { warnings.push({ scope, message, ...extra }); }
function assert(condition, scope, message, extra = {}) { if (!condition) fail(scope, message, extra); }

async function walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const out = [];
  for (const entry of entries) {
    if ([".git", "node_modules", "qa-results"].includes(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...await walk(full));
    else out.push(path.relative(ROOT, full).replaceAll(path.sep, "/"));
  }
  return out;
}

const files = await walk(ROOT);
const textExt = /\.(html?|js|mjs|css|json|txt|xml|yml|yaml|md)$/i;

for (const file of files.filter(f => textExt.test(f))) {
  checked.files++;
  let content = "";
  try { content = await fs.readFile(file, "utf8"); }
  catch (e) { fail("filesystem", "Cannot read " + file + ": " + e.message); continue; }

  if (/\u0000/.test(content)) fail("encoding", "NUL byte in " + file);
  if (/\r\n/.test(content)) warn("format", "CRLF line endings in " + file);

  if (file.endsWith(".js") || file.endsWith(".mjs")) {
    checked.js++;
    const result = spawnSync(process.execPath, ["--check", file], { encoding: "utf8" });
    if (result.status !== 0) {
      fail("javascript-syntax", "Node syntax check failed for " + file, {
        detail: (result.stderr || result.stdout).trim().slice(0, 1200)
      });
    }
  }
}

const routes = JSON.parse(await fs.readFile("_routes.json", "utf8"));
assert(routes.version === 1, "routing", "_routes.json version must be 1");
assert(Array.isArray(routes.include) && Array.isArray(routes.exclude), "routing", "_routes.json include/exclude must be arrays");
for (const route of ["/api/*", "/play", "/games", "/games/*", "/guides/*", "/sitemap.xml"]) {
  assert(routes.include.includes(route), "routing", "Missing Functions include route " + route);
}
assert(routes.exclude.length === 0, "routing", "_routes.json unexpectedly excludes a required route");

const redirects = (await fs.readFile("_redirects", "utf8")).split(/\r?\n/).map(x => x.trim()).filter(Boolean);
for (const line of redirects) {
  const parts = line.split(/\s+/);
  assert(parts.length >= 2 && parts.length <= 3, "redirects", "Malformed _redirects line: " + line);
  if (parts.length === 3) assert(/^30[12378]$/.test(parts[2]), "redirects", "Invalid redirect status: " + line);
}
assert(redirects.some(x => x.startsWith("/play.html /play")), "redirects", "Legacy /play.html redirect is missing");

const headers = await fs.readFile("_headers", "utf8");
assert(headers.includes("X-Content-Type-Options: nosniff"), "headers", "Missing nosniff header");
assert(headers.includes("Referrer-Policy:"), "headers", "Missing Referrer-Policy");
assert(headers.includes("X-Robots-Tag: noindex"), "headers", "Missing noindex rule for pages.dev");

const robots = await fs.readFile("robots.txt", "utf8");
assert(/^User-agent:\s*\*/m.test(robots), "robots", "robots.txt has no wildcard User-agent");
assert(/Allow:\s*\//m.test(robots), "robots", "robots.txt does not allow /");
assert(/Sitemap:\s*https:\/\/brainrotgames\.me\/sitemap\.xml/i.test(robots), "robots", "robots.txt sitemap URL is incorrect");

const ads = await fs.readFile("ads.txt", "utf8");
assert(ads.includes("pub-1559302511010806"), "ads.txt", "AdSense publisher ID is missing from ads.txt");

const htmlFiles = files.filter(f => f.endsWith(".html"));
const staticPaths = new Set(files.filter(f => !f.startsWith("functions/")).map(f => "/" + f));
staticPaths.add("/");
staticPaths.add("/guides/");
staticPaths.add("/games/");
staticPaths.add("/play");
staticPaths.add("/sitemap.xml");
staticPaths.add("/robots.txt");
staticPaths.add("/404");

function normalizeLocal(raw) {
  const u = new URL(raw, BASE_URL);
  if (u.origin !== BASE_URL) return null;
  let p = decodeURIComponent(u.pathname);
  if (p.endsWith("/index.html")) p = p.slice(0, -10) || "/";
  if (p.endsWith(".html")) return p;
  if (p === "/") return "/";
  return p;
}
function routeKnown(p) {
  if (staticPaths.has(p)) return true;
  if (/^\/guides\/[^/]+\/?$/.test(p)) return true;
  if (/^\/games\/[^/]+\/?$/.test(p)) return true;
  if (p === "/api/games" || p === "/api/game") return true;
  if (p === "/play") return true;
  return false;
}
function targetExists(p) {
  if (routeKnown(p)) return true;
  if (p === "/about" || p === "/contact" || p === "/privacy" || p === "/cookies" || p === "/terms") return staticPaths.has(p + ".html");
  return false;
}

for (const file of htmlFiles) {
  checked.html++;
  const html = await fs.readFile(file, "utf8");
  const ids = [...html.matchAll(/\bid=["']([^"']+)["']/gi)].map(m => m[1]);
  const seenIds = new Set();
  for (const id of ids) {
    if (seenIds.has(id)) fail("html-id", 'Duplicate id="' + id + '" in ' + file);
    seenIds.add(id);
  }

  const titleCount = (html.match(/<title(?:\s[^>]*)?>[\s\S]*?<\/title>/gi) || []).length;
  const descCount = (html.match(/<meta\s+[^>]*name=["']description["'][^>]*>/gi) || []).length;
  const canonicalCount = (html.match(/<link\s+[^>]*rel=["']canonical["'][^>]*>/gi) || []).length;
  assert(titleCount === 1, "html-meta", file + " must contain exactly one title");
  assert(descCount === 1, "html-meta", file + " must contain exactly one meta description");
  if (file === "404.html") assert(canonicalCount === 0, "html-meta", "404.html should not advertise a canonical URL");
  else assert(canonicalCount === 1, "html-meta", file + " must contain exactly one canonical link");

  const urls = [...html.matchAll(/\b(?:href|src)=["']([^"']+)["']/gi)].map(m => m[1]);
  for (const raw of urls) {
    if (/^(data:|mailto:|tel:|javascript:|#)/i.test(raw)) continue;
    if (/^https?:\/\//i.test(raw)) {
      try { new URL(raw); } catch { fail("html-url", "Invalid absolute URL " + raw + " in " + file); }
      continue;
    }
    if (raw.startsWith("//")) {
      try { new URL("https:" + raw); } catch { fail("html-url", "Invalid protocol-relative URL " + raw + " in " + file); }
      continue;
    }
    checked.links++;
    const p = normalizeLocal(raw);
    if (p && !targetExists(p)) fail("broken-local-link", file + " references missing route " + p, { raw });
  }

  const adsCount = (html.match(/adsbygoogle\.js\?client=ca-pub-1559302511010806/gi) || []).length;
  assert(adsCount <= 1, "adsense", file + " contains duplicate AdSense verification scripts");
  if (/^(about|contact|privacy|cookies|terms|brainrot-games)\.html$/.test(path.basename(file)) || file === "index.html" || file === "guides/index.html") {
    assert(adsCount === 1, "adsense", file + " is missing the AdSense verification script");
  }
  if (file === "404.html") assert(/noindex/i.test(html), "seo", "404.html must be noindex");
  if (file === "play.html") assert(/noindex,follow/i.test(html), "seo", "play.html must be noindex,follow");
}

const sitemapJs = await fs.readFile("functions/sitemap.xml.js", "utf8");
assert(sitemapJs.includes("brainrot-games.html"), "sitemap", "Brainrot Games editorial page is missing from sitemap source");
for (const id of ["7RU2YF", "011ODI", "ANMAR4"]) assert(sitemapJs.includes(id), "sitemap", "Blocked game " + id + " is missing from sitemap source");

const apiGame = await fs.readFile("functions/api/game.js", "utf8");
const apiGames = await fs.readFile("functions/api/games.js", "utf8");
const playFn = await fs.readFile("functions/play.js", "utf8");
const gamepix = await fs.readFile("functions/lib/gamepix.js", "utf8");
assert(apiGame.includes("games.gamepix.com/game"), "game-resolver", "Single-game GamePix lookup is missing");
assert(apiGame.includes("gid"), "game-resolver", "GamePix lookup does not query gid");
assert(apiGame.includes("validateGamePixEmbed"), "game-resolver", "GamePix embed validation is missing");
assert(playFn.includes("/api/game"), "play-route", "Play Function does not validate games through /api/game");
assert(playFn.includes("Game not found"), "play-route", "Play Function has no explicit not-found handling");
assert(gamepix.includes("play.gamepix.com"), "gamepix", "Canonical GamePix embed construction is missing");
assert(apiGames.includes("BLOCKED_GAME_IDS"), "catalogue", "Catalogue API blocklist is missing");

const workflow = await fs.readFile(".github/workflows/game-qa.yml", "utf8");
const liveWorkflow = await fs.readFile(".github/workflows/live-site-qa.yml", "utf8");
assert(workflow.includes("scripts/full-site-qa.mjs"), "workflow", "Full site QA is not part of the main QA workflow");
assert(workflow.includes("scripts/provider-health.mjs"), "workflow", "Provider health QA is not part of the main QA workflow");
assert(liveWorkflow.includes("scripts/game-qa.mjs"), "workflow", "Live deployment QA does not run game integration QA");
assert(liveWorkflow.includes("deployment_status"), "workflow", "Live QA is not triggered after deployments");

console.log(JSON.stringify({
  status: failures.length ? "FAIL" : "PASS",
  baseUrl: BASE_URL,
  checked,
  warnings: warnings.length,
  failures: failures.length,
  failureDetails: failures.slice(0, 100)
}, null, 2));
if (failures.length) process.exitCode = 1;
