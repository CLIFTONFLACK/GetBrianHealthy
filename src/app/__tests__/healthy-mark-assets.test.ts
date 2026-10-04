import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Everywhere the /healthy/brand/*.png marks are declared: the footer tile
 * (layout.tsx), the hero lockup (page.tsx), and the animated mark
 * (logo-animation.tsx). Read as source text for the same reason
 * brand-assets.test.ts does (layout.tsx imports next/font/google, which the
 * plain node:test loader can't execute).
 */
const testDir = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.resolve(testDir, "../../../public");

const files = {
  layout: path.resolve(testDir, "../layout.tsx"),
  page: path.resolve(testDir, "../page.tsx"),
  logoAnimation: path.resolve(testDir, "../logo-animation.tsx"),
};
const sources = {
  layout: readFileSync(files.layout, "utf8"),
  page: readFileSync(files.page, "utf8"),
  logoAnimation: readFileSync(files.logoAnimation, "utf8"),
};

function absoluteFromPublic(webPath: string): string {
  assert.match(webPath, /^\//, `expected a root-relative path, got "${webPath}"`);
  return path.join(publicDir, webPath);
}

function pngDimensions(filePath: string): { width: number; height: number } {
  const buf = readFileSync(filePath);
  const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  assert.ok(buf.length >= 24 && buf.subarray(0, 8).equals(PNG_SIGNATURE), `${filePath} is not a PNG`);
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

/** Every `/healthy/brand/*.png` path referenced anywhere in the given source. */
function referencedMarkPaths(source: string): string[] {
  const matches = source.match(/\/healthy\/brand\/[\w-]+\.png/g) ?? [];
  return [...new Set(matches)];
}

/** `<Image src="/healthy/brand/x.png" ... width={W} height={H} ...>` triples,
 *  for the Image tags that declare intrinsic pixel dimensions (not `fill`). */
function sizedMarkDeclarations(source: string): Array<{ src: string; width: number; height: number }> {
  const re = /src="(\/healthy\/brand\/[\w-]+\.png)"[^>]*?width=\{(\d+)\}[^>]*?height=\{(\d+)\}/gs;
  const out: Array<{ src: string; width: number; height: number }> = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(source))) {
    out.push({ src: m[1], width: Number(m[2]), height: Number(m[3]) });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Existence: everything referenced must exist on disk.
// ---------------------------------------------------------------------------

const allReferenced = new Set([
  ...referencedMarkPaths(sources.layout),
  ...referencedMarkPaths(sources.page),
  ...referencedMarkPaths(sources.logoAnimation),
]);

test("at least one /healthy/brand mark is referenced across layout, page and logo-animation (sanity check)", () => {
  assert.ok(allReferenced.size > 0);
});

for (const webPath of allReferenced) {
  test(`referenced mark "${webPath}" exists in public/`, () => {
    assert.ok(existsSync(absoluteFromPublic(webPath)), `missing file: ${webPath}`);
  });
}

test("logo-animation.tsx references the solo-cut mark", () => {
  assert.ok(referencedMarkPaths(sources.logoAnimation).includes("/healthy/brand/healthy-mark-solo.png"));
});

// ---------------------------------------------------------------------------
// Aspect ratio: every sized <Image> declaration must match its file's real
// pixel aspect ratio, within a rounding pixel (the generator resizes the
// display cut to an exact height per size, so width can round by 1px).
// ---------------------------------------------------------------------------

const sizedDeclarations = [
  ...sizedMarkDeclarations(sources.layout),
  ...sizedMarkDeclarations(sources.page),
];

test("layout.tsx and page.tsx together declare at least the header and hero marks (sanity check)", () => {
  assert.ok(sizedDeclarations.length >= 2);
});

for (const decl of sizedDeclarations) {
  test(`declared size for "${decl.src}" (${decl.width}x${decl.height}) matches the file's own aspect ratio within 1px`, () => {
    const filePath = absoluteFromPublic(decl.src);
    assert.ok(existsSync(filePath), `missing file: ${decl.src}`);
    const actual = pngDimensions(filePath);
    // Scale the declared aspect ratio to the file's real height, and expect
    // the resulting width within a rounding pixel of the file's real width.
    const expectedWidth = actual.height * (decl.width / decl.height);
    assert.ok(
      Math.abs(expectedWidth - actual.width) <= 1,
      `declared ${decl.width}x${decl.height} implies width ~${expectedWidth.toFixed(2)} at height ${actual.height}, but the file is ${actual.width}x${actual.height}`,
    );
  });
}

// ---------------------------------------------------------------------------
// The solo mark's own aspect ratio must equal the SVG crop box's aspect
// ratio (978/839... see logo-animation.test.tsx for the full VIEW_BOX pin;
// this file only checks the underlying asset dimensions it depends on).
// ---------------------------------------------------------------------------

test("healthy-mark-solo.png's aspect ratio matches the documented 982x839 crop", () => {
  const dims = pngDimensions(absoluteFromPublic("/healthy/brand/healthy-mark-solo.png"));
  const actualAspect = dims.width / dims.height;
  const cropAspect = 982 / 839;
  assert.ok(
    Math.abs(actualAspect - cropAspect) < 0.01,
    `expected ${dims.width}x${dims.height} (aspect ${actualAspect}) to match crop aspect ${cropAspect}`,
  );
});
