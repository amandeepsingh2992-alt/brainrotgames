import { GAMEPIX_SID, slug } from "../lib/gamepix.js";

const CACHE_TTL = 900;
const BLOCKED_GAME_IDS = new Set(["7RU2YF", "011ODI", "ANMAR4"]);

function json(data, status = 200, cache = CACHE_TTL) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": `public, max-age=60, s-maxage=${cache}, stale-while-revalidate=86400`
    }
  });
}

function buildDirectEmbedUrl(title) {
  const namespace = slug(title);
  if (!namespace) return "";
  return `https://play.gamepix.com/${encodeURIComponent(namespace)}/embed?sid=${encodeURIComponent(GAMEPIX_SID)}`;
}

async function validateGamePixEmbed(embedUrl) {
  if (!embedUrl) return false;
  try {
    const response = await fetch(embedUrl, {
      method: "GET",
      redirect: "follow",
      headers: { Accept: "text/html,application/xhtml+xml" },
      signal: AbortSignal.timeout(5000),
      cf: { cacheTtl: CACHE_TTL, cacheEverything: true }
    });
    if (!response.ok) return false;
    const finalUrl = new URL(response.url);
    if (finalUrl.protocol !== "https:" || !finalUrl.hostname.endsWith("gamepix.com")) return false;
    const xFrame = (response.headers.get("x-frame-options") || "").toLowerCase();
    if (xFrame === "deny" || xFrame === "sameorigin") return false;
    const csp = (response.headers.get("content-security-policy") || "").toLowerCase();
    if (/frame-ancestors\s+[^;]*(?:'none'|\bself\b)/i.test(csp)) return false;
    return true;
  } catch {
    return false;
  }
}

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const id = String(url.searchParams.get("id") || "").trim();
  const requestedTitle = String(url.searchParams.get("title") || "").trim();

  if (!id || BLOCKED_GAME_IDS.has(id) || !requestedTitle) {
    return json({ error: "Game not found or unavailable" }, 404, 60);
  }

  const title = requestedTitle.replace(/-/g, " ").replace(/\b\w/g, char => char.toUpperCase());
  const embedUrl = buildDirectEmbedUrl(requestedTitle);
  const cacheKey = new Request(`${url.toString()}&cache=direct-title-v1`, { method: "GET" });
  const cache = caches.default;
  const cached = await cache.match(cacheKey);
  if (cached) return cached;

  if (!(await validateGamePixEmbed(embedUrl))) {
    return json({ error: "Game not found or unavailable" }, 404, 60);
  }

  const result = json({
    id,
    namespace: slug(requestedTitle),
    title,
    description: `Play ${title} online for free on BrainrotGames.`,
    category: "Browser Game",
    image: "",
    url: embedUrl
  });

  context.waitUntil(cache.put(cacheKey, result.clone()));
  return result;
}
