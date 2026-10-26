import { BLOCKED_GAME_IDS } from "./lib/gamepix.js";

export async function onRequestGet(context) {
  const requestUrl = new URL(context.request.url);
  const gameId = String(requestUrl.searchParams.get("id") || "").trim();
  const requestedTitle = String(requestUrl.searchParams.get("title") || "").trim();
  if (!gameId || BLOCKED_GAME_IDS.has(gameId) || !requestedTitle) return notFound();

  const apiUrl = new URL("/api/game", requestUrl.origin);
  apiUrl.searchParams.set("id", gameId);
  apiUrl.searchParams.set("title", requestedTitle);

  let game;
  try {
    const response = await fetch(apiUrl, { headers: { Accept: "application/json" } });
    if (!response.ok) return notFound();
    game = await response.json();
  } catch (error) {
    console.error("Game validation failed:", error);
    return notFound();
  }
  if (!game?.title || !game?.url) return notFound();

  const assetUrl = new URL("/play.html", requestUrl.origin);
  const assetResponse = await context.env.ASSETS.fetch(assetUrl);
  if (!assetResponse.ok) {
    return new Response("Unable to load play.html", {
      status: 502,
      headers: { "content-type": "text/plain; charset=utf-8" }
    });
  }

  let html = await assetResponse.text();
  // Keep AdSense out of the noindex game player and its third-party embed.
  html = html.replace(/<script\s+async\s+src=["']https:\/\/pagead\.googlesyndication\.com\/pagead\/js\/adsbygoogle\.js\?client=ca-pub-1559302511010806["'][^>]*><\/script>/i, "");

  const escapeHtml = value => String(value || "").replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  }[char]));
  const cleanText = value => String(value || "").replace(/\s+/g, " ").trim();
  const slug = value => cleanText(value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const setElementText = (source, id, value) => {
    const pattern = new RegExp(`(<[^>]+\\bid=["']${id}["'][^>]*>)[\\s\\S]*?(</[^>]+>)`, "i");
    return source.replace(pattern, (match, opening, closing) => opening + escapeHtml(value) + closing);
  };

  const title = cleanText(game.title);
  const description = cleanText(game.description || "");
  const category = cleanText(game.category || "Browser Game");
  const canonical = new URL("/play", requestUrl.origin);
  canonical.searchParams.set("id", gameId);
  canonical.searchParams.set("title", slug(title));
  const metaDescription = cleanText(description || `Play ${title} in your browser.`).slice(0, 160);

  html = html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeHtml(title)} | Play Online</title>`);
  html = html.replace(/(<link\s+rel=["']canonical["'][^>]*\bid=["']canonical-url["'][^>]*\bhref=["'])[^"']*(["'])/i, `$1${escapeHtml(canonical.toString())}$2`);
  html = html.replace(/(<meta\s+name=["']description["'][^>]*\bid=["']meta-description["'][^>]*content=["'])[^"']*(["'])/i, `$1${escapeHtml(metaDescription)}$2`);
  html = setElementText(html, "game-title", title);
  html = setElementText(html, "game-description", description || "Game information is supplied by the third-party distributor and may change.");
  html = setElementText(html, "game-category", category);
  html = setElementText(html, "detail-category", category);
  html = setElementText(html, "breadcrumb-title", title);
  html = html.replace(/<div\s+id=["']game-content["']\s+style=["']display:none;["']>/i, '<div id="game-content" style="display:block;">');
  html = html.replace(/<div\s+class=["']error-card["']\s+id=["']game-error["']>/i, '<div class="error-card" id="game-error" style="display:none;">');

  return new Response(html, {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "public, max-age=300"
    }
  });
}

function notFound() {
  return new Response("Game not found", {
    status: 404,
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "no-store"
    }
  });
}
