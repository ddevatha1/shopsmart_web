# shopsmart-scraper-service

A small, standalone, always-on Node service. It exists for one reason: two
pieces of ShopSmart's grocery-scraping logic need a real headless browser
(Playwright), and Vercel's serverless functions can't run one (read-only
filesystem outside `/tmp`, no bundled Chromium binary, function duration
limits far shorter than a browser cold-start). This service runs on a
normal persistent host (Render) where none of that applies, and the main
Next.js app calls it over HTTP for the two things it provides:

- `GET /trader-joes/cookie` — a warm Trader Joe's session cookie, refreshed
  in the background every ~20 minutes. The main app uses this cookie to
  make its own plain HTTP GraphQL request to Trader Joe's — only *session
  establishment* needs a browser, not the actual product search.
- `GET /sprouts/image?productUrl=...&productName=...` — a one-off scrape of
  a single known Sprouts product page for its photo (used only when
  Sprouts' search API didn't already include an image).
- `GET /health` — unauthenticated, for uptime/keep-alive pings.

`/trader-joes/cookie` and `/sprouts/image` require `Authorization: Bearer
<SCRAPER_SERVICE_TOKEN>`, matching the same env var set on the main app's
Vercel project.

## Local development

```bash
cp .env.example .env.local   # fill in SCRAPER_SERVICE_TOKEN
npm install
npx playwright install --with-deps chromium
npm run dev
```

## Deploying to Render (free tier)

1. Push this repo to GitHub (the whole monorepo — `render.yaml` points
   Render at the `scraper-service/` subdirectory via `rootDir`).
2. In the Render dashboard: **New → Blueprint**, select this repo. Render
   reads `render.yaml` and creates the service automatically.
3. Set the `SCRAPER_SERVICE_TOKEN` env var in the Render dashboard (it's
   marked `sync: false` in the blueprint, so Render will prompt for it
   rather than committing it to the repo).
4. Once deployed, copy the service's `https://*.onrender.com` URL — this is
   the `SCRAPER_SERVICE_URL` the main app needs.

## Avoiding Render's free-tier spin-down (optional)

Render's free web services sleep after ~15 minutes with no traffic; the
next request that needs a fresh session can take 30-60s to wake. To avoid
this in practice, set up a free external uptime ping against `/health`
every ~10 minutes — e.g. [cron-job.org](https://cron-job.org) or
[UptimeRobot](https://uptimerobot.com), both free. Not required for
correctness (the main app degrades Trader Joe's gracefully to "temporarily
unavailable" for the one request that hits a cold instance), just for
consistently fast searches.
