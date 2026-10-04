# GetBrian Healthy

GetBrian Healthy ("Brian's Human Longevity Program") is a supplement guide for adults over 40. It reviews one pick each for magnesium, creatine and L-theanine, explains the research behind each, and links to the pick on Amazon. It serves two regions, the US and the UK, and each sees only the picks and wording that apply in their country.

The site earns money through Amazon Associates links. The tags are `getbrian-20` (US) and `getbrian-21` (UK).

- Production: https://www.getbrianhealthy.xyz (the apex domain redirects to `www`)
- Source: GitHub `CLIFTONFLACK/GetBrianHealthy`
- History: this repo was split out of `CLIFTONFLACK/cliftonai-site` on 2026-10-04. The site used to live at `getbrian.xyz/healthy`, and the old site redirects `/healthy/*` here.

## Stack

- Next.js 16.2.12 (App Router), React 19.2.4, TypeScript
- Tailwind CSS 4 (through `@tailwindcss/postcss`)
- Vercel project `getbrianhealthy` in the team `clifton-ai-team`
- No database. The email sign-up uses the Resend API, and live prices come from Amazon's Creators API (see Configuration).

### Read this before you change Next.js code

`AGENTS.md` warns that this version of Next.js has breaking changes: its APIs, conventions and file structure may differ from what you remember. Read the relevant guide in `node_modules/next/dist/docs/` before you write code, and heed deprecation notices. `CLAUDE.md` imports `AGENTS.md`.

## Install

Prerequisite: Node.js 20.9.0 or later. This is the minimum that both `next` and `sharp` declare in their `package.json` files. The repo does not pin a Node version itself.

Work on local disk, for example `C:\dev\GetBrianHealthy`. `npm install` does not complete on the Google Drive volume (`G:`). Build locally and copy the result back to Drive if you need it there.

```powershell
npm install
```

## Quick start

```powershell
npm run dev
```

Next.js prints a local URL, normally http://localhost:3000. Open it and the home page loads. With no environment variables set, the email sign-up form is hidden and no prices are shown (see Configuration), and everything else works.

## Scripts

All scripts are in `package.json`.

| Command | What it does |
| --- | --- |
| `npm run dev` | Runs `next dev`. |
| `npm run build` | Runs `next build`. |
| `npm start` | Runs `next start` on a production build. |
| `npm run lint` | Runs `eslint`. |
| `npm test` | Runs every `src/**/*.test.ts` and `src/**/*.test.tsx` file with `node --test`. It uses `--experimental-test-module-mocks` and the loader in `scripts/test-loader-register.mjs` and `scripts/test-loader.mjs`, which let Node import `.ts` and `.tsx` files directly. Only tests use the loader. The Next.js build does not. |
| `npm run brand:healthy` | Runs `scripts/gen-healthy-brand.mjs`. It regenerates the favicons, app icons, share image and logo marks in `public/healthy/brand/` from `docs/GetBrian_Healthy_Logo.png`. It needs `sharp`, which is a dev dependency. |

`scripts/healthy-mascot/cut.py` and `build.py` are not wired to any npm script. They build the mascot animation frames by hand (they use Pillow, and `build.py` expects ffmpeg output). Read the docstring at the top of `build.py` before you use them.

## Configuration

The code reads two groups of environment variables: the email sign-up (`src/app/newsletter.ts`) and Amazon live prices (`src/lib/amazon-prices.ts`). All of them are server-only. Set them in the Vercel project settings and never commit them. `.env*` files are git-ignored. Do not give any of them a `NEXT_PUBLIC_` prefix.

| Variable | Required | What it does |
| --- | --- | --- |
| `RESEND_API_KEY` | For sign-up | API key used for every call to `https://api.resend.com`. |
| `RESEND_SEGMENT_ID` | For sign-up | Resend segment that confirmed addresses are added to. |
| `NEWSLETTER_SECRET` | For sign-up | Secret that signs the confirmation tokens (HMAC-SHA256). It must be at least 32 characters. |
| `NEWSLETTER_FROM` | For sign-up | The `from` address on the confirmation email. |
| `AMAZON_CREATORS_ID_US` | For US prices | Creators API credential ID for the US store. Used with `AMAZON_CREATORS_SECRET_US`. |
| `AMAZON_CREATORS_SECRET_US` | For US prices | Creators API credential secret for the US store. |
| `AMAZON_CREATORS_ID_GB` | For UK prices | Creators API credential ID for the UK store. Used with `AMAZON_CREATORS_SECRET_GB`. |
| `AMAZON_CREATORS_SECRET_GB` | For UK prices | Creators API credential secret for the UK store. |

