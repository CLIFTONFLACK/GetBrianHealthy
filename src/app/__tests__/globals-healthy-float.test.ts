import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * globals.css's .animate-healthy-float, the slow bob on the product hero's packshot.
 * Its resting frame must be the packshot in place (translateY(0)), and the global
 * prefers-reduced-motion rule must stop the loop: that rule is what keeps the
 * packshot still for reduced-motion visitors, since the class has no block of its own.
 *
 * There is no CSS engine here, so this reads the stylesheet text and pins the literal
 * declarations, the same trade-off globals-healthy-anim.test.ts makes.
 */
const cssPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../globals.css");
const css = readFileSync(cssPath, "utf8")
  .replace(/\r\n/g, "\n")
  .replace(/\/\*[\s\S]*?\*\//g, "");

test("the .animate-healthy-float rule exists exactly once, so the checks below are not vacuous", () => {
  const rules = css.match(/\.animate-healthy-float\s*\{[^}]*\}/g) ?? [];
  assert.equal(rules.length, 1);
});

test(".animate-healthy-float runs the healthy-float keyframe, 5 seconds, looping", () => {
  const rule = css.match(/\.animate-healthy-float\s*\{[^}]*\}/)?.[0] ?? "";
  assert.match(rule, /animation:\s*healthy-float 5s ease-in-out infinite;/);
});

test("the healthy-float keyframe rests at translateY(0) at both ends, so the packshot's resting frame is in place", () => {
  const keyframes = css.match(/@keyframes healthy-float\s*\{[\s\S]*?\n\}/)?.[0] ?? "";
  assert.ok(keyframes.length > 0, "expected a healthy-float keyframe");
  assert.equal(
    keyframes.replace(/\s+/g, ""),
    "@keyframeshealthy-float{0%,100%{transform:translateY(0);}50%{transform:translateY(-10px);}}",
  );
});

test("the global reduced-motion rule caps every animation at one 0.01ms run, which stops the bob", () => {
  const globalReduced = css.match(/@media \(prefers-reduced-motion: reduce\)\s*\{\s*\*\s*\{([^}]*)\}/)?.[1] ?? "";
  assert.ok(globalReduced.length > 0, "expected the global reduced-motion rule on *");
  assert.match(globalReduced, /animation-duration:\s*0\.01ms !important;/);
  assert.match(globalReduced, /animation-iteration-count:\s*1 !important;/);
});
