/**
 * Generate the /healthy sub-brand assets from docs/GetBrian_Healthy_Logo.png.
 *
 *   npm run brand:healthy      (not part of `npm run brand`, which rebuilds only
 *                               the masterbrand assets)
 *
 * The Healthy logo is the GetBrian B/G with teal circuit traces, a teal medical
 * cross and a teal swoosh where the masterbrand has gold. It was delivered as a
 * 1254px transparent raster (an app icon with its tile knocked out), and unlike
 * the masterbrand mark it is not traced: at the sizes /healthy shows it (a 34px
 * footer tile up to the 112px hero lockup) the raster keeps its traces and cross
 * legible.
 * Outputs, all under public/healthy/brand/:
 *   healthy-mark.png     transparent, tightly cropped (used in the footer tile)
 *   healthy-mark-lg.png  the same at 3x the landing-page hero lockup
 *   healthy-mark-solo.png  the mark with its traces, terminals and cross painted
 *                        out, for logo-animation.tsx to redraw them as SVG
 *   favicon-16.png, favicon-32.png, icon-512.png, apple-touch-icon.png
 *                        the mark on a white tile
 *   og-image.png         1200x630 share image
 *
 * Why a 16px favicon when the masterbrand ships only 32: the root app/favicon.ico
 * is emitted on every route, /healthy included, declared as 48x48. Browsers
 * prefer an exact size match, so /healthy declaring 16 and 32 wins the tab icon
 * at both 1x and 2x without touching the main site's icons.
 *
 * The mark belongs on white. Its counter is white and a soft white trail runs
 * behind the traces where they enter the letterform; on a dark ground the navy
 * all but disappears and the trail reads as a grey smudge. So the icons use an
 * opaque white tile (same recipe as the masterbrand icons in gen-icons.mjs), and
 * the site shows the mark on white or on a white tile, never directly on dark.
 */

import sharp from "sharp";
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(root, "docs", "GetBrian_Healthy_Logo.png");
const OUT = path.join(root, "public", "healthy", "brand");

/**
 * Alpha at or below this is noise, not artwork. The source carries a faint
 * rounded-square outline from the app-icon tile it was cut from (alpha <= 4
 * around the edges of the canvas); it is invisible on white but would set the
 * crop box to the full canvas and leave a grey ghost on any other ground.
 */
const ALPHA_FLOOR = 8;

/** Heights of the web marks. healthy-mark.png is now drawn only in the footer
 *  tile (34px; it was sized for the old 56px header mark, since removed), the
 *  landing-page hero lockup at 112px (3x here), the logo animation at 160px. The
 *  site serves them `unoptimized`, because next/image would re-encode a flat
 *  logo at quality 75 and soften its edges. */
const MARK_H = 168;
const MARK_LG_H = 336;
const SOLO_H = 480;

/** The swoosh starts below this source row; everything teal above it (traces,
 *  terminals, cross) is what the solo cut removes. */
const SWOOSH_TOP = 800;

/** The counter's own white, sampled (#FCFCFC). Pure white would leave the
 *  removed shapes faintly brighter than the paper around them. */
const COUNTER_WHITE = 0xfc;

const ICON_GROUND = "#FFFFFF";

/** Logo teal, sampled from the source (median of its opaque teal pixels). */
const TEAL = [0x02, 0x8f, 0x96];

/**
 * Icons at or below this size use the compact cut. The circuit traces are ~20px
 * thick on the 1254px source, so in a 32px icon they resample to about half a
 * pixel and fade to a pale smear, and without them the letterform reads as a
 * "3" (the same failure the masterbrand's compact cut exists for).
 */
const COMPACT_MAX = 64;

/** Opening radius that separates the traces (and the hollow rings they end in)
 *  from the solid shapes: wider than a trace, narrower than the cross's arms,
 *  the solid terminals and the swoosh. */
const TRACE_R = 12;

/** How far the compact cut thickens the traces, in source pixels. 12 keeps the
 *  three traces apart and the cross a cross at 32px; 16 starts merging them. */
const THICKEN_R = 12;

// ------------------------------------------------------------------ source

const { data, info } = await sharp(SRC).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const { width: W, height: H, channels: CH } = info;
const N = W * H;

for (let i = 3; i < data.length; i += CH) if (data[i] <= ALPHA_FLOOR) data[i] = 0;

