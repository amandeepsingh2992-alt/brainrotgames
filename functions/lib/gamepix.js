export const GAMEPIX_SID = "E158N";
export const GAMEPIX_FEED_BASE = "https://feeds.gamepix.com/v2/json";

export function slug(value = "") {
  return String(value).toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

// BrainrotGames category URLs and labels are normalized to the GamePix feed's
// slug convention. This keeps every category using one canonical value.
export function normalizeGamePixCategory(value = "") {
  const normalized = slug(value);
  return normalized === "all" || normalized === "all-games" ? "" : normalized;
}

export function buildEmbedUrl(game) {
  const namespace = String(game?.namespace || "").trim();
  const sourceUrl = String(game?.url || game?.game_url || "").trim();
  if (!namespace) return sourceUrl;

  let sid = GAMEPIX_SID;
  try {
    const parsed = new URL(sourceUrl);
    sid = parsed.searchParams.get("sid") || GAMEPIX_SID;
  } catch {}

  return `https://play.gamepix.com/${encodeURIComponent(namespace)}/embed?sid=${encodeURIComponent(sid)}`;
}

export function normalizeGame(game = {}) {
  return {
    id: game.id ?? game.namespace ?? "",
    namespace: game.namespace ?? "",
    title: game.title ?? "Untitled game",
    description: game.description ?? "",
    category: game.category ?? "Other",
    image: game.banner_image || game.image || game.thumbnailUrl || game.thumbnailUrl100 || game.thumbnail_url || "",
    url: buildEmbedUrl(game),
    width: game.width,
    height: game.height
  };
}