There are no defaults. The code treats a variable as missing if it is unset or empty.

### When a variable is missing

The feature is all or nothing. If any of the four is missing, or `NEWSLETTER_SECRET` is shorter than 32 characters, the whole feature is off:

- `signupEnabled()` returns false and the home page does not render the sign-up form.
- `sendConfirmation` and `addContact` return false, and `verifyConfiguredToken` returns null.
- The code does not raise an error and does not log which variable is wrong. A too-short secret looks the same as a missing key.

### How sign-up works

1. The form on the home page sends a confirmation email that contains a signed link to `/confirm?t=<token>`. The token holds the address and an expiry, and it is valid for 48 hours.
2. The reader opens `/confirm` and presses a button. The button is a POST, so mail scanners that pre-open links cannot confirm for the reader.
3. Only then is the address added to the Resend segment. If Resend already has the contact (HTTP 409), the code marks it as subscribed and adds it to the segment.

The form answers "sent" for any well-formed address, so it cannot be used to find out who is on the list. A hidden `website` field acts as a honeypot. `/confirm` is `noindex`.

### Amazon live prices

The home page and the product pages show Amazon's current price for a pick when the site can read one. `src/lib/amazon-prices.ts` fetches it from Amazon's Creators API at request time, and `withPrices(products, region)` sets `Product.livePrice` (`{ amount, currency, fetchedAt }`) on each product that has a fresh price. `src/app/page.tsx` and `src/app/products/[slug]/page.tsx` call it.

**Amazon's terms.** A price may be shown only if it came from Amazon's API recently. Never hardcode a price, never store one in the repo or on disk, and never scrape one. `data.ts` has no prices: `resolveProduct` sets `priceUsd` and `priceCheckedAt` to `null` for every product.

Each region is set up on its own. A region needs both its ID and its secret. If either is missing or empty, that region shows no prices and makes no calls to Amazon. If all four variables are absent, the site behaves as it did before live prices existed: cards say "Current price on Amazon" and the product page says "No current price is available here right now."

What the code does:

- **Which price.** For each product it asks for the listing of the product's ASIN in the visitor's region. It uses only the listing that wins the buy box, so the price matches what the Buy button's page leads with; no winner means no price. It discards the price if the amount is not a positive number, or if the currency is not USD for `US` or GBP for `GB`.
- **Display.** US prices show in USD and UK prices in GBP. Each price is shown with the time it was fetched, in UTC, for example "Price from Amazon, 4 Oct 2026, 14:05 UTC." Cost per serving is worked out from the live price.
- **Cache.** Each price is held in memory for 1 hour (`PRICE_TTL_MS`), per region and ASIN, in each server process. Nothing is written to disk. A listing that Amazon answers without a usable price is remembered for only 60 seconds (`FAILURE_BACKOFF_MS`), so one empty response cannot hide a price for an hour.
- **Failure.** Any failed call (a network error, a 5-second timeout, a non-2xx status, or a token response without an `access_token`) leaves the page without a price. The region is then left alone for 60 seconds (`FAILURE_BACKOFF_MS`), so a slow Amazon outage cannot slow every page. A 401 or 403 from the price call also discards the cached access token. The code never throws to the page and does not log the failure.
- **Calls.** Access tokens are cached and renewed 5 minutes before they expire. Product requests go out in batches of at most 10 ASINs. One refresh (token plus every product request) shares a single 3-second budget (`REFRESH_BUDGET_MS`), so a hung Amazon delays a page by 3 seconds at most.

**Unconfirmed for the UK.** The UK token host (`https://api.amazon.co.uk/auth/o2/token`) and the single API host (`https://creatorsapi.amazon/catalog/v1/getItems`, with the UK store passed as `www.amazon.co.uk` in the `x-marketplace` header and the `marketplace` field) have not been checked against Amazon's documentation or a live call. Treat the first live UK call as the test. Until then, a UK page that shows no price may mean this handling is wrong, not that Amazon has no price. Because failures are not logged, you will not see why.

## Project layout

All pages sit at the app root. Nothing is under a `/healthy` route, because the site now owns its whole domain.

