# Deploying ShopSmart

ShopSmart deploys as **two services**:

1. **The Next.js app** → Vercel (free Hobby tier)
2. **`scraper-service/`** → Render (free tier) — a small always-on Node
   service that owns the only two Playwright browser launches the app
   still needs.

## Why two services

Trader Joe's search and the Sprouts missing-image fallback both need a
real headless browser (Playwright). Vercel serverless functions can't run
one: the filesystem is read-only outside `/tmp`, there's no Chromium
binary bundled for the runtime, and a cold browser launch (3-30s) exceeds
function duration limits. Everything else in the app (Kroger, Aldi,
Sprouts core search, geocoding, routing, images) is plain HTTP and runs on
Vercel exactly as before.

The fix: Trader Joe's only needs a browser to *mint a session cookie* —
the actual product search is a plain authenticated HTTP POST. So
`scraper-service` keeps a warm cookie in memory (refreshed on a timer) and
serves it over HTTP; the Vercel app fetches that cookie and does the fast
GraphQL request itself, no browser involved on Vercel's side. Same idea
for the one-off Sprouts product-image scrape.

```
Browser ──▶ Vercel (Next.js app)
              ├─ Kroger / Aldi / Sprouts search: plain HTTP, unchanged
              ├─ Trader Joe's search: plain HTTP, using a cookie fetched
              │     from scraper-service (cached ~10 min)
              └─ Sprouts image fallback: HTTP call → scraper-service

Render (scraper-service, always-on)
              ├─ GET /trader-joes/cookie — warm session cookie
              ├─ GET /sprouts/image      — one-off product photo scrape
              └─ GET /health             — uptime/keep-alive
```

## Files changed

**New:**
- `scraper-service/` — standalone Node/TS service (own `package.json`,
  not part of the Next.js build). See `scraper-service/README.md` for
  what it does and how to run/deploy it.
- `src/utils/devLog.ts` — `console.log` gated on `NODE_ENV !== 'production'`,
  used for the verbose per-request trace lines that were previously
  unconditional `console.log`s in every scraper.
- `.env.example` — documents every env var the app reads.

**Changed:**
- `src/services/traderJoesLiveScraper.ts` — removed all Playwright/`fs`
  usage; now fetches a session cookie from `scraper-service` over HTTP
  and does the GraphQL search with plain `fetch`, same pattern as
  Kroger/Aldi/Sprouts. Per-store timeout dropped from 45s to 8s (it no
  longer pays for an in-process browser launch).
- `src/services/sproutsLiveScraper.ts` — `fetchSproutsProductImage` is now
  an HTTP call to `scraper-service` instead of launching Playwright
  in-process; same fail-soft contract (returns `null` on failure, caller
  already falls through to Open Food Facts). Diagnostic logs gated behind
  `devLog`.
- `src/services/krogerLiveScraper.ts`, `src/services/aldiLiveScraper.ts` —
  diagnostic logs gated behind `devLog` (no behavior change).
- `src/app/api/search/route.ts` — all four store timeouts tightened to 8s
  each (previously 15s/45s, sized for an in-process browser that no longer
  runs here); added `export const maxDuration = 12`. Diagnostic logs
  gated behind `devLog`.
- `src/app/api/warmup/route.ts` — added `export const maxDuration = 12`.
- `src/app/api/product-image/route.ts` — added `export const maxDuration = 15`
  (covers the sequential store-scrape-then-Open-Food-Facts-fallback path).
- `src/app/api/trip/route.ts` — added `export const maxDuration = 20`
  (covers the Nominatim rate-limit queue plus OSRM's own timeout for
  multi-stop trips).
- `src/instrumentation.ts` — comment update only; still fire-and-forget
  `runWarmup()` at boot, now just HTTP calls under the hood.
- `next.config.ts` — dropped an unused `picsum.photos` image remote
  pattern (dead leftover; every real product image already renders
  `unoptimized`, so this had no effect either way).
- `package.json` — removed the `playwright` dependency (no longer used
  anywhere in the Vercel-deployed app); bumped `next` 16.2.9 → 16.2.11
  (patch release, fixes a middleware-bypass and a DoS advisory —
  `npm audit` still flags `sharp`/`postcss` versions nested inside Next's
  own dependency tree, which only resolve by downgrading Next 7 major
  versions, not worth doing).
- `.gitignore` — added `!.env.example` so the template file is trackable
  despite the blanket `.env*` ignore rule; removed the now-nonexistent
  `.sprouts-session.json`/`.traderjoes-session.json` entries (deleted —
  see below).
- `.env.local` — removed three dead vars (`ALDI_DEFAULT_SHOP_ID`,
  `ALDI_DEFAULT_ZONE_ID`, `ALDI_DEFAULT_POSTAL_CODE` — never read
  anywhere in the code); added `SCRAPER_SERVICE_URL`/`SCRAPER_SERVICE_TOKEN`.

**Deleted:**
- `.sprouts-session.json`, `.traderjoes-session.json` — orphaned
  Playwright session-cookie files at the repo root. The Sprouts one was
  already unused before this change (Sprouts search moved off Playwright
  earlier); the Trader Joe's one is unused now that session state lives
  in `scraper-service`'s memory instead of on disk. Both were
  git-ignored, so this doesn't touch git history.

**Untouched by design** (see "Known limitations" below): `src/repositories/*`
(localStorage-only "database"), `AuthModal.tsx`/`authRepository.ts` (mock
auth), `src/utils/geocode.ts` (Nominatim), `src/services/routingService.ts`
(OSRM) — all already behave identically on Vercel as on `localhost`, so
there was nothing to fix for deployment parity.

## Environment variables

