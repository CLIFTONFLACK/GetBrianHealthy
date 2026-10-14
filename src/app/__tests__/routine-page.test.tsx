import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * routine/page.tsx cannot be imported under `npm test`: it imports "../routine" with no
 * extension while a routine/ directory sits beside routine.ts, and Node's resolver throws
 * ERR_UNSUPPORTED_DIR_IMPORT before the test loader's extension fallback runs. The page
 * also pulls in layout.tsx (next/font, a global .css import). So, as layout-metadata.test.tsx
 * does, these read the source as text and pin the literal contracts. Weaker than rendering,
 * and it says so by name.
 */
const here = path.dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => readFileSync(path.resolve(here, rel), "utf8").replace(/\r\n/g, "\n");
const pageSource = read("../routine/page.tsx");
const plannerSource = read("../routine-planner.tsx");
const layoutSource = read("../layout.tsx");

// ---------------------------------------------------------------------------
// Metadata and sitemap
// ---------------------------------------------------------------------------

test("the page's canonical is /routine", () => {
  assert.match(pageSource, /alternates: \{ canonical: "\/routine" \}/);
});

test("the page title is Daily routine", () => {
  assert.match(pageSource, /const TITLE = "Daily routine";/);
  assert.match(pageSource, /title: TITLE,/);
});

test("the Open Graph URL is /routine", () => {
  assert.match(pageSource, /url: "\/routine"/);
});

// The sitemap's /routine entry is asserted in sitemap.test.ts ("lists every indexable section page").

// ---------------------------------------------------------------------------
// The page builds the day from the visitor's region
// ---------------------------------------------------------------------------

test("the page reads the visitor's region once and builds the steps and picks from it", () => {
  assert.match(pageSource, /const region = await getRegion\(\);/);
  assert.match(pageSource, /const steps = allSteps\(region\);/);
  assert.match(pageSource, /const options = pickOptions\(region\);/);
});

test("the page hands the planner the steps, the picks and the region's printed disclaimer", () => {
  assert.match(pageSource, /<RoutinePlanner steps=\{steps\} options=\{options\} disclaimer=\{PRINT_DISCLAIMER\[region\]\} \/>/);
});

test("the US printed disclaimer is the FDA-style statement", () => {
  assert.match(pageSource, /US: "These statements have not been evaluated by the Food and Drug Administration\./);
});

test("the GB printed disclaimer is the UK food-supplement statement", () => {
  assert.match(pageSource, /GB: "Food supplements should not replace a varied, balanced diet/);
});

// ---------------------------------------------------------------------------
// No Buy link: the Amazon disclosure only sits beside Buy links, and this page has none.
// ---------------------------------------------------------------------------

test("page.tsx names no Amazon host, no amazonUrl and no BuyButton", () => {
  assert.doesNotMatch(pageSource, /amazon\.(com|co\.uk)|amazonUrl|BuyButton/i);
});

test("the planner names no Amazon host and links to no /go/ redirect", () => {
  assert.doesNotMatch(plannerSource, /amazon\.(com|co\.uk)|amazonUrl|BuyButton/i);
  assert.doesNotMatch(plannerSource, /href="\/go\//);
});

test("the page's only in-page links are to ids the planner renders", () => {
  assert.match(pageSource, /href="#rt-pick-heading"/);
  assert.match(pageSource, /href="#rt-week-heading"/);
  assert.match(plannerSource, /id="rt-pick-heading"/);
  assert.match(plannerSource, /id="rt-week-heading"/);
});

test("the mascot and mark images the page and planner name exist under public/", () => {
  const publicDir = path.resolve(here, "../../../public");
  assert.match(pageSource, /src="\/healthy\/mascot\/hero-wave\.webp"/);
  assert.match(plannerSource, /const MASCOT = "\/healthy\/brand\/healthy-mascot\.webp";/);
  assert.match(plannerSource, /src="\/healthy\/brand\/healthy-mark\.png"/);
  assert.ok(existsSync(path.join(publicDir, "healthy/mascot/hero-wave.webp")));
  assert.ok(existsSync(path.join(publicDir, "healthy/brand/healthy-mascot.webp")));
  assert.ok(existsSync(path.join(publicDir, "healthy/brand/healthy-mark.png")));
});

// ---------------------------------------------------------------------------
// layout.tsx: the four site-chrome marks the print rule depends on, and the nav entry
// ---------------------------------------------------------------------------

test("layout.tsx marks exactly four elements as site chrome", () => {
  assert.equal((layoutSource.match(/data-chrome/g) ?? []).length, 4);
});

test("the side navigation aside is marked as chrome", () => {
  assert.match(layoutSource, /<aside data-chrome /);
});

test("the disclosure bar is marked as chrome", () => {
  assert.match(layoutSource, /<div data-chrome className="hidden bg-slate-900/);
});

test("the header is marked as chrome", () => {
  assert.match(layoutSource, /<header data-chrome /);
});

test("the footer is marked as chrome", () => {
  assert.match(layoutSource, /<footer data-chrome /);
});

test("the navigation has a Daily routine entry pointing at /routine", () => {
  assert.match(layoutSource, /\{ href: "\/routine", label: "Daily routine" \}/);
});