```
src/app/
  page.tsx                          /
  about/  method/  disclosures/     /about, /method, /disclosures
  why-these-picks/                  /why-these-picks (and /why-these-picks/creator-notes)
  products/[slug]/page.tsx          /products/<slug>
  confirm/page.tsx                  /confirm (email confirmation step)
  go/[slug]/route.ts                /go/<slug> (buy-button redirect)
  data.ts                           all content: products, copy, Amazon tags, LAUNCHED
  region.ts, region-server.ts       region detection
  region-actions.ts                 server action behind the footer country switch
  newsletter.ts, actions.ts         email sign-up
  site.ts                           siteUrl and parentSiteUrl
  sitemap.ts, robots.ts             /sitemap.xml and /robots.txt
  __tests__/                        tests (more under go/, products/, why-these-picks/)
src/lib/
  amazon-prices.ts                  live Amazon prices (getPrices, withPrices)
  __tests__/amazon-prices.test.ts   tests for the above
public/healthy/                     static assets
scripts/                            brand generator, test loader, mascot tools
docs/GetBrian_Healthy_Logo.png      source image for brand:healthy
```

Static assets keep the `public/healthy/` prefix on purpose. Their URLs are `/healthy/brand/...`, `/healthy/products/...` and so on, and the code, metadata and tests all refer to those paths.

`next.config.ts` rewrites `/favicon.ico` to `/healthy/brand/favicon-32.png`.

## Where content lives

Everything the pages render comes from `src/app/data.ts`. Adding or swapping a product is a data change.

- **`LAUNCHED`** (currently `true`) is the master switch for search engines. When it is `false`, every page is `noindex` and the sitemap is empty. Set it to `true` only when the launch products are `verified`.
- **`products`** is the list of picks. Each has a `slug`, label figures, evidence, the regions it is sold in (`regions`), one Amazon ASIN per region (`offers`), and optional per-region overrides (`regional`). Figures that have not been checked are `null`, and the page shows "being verified". Today the products are:
  - `pure-encapsulations-magnesium-glycinate` (US and UK)
  - `pure-encapsulations-creatine` (US only)
  - `thorne-creatine` (UK only)
  - `pure-encapsulations-l-theanine` (US and UK)
- **`AMAZON`** holds the host and Associates tag for each region: `www.amazon.com` with `getbrian-20`, and `www.amazon.co.uk` with `getbrian-21`. `amazonUrl(region, asin)` builds the link as `https://<host>/dp/<asin>?tag=<tag>`.
- **`AMAZON_ASSOCIATE_STATEMENT`** is the disclosure sentence Amazon requires wherever the site links to it.
- Other copy (`supplements`, `goals`, `faqs`, `pillars`, `TAGLINE`) is in the same file. It includes the UK variants, which carry only the claims Great Britain authorises.
- Prices are not stored in this file. `resolveProduct` sets `priceUsd` and `priceCheckedAt` to `null`, because Amazon limits how long a price may be displayed. A price appears only when `withPrices` adds a fresh one from Amazon's API at request time (see "Amazon live prices").

The header comment in `data.ts` sets the content rules. Evidence statements use structure/function wording only ("supports..."), never treat, prevent or cure. A pick stays `verified: false` until every label figure has a source. All four products are currently `verified: false`, so each product page shows a draft banner.

### Buy links and `/go/[slug]`

Every current product has an Amazon offer, and Amazon bars redirecting links. So the Buy buttons link straight to Amazon, and `/go/<slug>` returns 404 for all of them. The route still works for any product that has no `offers` and whose `redirectAllowed` is true or whose `affiliateUrl` is null. It sends a 302 to `affiliateUrl ?? brandUrl`, logs a `healthy_buy_click` line with the slug and a fixed source label, and records no IP or user agent. `/go/` is disallowed in `robots.txt`.

## Region behaviour

There are two regions, `US` and `GB`. The region for a request is chosen in this order (`src/app/region.ts` and `src/app/region-server.ts`):

1. The `hl-region` cookie, if its value is exactly `US` or `GB`. The footer country switch sets it (httpOnly, one year, `sameSite: lax`, `secure` in production).
2. The country in the `x-vercel-ip-country` request header. `GB`, `IM`, `JE` and `GG` map to `GB`.
3. `US` for everything else, including a missing header (for example, in local development).

Detection never sets the cookie. Only a visitor's own choice does.

