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
- No database. The email sign-up uses the Resend API (see Configuration).

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

Next.js prints a local URL, normally http://localhost:3000. Open it and the home page loads. With no environment variables set, the email sign-up form is hidden (see Configuration), and everything else works.

## Scripts

All scripts are in `package.json`.

| Command | What it does |
| --- | --- |
| `npm run dev` | Runs `next dev`. |
| `npm run build` | Runs `next build`. |
| `npm start` | Runs `next start` on a production build. |
| `npm run lint` | Runs `eslint`. |
| `npm test` | Runs every `src/**/*.test.ts` and `src/**/*.test.tsx` file with `node --test`. It uses `--experimental-test-module-mocks` and the loader in `scripts/test-loader-register.mjs` and `scripts/test-loader.mjs`, which let Node import `.ts` and `.tsx` files directly. Only tests use the loader. The Next.js build does not. |
| `npm run brand:healthy` | Runs `scripts/gen-healthy-brand.mjs`. It regenerates the favicons, app icons, share image and logo marks in `public/healthy/brand/` from `docs/GetBrian_Healthy_Logo.png`. It also writes three photo share cards in the same folder: `og-home.jpg`, `og-routine.jpg` and `og-method.jpg`, built from `docs/og/home.jpg`, `docs/og/routine.jpg` and `docs/og/method.jpg` (each 1200x630). `og-image.png` stays the fallback card. It needs `sharp`, which is a dev dependency. |

`scripts/healthy-mascot/cut.py` and `build.py` are not wired to any npm script. They build the mascot animation frames by hand (they use Pillow, and `build.py` expects ffmpeg output). Read the docstring at the top of `build.py` before you use them.

## Media assets

The home hero (`src/app/hero-video.tsx`) plays a silent looping clip of three scenes. The `/method` page plays a second clip, "How Brian decides". The `/routine` page plays its own clip. The product pages show a still. These files are committed. `npm run brand:healthy` does not rebuild them. Run the commands below from the repo root when you replace a clip or a still. The home hero build is the exception: it runs from the `hero-data` folder outside the repo.

The hero never plays under reduced motion or Save-Data. Those visitors get the poster alone.

### Home hero

The home hero has two cuts. The 16:9 cut shows from `lg` (64rem) up. The square cut shows below it. `HERO_VIDEO` in `src/app/hero-video.tsx` names the files:

| File in `public/healthy/video/` | Size | Used |
| --- | --- | --- |
| `home-hero-v2-16x9.mp4` | 1920x1080 | From `lg` up. Full-bleed behind the copy. |
| `home-hero-v2-16x9-poster.webp` | 1600x900 | Poster for the 16:9 cut. |
| `home-hero-v2-1x1.mp4` | 1080x1080 | Below `lg`. A square crop around each scene's subject. |
| `home-hero-v2-1x1-poster.webp` | 810x810 | Poster for the square cut. |

The first version used `home-hero-16x9.mp4` and `home-hero-9x16.mp4`. Those files are no longer in the repo.

The clip is a silent loop of three scenes. A small chip in the corner names each scene:

| Scene | Chip | Source take | Start in take | Frames used |
| --- | --- | --- | --- | --- |
| Strength: a home gym | `1 Strength` | `E2_routine_loop_16x9.mp4` | 6.6 s | 50 |
| Focus: a desk by a window | `2 Focus` | `H1_focus_desk_16x9.mp4` | 0 s | 124 |
| Calm: an armchair, a lamp, a mug at night | `3 Calm` | `E2_routine_loop_16x9.mp4` | 9.3 s | 132 |

Each scene fades into the next over 12 frames (0.5 s). The loop is 282 frames, 11.75 s, at 24 fps. At the end, it dissolves back to frame 1, so the loop has no seam. Frame 1 shows the `1 Strength` chip, so the poster shows it too.

