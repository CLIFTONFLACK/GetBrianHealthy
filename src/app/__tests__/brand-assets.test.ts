import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// layout.tsx imports next/font/google, which the plain node:test loader
// (scripts/test-loader.mjs only strips types/JSX, it doesn't shim Google
// Fonts network calls) can't execute — the same reason robots.test.ts and
// sitemap.test.ts stub it via mock.module instead of importing it. There's
// nothing to mock the *values* checked here out of, though (they're literal
// metadata and JSX, not something the module exports), so this reads the
// source file as text instead, the way the task brief anticipates.
const testDir = path.dirname(fileURLToPath(import.meta.url));
const layoutPath = path.resolve(testDir, "../layout.tsx");
const layoutSource = readFileSync(layoutPath, "utf8");
const publicDir = path.resolve(testDir, "../../../public");

function absoluteFromPublic(webPath: string): string {
  assert.match(webPath, /^\//, `expected a root-relative path, got "${webPath}"`);
  return path.join(publicDir, webPath);
}

/** Reads width/height out of a PNG's IHDR chunk (bytes 16-23 of a valid PNG),
 *  with no image-decoding dependency required. */
function pngDimensions(filePath: string): { width: number; height: number } {
  const buf = readFileSync(filePath);
  const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  assert.ok(
    buf.length >= 24 && buf.subarray(0, 8).equals(PNG_SIGNATURE),
    `${filePath} does not start with a valid PNG signature`,
  );
  return {
    width: buf.readUInt32BE(16),
    height: buf.readUInt32BE(20),
  };
}

// ---------------------------------------------------------------------------
// pngDimensions
// ---------------------------------------------------------------------------

test("pngDimensions throws for a file that is not a PNG", () => {
  assert.throws(() => pngDimensions(layoutPath), /valid PNG signature/);
});

// ---------------------------------------------------------------------------
// metadata.icons — every declared size must exist on disk and match its
// declared dimensions exactly.
// ---------------------------------------------------------------------------

function extractIconDeclarations(source: string): Array<{ url: string; width: number; height: number }> {
  const re = /url:\s*"([^"]+)",\s*sizes:\s*"(\d+)x(\d+)"/g;
  const icons: Array<{ url: string; width: number; height: number }> = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(source))) {
    icons.push({ url: m[1], width: Number(m[2]), height: Number(m[3]) });
  }
  return icons;
}

const declaredIcons = extractIconDeclarations(layoutSource);

test("layout.tsx declares at least one icon (sanity check for the loop below)", () => {
  assert.ok(declaredIcons.length > 0);
});

test("layout.tsx declares exactly the four expected icon sizes", () => {
  const sizes = declaredIcons.map((i) => `${i.width}x${i.height}`).sort();
  assert.deepEqual(sizes, ["16x16", "180x180", "32x32", "512x512"]);
});

for (const icon of declaredIcons) {
  test(`declared icon "${icon.url}" (${icon.width}x${icon.height}) exists in public/`, () => {
    assert.ok(existsSync(absoluteFromPublic(icon.url)), `missing file: ${icon.url}`);
  });

  test(`declared icon "${icon.url}" file's real pixel size matches its declared ${icon.width}x${icon.height}`, () => {
    const filePath = absoluteFromPublic(icon.url);
    assert.ok(existsSync(filePath), `missing file: ${icon.url}`);
    const dims = pngDimensions(filePath);
    assert.equal(dims.width, icon.width, `${icon.url} width`);
    assert.equal(dims.height, icon.height, `${icon.url} height`);
  });
}

// ---------------------------------------------------------------------------
// healthyOpenGraph.images — the share image's declared size must match the
// real file, and the file must exist.
// ---------------------------------------------------------------------------

