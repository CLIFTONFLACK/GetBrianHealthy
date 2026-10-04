import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// ---------------------------------------------------------------------------
// This reads the compiled CSS text of globals.css from disk rather than
// importing it (CSS isn't a module the test loader can execute), extracts
// the /healthy "kinetic-*" custom-property values from the :root block, and
// re-implements WCAG 2.x contrast math against them. A renamed or mistyped
// token fails loudly (an unresolvable var() throws) rather than silently
// skipping a pairing, per the brief in globals.css's kinetic-ramp comment.
// ---------------------------------------------------------------------------

const cssPath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../globals.css",
);
const cssText = readFileSync(cssPath, "utf8");

/** Strip CSS comments so a colour value inside one is never mistaken for a
 *  declaration, and so `--x: /* ... *\/ #fff;` style edge cases can't occur. */
function stripComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, "");
}

/** Isolate the :root { ... } block. The file has no nested braces inside
 *  :root (values are var()/hex literals only), so the first closing brace
 *  after the opening one is the end of the block. */
function extractRootBlock(css: string): string {
  const rootIdx = css.indexOf(":root");
  assert.ok(rootIdx !== -1, "fixture assumption: globals.css has a :root block");
  const openIdx = css.indexOf("{", rootIdx);
  const closeIdx = css.indexOf("}", openIdx);
  assert.ok(openIdx !== -1 && closeIdx !== -1, "fixture assumption: :root block is well-formed");
  return css.slice(openIdx + 1, closeIdx);
}

/** Map of custom-property name (without the leading `--`) to its raw,
 *  unresolved declaration value. */
function parseCustomProperties(block: string): Map<string, string> {
  const map = new Map<string, string>();
  const re = /--([a-zA-Z0-9-]+)\s*:\s*([^;]+);/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(block))) {
    map.set(m[1], m[2].trim());
  }
  return map;
}

const rootVars = parseCustomProperties(extractRootBlock(stripComments(cssText)));

/**
 * Resolves a custom property to a literal colour value, following one
 * `var(--other)` indirection (the ramp in globals.css only ever nests one
 * level deep). Throws if the named property doesn't exist or the chain goes
 * deeper than that, so a rename that breaks the reference fails the test
 * suite instead of silently resolving to `undefined`.
 */
function resolveToken(name: string, depth = 0): string {
  if (depth > 5) {
    throw new Error(`--${name}: var() indirection too deep (possible cycle)`);
  }
  const raw = rootVars.get(name);
  if (raw === undefined) {
    throw new Error(`--${name}: no such custom property in globals.css :root`);
  }
  const varMatch = raw.match(/^var\(\s*--([a-zA-Z0-9-]+)\s*\)$/);
  if (varMatch) {
    return resolveToken(varMatch[1], depth + 1);
  }
  return raw;
}

// ---------------------------------------------------------------------------
// WCAG 2.x contrast
// ---------------------------------------------------------------------------

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const clean = hex.trim().replace(/^#/, "");
  assert.match(clean, /^[0-9a-fA-F]{6}$/, `expected a 6-digit hex colour, got "${hex}"`);
  return {
    r: parseInt(clean.slice(0, 2), 16),
    g: parseInt(clean.slice(2, 4), 16),
    b: parseInt(clean.slice(4, 6), 16),
  };
}

function srgbChannelToLinear(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

function relativeLuminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  return (
    0.2126 * srgbChannelToLinear(r) +
    0.7152 * srgbChannelToLinear(g) +
    0.0722 * srgbChannelToLinear(b)
  );
}

function contrastRatio(hexA: string, hexB: string): number {
  const lA = relativeLuminance(hexA);
  const lB = relativeLuminance(hexB);
  const lighter = Math.max(lA, lB);
  const darker = Math.min(lA, lB);
  return (lighter + 0.05) / (darker + 0.05);
}

// Tailwind's hardcoded palette values used alongside the kinetic-* tokens in
// the /healthy markup (slate-50/900/950), plus plain white/ink.
const WHITE = "#ffffff";
const SLATE_50 = "#f8fafc";
const SLATE_900 = "#0f172a";
const SLATE_950 = "#020617";
const INK = resolveToken("fg");

// ---------------------------------------------------------------------------
// contrastRatio sanity checks (known WCAG reference pairs)
// ---------------------------------------------------------------------------

test("contrastRatio of black on white is 21:1", () => {
  assert.ok(Math.abs(contrastRatio("#000000", "#ffffff") - 21) < 0.01);
});

test("contrastRatio of a colour against itself is 1:1", () => {
  assert.ok(Math.abs(contrastRatio("#046d7c", "#046d7c") - 1) < 0.001);
});

