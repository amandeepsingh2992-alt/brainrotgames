const SITE_URL = "https://brainrotgames.me";
const GUIDE_SLUGS = [
  "how-we-select-games",
  "how-to-evaluate-a-browser-game.html",
  "browser-game-loading-errors.html",
  "browser-game-controls-guide.html",
  "browser-game-progress-and-saving.html",
  "browser-games-for-chromebook-and-low-end-devices.html",
  "browser-gaming-accessibility.html",
  "browser-game-safety-and-privacy.html",
  "how-browser-games-work.html",
  "browser-gamepads-and-controller-support.html",
  "multiplayer-browser-gaming-tips.html"
];
const STATIC_PAGES = [
  "/", "/guides/", "/brainrot-games.html", "/about.html", "/contact.html",
  "/privacy.html", "/cookies.html", "/terms.html"
];
export async function onRequestGet() {
  const urls = [
    ...STATIC_PAGES.map(path => `${SITE_URL}${path}`),
    ...GUIDE_SLUGS.map(slug => `${SITE_URL}/guides/${slug}`)
  ];
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(url => `  <url><loc>${url}</loc></url>`).join("\n")}
</urlset>`;
  return new Response(xml, {
    status: 200,
    headers: {
      "content-type": "application/xml; charset=utf-8",
      "cache-control": "public, max-age=300, s-maxage=1800, stale-while-revalidate=86400"
    }
  });
}
