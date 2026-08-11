# BrainrotGames V1

A lightweight HTML5 game portal built around your GamePix JSON feed.

## Your GamePix feed

The project is configured with your publisher feed:

https://feeds.gamepix.com/v2/json?sid=E158N&pagination=12&page=1

**Do not remove or change `sid=E158N`** unless GamePix gives you a replacement.

## What is included

- Responsive BrainrotGames homepage
- Game catalog loaded from GamePix
- Category filters
- Search
- Load-more pagination
- Individual `/play.html?id=...` game pages
- Server-side GamePix feed proxy through Cloudflare Pages Functions
- No paid hosting required for the initial version
- Basic SEO metadata and mobile-first layout

## Recommended Cloudflare deployment

Cloudflare Pages supports static HTML sites and Pages Functions.

### Option A — GitHub + Cloudflare Pages (recommended)

1. Create a GitHub repository named `brainrotgames`.
2. Upload all files/folders from this project, including the `functions` folder.
3. In Cloudflare: **Workers & Pages → Create application → Pages → Import an existing Git repository**.
4. Select the repository.
5. Production branch: `main`.
6. Build command: `exit 0`.
7. Build output directory: `/` (or leave it blank if the UI permits).
8. Deploy.

After deployment Cloudflare will give you a `*.pages.dev` URL.

### Connect brainrotgames.me

In the Pages project:
**Custom domains → Set up a domain → brainrotgames.me**

Because your domain is already an active Cloudflare zone with Cloudflare nameservers, Cloudflare can configure the apex custom domain for the Pages project.

**Important:** do not manually guess A-record IPs for Pages. Let the Pages custom-domain flow create/configure the required DNS record.

## Important monetization note

This V1 intentionally does not add arbitrary third-party ad scripts. First verify that:
1. GamePix games load,
2. your GamePix property is verified,
3. GamePix revenue/game-play tracking works,
4. the site is stable.

Then we can add carefully selected monetization placements without damaging UX or violating GamePix/advertiser policies.

## Next V2 work

- Better logo/brand identity
- Featured/trending section
- Recently played
- More polished game cards
- Dedicated category pages
- SEO landing pages
- sitemap.xml + robots.txt
- privacy/terms/contact pages
- analytics
- ad placement strategy
- performance optimization
- GamePix-specific monetization integration

