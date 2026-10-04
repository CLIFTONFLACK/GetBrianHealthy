import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * mascot-animation.tsx is a "use client" component with hooks in its own
 * body (useRef/useEffect + IntersectionObserver), the same shape
 * logo-animation.tsx has, and hits the same CJS/ESM next/image interop gap
 * under this project's node:test loader. This reads the source as text and
 * pins the literal values, the same trade-off logo-animation.test.tsx and
 * brand-assets.test.ts already make.
 */
const sourcePath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../mascot-animation.tsx",
);
const source = readFileSync(sourcePath, "utf8");

test("the image references the mascot cutout", () => {
  assert.match(source, /const SRC = "\/healthy\/brand\/healthy-mascot\.webp";/);
  assert.match(source, /src=\{SRC\}/);
});

test("WIDTH and HEIGHT are declared as literals", () => {
  const w = source.match(/const WIDTH = (\d+);/);
  const h = source.match(/const HEIGHT = (\d+);/);
  assert.ok(w, "expected a literal WIDTH declaration");
  assert.ok(h, "expected a literal HEIGHT declaration");
  assert.equal(Number(w![1]), 473);
  assert.equal(Number(h![1]), 372);
});

test("width/height props are wired to the WIDTH/HEIGHT constants, not separate literals", () => {
  assert.match(source, /width=\{WIDTH\}/);
  assert.match(source, /height=\{HEIGHT\}/);
});

test("has an accessible alt description", () => {
  const m = source.match(/alt="([^"]*)"/);
  assert.ok(m, "expected an alt attribute on the mascot image");
  assert.ok(m![1].trim().length > 0, "alt text must not be empty");
});

test("the mascot is never named Brian in the alt text (brand rule: Brian is never shown as a picture)", () => {
  const m = source.match(/alt="([^"]*)"/);
  assert.ok(m, "expected an alt attribute on the mascot image");
  assert.doesNotMatch(m![1], /\bBrian\b/);
});

test("root wrapper carries the healthy-mascot class the CSS/JS contract keys off of", () => {
  assert.match(source, /className=\{`healthy-mascot \$\{className\}`\}/);
});

test("renders a healthy-mascot-shadow element alongside the image", () => {
  assert.match(source, /className="healthy-mascot-shadow"/);
});

test("the image carries the healthy-mascot-body class the CSS keyframes target", () => {
  assert.match(source, /className="healthy-mascot-body[^"]*"/);
});

test("pauses via an IntersectionObserver toggling data-paused, not by tearing the animation down", () => {
  assert.match(source, /new IntersectionObserver/);
  assert.match(source, /setAttribute\("data-paused", ""\)/);
  assert.match(source, /removeAttribute\("data-paused"\)/);
});

// ---------------------------------------------------------------------------
// The webp itself. gen-*.mjs scripts elsewhere derive crops at run time
// rather than declaring a static box (see logo-animation's VIEW_BOX test),
// but here WIDTH/HEIGHT are plain literals describing a fixed asset, so they
// must equal the file's own pixel dimensions exactly, not just in aspect
// ratio.
// ---------------------------------------------------------------------------

const webpPath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../public/healthy/brand/healthy-mascot.webp",
);

/** Minimal WebP (VP8X extended format) dimension reader: RIFF/WEBP container,
 *  a VP8X chunk whose bytes 4-9 hold (width-1) and (height-1) as 24-bit
 *  little-endian integers. */
function webpDimensions(filePath: string): { width: number; height: number } {
  const buf = readFileSync(filePath);
  assert.equal(buf.subarray(0, 4).toString("ascii"), "RIFF", `${filePath} is not a RIFF file`);
  assert.equal(buf.subarray(8, 12).toString("ascii"), "WEBP", `${filePath} is not a WEBP file`);
  const chunkType = buf.subarray(12, 16).toString("ascii");
  assert.equal(chunkType, "VP8X", `expected an extended-format (VP8X) WebP, got "${chunkType}"`);
  const width = 1 + (buf.readUInt8(24) | (buf.readUInt8(25) << 8) | (buf.readUInt8(26) << 16));
  const height = 1 + (buf.readUInt8(27) | (buf.readUInt8(28) << 8) | (buf.readUInt8(29) << 16));
  return { width, height };
}

test("the webp's own pixel dimensions match WIDTH/HEIGHT exactly", () => {
  const { width, height } = webpDimensions(webpPath);
  const w = Number(source.match(/const WIDTH = (\d+);/)![1]);
  const h = Number(source.match(/const HEIGHT = (\d+);/)![1]);
  assert.deepEqual({ width, height }, { width: w, height: h });
});

// ---------------------------------------------------------------------------
// globals.css's contract for .healthy-mascot: the CSS parsing approach
// matches globals-healthy-anim.test.ts (no CSS engine here, so this reads
// declaration blocks out of the stylesheet text directly).
// ---------------------------------------------------------------------------

const cssPath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../globals.css",
);
const css = readFileSync(cssPath, "utf8");
const cssNoComments = css.replace(/\/\*[\s\S]*?\*\//g, "");
const topLevelCss = cssNoComments.replace(/@media[^{]*\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g, "");

const topLevelRules: Array<{ selectors: string[]; body: string }> = [];
{
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(topLevelCss))) {
    topLevelRules.push({
      selectors: m[1].split(",").map((s) => s.trim()),
      body: m[2],
    });
  }
}

