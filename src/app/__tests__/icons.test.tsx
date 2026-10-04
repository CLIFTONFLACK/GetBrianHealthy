import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Icon, type IconName } from "../icons.tsx";

/**
 * Every icon name actually referenced somewhere under /healthy (components,
 * layout, page, data goal/pillar icons). Kept as an explicit list rather than
 * derived from the module, so a name that stops being used anywhere is still
 * exercised, and a typo'd `Icon name="..."` elsewhere in the app would show
 * up as a *different* failure (an unknown key) rather than silently passing.
 */
const ALL_ICON_NAMES: IconName[] = [
  "arrow",
  "badgeCheck",
  "shield",
  "shieldCheck",
  "refresh",
  "flask",
  "zap",
  "dumbbell",
  "target",
  "moon",
  "book",
  "clipboardCheck",
  "listChecks",
  "plus",
];

// ---------------------------------------------------------------------------
// Icon
// ---------------------------------------------------------------------------

test("Icon renders an svg element", () => {
  const el = Icon({ name: "arrow" });
  assert.equal(el.type, "svg");
});

test("Icon is always aria-hidden, regardless of props", () => {
  const el = Icon({ name: "arrow" });
  assert.equal(el.props["aria-hidden"], "true");
});

test("Icon is always not focusable, regardless of props", () => {
  const el = Icon({ name: "arrow" });
  assert.equal(el.props.focusable, "false");
});

test("Icon has no props that could give it an accessible name (no aria-label, no title, no text child)", () => {
  const el = Icon({ name: "badgeCheck" });
  assert.equal(el.props["aria-label"], undefined);
  assert.equal(el.props.title, undefined);
  // The svg's own children are path/circle elements, never a bare string —
  // a bare string child is exactly what would leak into a containing
  // link's accessible name.
  const kids = el.props.children;
  const flat = Array.isArray(kids) ? kids : [kids];
  for (const child of flatten(flat)) {
    assert.notEqual(typeof child, "string");
  }
});

function flatten(nodes: unknown[]): unknown[] {
  const out: unknown[] = [];
  for (const n of nodes) {
    if (Array.isArray(n)) out.push(...flatten(n));
    else out.push(n);
  }
  return out;
}

test("Icon defaults to size 20 for both width and height", () => {
  const el = Icon({ name: "arrow" });
  assert.equal(el.props.width, 20);
  assert.equal(el.props.height, 20);
});

test("Icon honors an explicit size for both width and height", () => {
  const el = Icon({ name: "arrow", size: 32 });
  assert.equal(el.props.width, 32);
  assert.equal(el.props.height, 32);
});

test("Icon defaults to an empty extra className, keeping only the base shrink-0 class", () => {
  const el = Icon({ name: "arrow" });
  assert.equal(el.props.className, "shrink-0 ");
});

test("Icon appends a custom className after the base shrink-0 class", () => {
  const el = Icon({ name: "arrow", className: "text-amber-400" });
  assert.equal(el.props.className, "shrink-0 text-amber-400");
});

for (const name of ALL_ICON_NAMES) {
  test(`Icon renders a defined path for icon "${name}" without throwing`, () => {
    const el = Icon({ name });
    assert.equal(el.type, "svg");
    assert.notEqual(el.props.children, undefined);
  });
}

test("Icon silently renders no path for a name that isn't a known icon", () => {
  // Documents current behavior rather than asserting a guard that doesn't
  // exist: `paths[name]` on an unrecognized name is `undefined`, so this
  // does not throw — it renders an empty (but still aria-hidden) svg. If
  // `IconName` is ever widened to a less-strict type (e.g. sourced from
  // JSON), a typo'd icon name would fail silently rather than loudly. Kept
  // as a regression pin, not an endorsement of the behavior.
  const el = Icon({ name: "not-a-real-icon" as IconName });
  assert.equal(el.type, "svg");
  assert.equal(el.props.children, undefined);
});

// ---------------------------------------------------------------------------
// No leftover Material Symbols icon font under /healthy
// ---------------------------------------------------------------------------

/**
 * The reskin (see icons.tsx's own file comment) replaced every Material
 * Symbols ligature icon with this inline-SVG component. This reads the
 * actual source files from disk — not through the module loader — so it
 * catches a stray icon-font className or Google Fonts link even in a file
 * nothing else here imports (e.g. layout.tsx's <head> link tag).
 */
const HEALTHY_DIR = fileURLToPath(new URL("..", import.meta.url));

function readHealthySource(relativePath: string): string {
  return readFileSync(new URL(relativePath, new URL("../", import.meta.url)), "utf8");
}

const SOURCE_FILES = [
  "components.tsx",
  "data.ts",
  "icons.tsx",
  "layout.tsx",
  "page.tsx",
  "why-these-picks/page.tsx",
];

for (const file of SOURCE_FILES) {
  test(`${file} contains no reference to material-symbols`, () => {
    const source = readHealthySource(file);
    assert.doesNotMatch(source.toLowerCase(), /material-symbols/);
  });
}

test("sanity: HEALTHY_DIR resolves to the app directory", () => {
  assert.match(HEALTHY_DIR.replace(/\\/g, "/"), /\/src\/app\/$/);
});
