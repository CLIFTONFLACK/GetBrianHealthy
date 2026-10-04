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
