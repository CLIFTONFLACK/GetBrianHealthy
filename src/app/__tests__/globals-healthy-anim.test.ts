import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * globals.css's contract for .healthy-anim (logo-animation.tsx) and
 * .healthy-rail-* (job-rail.tsx): every element's RESTING style (no
 * animation/transition applied) must already be the finished frame, so a
 * browser that skips animation altogether — reduced motion, above all —
 * still shows a complete mark and a fully revealed rail instead of the
 * faded-out end of a keyframe or the pre-reveal hidden state.
 *
 * There is no CSS engine here, so this parses the stylesheet text directly:
 * grabs each named rule's declaration block and asserts on the properties
 * inside it. Brittle to reformatting, same trade-off brand-assets.test.ts
 * makes reading layout.tsx as text.
 */
const cssPath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../globals.css",
);
const css = readFileSync(cssPath, "utf8");

/**
 * All top-level (outside any @media block) rules, as {selectors, body}
 * pairs. Strips @media blocks first (none of them nest further in this
 * file), then splits what's left on brace pairs — a class can appear as one
 * of several comma-separated selectors sharing a rule (e.g.
 * `.healthy-anim-node,\n.healthy-anim-cross {`), and separately in its own
 * single-selector rule further down, so callers need every body that
 * mentions the class, not just the first.
 */
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

/** Every top-level declaration block whose selector list includes this
 *  exact class, concatenated (cascade order), since a class's effective
 *  style can be split across more than one rule. */
function ruleBody(selector: string): string {
  const bodies = topLevelRules.filter((r) => r.selectors.includes(selector)).map((r) => r.body);
  assert.ok(bodies.length > 0, `expected a top-level rule for "${selector}"`);
  return bodies.join("\n");
}

/** The body of a `@media (prefers-reduced-motion: reduce) { ... }` block
 *  that itself contains the given selector, so this can tell the two
 *  reduced-motion blocks in the file apart. */
function reducedMotionBlockContaining(selectorSnippet: string): string {
  const re = /@media \(prefers-reduced-motion: reduce\)\s*\{([\s\S]*?)\n\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(css))) {
    if (m[1].includes(selectorSnippet)) return m[1];
  }
  assert.fail(`expected a prefers-reduced-motion block containing "${selectorSnippet}"`);
}

// ---------------------------------------------------------------------------
// Resting state of the logo-animation traces/nodes/cross/seal: the elements
// that must show FINISHED (not hidden), so they need no override here — the
// keyframes' own 0% is what hides them, and resting (no animation) must fall
// through to the plain, un-hidden default. Assert the rules don't sneak an
// opacity/visibility override in that would hide them at rest.
// ---------------------------------------------------------------------------

for (const cls of [".healthy-anim-node", ".healthy-anim-cross", ".healthy-anim-seal", ".healthy-anim-trace"]) {
  test(`${cls}'s own rule does not hide the element outside of its animation`, () => {
    const body = ruleBody(cls);
    assert.doesNotMatch(body, /opacity:\s*0[^.\d]/, `${cls} must not rest hidden`);
  });
}

test(".healthy-anim-trace rests fully drawn (stroke-dashoffset: 0)", () => {
  const body = ruleBody(".healthy-anim-trace");
  assert.match(body, /stroke-dashoffset:\s*0\s*;/);
});

test(".healthy-anim-pulse rests hidden on purpose (it is a decoration, not part of the finished mark)", () => {
  const body = ruleBody(".healthy-anim-pulse");
  assert.match(body, /opacity:\s*0\s*;/);
});

// ---------------------------------------------------------------------------
// The reduced-motion override that keeps the animated mark on its finished
// frame instead of the last (faded-out) keyframe step. Without this rule,
// the later global `* { animation-duration: 0.01ms; animation-iteration-count: 1; }`
// block would run the keyframe once and leave every .healthy-anim element on
// its 100% state — opacity 0 for the traces/nodes/cross/seal.
// ---------------------------------------------------------------------------

test("a prefers-reduced-motion block forces every .healthy-anim descendant's animation off", () => {
  const block = reducedMotionBlockContaining(".healthy-anim *");
  assert.match(block, /\.healthy-anim \*\s*\{\s*animation:\s*none\s*!important\s*;\s*\}/);
});

test("the same prefers-reduced-motion block forces the rail elements to their revealed state", () => {
  const block = reducedMotionBlockContaining(".healthy-anim *");
  const railRule = block.match(/\.healthy-rail-line,[\s\S]*?\{([\s\S]*?)\}/);
  assert.ok(railRule, "expected a rail selector list inside the same reduced-motion block");
  assert.match(railRule![1], /opacity:\s*1\s*;/);
  assert.match(railRule![1], /transform:\s*none\s*;/);
});

// ---------------------------------------------------------------------------
// The rail rests in its FINISHED state too: the hidden start applies only
// under .rail-armed, which RailReveal adds once JavaScript runs. Pin both
// halves, so a future edit can't move the hidden state onto the bare class
// (blank picks, prices and Buy buttons included, whenever JavaScript fails).
// ---------------------------------------------------------------------------

test(".healthy-rail-node rests visible (no opacity: 0 on the bare class)", () => {
  const body = ruleBody(".healthy-rail-node");
  assert.doesNotMatch(body, /opacity:\s*0\s*;/);
});

test(".rail-armed .healthy-rail-node carries the hidden start state", () => {
  const body = ruleBody(".rail-armed .healthy-rail-node");
  assert.match(body, /opacity:\s*0\s*;/);
});
