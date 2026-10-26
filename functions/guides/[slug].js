const SITE_URL = "https://brainrotgames.me";
const UPDATED = "2026-10-26";

const ARTICLE = {
  title: "Where Game Listings Come From and What BrainrotGames Checks",
  category: "Catalogue Transparency",
  intro: "BrainrotGames combines a third-party game catalogue with site navigation and automated availability checks. This page explains which details come from the distributor, what our checks can verify, and where their limits are.",
  sections: [
    ["Which information is supplied by the game distributor", [
      "Playable titles are discovered through the GamePix distribution feed. The feed supplies catalogue fields such as a game's title, category, description, artwork, identifier and launch URL. Those fields help populate search, category and game pages, but they are not written as independent BrainrotGames reviews.",
      "The provider controls the game build and can change, remove or replace it. A title, thumbnail or description can therefore stop matching the current game. We treat provider information as a starting record, not a promise about quality, device support or exact controls."
    ]],
    ["What our automated checks cover", [
      "The site runs automated checks against the catalogue and its routes. Depending on the workflow, checks can confirm that the feed responds, that a game identifier maps to a valid provider URL, that the site's game route responds, and that a sampled embedded player does not immediately show common failures such as a 403 or 404 response.",
      "These checks help us catch broken links and routing regressions. They do not play through a game's tutorial, judge whether instructions are fair, measure enjoyment, or prove that every title works on every browser, network and device."
    ]],
    ["What we do not claim", [
      "A listing is not a human-reviewed rating. BrainrotGames does not claim to have independently played every catalogue title or verified every game-specific tip. The instructions shown in the current game are the authority for its controls and rules.",
      "For that reason, we do not assign popularity or quality scores from provider metadata. Category labels are useful filters, but they are broad distributor labels and may not predict the exact mechanic."
    ]],
    ["How to report a specific problem", [
      "If a title is broken or its listing details are misleading, use the contact page and include the game name, the BrainrotGames page address, your device and browser, and what happened. A concise report helps us distinguish a site route problem from a provider-side change.",
      "Do not send passwords, payment details or other private account information. For temporary loading trouble, try another title once; if other games work normally, the problem may be limited to that provider build."
    ]]
  ]
};