/** Crop raw RGBA to its visible content and return it as a PNG buffer. */
async function cropToContent(raw) {
  let left = W, top = H, right = -1, bottom = -1;
  for (let p = 0; p < N; p++) {
    if (raw[p * CH + 3] === 0) continue;
    const x = p % W, y = (p - x) / W;
    if (x < left) left = x;
    if (x > right) right = x;
    if (y < top) top = y;
    if (y > bottom) bottom = y;
  }
  if (right < 0) throw new Error(`${SRC}: no pixels above alpha ${ALPHA_FLOOR}`);
  const box = { left, top, width: right - left + 1, height: bottom - top + 1 };
  const png = await sharp(raw, { raw: { width: W, height: H, channels: CH } }).extract(box).png().toBuffer();
  return { png, box };
}

// ------------------------------------------------------------ compact cut

/**
 * Square min/max filter on a 0/1 mask, one axis at a time. A square window is
 * separable, and on a binary mask a running sum answers "any set" (max) and
 * "all set" (min) in O(1) per pixel.
 */
function filterAxis(src, r, horizontal, op) {
  const out = new Uint8Array(N);
  const lines = horizontal ? H : W;
  const len = horizontal ? W : H;
  const sums = new Int32Array(len + 1);
  for (let line = 0; line < lines; line++) {
    const idx = (i) => (horizontal ? line * W + i : i * W + line);
    for (let i = 0; i < len; i++) sums[i + 1] = sums[i] + src[idx(i)];
    for (let i = 0; i < len; i++) {
      const lo = Math.max(0, i - r);
      const hi = Math.min(len, i + r + 1);
      const n = sums[hi] - sums[lo];
      out[idx(i)] = op === "max" ? (n > 0 ? 1 : 0) : n === hi - lo ? 1 : 0;
    }
  }
  return out;
}
const dilate = (m, r) => filterAxis(filterAxis(m, r, true, "max"), r, false, "max");
const erode = (m, r) => filterAxis(filterAxis(m, r, true, "min"), r, false, "min");

/**
 * The traces thickened for small icons. Teal is split into thin strokes (the
 * traces and hollow rings) and solid shapes (cross, terminals, swoosh) with a
 * morphological opening; only the strokes are dilated, so the cross keeps its
 * arms instead of swelling into a blob, and the rings fill in to dots. The
 * dilation is painted everywhere except over navy, so the letterform keeps its
 * outline. Teal is tested on saturation (g-r, b-r), not distance: the pale glow
 * around the traces is in the mask, the navy/white anti-alias greys are not.
 */
function compactCut() {
  const teal = new Uint8Array(N);
  const navy = new Uint8Array(N);
  for (let p = 0; p < N; p++) {
    const i = p * CH;
    const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
    if (a <= 128) continue;
    if (g - r > 60 && b - r > 60) teal[p] = 1;
    else if (r < 70 && g < 90 && b < 130 && b > r) navy[p] = 1;
  }
  const solid = dilate(erode(teal, TRACE_R), TRACE_R);
  const strokes = new Uint8Array(N);
  for (let p = 0; p < N; p++) strokes[p] = teal[p] && !solid[p] ? 1 : 0;
  const thick = dilate(strokes, THICKEN_R);

  const out = Buffer.from(data);
  for (let p = 0; p < N; p++) {
    if (!thick[p] || navy[p]) continue;
    const i = p * CH;
    out[i] = TEAL[0];
    out[i + 1] = TEAL[1];
    out[i + 2] = TEAL[2];
    out[i + 3] = 255;
  }
  return out;
}

/**
 * The mark with its traces, terminals and cross painted out. Every teal-tinted
 * pixel above the swoosh, the soft glow around the traces included, grown by
 * five pixels to catch the anti-aliased rim, takes the counter's white (its
 * alpha kept, so the trail behind the traces stays as soft as before). Navy is
 * never touched. logo-animation.tsx redraws what this removes as SVG, in this
 * crop's coordinates, so it is cropped to the display cut's box, not its own.
 */
function soloCut() {
  const tint = new Uint8Array(N);
  const navy = new Uint8Array(N);
  for (let p = 0; p < N; p++) {
    const i = p * CH;
    const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
    if (a === 0) continue;
    if (r < 70 && g < 90 && b < 130 && b > r && a > 128) navy[p] = 1;
    else if (p / W < SWOOSH_TOP && g - r > 15 && b - r > 15) tint[p] = 1;
  }
  const cover = dilate(tint, 5);
  const out = Buffer.from(data);
  for (let p = 0; p < N; p++) {
    if (!cover[p] || navy[p] || out[p * CH + 3] === 0) continue;
    out.fill(COUNTER_WHITE, p * CH, p * CH + 3);
  }
  return out;
}