function extractOgImage(source: string): { url: string; width: number; height: number } {
  const m = source.match(/images:\s*\[\{\s*url:\s*"([^"]+)",\s*width:\s*(\d+),\s*height:\s*(\d+)/);
  assert.ok(m, "fixture assumption: healthyOpenGraph.images declares a url/width/height");
  return { url: m![1], width: Number(m![2]), height: Number(m![3]) };
}

const ogImage = extractOgImage(layoutSource);

test("og-image is declared as 1200x630", () => {
  assert.equal(ogImage.width, 1200);
  assert.equal(ogImage.height, 630);
});

test("og-image file exists in public/", () => {
  assert.ok(existsSync(absoluteFromPublic(ogImage.url)), `missing file: ${ogImage.url}`);
});

test("og-image file's real pixel size matches its declared 1200x630", () => {
  const filePath = absoluteFromPublic(ogImage.url);
  assert.ok(existsSync(filePath), `missing file: ${ogImage.url}`);
  const dims = pngDimensions(filePath);
  assert.equal(dims.width, ogImage.width);
  assert.equal(dims.height, ogImage.height);
});

// ---------------------------------------------------------------------------
// ogImages — the photo share cards for /, /routine and /method. Each page
// sets `images: [ogImages.<name>]` on its own openGraph (Next merges metadata
// one level deep, so the page's images list is the one that ships), and
// each card file is a real 1200x630 JPEG. og-image.png stays the fallback
// for every other page, so the checks above still hold.
// ---------------------------------------------------------------------------

/** Reads width/height out of a baseline or progressive JPEG's SOF marker. */
function jpegDimensions(filePath: string): { width: number; height: number } {
  const buf = readFileSync(filePath);
  assert.ok(buf.length > 4 && buf[0] === 0xff && buf[1] === 0xd8, `${filePath} does not start with a JPEG SOI marker`);
  let offset = 2;
  while (offset + 9 < buf.length) {
    assert.equal(buf[offset], 0xff, `${filePath}: expected a marker at byte ${offset}`);
    const marker = buf[offset + 1];
    const length = buf.readUInt16BE(offset + 2);
    // SOF0..SOF15, excluding the DHT/JPG/DAC markers that share the range.
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      return { height: buf.readUInt16BE(offset + 5), width: buf.readUInt16BE(offset + 7) };
    }
    offset += 2 + length;
  }
  throw new Error(`${filePath}: no SOF marker found`);
}

test("jpegDimensions throws for a file that is not a JPEG", () => {
  assert.throws(() => jpegDimensions(layoutPath), /JPEG SOI marker/);
});

const OG_CARDS = ["home", "routine", "method"] as const;

test("layout.tsx builds the three photo cards from one ogCard helper at 1200x630", () => {
  assert.match(layoutSource, /url: `\/healthy\/brand\/og-\$\{name\}\.jpg`,\s*width: 1200,\s*height: 630,/);
  for (const name of OG_CARDS) {
    assert.match(layoutSource, new RegExp(`\\b${name}: ogCard\\("${name}", "[^"]+"\\)`), `ogImages.${name}`);
  }
});

for (const name of OG_CARDS) {
  test(`share card og-${name}.jpg exists in public/ and is a real 1200x630 JPEG`, () => {
    const filePath = absoluteFromPublic(`/healthy/brand/og-${name}.jpg`);
    assert.ok(existsSync(filePath), `missing file: /healthy/brand/og-${name}.jpg`);
    const dims = jpegDimensions(filePath);
    assert.equal(dims.width, 1200, `og-${name}.jpg width`);
    assert.equal(dims.height, 630, `og-${name}.jpg height`);
  });
}

const sourceFor: Record<(typeof OG_CARDS)[number], string> = {
  home: layoutSource,
  routine: readFileSync(path.resolve(testDir, "../routine/page.tsx"), "utf8"),
  method: readFileSync(path.resolve(testDir, "../method/page.tsx"), "utf8"),
};

for (const name of OG_CARDS) {
  test(`the ${name} page's openGraph ships its own card as its images list`, () => {
    const source = sourceFor[name];
    assert.match(source, new RegExp(`openGraph: \\{ \\.\\.\\.healthyOpenGraph,[^\\n]*images: \\[ogImages\\.${name}\\] \\}`));
  });
}

test("the routine and method pages import ogImages from the layout, not a local copy", () => {
  assert.match(sourceFor.routine, /import \{ healthyOpenGraph, ogImages \} from "\.\.\/layout";/);
  assert.match(sourceFor.method, /import \{ healthyOpenGraph, ogImages \} from "\.\.\/layout";/);
});

test("the about page keeps the fallback card (its openGraph names no images of its own)", () => {
  const about = readFileSync(path.resolve(testDir, "../about/page.tsx"), "utf8");
  assert.match(about, /\.\.\.healthyOpenGraph/);
  assert.doesNotMatch(about, /ogImages/);
});