function ruleBody(selector: string): string {
  const bodies = topLevelRules.filter((r) => r.selectors.includes(selector)).map((r) => r.body);
  assert.ok(bodies.length > 0, `expected a top-level rule for "${selector}"`);
  return bodies.join("\n");
}

function reducedMotionBlockContaining(selectorSnippet: string): string {
  const re = /@media \(prefers-reduced-motion: reduce\)\s*\{([\s\S]*?)\n\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(css))) {
    if (m[1].includes(selectorSnippet)) return m[1];
  }
  assert.fail(`expected a prefers-reduced-motion block containing "${selectorSnippet}"`);
}

/** Every top-level `@keyframes <name> { ... }` block's body, by name. */
function keyframesBody(name: string): string {
  const re = new RegExp(`@keyframes ${name}\\s*\\{([\\s\\S]*?)\\n\\}`);
  const m = css.match(re);
  assert.ok(m, `expected an @keyframes block named "${name}"`);
  return m![1];
}

test(".healthy-mascot-body pivots at the bottom (transform-origin: 50% 100%)", () => {
  const body = ruleBody(".healthy-mascot-body");
  assert.match(body, /transform-origin:\s*50%\s*100%\s*;/);
});

test(".healthy-mascot-body's animation runs the healthy-mascot-flow keyframes", () => {
  const body = ruleBody(".healthy-mascot-body");
  assert.match(body, /animation:\s*healthy-mascot-flow\b/);
});

test(".healthy-mascot-shadow's animation runs the healthy-mascot-shadow keyframes", () => {
  const body = ruleBody(".healthy-mascot-shadow");
  assert.match(body, /animation:\s*healthy-mascot-shadow\b/);
});

test(".healthy-mascot[data-paused] * pauses every descendant animation", () => {
  const body = ruleBody(".healthy-mascot[data-paused] *");
  assert.match(body, /animation-play-state:\s*paused\s*;/);
});

test("the mascot keyframe durations equal 5 x SPOKE_STAGGER_S (one 10s round, matching the spokes)", () => {
  const pickLoopSource = readFileSync(
    path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../pick-loop.tsx"),
    "utf8",
  );
  const staggerMatch = pickLoopSource.match(/export const SPOKE_STAGGER_S = (\d+(?:\.\d+)?);/);
  assert.ok(staggerMatch, "expected a literal SPOKE_STAGGER_S export in pick-loop.tsx");
  const expectedDuration = Number(staggerMatch![1]) * 5;

  for (const selector of [".healthy-mascot-body", ".healthy-mascot-shadow"]) {
    const body = ruleBody(selector);
    const durationMatch = body.match(/animation:\s*healthy-mascot-(?:flow|shadow)\s+(\d+(?:\.\d+)?)s\b/);
    assert.ok(durationMatch, `expected a duration in ${selector}'s animation shorthand`);
    assert.equal(Number(durationMatch![1]), expectedDuration);
  }
});

test("both mascot keyframes loop (infinite)", () => {
  for (const selector of [".healthy-mascot-body", ".healthy-mascot-shadow"]) {
    const body = ruleBody(selector);
    assert.match(body, /animation:\s*healthy-mascot-(?:flow|shadow)\s+\d+(?:\.\d+)?s\s+[\w-]+\s+infinite\b/);
  }
});

test("healthy-mascot-flow keyframes rest at translateY(0) rotate(0deg) scale(1, 1) at 0% and 100%", () => {
  const body = keyframesBody("healthy-mascot-flow");
  const zeroPercentBlock = body.match(/0%[^{]*\{([^}]*)\}/);
  assert.ok(zeroPercentBlock, "expected a 0% keyframe step");
  assert.match(zeroPercentBlock![1], /transform:\s*translateY\(0\)\s*rotate\(0deg\)\s*scale\(1,\s*1\)\s*;/);
  const hundredPercentIsInSameRule = body.match(/0%,[^{]*100%\s*\{/);
  assert.ok(hundredPercentIsInSameRule, "expected 0% and 100% to share the resting transform");
});

test("healthy-mascot-shadow keyframes rest fully visible (opacity: 1, scaleX(1)) at 0% and 100%", () => {
  const body = keyframesBody("healthy-mascot-shadow");
  const zeroPercentBlock = body.match(/0%[^{]*\{([^}]*)\}/);
  assert.ok(zeroPercentBlock, "expected a 0% keyframe step");
  assert.match(zeroPercentBlock![1], /transform:\s*scaleX\(1\)\s*;/);
  assert.match(zeroPercentBlock![1], /opacity:\s*1\s*;/);
});

test("a prefers-reduced-motion block forces every .healthy-mascot descendant's animation off", () => {
  const block = reducedMotionBlockContaining(".healthy-mascot *");
  assert.match(block, /\.healthy-mascot \*\s*\{\s*animation:\s*none\s*!important\s*;\s*\}/);
});

test(".healthy-mascot-shadow's own rule does not hide the shadow outside of its animation", () => {
  const body = ruleBody(".healthy-mascot-shadow");
  assert.doesNotMatch(body, /opacity:\s*0[^.\d]/);
});