const display = await cropToContent(data);
const compact = await cropToContent(compactCut());
const soloPng = await sharp(soloCut(), { raw: { width: W, height: H, channels: CH } })
  .extract(display.box)
  .png()
  .toBuffer();

const png = (buf, height) => sharp(buf).resize({ height }).png({ compressionLevel: 9 }).toBuffer();
const mark = await png(display.png, MARK_H);

// ----------------------------------------------------------------- icons

const tile = (size) => {
  const r = Math.round(size * 0.18);
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">` +
      `<rect width="${size}" height="${size}" rx="${r}" ry="${r}" fill="${ICON_GROUND}"/></svg>`
  );
};

/** The mark at 86% of a white rounded tile, as the masterbrand icons do. */
async function icon(size) {
  const inner = Math.round(size * 0.86);
  const m = await sharp(size <= COMPACT_MAX ? compact.png : display.png)
    .resize({ width: inner, height: inner, fit: "inside" })
    .png()
    .toBuffer();
  const meta = await sharp(m).metadata();
  return sharp(tile(size))
    .composite([
      {
        input: m,
        left: Math.round((size - meta.width) / 2),
        top: Math.round((size - meta.height) / 2),
      },
    ])
    .png({ compressionLevel: 9 })
    .toBuffer();
}

// ------------------------------------------------------------- og image

/**
 * The share card is the mark alone on white over a teal base rule. No type:
 * the brand faces are not installed where this runs, so librsvg would set any
 * wordmark in a fallback font (see gen-icons.mjs), and every platform that
 * shows the card prints the page title beside it anyway.
 */
const OG_W = 1200;
const OG_H = 630;
const OG_RULE = 12;
const OG_TEAL = "#028F96";

async function ogImage() {
  const m = await sharp(display.png).resize({ height: 380 }).png().toBuffer();
  const meta = await sharp(m).metadata();
  const ground = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${OG_W}" height="${OG_H}">` +
      `<rect width="${OG_W}" height="${OG_H}" fill="${ICON_GROUND}"/>` +
      `<rect y="${OG_H - OG_RULE}" width="${OG_W}" height="${OG_RULE}" fill="${OG_TEAL}"/></svg>`
  );
  return sharp(ground)
    .composite([
      {
        input: m,
        left: Math.round((OG_W - meta.width) / 2),
        top: Math.round((OG_H - OG_RULE - meta.height) / 2),
      },
    ])
    .png({ compressionLevel: 9 })
    .toBuffer();
}

// ----------------------------------------------------------------- write

mkdirSync(OUT, { recursive: true });
const written = [];
const record = (name, buf) => {
  const p = path.join(OUT, name);
  writeFileSync(p, buf);
  written.push({ file: path.relative(root, p).replace(/\\/g, "/"), kb: (buf.length / 1024).toFixed(1) });
};

record("healthy-mark.png", mark);
// Palette-quantised like the solo cut: it loads eagerly above the fold, and at
// full colour it was heavier (~150KB) than the hero photo it sits beside.
record(
  "healthy-mark-lg.png",
  await sharp(display.png).resize({ height: MARK_LG_H }).png({ palette: true, colours: 256, compressionLevel: 9 }).toBuffer()
);
// Palette-quantised: the full-colour file is ~230KB for a below-the-fold image,
// and the solo cut is flat navy/white with soft edges that 256 colours hold.
record(
  "healthy-mark-solo.png",
  await sharp(soloPng).resize({ height: SOLO_H }).png({ palette: true, colours: 256, compressionLevel: 9 }).toBuffer()
);
record("favicon-16.png", await icon(16));
record("favicon-32.png", await icon(32));
record("icon-512.png", await icon(512));
record("apple-touch-icon.png", await icon(180));
record("og-image.png", await ogImage());

const box = (b) => `${b.width}x${b.height} at (${b.left}, ${b.top})`;
console.log(`display cut ${box(display.box)}, compact cut ${box(compact.box)}, of ${W}x${H}`);
console.table(written);