test("the brand script writes the three cards from docs/og and keeps og-image.png", () => {
  const script = readFileSync(path.resolve(testDir, "../../../scripts/gen-healthy-brand.mjs"), "utf8");
  assert.match(script, /async function ogOverPhoto\(name\)/);
  assert.match(script, /for \(const name of \["home", "routine", "method"\]\) record\(`og-\$\{name\}\.jpg`, await ogOverPhoto\(name\)\);/);
  assert.match(script, /record\("og-image\.png", await ogImage\(\)\);/);
  for (const name of OG_CARDS) {
    const src = path.resolve(testDir, `../../../docs/og/${name}.jpg`);
    assert.ok(existsSync(src), `missing source photo docs/og/${name}.jpg`);
    assert.deepEqual(jpegDimensions(src), { width: 1200, height: 630 }, `docs/og/${name}.jpg must already be 1200x630`);
  }
});

// ogOverPhoto: the script runs on import and writes files, so it is checked as
// source text, not called. Its size guard is the failure path for a source
// photo that is not 1200x630.

function ogOverPhotoBody(): string {
  // The script is CRLF on disk; the closing "\n}\n" below only matches after normalising.
  const script = readFileSync(path.resolve(testDir, "../../../scripts/gen-healthy-brand.mjs"), "utf8").replace(/\r\n/g, "\n");
  const start = script.indexOf("async function ogOverPhoto(name) {");
  assert.ok(start !== -1, "expected an ogOverPhoto function");
  const end = script.indexOf("\n}\n", start);
  assert.ok(end !== -1, "expected ogOverPhoto to close");
  return script.slice(start, end);
}

test("ogOverPhoto reads docs/og/<name>.jpg, and the expected size is 1200 by 630", () => {
  const script = readFileSync(path.resolve(testDir, "../../../scripts/gen-healthy-brand.mjs"), "utf8");
  assert.match(script, /const OG_PHOTO_DIR = path\.join\(root, "docs", "og"\);/);
  assert.match(script, /const OG_W = 1200;/);
  assert.match(script, /const OG_H = 630;/);
  assert.match(ogOverPhotoBody(), /path\.join\(OG_PHOTO_DIR, `\$\{name\}\.jpg`\)/);
});

test("ogOverPhoto refuses a source photo unless both its width and its height match", () => {
  assert.match(ogOverPhotoBody(), /if \(meta\.width !== OG_W \|\| meta\.height !== OG_H\) \{/);
});

test("the size error names the photo file and both the expected and the actual size", () => {
  assert.match(ogOverPhotoBody(), /throw new Error\(`\$\{photo\}: expected \$\{OG_W\}x\$\{OG_H\}, got \$\{meta\.width\}x\$\{meta\.height\}`\);/);
});

test("ogOverPhoto checks the size after reading the metadata and before it composites anything", () => {
  const body = ogOverPhotoBody();
  const metadata = body.indexOf("const meta = await sharp(photo).metadata();");
  const guard = body.indexOf("if (meta.width !== OG_W");
  const composite = body.indexOf(".composite(");
  assert.ok(metadata !== -1, "expected the metadata read");
  assert.ok(metadata < guard, "the metadata read must come before the guard");
  assert.ok(guard < composite, "the guard must come before the composite");
});

test("ogOverPhoto has no catch, so a bad source photo stops the whole brand run instead of writing a wrong card", () => {
  assert.doesNotMatch(ogOverPhotoBody(), /\bcatch\b/);
});

// ---------------------------------------------------------------------------
// Header/footer mark — must be the Healthy mark, not the masterbrand's.
// ---------------------------------------------------------------------------

test("healthy-mark.png file exists in public/", () => {
  assert.ok(existsSync(absoluteFromPublic("/healthy/brand/healthy-mark.png")));
});

test("layout shows the Healthy mark twice: the desktop sidebar and the footer tile", () => {
  const occurrences = layoutSource.match(/\/healthy\/brand\/healthy-mark\.png/g) ?? [];
  // The small-screen floating header stays links only; the left sidebar
  // (lg and up) and the footer tile each carry one mark.
  assert.equal(occurrences.length, 2);
  const aside = layoutSource.slice(layoutSource.indexOf("<aside"), layoutSource.indexOf("</aside>"));
  assert.match(aside, /\/healthy\/brand\/healthy-mark\.png/);
});

test("the floating header carries no logo image", () => {
  const header = layoutSource.slice(layoutSource.indexOf("<header"), layoutSource.indexOf("</header>"));
  assert.ok(header.length > 0, "expected a <header> in layout.tsx");
  assert.doesNotMatch(header, /<Image\b/);
});

test("layout no longer references the masterbrand mark", () => {
  assert.doesNotMatch(layoutSource, /brian-mark-compact\.svg/);
});