const LEGACY_REDIRECTS = {
  "choose-browser-game": "/guides/how-to-evaluate-a-browser-game.html",
  "browser-game-performance": "/guides/browser-game-loading-errors.html",
  "mobile-browser-gaming": "/guides/how-to-evaluate-a-browser-game.html",
  "puzzle-game-strategy": "/games/puzzle",
  "browser-racing-tips": "/games/racing",
  "keyboard-mouse-controls": "/guides/browser-game-controls-guide.html",
  "two-player-browser-games": "/guides/multiplayer-browser-gaming-tips.html",

  "browser-game-audio-and-video-troubleshooting": "/guides/browser-game-loading-errors.html",
  "browser-game-session-planning": "/guides/how-to-evaluate-a-browser-game.html",
  "browser-games-for-short-breaks": "/guides/how-to-evaluate-a-browser-game.html",
  "casual-arcade-puzzle-games": "/guides/how-to-evaluate-a-browser-game.html",
  "choosing-browser-games-by-device": "/guides/how-to-evaluate-a-browser-game.html",
  "finding-browser-games-without-downloads": "/guides/how-to-evaluate-a-browser-game.html",

  "brainrot-clicker-progression": "/brainrot-games.html#common-game-mechanics",
  "brainrot-merge-game-planning": "/brainrot-games.html#common-game-mechanics",
  "brainrot-obby-obstacle-course-tips": "/brainrot-games.html#common-game-mechanics",
  "brainrot-runner-timing-guide": "/brainrot-games.html#common-game-mechanics",
  "brainrot-escape-game-puzzle-approach": "/brainrot-games.html#common-game-mechanics",
  "brainrot-multiplayer-session-guide": "/brainrot-games.html#choose-by-mechanic-time-and-device",
  "brainrot-games-on-mobile-or-desktop": "/brainrot-games.html#choose-by-mechanic-time-and-device",
  "choose-brainrot-game-by-session-length": "/brainrot-games.html#choose-by-mechanic-time-and-device",
  "compare-brainrot-game-mechanics": "/brainrot-games.html#common-game-mechanics",
  "understand-brainrot-game-objectives": "/brainrot-games.html#first-session",
  "brainrot-game-first-session-checklist": "/brainrot-games.html#first-session",
  "brainrot-games-for-puzzle-players": "/brainrot-games.html#common-game-mechanics",
  "brainrot-games-for-action-players": "/brainrot-games.html#common-game-mechanics",
  "brainrot-games-for-relaxed-play": "/brainrot-games.html#choose-by-mechanic-time-and-device",
  "brainrot-game-progress-and-replay": "/guides/browser-game-progress-and-saving.html",
  "brainrot-meme-characters-and-gameplay": "/brainrot-games.html#common-game-mechanics",
  "browser-brainrot-vs-platform-games": "/brainrot-games.html",
  "evaluate-a-brainrot-game-page": "/brainrot-games.html#first-session",
  "brainrot-game-controls-troubleshooting": "/guides/browser-game-controls-guide.html",
  "brainrot-game-safety-and-third-party-prompts": "/guides/browser-game-safety-and-privacy.html"
};

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[char]));
}
function slug(value = "") {
  return String(value).toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
function paragraphs(lines) {
  return lines.map(line => `<p>${escapeHtml(line)}</p>`).join("");
}
function schema(article, canonical) {
  return JSON.stringify({
    "@context": "https://schema.org",
    "@type": "Article",
    headline: article.title,
    description: article.intro,
    dateModified: UPDATED,
    author: { "@type": "Organization", name: "BrainrotGames" },
    publisher: { "@type": "Organization", name: "BrainrotGames", url: `${SITE_URL}/` },
    mainEntityOfPage: canonical
  }).replace(/</g, "\\u003c");
}

export async function onRequestGet(context) {
  const requestedSlug = String(context.params.slug || "");
  const slugValue = slug(requestedSlug.replace(/\.html$/i, ""));
  const legacyDestination = LEGACY_REDIRECTS[slugValue];
  if (legacyDestination) return Response.redirect(`${SITE_URL}${legacyDestination}`, 301);

  // Static authored guides use .html files and remain available through ASSETS.
  if (/\.html$/i.test(requestedSlug)) {
    const staticUrl = new URL(context.request.url);
    const staticResponse = await context.env.ASSETS.fetch(staticUrl);
    if (staticResponse.ok) return staticResponse;
  }

  if (slugValue !== "how-we-select-games") {
    const assetUrl = new URL(context.request.url);
    assetUrl.pathname = `${assetUrl.pathname.replace(/\/$/, "")}.html`;
    const staticResponse = await context.env.ASSETS.fetch(assetUrl);
    if (staticResponse.ok) return staticResponse;
    return new Response("Guide not found", { status: 404, headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" } });
  }

  const canonical = `${SITE_URL}/guides/how-we-select-games`;
  const sections = ARTICLE.sections.map(([heading, lines]) => `<section><h2>${escapeHtml(heading)}</h2>${paragraphs(lines)}</section>`).join("");
  const jsonLd = schema(ARTICLE, canonical);
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="index,follow"><meta name="description" content="${escapeHtml(ARTICLE.intro)}"><title>${escapeHtml(ARTICLE.title)} | BrainrotGames</title><link rel="canonical" href="${canonical}"><link rel="stylesheet" href="/styles.css"><script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-1559302511010806" crossorigin="anonymous"></script><script type="application/ld+json">${jsonLd}</script><style>
.article-page{padding:42px 0 80px}.article-wrap{max-width:860px;margin:0 auto}.article-header{padding:30px 0 34px;border-bottom:1px solid var(--border)}.article-header h1{font-size:clamp(38px,6vw,64px);line-height:1.03;margin:4px 0 16px}.article-intro{color:var(--muted);font-size:18px;line-height:1.8;max-width:780px}.article-meta{color:var(--muted);font-size:12px}.article-body{padding-top:30px}.article-body section{margin-bottom:34px}.article-body h2{font-size:27px;margin:0 0 12px}.article-body p{color:var(--muted);font-size:16px;line-height:1.85;margin:0 0 16px}@media(max-width:650px){.article-page{padding-top:24px}.article-header h1{font-size:38px}.article-intro{font-size:16px}}
</style></head><body><header class="site-header"><div class="container nav"><a class="brand" href="/" aria-label="BrainrotGames home"><span class="brand-mark">BG</span><span>Brainrot<span>Games</span></span></a><nav aria-label="Main navigation"><a href="/">Home</a><a href="/games">Categories</a><a href="/guides/">Guides</a><a href="/about.html">About</a></nav></div></header><main class="container article-page"><article class="article-wrap"><header class="article-header"><p class="eyebrow">${escapeHtml(ARTICLE.category.toUpperCase())}</p><h1>${escapeHtml(ARTICLE.title)}</h1><p class="article-intro">${escapeHtml(ARTICLE.intro)}</p><p class="article-meta">Updated October 26, 2026</p></header><div class="article-body">${sections}</div><p><a href="/guides/">← Browse all practical guides</a></p></article></main><footer class="site-footer"><div class="container footer-inner"><div class="footer-brand"><strong>BrainrotGames</strong><span>Free browser games and practical gaming guides.</span></div><nav class="footer-links" aria-label="Footer navigation"><a href="/about.html">About Us</a><a href="/contact.html">Contact Us</a><a href="/privacy.html">Privacy Policy</a><a href="/cookies.html">Cookie Policy</a><a href="/terms.html">Terms of Service</a></nav></div></footer></body></html>`;
  return new Response(html, { status: 200, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=300, s-maxage=1800, stale-while-revalidate=86400" } });
}
