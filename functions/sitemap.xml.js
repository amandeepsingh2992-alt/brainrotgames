const FEED =
  "https://feeds.gamepix.com/v2/json?sid=E158N&pagination=12&page=";

const SITE_URL = "https://brainrotgames.me";
const MAX_PAGES = 100;

function escapeXml(value = "") {
  return String(value).replace(/[<>&'\"]/g, (char) => {
    const map = {
      "<": "&lt;",
      ">": "&gt;",
      "&": "&amp;",
      "'": "&apos;",
      '"': "&quot;"
    };

    return map[char];
  });
}

function slug(value = "") {
  return String(value)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export async function onRequestGet() {
  const urls = [
    `${SITE_URL}/`,
    `${SITE_URL}/about`,
    `${SITE_URL}/contact`,
    `${SITE_URL}/privacy`,
    `${SITE_URL}/cookies`,
    `${SITE_URL}/terms`
  ];

  const seen = new Set(urls);

  try {
    for (let page = 1; page <= MAX_PAGES; page++) {
      const response = await fetch(`${FEED}${page}`, {
        headers: {
          Accept: "application/json"
        }
      });

      if (!response.ok) {
        break;
      }

      const data = await response.json();

      const items = Array.isArray(data.items)
        ? data.items
        : [];

      for (const game of items) {
        const id = game.id ?? game.namespace ?? "";
        const title = game.title ?? "";

        if (!id) {
          continue;
        }

        const gameUrl = new URL("/play", SITE_URL);
        gameUrl.searchParams.set("id", String(id));

        if (title) {
          gameUrl.searchParams.set("title", slug(title));
        }

        const url = gameUrl.toString();

        if (!seen.has(url)) {
          seen.add(url);
          urls.push(url);
        }
      }

      if (
        !data.next_page_url &&
        !data.next_url &&
        items.length < 12
      ) {
        break;
      }
    }
  } catch (error) {
    console.error("Sitemap GamePix fetch failed:", error);
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (url) => `  <url>\n    <loc>${escapeXml(url)}</loc>\n  </url>`
  )
  .join("\n")}
</urlset>`;

  return new Response(xml, {
    status: 200,
    headers: {
      "content-type": "application/xml; charset=utf-8",
      "cache-control": "public, max-age=1800"
    }
  });
}
