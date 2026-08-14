export async function onRequestGet(context) {
  const requestUrl = new URL(context.request.url);

  const gameId = requestUrl.searchParams.get("id");
  const requestedTitle = requestUrl.searchParams.get("title") || "";

  // ------------------------------------------------------------
  // LOAD ORIGINAL PLAY PAGE
  // ------------------------------------------------------------

  const assetUrl = new URL(requestUrl);

  assetUrl.pathname = "/play.html";
  assetUrl.search = "";

  const assetResponse = await context.env.ASSETS.fetch(assetUrl);

  if (!assetResponse.ok) {
    return new Response("Unable to load play.html", {
      status: 502,
      headers: {
        "content-type": "text/plain; charset=utf-8"
      }
    });
  }

  let html = await assetResponse.text();

  // ------------------------------------------------------------
  // HELPERS
  // ------------------------------------------------------------

  function escapeHtml(value = "") {
    return String(value).replace(/[&<>"']/g, (char) => {
      const map = {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
      };

      return map[char];
    });
  }

  function cleanText(value = "") {
    return String(value)
      .replace(/\s+/g, " ")
      .trim();
  }

  function replaceElementText(source, id, value) {
    const safeValue = escapeHtml(value);

    const pattern = new RegExp(
      `(<[^>]+\\bid=["']${id}["'][^>]*>)[\\s\\S]*?(</[^>]+>)`,
      "i"
    );

    return source.replace(pattern, `$1${safeValue}$2`);
  }

  // ------------------------------------------------------------
  // GAME DATA
  // ------------------------------------------------------------

  let gameTitle = requestedTitle
    ? requestedTitle
        .replace(/-/g, " ")
        .replace(/\b\w/g, (char) => char.toUpperCase())
    : "Game";

  let gameDescription = "";
  let gameCategory = "Browser Game";
  let gameLoaded = false;

  if (gameId) {
    try {
      const apiUrl = new URL("/api/game", requestUrl.origin);

      apiUrl.searchParams.set("id", gameId);

      const gameResponse = await fetch(apiUrl.toString(), {
        headers: {
          Accept: "application/json"
        }
      });

      if (gameResponse.ok) {
        const gameData = await gameResponse.json();

        if (gameData.title) {
          gameTitle = cleanText(gameData.title);
        }

        if (gameData.description) {
          gameDescription = cleanText(gameData.description);
        }

        if (gameData.category) {
          gameCategory = cleanText(gameData.category);
        }

        if (gameData.title) {
          gameLoaded = true;
        }
      }
    } catch (error) {
      // Use the URL title as fallback.
    }
  }

  // ------------------------------------------------------------
  // SEO TITLE
  // ------------------------------------------------------------

  const seoTitle =
    `${gameTitle} - Play Free Online | BrainrotGames`;

  // ------------------------------------------------------------
  // SEO DESCRIPTION
  // ------------------------------------------------------------

  let seoDescription =
    `Play ${gameTitle} online for free on BrainrotGames.`;

  if (gameDescription) {
    seoDescription =
      `Play ${gameTitle} online for free on BrainrotGames. ${gameDescription}`;
  }

  seoDescription = cleanText(seoDescription).slice(0, 160);

  // ------------------------------------------------------------
  // CANONICAL URL
  // ------------------------------------------------------------

  if (gameId) {
    const canonicalUrl = new URL("/play", requestUrl.origin);

    canonicalUrl.searchParams.set("id", gameId);

    if (requestedTitle) {
      canonicalUrl.searchParams.set(
        "title",
        requestedTitle
      );
    }

    html = html.replace(
      /(<link\s+rel=["']canonical["'][^>]*\bid=["']canonical-url["'][^>]*\bhref=["'])[^"']*(["'])/i,
      `$1${escapeHtml(canonicalUrl.toString())}$2`
    );
  }

  // ------------------------------------------------------------
  // SERVER-SIDE SEO TITLE
  // ------------------------------------------------------------

  html = html.replace(
    /<title>[\s\S]*?<\/title>/i,
    `<title>${escapeHtml(seoTitle)}</title>`
  );

  // ------------------------------------------------------------
  // SERVER-SIDE META DESCRIPTION
  // ------------------------------------------------------------

  html = html.replace(
    /(<meta\s+name=["']description["'][^>]*\bid=["']meta-description["'][^>]*content=["'])[^"']*(["'])/i,
    `$1${escapeHtml(seoDescription)}$2`
  );

  // ------------------------------------------------------------
  // SERVER-SIDE GAME CONTENT
  //
  // Keep the important game-specific page content in the initial
  // HTML response instead of requiring Google to execute JavaScript
  // before it can see the title, description and category.
  // ------------------------------------------------------------

  if (gameId && gameLoaded) {
    html = replaceElementText(
      html,
      "game-title",
      gameTitle
    );

    html = replaceElementText(
      html,
      "game-description",
      gameDescription || `Play ${gameTitle} online for free on BrainrotGames.`
    );

    html = replaceElementText(
      html,
      "about-game",
      gameDescription || `Play ${gameTitle} online for free on BrainrotGames.`
    );

    html = replaceElementText(
      html,
      "game-category",
      gameCategory
    );

    html = replaceElementText(
      html,
      "detail-category",
      gameCategory
    );

    html = replaceElementText(
      html,
      "breadcrumb-title",
      gameTitle
    );

    // The static template starts hidden while JavaScript loads the
    // game. Since the server has already loaded the game data, expose
    // the finished page in the initial HTML response.
    html = html.replace(
      /<div\s+id=["']game-content["']\s+style=["']display:none;["']>/i,
      '<div id="game-content" style="display:block;">'
    );

    html = html.replace(
      /<div\s+class=["']error-card["']\s+id=["']game-error["']>/i,
      '<div class="error-card" id="game-error" style="display:none;">'
    );
  }

  return new Response(html, {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "public, max-age=300"
    }
  });
}