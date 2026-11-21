const SITE_URL = "https://brainrotgames.me";
const STATIC_PAGES = [
  "/", "/pulse-tap.html", "/orbit-shift.html", "/letter-ladder.html", "/how-we-make-games.html", "/about.html", "/contact.html", "/feedback.html",
  "/privacy.html", "/cookies.html", "/terms.html"
];
export async function onRequestGet() {
  const urls = [
    ...STATIC_PAGES.map(path => `${SITE_URL}${path}`)
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