The region changes the products shown, the copy and the metadata description. A product page for a pick that is not sold in the visitor's region redirects to that region's pick for the same ingredient.

**No page may be static or cached.** One URL shows different content by country, so a shared cache would serve one country's page to the other. `getRegion()` reads cookies and headers, which makes every page that calls it dynamic, and the root layout calls it. Do not add `force-static`, `revalidate` or `use cache` to any route. The comment in `region-server.ts` states this rule.

## Redirects, sitemap and robots

- `next.config.ts` permanently redirects (308) the three retired Thorne product URLs to the Pure Encapsulations pages that replaced them. The three picks were all Thorne until 2026-10-01.
  - `/products/thorne-magnesium-glycinate` to `/products/pure-encapsulations-magnesium-glycinate`
  - `/products/thorne-creatine-stick-packs` to `/products/pure-encapsulations-creatine`
  - `/products/thorne-theanine` to `/products/pure-encapsulations-l-theanine`

  `/products/thorne-creatine` is a live page (the UK creatine pick), not a redirect.
- `/sitemap.xml` (`src/app/sitemap.ts`) is empty unless `LAUNCHED` is true. It lists `/`, `/method`, `/why-these-picks`, `/about`, `/disclosures` and the product pages for US picks only, because crawlers arrive from the US and a UK-only product page would just redirect. `/confirm`, `/go/*` and creator notes are left out.
- `/robots.txt` (`src/app/robots.ts`) allows `/`, disallows `/go/`, and points to the sitemap on `https://www.getbrianhealthy.xyz`.
- `siteUrl` in `src/app/site.ts` is `https://www.getbrianhealthy.xyz`. It is the host that actually serves. Canonical URLs, Open Graph URLs and the sitemap all use it, so keep them in step.

## Deploying

Push to `main` on GitHub `CLIFTONFLACK/GetBrianHealthy`. Vercel builds and deploys from there. Do not deploy with the Vercel CLI.

Before you push, check which GitHub account is active (`gh auth switch --user CLIFTONFLACK`). A "403 denied" on push means the wrong account is active.

## Common problems

| Symptom | Cause and fix |
| --- | --- |
| The email sign-up form does not appear on the home page. | At least one of the four newsletter variables is missing, or `NEWSLETTER_SECRET` is shorter than 32 characters. Set all four in the Vercel project and redeploy. |
| The sign-up form shows an error after submit. | `sendConfirmation` returned false or threw, usually because Resend refused the email. Check `RESEND_API_KEY` and that `NEWSLETTER_FROM` is a sender Resend accepts. Every failed Resend call writes one `[newsletter] {"step":...,"status":...,"name":...,"message":...}` line to the runtime logs (search for `[newsletter]`); the address, key and token are scrubbed out of it, and it waits at most two seconds for Resend's error body. |
| `/confirm` shows "That link didn't work". | The link is older than 48 hours, was copied incompletely, or `NEWSLETTER_SECRET` changed after the email was sent. Sign up again. The same message appears if Resend refuses to add the contact. |
| A UK visitor sees the US page, or the other way round. | Check for a stale `hl-region` cookie, which overrides detection. Locally there is no `x-vercel-ip-country` header, so you always get `US` unless the cookie says otherwise. Use the footer switch. |
| One country sees the other's content in production. | A page or route has been made static or cached. Remove `force-static`, `revalidate` or `use cache`. |
| `npm install` fails or hangs. | You are on the Google Drive volume (`G:`). Move to local disk. |
| `npm run brand:healthy` fails. | It needs `sharp` installed (`npm install`) and `docs/GetBrian_Healthy_Logo.png`. It also throws if the logo has no pixels above its alpha threshold. |
| No price shows, and cards say "Current price on Amazon". | Expected when the region's `AMAZON_CREATORS_ID_*` and `AMAZON_CREATORS_SECRET_*` pair is not both set in Vercel. Otherwise a call to Amazon failed and the region is in its 60-second back-off, or Amazon returned no usable price (wrong currency, no offer). Nothing is logged, so check the credentials first. After you change a variable in Vercel, redeploy. For the UK, see "Unconfirmed for the UK". |
| A price is a few minutes old, or shows the wrong time. | Prices are cached in memory for up to 1 hour. The time beside the price is when Amazon was asked, in UTC, not the current time. |
| `/go/<slug>` returns 404. | Expected for every current product. See "Buy links". |