The takes are in `G:\My Drive\CLAUDE\Ai-projects-BRIAN\GetBrian-Healthy\output\Site-assets\openart\raw\`. The build script is `build_hero_v2.py` in `G:\My Drive\CLAUDE\Ai-projects-BRIAN\GetBrian-Healthy\output\Site-assets\hero-data\`. Both folders sit in the `output` folder, outside this repo. `H1b_focus_desk_alt_16x9.mp4` in the raw folder is an unused alternative Focus take. The script does not read it.

The takes must be 1920x1080. The build reads raw frames of that size. It stops with `ended early at frame N` if a take runs out before a scene is done.

Run these from the `hero-data` folder. `build_hero.py` must stay beside `build_hero_v2.py`, because the build imports it.

```powershell
python build_hero_v2.py wide --frames 0,80,200,300
python build_hero_v2.py wide --full
python build_hero_v2.py square --full
```

The first command writes PNG previews to `out\preview-v2-wide\`. Check them before you encode. Each `--full` command encodes one cut and writes its poster to `out\`:

- `wide --full` writes `out\home-hero-v2-16x9.mp4` and `out\home-hero-v2-16x9-poster.webp`.
- `square --full` writes `out\home-hero-v2-1x1.mp4` and `out\home-hero-v2-1x1-poster.webp`.

The script does not copy the files into the repo. Copy all four into `public\healthy\video\`.

Each encode uses libx264 with `-preset slow`, `-crf 24` (set another value with `--crf`), a GOP of 48 frames and no audio. It writes the bt709 colour tags into the H.264 stream in the same encode, and it sets `+faststart`. There is no separate tagged-copy step. Do not use the ffmpeg commands under "Routine clip" for these files.

The poster is frame 1 of the composed frame, written before encoding. The hero test checks that the poster matches frame 1 of the mp4, with a mean channel difference under 12.

The square cut centres each scene on its subject. The crop centres are x = 960, 1300 and 900 of the 1920 px frame.

The build needs these:

- Python with Pillow and numpy. `build_hero.py` imports both. `build_hero_v2.py` imports Pillow and uses `build_hero.py`.
- `ffmpeg` on PATH.
- Google Chrome at `C:\Program Files\Google\Chrome\Application\chrome.exe`. `build_hero.py` has this path hard-coded. Chrome draws the chips.
- Internet access on the first run. The chip page loads the site fonts from Google Fonts. The chips are then cached in `out\pieces-scenes-wide\` and `out\pieces-scenes-square\`. Delete a cache folder to draw its chips again.

### Method clip

The `/method` clip ("How Brian decides") uses the `method-data-*` files named by `METHOD_VIDEO` in `hero-video.tsx`. `build_hero.py` makes the panel over the kitchen takes (`E1_home_hero_16x9.mp4` and `E3_home_hero_9x16.mp4`). It writes `home-hero-data-16x9.mp4` and `home-hero-data-9x16.mp4`, not the `method-data-*` names, so rename the files when you copy them into `public\healthy\video\`. Any crop of those files is made with ffmpeg and is not in the script.

### Routine clip

The `/routine` clip is one encode. Its last 0.5 s crossfades into a frozen copy of frame 1, so the clip loops without a seam. The encode is YUV with no audio. The file is tagged bt709 and has `moov` first.

Set `IN` to the raw take, `OUT` to the file under `public/healthy/video/`, and `OFF` to the take's duration minus 0.5. Read the duration with `ffprobe -v error -show_entries format=duration -of csv=p=0 IN`.

| Clip | IN (raw take, in the `output` folder outside this repo) | OUT | Changes to the command |
| --- | --- | --- | --- |
| `/routine` | `G:\My Drive\CLAUDE\Ai-projects-BRIAN\GetBrian-Healthy\output\Site-assets\openart\raw\E2_routine_loop_16x9.mp4` | `public/healthy/video/routine-day.mp4` | Adds `scale=1280:720:flags=lanczos,` before `split` in the filter graph, and `-maxrate 1200k` instead of `2000k`. |

The first command encodes the clip. The second command writes `OUT.tagged.mp4`, a copy with the colour tags written into the H.264 stream itself (the first command only sets the container tags). Rename the tagged copy over `OUT`; that is the file the site serves.

```powershell
ffmpeg -y -i IN -an -filter_complex "[0:v]split=2[main][b];[b]trim=end_frame=1,setpts=PTS-STARTPTS,tpad=stop_mode=clone:stop_duration=0.5[first];[main][first]xfade=transition=fade:duration=0.5:offset=OFF,format=yuv420p[v]" -map "[v]" -r 24 -c:v libx264 -preset slow -crf 23 -maxrate 2000k -bufsize 4000k -color_primaries bt709 -color_trc bt709 -colorspace bt709 -movflags +faststart OUT
ffmpeg -y -i OUT -c copy -bsf:v h264_metadata=colour_primaries=1:transfer_characteristics=1:matrix_coefficients=1:video_full_range_flag=0 -color_primaries bt709 -color_trc bt709 -colorspace bt709 -movflags +faststart OUT.tagged.mp4
```

### Posters

The `/routine` poster is frame 1 of its encoded clip. Run this after the clip is in place under `public/healthy/video/`. The width is 1280 px. The home hero posters come from the build script, in the Home hero section.

```powershell
ffmpeg -y -i public/healthy/video/routine-day.mp4 -frames:v 1 -vf "scale=1280:-2:in_color_matrix=bt709" -c:v libwebp -quality 80 public/healthy/video/routine-day-poster.webp
```

### Stills

There is no npm script for the stills. They came from a one-off Node script that uses `sharp`, a dev dependency. The script reads the raw PNGs (`S1.png` to `S6.png`) from the same raw folder as the clips and writes one JPEG for each:

- `S1`, `S2`, `S3` to `public/healthy/hero/magnesium.jpg`, `creatine.jpg` and `l-theanine.jpg`: 1600 px wide, JPEG quality 80, mozjpeg. These are the `heroImage` values in `src/app/data.ts`.
- `S4`, `S5`, `S6` to `docs/og/home.jpg`, `routine.jpg` and `method.jpg`: 1200x630, cover fit, JPEG quality 90. These are the share-card sources.

After you change the share-card sources in `docs/og/`, run `npm run brand:healthy` to write the share cards.

### Tests

The tests in `src/app/__tests__/hero-video.test.tsx` and `src/app/__tests__/routine-hero-clip.test.tsx` use ffmpeg to check each clip for a loop seam and for no audio stream, and the home posters against frame 1, and they skip those checks when `ffmpeg` is not on PATH.

## Configuration

The only environment variables the code reads are for the email sign-up. They are read in `src/app/newsletter.ts`. Set them in the Vercel project settings. `.env*` files are git-ignored.

| Variable | Required | What it does |
| --- | --- | --- |
| `RESEND_API_KEY` | For sign-up | API key used for every call to `https://api.resend.com`. |
| `RESEND_SEGMENT_ID` | For sign-up | Resend segment that confirmed addresses are added to. |
| `NEWSLETTER_SECRET` | For sign-up | Secret that signs the confirmation tokens (HMAC-SHA256). It must be at least 32 characters. |
| `NEWSLETTER_FROM` | For sign-up | The `from` address on the confirmation email. |

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
public/healthy/                     static assets
  video/                            home hero, /method and /routine clips, with posters
  hero/                             product-page hero stills
scripts/                            brand generator, test loader, mascot tools
docs/GetBrian_Healthy_Logo.png      source image for brand:healthy
docs/og/                            share-card source photos for brand:healthy
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
- Product pages never show a price. `resolveProduct` sets the price fields to `null`, because Amazon limits how long a price may be displayed.

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
| `npm run brand:healthy` fails. | It needs `sharp` installed (`npm install`), `docs/GetBrian_Healthy_Logo.png`, and `docs/og/home.jpg`, `routine.jpg` and `method.jpg`. Each photo must be exactly 1200x630, or the script throws. It also throws if the logo has no pixels above its alpha threshold. |
| `/go/<slug>` returns 404. | Expected for every current product. See "Buy links". |
