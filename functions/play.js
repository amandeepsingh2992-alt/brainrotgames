export async function onRequestGet(context) {
  const requestUrl = new URL(context.request.url);
  const gameId = String(requestUrl.searchParams.get("id") || "").trim();
  const requestedTitle = String(requestUrl.searchParams.get("title") || "").trim();
  const BLOCKED_GAME_IDS = new Set(["7RU2YF", "011ODI", "ANMAR4"]);

  const assetUrl = new URL(requestUrl);
  assetUrl.pathname = "/play.html";
  assetUrl.search = "";

  const assetResponse = await context.env.ASSETS.fetch(assetUrl);
  if (!assetResponse.ok) return new Response("Unable to load play.html", { status: 502, headers: { "content-type": "text/plain; charset=utf-8" } });

  let html = await assetResponse.text();
  function escapeHtml(value = "") { return String(value).replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[char])); }
  function cleanText(value = "") { return String(value).replace(/\s+/g, " ").trim(); }
  function slug(value = "") { return String(value).toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); }
  function replaceElementText(source, id, value) {
    const safeValue = escapeHtml(value);
    const pattern = new RegExp(`(<[^>]+\\bid=["']${id}["'][^>]*>)[\\s\\S]*?(</[^>]+>)`, "i");
    return source.replace(pattern, `$1${safeValue}$2`);
  }
  function injectJsonLd(source, id, data) {
    const json = JSON.stringify(data).replace(/</g, "\\u003c");
    const script = `<script type="application/ld+json" id="${id}">${json}</script>`;
    const existing = new RegExp(`<script[^>]+id=["']${id}["'][^>]*>[\\s\\S]*?<\\/script>`, "i");
    if (existing.test(source)) return source.replace(existing, script);
    return source.replace(/<\/head>/i, `${script}\n</head>`);
  }
  function notFound() { return new Response("Game not found", { status: 404, headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" } }); }

  if (!gameId || BLOCKED_GAME_IDS.has(gameId) || !requestedTitle) return notFound();

  let gameTitle = requestedTitle.replace(/-/g, " ").replace(/\b\w/g, char => char.toUpperCase());
  let gameDescription = `Play ${gameTitle} online for free on BrainrotGames.`;
  let gameCategory = "Browser Game";
  let gameImage = "";

  try {
    const apiUrl = new URL("/api/game", requestUrl.origin);
    apiUrl.searchParams.set("id", gameId);
    apiUrl.searchParams.set("title", requestedTitle);
    const gameResponse = await fetch(apiUrl.toString(), { headers: { Accept: "application/json" } });
    if (!gameResponse.ok) return notFound();
    const gameData = await gameResponse.json();
    if (!gameData?.title || !gameData?.url) return notFound();
    gameTitle = cleanText(gameData.title);
    gameDescription = cleanText(gameData.description || gameDescription);
    gameCategory = cleanText(gameData.category || gameCategory);
    gameImage = cleanText(gameData.image || "");
  } catch (error) {
    console.error("Game validation failed:", error);
    return notFound();
  }

  const seoTitle = `${gameTitle} - Play Free Online | BrainrotGames`;
  const seoDescription = cleanText(`Play ${gameTitle} online for free on BrainrotGames. ${gameDescription}`).slice(0, 160);
  const canonicalUrl = new URL("/play", requestUrl.origin);
  canonicalUrl.searchParams.set("id", gameId);
  canonicalUrl.searchParams.set("title", slug(gameTitle));

  html = html.replace(/(<link\s+rel=["']canonical["'][^>]*\bid=["']canonical-url["'][^>]*\bhref=["'])[^"']*(["'])/i, `$1${escapeHtml(canonicalUrl.toString())}$2`);
  html = html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeHtml(seoTitle)}</title>`);
  html = html.replace(/(<meta\s+name=["']description["'][^>]*\bid=["']meta-description["'][^>]*content=["'])[^"']*(["'])/i, `$1${escapeHtml(seoDescription)}$2`);
  html = replaceElementText(html, "game-title", gameTitle);
  html = replaceElementText(html, "game-description", gameDescription);
  html = replaceElementText(html, "about-game", gameDescription);
  html = replaceElementText(html, "game-category", gameCategory);
  html = replaceElementText(html, "detail-category", gameCategory);
  html = replaceElementText(html, "breadcrumb-title", gameTitle);
  html = html.replace(/<div\s+id=["']game-content["']\s+style=["']display:none;["']>/i, '<div id="game-content" style="display:block;">');
  html = html.replace(/<div\s+class=["']error-card["']\s+id=["']game-error["']>/i, '<div class="error-card" id="game-error" style="display:none;">');

  const videoGameSchema = {
    "@context": "https://schema.org",
    "@type": "VideoGame",
    "name": gameTitle,
    "description": gameDescription,
    "genre": gameCategory,
    "gamePlatform": "Web Browser",
    "url": canonicalUrl.toString(),
    "isAccessibleForFree": true,
    "publisher": { "@type": "Organization", "name": "BrainrotGames", "url": `${requestUrl.origin}/` }
  };
  if (gameImage) videoGameSchema.image = gameImage;
  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      { "@type": "ListItem", "position": 1, "name": "Home", "item": `${requestUrl.origin}/` },
      { "@type": "ListItem", "position": 2, "name": "Games", "item": `${requestUrl.origin}/games` },
      { "@type": "ListItem", "position": 3, "name": gameTitle, "item": canonicalUrl.toString() }
    ]
  };
  html = injectJsonLd(html, "game-schema-server", videoGameSchema);
  html = injectJsonLd(html, "breadcrumb-schema-server", breadcrumbSchema);

  return new Response(html, { status: 200, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=300" } });
}
