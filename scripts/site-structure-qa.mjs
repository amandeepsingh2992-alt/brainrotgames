import fs from "node:fs";

const read = file => fs.readFileSync(file, "utf8");
const assert = (condition, message) => { if (!condition) throw new Error(message); };

const home = read("index.html");
for (const item of ["ORIGINAL BROWSER GAMES", "Pulse Tap", "Orbit Shift", "Letter Ladder", "first party games and tools"]) assert(home.includes(item), `Homepage is missing original-product content: ${item}`);
assert(!home.includes("third-party catalogue"), "Homepage still presents a third-party catalogue as the core product");

for (const [file, terms] of Object.entries({
  "pulse-tap.html": ["ORIGINAL REACTION GAME", "How to play", "localStorage.pulseTapBest"],
  "orbit-shift.html": ["ORIGINAL DODGER", "Controls", "requestAnimationFrame"],
  "letter-ladder.html": ["ORIGINAL WORD PROMPT", "Private by design", "That word fits the letter set"],
  "how-we-make-games.html": ["What is original here", "How a game is designed", "What we do not claim"]
})) for (const term of terms) assert(read(file).includes(term), `${file} is missing: ${term}`);

const headers = read("_headers");
for (const route of ["/games/*", "/play*", "/guides/*"]) assert(headers.includes(route), `Legacy provider route is missing noindex protection: ${route}`);
const sitemap = read("functions/sitemap.xml.js");
for (const path of ["pulse-tap.html", "orbit-shift.html", "letter-ladder.html", "how-we-make-games.html"]) assert(sitemap.includes(path), `Sitemap is missing original page: ${path}`);
for (const retired of ["how-we-select-games", "editor-picks.html", "brainrot-games.html"]) assert(!sitemap.includes(retired), `Sitemap still includes the retired directory-era page: ${retired}`);
console.log("ORIGINAL PRODUCT STRUCTURE QA: PASS");
