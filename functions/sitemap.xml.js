import { BLOCKED_GAME_IDS } from "./lib/gamepix.js";

const SITE_URL = "https://brainrotgames.me";
// Provider IDs permanently excluded from the public sitemap after QA/provider checks.
const CURATED_CATEGORIES = [
  "action","adventure","arcade","casual","puzzle","racing",
  "sports","strategy","simulation","board","card","word"
];
const GUIDE_SLUGS = [
  "choose-browser-game","browser-game-performance","mobile-browser-gaming",
  "puzzle-game-strategy","browser-racing-tips","keyboard-mouse-controls",
  "two-player-browser-games","how-we-select-games",
  "browser-games-for-short-breaks","casual-arcade-puzzle-games",
  "multiplayer-browser-gaming-tips","browser-gaming-accessibility",
  "browser-game-loading-errors","browser-game-controls-guide",
  "choosing-browser-games-by-device","browser-game-session-planning",
  "browser-game-safety-and-privacy","finding-browser-games-without-downloads",
  "how-browser-games-work","how-to-evaluate-a-browser-game",
  "browser-game-audio-and-video-troubleshooting","browser-games-for-chromebook-and-low-end-devices",
  "browser-game-progress-and-saving","browser-gamepads-and-controller-support",
];
const STATIC_PAGES = [
  "/", "/games", "/guides/", "/brainrot-games.html", "/about.html", "/contact.html",
  "/privacy.html", "/cookies.html", "/terms.html"
];
function escapeXml(value = "") {
  return String(value).replace(/[<>&'"]/g, char => ({"<":"&lt;",">":"&gt;","&":"&amp;","'":"&apos;","\"":"&quot;"}[char]));
}
export async function onRequestGet() {
  const urls = [
    ...STATIC_PAGES.map(path => `${SITE_URL}${path}`),
    ...GUIDE_SLUGS.map(slug => `${SITE_URL}/guides/${slug}`),
    ...CURATED_CATEGORIES.map(slug => `${SITE_URL}/games/${slug}`)
  ];
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(url => `  <url>
    <loc>${escapeXml(url)}</loc>
  </url>`).join("\n")}
</urlset>`;
  return new Response(xml, {
    status: 200,
    headers: {
      "content-type": "application/xml; charset=utf-8",
      "cache-control": "public, max-age=300, s-maxage=1800, stale-while-revalidate=86400"
    }
  });
}