test("contrastRatio is symmetric regardless of argument order", () => {
  assert.equal(
    contrastRatio("#046d7c", "#ffffff"),
    contrastRatio("#ffffff", "#046d7c"),
  );
});

// ---------------------------------------------------------------------------
// resolveToken
// ---------------------------------------------------------------------------

test("resolveToken throws for a token that does not exist", () => {
  assert.throws(() => resolveToken("kinetic-does-not-exist"), /no such custom property/);
});

test("resolveToken follows a var() indirection to its literal value", () => {
  assert.equal(resolveToken("kinetic-primary"), resolveToken("brand-navy"));
});

// ---------------------------------------------------------------------------
// Documented /healthy contrast pairings (globals.css kinetic-* ramp)
// ---------------------------------------------------------------------------

test("kinetic-primary-electric text on white meets 4.5:1", () => {
  const ratio = contrastRatio(resolveToken("kinetic-primary-electric"), WHITE);
  assert.ok(ratio >= 4.5, `got ${ratio.toFixed(2)}:1`);
});

test("kinetic-primary-electric text on slate-50 meets 4.5:1", () => {
  const ratio = contrastRatio(resolveToken("kinetic-primary-electric"), SLATE_50);
  assert.ok(ratio >= 4.5, `got ${ratio.toFixed(2)}:1`);
});

test("kinetic-primary-electric text on kinetic-primary-light meets 4.5:1", () => {
  const ratio = contrastRatio(
    resolveToken("kinetic-primary-electric"),
    resolveToken("kinetic-primary-light"),
  );
  assert.ok(ratio >= 4.5, `got ${ratio.toFixed(2)}:1`);
});

test("white text on kinetic-primary (navy button) meets 4.5:1", () => {
  const ratio = contrastRatio(WHITE, resolveToken("kinetic-primary"));
  assert.ok(ratio >= 4.5, `got ${ratio.toFixed(2)}:1`);
});

test("white text on kinetic-primary-hover meets 4.5:1", () => {
  const ratio = contrastRatio(WHITE, resolveToken("kinetic-primary-hover"));
  assert.ok(ratio >= 4.5, `got ${ratio.toFixed(2)}:1`);
});

test("kinetic-teal fill against white meets the 3:1 non-text minimum", () => {
  const ratio = contrastRatio(resolveToken("kinetic-teal"), WHITE);
  assert.ok(ratio >= 3, `got ${ratio.toFixed(2)}:1`);
});

test("white icon on kinetic-teal meets the 3:1 non-text minimum", () => {
  const ratio = contrastRatio(WHITE, resolveToken("kinetic-teal"));
  assert.ok(ratio >= 3, `got ${ratio.toFixed(2)}:1`);
});

test("kinetic-teal-on-dark text on slate-950 meets 4.5:1", () => {
  const ratio = contrastRatio(resolveToken("kinetic-teal-on-dark"), SLATE_950);
  assert.ok(ratio >= 4.5, `got ${ratio.toFixed(2)}:1`);
});

test("kinetic-teal-on-dark text on slate-900 meets 4.5:1", () => {
  const ratio = contrastRatio(resolveToken("kinetic-teal-on-dark"), SLATE_900);
  assert.ok(ratio >= 4.5, `got ${ratio.toFixed(2)}:1`);
});

test("ink text on kinetic-amber (retailer Buy button) meets 4.5:1", () => {
  const ratio = contrastRatio(INK, resolveToken("kinetic-amber"));
  assert.ok(ratio >= 4.5, `got ${ratio.toFixed(2)}:1`);
});

test("ink text on kinetic-amber-hover meets 4.5:1", () => {
  const ratio = contrastRatio(INK, resolveToken("kinetic-amber-hover"));
  assert.ok(ratio >= 4.5, `got ${ratio.toFixed(2)}:1`);
});

test("white text on the 'Robust' evidence-grade ribbon meets 4.5:1", () => {
  const ratio = contrastRatio(WHITE, resolveToken("kinetic-evidence-strong"));
  assert.ok(ratio >= 4.5, `got ${ratio.toFixed(2)}:1`);
});

test("white text on the 'Promising' evidence-grade ribbon meets 4.5:1", () => {
  const ratio = contrastRatio(WHITE, resolveToken("kinetic-evidence-moderate"));
  assert.ok(ratio >= 4.5, `got ${ratio.toFixed(2)}:1`);
});

test("white text on the 'Early' evidence-grade ribbon meets 4.5:1", () => {
  const ratio = contrastRatio(WHITE, resolveToken("kinetic-evidence-early"));
  assert.ok(ratio >= 4.5, `got ${ratio.toFixed(2)}:1`);
});