### Vercel project (the Next.js app)

| Variable | Value |
|---|---|
| `KROGER_CLIENT_ID` | From the Kroger Developer Portal |
| `KROGER_CLIENT_SECRET` | From the Kroger Developer Portal |
| `SCRAPER_SERVICE_URL` | Your deployed Render service URL, e.g. `https://shopsmart-scraper-service.onrender.com` |
| `SCRAPER_SERVICE_TOKEN` | A shared secret you generate — must match Render's value below |

### Render service (`scraper-service`)

| Variable | Value |
|---|---|
| `SCRAPER_SERVICE_TOKEN` | Same value as Vercel's `SCRAPER_SERVICE_TOKEN` |

No secrets are exposed to the browser — every env var above is read only
in server-side files (confirmed: no `NEXT_PUBLIC_`-prefixed vars exist in
the codebase).

## Deployment steps

### 1. Deploy `scraper-service` to Render first

1. Push this repo to GitHub (the whole monorepo — `scraper-service/render.yaml`
   points Render at the `scraper-service/` subdirectory).
2. In the Render dashboard: **New → Blueprint**, select this repo.
   Render reads `scraper-service/render.yaml` and creates the service.
3. Render will prompt for `SCRAPER_SERVICE_TOKEN` (generate one, e.g.
   `openssl rand -hex 32`) since it's marked `sync: false` in the blueprint.
4. Wait for the build to finish (`npm install && npx playwright install
   --with-deps chromium && npm run build`), then copy the service's
   `https://*.onrender.com` URL.
5. Verify: `curl https://<your-service>.onrender.com/health` → `{"ok":true,...}`.

**Optional but recommended:** set up a free external uptime ping (e.g.
[cron-job.org](https://cron-job.org)) against `/health` every ~10 minutes
to avoid Render's free-tier 15-minute sleep. Without it, the first
Trader Joe's search after 15+ minutes of no traffic can take 30-60s while
Render wakes up; the app already handles this gracefully (that one search
shows Trader Joe's as temporarily unavailable rather than crashing).

### 2. Deploy the Next.js app to Vercel

1. In the Vercel dashboard: **New Project**, import this repo. Vercel
   auto-detects Next.js — no `vercel.json` is needed (this Next.js
   version's zero-config Vercel adapter handles build output automatically).
2. Set the four environment variables listed above in
   **Project Settings → Environment Variables**.
3. Deploy. Build should succeed with no missing-dependency errors
   (Playwright is no longer in this app's dependency tree).
4. Once live, do a real search on the deployed URL and confirm all 4
   stores respond (Trader Joe's may show its "waking up" behavior on the
   very first search if Render's instance was asleep — try again after a
   few seconds).

### 3. Local development

```bash
cp .env.example .env.local        # fill in real values
cd scraper-service
cp .env.example .env.local        # fill in SCRAPER_SERVICE_TOKEN
npm install && npx playwright install --with-deps chromium
npm run dev                        # runs on :3000 by default

# in the root app's .env.local, point at the local scraper-service:
# SCRAPER_SERVICE_URL=http://localhost:3000
# SCRAPER_SERVICE_TOKEN=<matches scraper-service's .env.local>

cd .. && npm run dev
```

## Verified locally (production build)

Ran `npm run build && npm start` against a locally-running `scraper-service`
instance and confirmed:
- Kroger, Aldi, Sprouts: full live results (e.g. 49 Kroger results for
  "chicken breast" near Cincinnati; 11 Sprouts+Aldi results for "milk"
  near Austin).
- Typo correction: "orange juive" → "Orange Juice" (43 results).
- Trader Joe's: fails gracefully per-store (`storeStatuses` shows
  `status: "error"` for that store only, not a crash) when its upstream
  is unreachable — see the limitation below.
- Sprouts image-fallback: full round trip through `scraper-service`
  confirmed working (scraped and returned a real product photo).
- `/api/product-image` (Open Food Facts fallback), `/api/trip` validation,
  `/api/warmup` aggregation — all behave as expected.
- `npm run lint`, `npx tsc --noEmit`, `npm test` (80 tests) — all clean.

## Known limitations

- **Trader Joe's bot-protection risk**: Trader Joe's storefront is behind
  Akamai's WAF. During local verification, requests from this development
  sandbox's network were blocked outright (`403 Access Denied`) before any
  JS even ran — this happens with the *exact same* browser args/stealth
  script the original, already-working local-dev code used, so it's an
  IP-reputation block on that specific network, not a bug in this port.
  **This needs to be verified against the actual deployed Render
  instance** — datacenter/hosting IP ranges (which Render's are) are
  sometimes on the same kind of blocklist. If Render's IPs turn out to be
  blocked too, Trader Joe's will consistently show as unavailable in
  production even though the code is correct; the fallback in that case
  is accepting graceful degradation (3 of 4 stores fully working) or
  routing `scraper-service` through a residential-IP proxy (a paid
  service, outside the "free" constraint). Test this first via
  `curl https://<render-url>/trader-joes/cookie -H "Authorization: Bearer <token>"`
  after deploying.
- **No real backend/database**: accounts, cart, and route-checklist are
  `localStorage`-only; "sign in" has no password or server verification.
  This is identical on `localhost` today — deployment doesn't change or
  regress it, but it's worth knowing this isn't real auth.
- **Free public APIs, no SLA**: geocoding (Nominatim) and routing (OSRM)
  use free public demo servers with informal rate limits. The app already
  handles failures gracefully (falls back to `null`/best-effort), but
  there's no paid fallback if either goes down or rate-limits under load.
- **Render free-tier spin-down**: see the "optional but recommended"
  keep-alive note above.
