import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * logo-animation.tsx is a "use client" component whose default `next/image`
 * import resolves, under this project's node:test loader (which transpiles
 * .tsx but doesn't run Next's own bundler), to a plain object rather than a
 * function — the same CJS/ESM interop gap layout.tsx's own next/font/google
 * import hits, which is why brand-assets.test.ts reads layout.tsx as text
 * instead of importing it. LogoAnimation additionally calls hooks in its own
 * body (not just inside JSX), so unlike JobRail/ProductCard it can't be
 * inspected by calling it as a plain function either. This reads the source
 * as text and pins the literal values, the same trade-off brand-assets.test.ts
 * already makes: brittle to reformatting, but able to fail on the two things
 * this file's own comments call out as the drift risk (VIEW_BOX vs. the
 * generator's crop, and the trace count).
 */
const sourcePath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../logo-animation.tsx",
);
const source = readFileSync(sourcePath, "utf8");

test("VIEW_BOX is exactly the documented crop box (178, 206, 982x839)", () => {
  const m = source.match(
    /const VIEW_BOX = \{ x: (\d+), y: (\d+), w: (\d+), h: (\d+) \};/,
  );
  assert.ok(m, "expected a literal VIEW_BOX declaration");
  const [, x, y, w, h] = m!.map(Number);
  assert.deepEqual({ x, y, w, h }, { x: 178, y: 206, w: 982, h: 839 });
});

test("the base image references the solo-cut mark", () => {
  assert.match(source, /src="\/healthy\/brand\/healthy-mark-solo\.png"/);
});

test("the accessible label mentions circuit lines (the AI step) and verified (the human step)", () => {
  const m = source.match(/aria-label="([^"]*)"/);
  assert.ok(m, "expected an aria-label on the animation's role=img wrapper");
  assert.match(m![1], /circuit/i);
  assert.match(m![1], /verified/i);
});

test("declares exactly 3 traces", () => {
  const m = source.match(/const TRACES = \[([\s\S]*?)\n\];/);
  assert.ok(m, "expected a literal TRACES array");
  const entries = m![1].match(/\{ d:/g) ?? [];
  assert.equal(entries.length, 3);
});

test("renders one .healthy-anim-trace path per trace via the TRACES map", () => {
  assert.match(source, /className="healthy-anim-trace"/);
  assert.match(source, /\{TRACES\.map\(/);
});

test("renders both the medical cross and the check-seal group", () => {
  assert.match(source, /className="healthy-anim-cross"/);
  assert.match(source, /className="healthy-anim-seal"/);
});

test("renders both captions", () => {
  assert.match(source, />\s*AI gathers the research\s*</);
  assert.match(source, />\s*A person checks and signs off\s*</);
});

// ---------------------------------------------------------------------------
// viewBox <-> the generator's crop. gen-healthy-brand.mjs derives its crop
// from image content at run time rather than declaring a static box, so
// this can't statically diff "178 206 982 839 hard-coded here" against a
// matching literal in the generator (there isn't one). What must always
// hold instead: VIEW_BOX is declared as exactly the box the solo PNG is
// cropped to, so the solo PNG's own pixel aspect ratio must equal the
// viewBox's aspect ratio.
// ---------------------------------------------------------------------------

const soloPngPath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../public/healthy/brand/healthy-mark-solo.png",
);

function pngDimensions(filePath: string): { width: number; height: number } {
  const buf = readFileSync(filePath);
  const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  assert.ok(buf.length >= 24 && buf.subarray(0, 8).equals(PNG_SIGNATURE), `${filePath} is not a PNG`);
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

test("the solo PNG's own pixel aspect ratio matches VIEW_BOX's aspect ratio", () => {
  const { width, height } = pngDimensions(soloPngPath);
  const pngAspect = width / height;
  const viewBoxAspect = 982 / 839;
  assert.ok(
    Math.abs(pngAspect - viewBoxAspect) < 0.01,
    `expected png aspect ${pngAspect} to match viewBox aspect ${viewBoxAspect}`,
  );
});
