export async function onRequestGet(context) {
  const requestUrl = new URL(context.request.url);
  const gameId = requestUrl.searchParams.get("id");
  const requestedTitle = requestUrl.searchParams.get("title") || "";

  const assetUrl = new URL(requestUrl);
  assetUrl.pathname = "/play.html";
  assetUrl.search = "";
  const assetResponse = await context.env.ASSETS.fetch(assetUrl);
  if (!assetResponse.ok) {
    return new Response("Unable to load play.html", { status: 502, headers: { "content-type": "text/plain; charset=utf-8" } });
  }

  let html = await assetResponse.text();

  // Keep one responsive design system. play.html historically contained a large
  // page-specific <style> block; remove it so /styles.css is the single source of truth.
  html = html.replace(/<style>\s*\.game-page[\s\S]*?<\/style>/i, "");

  function escapeHtml(value = "") {
    return String(value).replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[char]));
  }
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

  let gameTitle = requestedTitle ? requestedTitle.replace(/-/g, " ").replace(/\b\w/g, char => char.toUpperCase()) : "Game";
  let gameDescription = "";
  let gameCategory = "Browser Game";
  let gameImage = "";
  let gameLoaded = false;

  if (gameId) {
    try {
      const apiUrl = new URL("/api/game", requestUrl.origin);
      apiUrl.searchParams.set("id", gameId);
      const gameResponse = await fetch(apiUrl.toString(), { headers: { Accept: "application/json" } });
      if (gameResponse.ok) {
        const gameData = await gameResponse.json();
        if (gameData.title) gameTitle = cleanText(gameData.title);
        if (gameData.description) gameDescription = cleanText(gameData.description);
        if (gameData.category) gameCategory = cleanText(gameData.category);
        if (gameData.image) gameImage = cleanText(gameData.image);
        if (gameData.title) gameLoaded = true;
      }
    } catch (error) {
      console.error("Game metadata fetch failed:", error);
    }
  }

  const seoTitle = `${gameTitle} - Play Free Online | BrainrotGames`;
  let seoDescription = `Play ${gameTitle} online for free on BrainrotGames.`;
  if (gameDescription) seoDescription = `Play ${gameTitle} online for free on BrainrotGames. ${gameDescription}`;
  seoDescription = cleanText(seoDescription).slice(0, 160);

  const canonicalUrl = new URL("/play", requestUrl.origin);
  if (gameId) {
    canonicalUrl.searchParams.set("id", gameId);
    if (requestedTitle) canonicalUrl.searchParams.set("title", requestedTitle);
    html = html.replace(/(<link\s+rel=["']canonical["'][^>]*\bid=["']canonical-url["'][^>]*\bhref=["'])[^"']*(["'])/i, `$1${escapeHtml(canonicalUrl.toString())}$2`);
  }

  html = html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeHtml(seoTitle)}</title>`);
  html = html.replace(/(<meta\s+name=["']description["'][^>]*\bid=["']meta-description["'][^>]*content=["'])[^"']*(["'])/i, `$1${escapeHtml(seoDescription)}$2`);

  if (gameId && gameLoaded) {
    html = replaceElementText(html, "game-title", gameTitle);
    html = replaceElementText(html, "game-description", gameDescription || `Play ${gameTitle} online for free on BrainrotGames.`);
    html = replaceElementText(html, "about-game", gameDescription || `Play ${gameTitle} online for free on BrainrotGames.`);
    html = replaceElementText(html, "game-category", gameCategory);
    html = replaceElementText(html, "detail-category", gameCategory);
    html = replaceElementText(html, "breadcrumb-title", gameTitle);
    html = html.replace(/<div\s+id=["']game-content["']\s+style=["']display:none;["']>/i, '<div id="game-content">');
    html = html.replace(/<div\s+class=["']error-card["']\s+id=["']game-error["']>/i, '<div class="error-card" id="game-error" style="display:none;">');

    const videoGameSchema = {
      "@context": "https://schema.org",
      "@type": "VideoGame",
      "name": gameTitle,
      "description": gameDescription || seoDescription,
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

    // Related links remain server-rendered for discovery and SEO.
    try {
      const relatedUrl = new URL("/api/games", requestUrl.origin);
      relatedUrl.searchParams.set("category", gameCategory);
      relatedUrl.searchParams.set("page", "1");
      const relatedResponse = await fetch(relatedUrl.toString(), { headers: { Accept: "application/json" } });
      if (relatedResponse.ok) {
        const relatedData = await relatedResponse.json();
        const relatedGames = Array.isArray(relatedData.items)
          ? relatedData.items.filter(game => String(game.id ?? game.namespace ?? "") !== String(gameId)).slice(0, 6)
          : [];
        if (relatedGames.length) {
          const links = relatedGames.map(game => {
            const id = game.id ?? game.namespace ?? "";
            const title = game.title || "Untitled game";
            const href = `/play?id=${encodeURIComponent(id)}&title=${encodeURIComponent(slug(title))}`;
            return `<a href="${escapeHtml(href)}">${escapeHtml(title)}</a>`;
          }).join("");
          const relatedMarkup = `<section class="related-games"><h2>More ${escapeHtml(gameCategory)} Games</h2><p>Keep playing with more games from the same category.</p><div class="sidebar-links">${links}</div><p><a href="/games/${escapeHtml(slug(gameCategory))}">Browse all ${escapeHtml(gameCategory)} games</a></p></section>`;
          html = html.replace(/<section\s+class=["']related-games["'][^>]*>[\s\S]*?<\/section>/i, relatedMarkup);
        }
      }
    } catch (error) {
      console.error("Related games fetch failed:", error);
    }
  }

  return new Response(html, {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "public, max-age=60, s-maxage=300, stale-while-revalidate=86400"
    }
  });
}
