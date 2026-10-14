import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * routine-planner.tsx is a "use client" component with hooks in its body, and it
 * imports ./routine.css, which this project's node:test loader cannot load (the
 * same gap promo-video.test.tsx describes). So this reads the source as text and
 * pins the literal contracts, the same trade-off promo-video.test.tsx makes.
 */
const here = path.dirname(fileURLToPath(import.meta.url));
const source = readFileSync(path.resolve(here, "../routine-planner.tsx"), "utf8").replace(/\r\n/g, "\n");
const cssRaw = readFileSync(path.resolve(here, "../routine.css"), "utf8").replace(/\r\n/g, "\n");
const css = cssRaw.replace(/\/\*[\s\S]*?\*\//g, "");

// ---------------------------------------------------------------------------
// Storage: every localStorage call sits inside try/catch, so blocked or full storage
// leaves the page working (it just does not remember).
// ---------------------------------------------------------------------------

test("readRaw reads localStorage inside a try block and falls back to null on error", () => {
  assert.match(
    source,
    /function readRaw\(\): string \| null \{\s*if \(cached === undefined\) \{\s*try \{\s*cached = window\.localStorage\.getItem\(STORAGE_KEY\);\s*\} catch \{\s*cached = null;\s*\}/,
  );
});

test("writeRaw writes localStorage inside a try block and keeps the value in memory", () => {
  assert.match(
    source,
    /function writeRaw\(value: string\) \{\s*cached = value;\s*try \{\s*window\.localStorage\.setItem\(STORAGE_KEY, value\);\s*\} catch \{/,
  );
});

test("the file touches localStorage only in those two wrapped calls", () => {
  assert.equal((source.match(/window\.localStorage/g) ?? []).length, 2);
});

// ---------------------------------------------------------------------------
// Privacy: nothing leaves the browser. No request, no analytics module.
// ---------------------------------------------------------------------------

test("the planner makes no network request (no fetch, sendBeacon, XHR, WebSocket or EventSource)", () => {
  assert.doesNotMatch(source, /\bfetch\(|sendBeacon|XMLHttpRequest|new WebSocket|new EventSource/);
});

test("the planner imports no analytics module and calls no analytics global", () => {
  assert.doesNotMatch(source, /from "\.\/analytics"|window\.gtag|dataLayer/);
});

test("the planner's imports are only React, next/image, next/link and its own local modules", () => {
  const imports = [...source.matchAll(/(?:from|import) "([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(imports, ["next/image", "next/link", "react", "./icons", "./routine", "./routine.css"]);
});

// ---------------------------------------------------------------------------
// Play my day: the interval is cleared on teardown and when the tour ends.
// ---------------------------------------------------------------------------

test("the Play-my-day interval is cleared in the effect's cleanup", () => {
  assert.match(
    source,
    /if \(!playing\) return;[\s\S]*?const timer = window\.setInterval\([\s\S]*?return \(\) => window\.clearInterval\(timer\);/,
  );
});

test("the Play-my-day interval clears itself and stops playing when the tour reaches the end", () => {
  assert.match(source, /window\.clearInterval\(timer\);\s*setPlaying\(false\);/);
});

test("the Play-my-day effect does not depend on the plan array, which is new after every saved change", () => {
  // BUG: routine-planner.tsx line 118 memoises plan on stored.chosen, a new array after every write,
  // so the effect at line 215 (deps at line 235) restarts the tour at step one on any tick saved mid-tour.
  assert.doesNotMatch(source, /\}, \[playing, plan\]\);/);
});

// ---------------------------------------------------------------------------
// The clip: muted, looping, inline, no preload, no autoplay from markup.
// ---------------------------------------------------------------------------

const videoElement = source.match(/<video[\s\S]*?\/>/)?.[0] ?? "";

test("the step clip is found in the source, so the attribute checks below cannot pass vacuously", () => {
  assert.match(videoElement, /src=\{clip\.src\}/);
});

test("the step clip is muted", () => {
  assert.match(videoElement, /^\s*muted\s*$/m);
});

test("the step clip loops", () => {
  assert.match(videoElement, /^\s*loop\s*$/m);
});

test("the step clip plays inline on iOS", () => {
  assert.match(videoElement, /^\s*playsInline\s*$/m);
});

test("the step clip has preload none, so no video downloads until the reader asks", () => {
  assert.match(videoElement, /preload="none"/);
});

test("the step clip has no autoPlay attribute", () => {
  assert.doesNotMatch(videoElement, /autoPlay/);
});

// ---------------------------------------------------------------------------
// Reduced motion is read before anything is armed or started.
// ---------------------------------------------------------------------------

test("the planner reads reduced motion before arming .rt-armed", () => {
  assert.ok(source.indexOf("const reduced = prefersReducedMotion();") >= 0, "expected the reduced-motion read");
  assert.ok(
    source.indexOf("const reduced = prefersReducedMotion();") < source.indexOf('classList.add("rt-armed")'),
    "reduced motion must be read before .rt-armed is added",
  );
});

test("the planner arms .rt-armed and observes card reveals only when reduced motion is off", () => {
  assert.match(source, /if \(!reduced\) root\.classList\.add\("rt-armed"\);/);
  assert.match(source, /if \(!reduced\) reveal\.observe\(c\);/);
});

test("a step clip is set to user-paused under reduced motion before its observer can autoplay it", () => {
  assert.match(source, /if \(prefersReducedMotion\(\)\) userPaused\.current = true;/);
  assert.ok(
    source.indexOf("if (prefersReducedMotion()) userPaused.current = true;") < source.indexOf("observer.observe(video)"),
    "the reduced-motion check must come before the observer starts",
  );
});

test("a step clip autoplays only when on screen and not paused by the reader", () => {
  assert.match(source, /if \(entry\.isIntersecting && !userPaused\.current\) video\.play\(\)/);
});

test("a step clip pauses when it scrolls off screen", () => {
  assert.match(source, /else if \(!entry\.isIntersecting\) video\.pause\(\);/);
});

test("the step clip observer is disconnected on unmount", () => {
  assert.match(source, /return \(\) => observer\.disconnect\(\);/);
});

test("the reveal and focus observers are both disconnected on cleanup", () => {
  assert.match(source, /reveal\.disconnect\(\);\s*focus\.disconnect\(\);/);
});

test("the scroll behaviour falls back to auto under reduced motion in both places that scroll", () => {
  assert.equal((source.match(/prefersReducedMotion\(\) \? "auto" : "smooth"/g) ?? []).length, 2);
});

// ---------------------------------------------------------------------------
// Ticks: only when a date is known, so the server render never writes a key.
// ---------------------------------------------------------------------------

test("the tick buttons are disabled until the reader's date is known", () => {
  assert.match(source, /disabled=\{!today\}/);
});

test("toggleDone writes nothing when no date is known", () => {
  assert.match(source, /function toggleDone\(id: StepId\) \{\s*if \(!todayKey\) return;/);
});

test("the print button calls window.print", () => {
  assert.match(source, /onClick=\{\(\) => window\.print\(\)\}/);
});

// ---------------------------------------------------------------------------
// routine.css: the motion and print contracts the planner relies on.
// ---------------------------------------------------------------------------

/** Top-level rules, outside the @media blocks, as selector and body pairs. */
const topLevelRules = (() => {
  const outside = css.replace(/@media[\s\S]*?\n\}/g, "");
  return [...outside.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({ selector: m[1].trim(), body: m[2] }));
})();

const reducedBlock = css.match(/@media \(prefers-reduced-motion: reduce\) \{([\s\S]*?)\n\}/)?.[1] ?? "";
const printBlock = css.match(/@media print \{([\s\S]*?)\n\}/)?.[1] ?? "";

test("the reduced-motion block exists, so the checks below are not vacuous", () => {
  assert.ok(reducedBlock.length > 0, "expected a prefers-reduced-motion block");
  assert.ok(printBlock.length > 0, "expected a print block");
});

test("the pre-reveal card state (translateY 28px) is set only under .rt-armed", () => {
  const selectors = topLevelRules.filter((r) => r.body.includes("translateY(28px)")).map((r) => r.selector);
  assert.deepEqual(selectors, [".rt-armed .rt-card:not(.is-in)"]);
});

test("the pre-reveal card state (opacity 0) is set only under .rt-armed", () => {
  const armed = topLevelRules.filter((r) => r.selector === ".rt-armed .rt-card:not(.is-in)");
  assert.equal(armed.length, 1);
  assert.match(armed[0].body, /opacity:\s*0;/);
});

test("the bare .rt-card rule never hides the card", () => {
  const bare = topLevelRules.filter((r) => r.selector === ".rt-card");
  assert.ok(bare.length > 0, "expected a bare .rt-card rule");
  assert.ok(bare.every((r) => !/opacity:\s*0/.test(r.body) && !r.body.includes("translateY(28px)")));
});

test("reduced motion turns off the hop, float and glow animations", () => {
  assert.match(reducedBlock, /\.rt-hop,\s*\.rt-float,\s*\.rt-lit\s*\{\s*animation:\s*none\s*!important;/);
});

test("reduced motion hides the day-complete confetti", () => {
  assert.match(reducedBlock, /\.rt-confetti\s*\{\s*display:\s*none;/);
});

test("reduced motion shows every card in its finished place", () => {
  assert.match(reducedBlock, /\.rt-armed \.rt-card:not\(\.is-in\)\s*\{\s*opacity:\s*1;\s*transform:\s*none;/);
});

test("the print block hides site chrome only through body:has([data-routine-page])", () => {
  assert.match(printBlock, /body:has\(\[data-routine-page\]\) \[data-chrome\]\s*\{\s*display:\s*none !important;/);
  assert.equal((css.match(/\[data-chrome\]/g) ?? []).length, 1);
});

// ---------------------------------------------------------------------------
// The printed sheet's images: the section is display:none on screen, so a lazy
// image inside it may not have loaded when the browser lays out the printout.
// ---------------------------------------------------------------------------

const sheetSection = source.match(/<section className="rt-sheet hidden print:block"[\s\S]*?<\/section>/)?.[0] ?? "";
const sheetImages = sheetSection.match(/<Image\b[^>]*>/g) ?? [];

test("the print sheet is found in the source, so the image checks below cannot pass vacuously", () => {
  assert.match(sheetSection, /aria-label="Printable routine"/);
});

test("the print sheet holds three next/image elements: the mark, the mascot and the packshot thumbnail", () => {
  assert.equal(sheetImages.length, 3);
});

test("every next/image in the print sheet is loading eager", () => {
  assert.deepEqual(
    sheetImages.map((tag) => /loading="eager"/.test(tag)),
    [true, true, true],
  );
});

test("the print sheet has no raw img element", () => {
  assert.doesNotMatch(sheetSection, /<img\b/);
});

// ---------------------------------------------------------------------------
// The sheet's CSS: .rt-sheet must not set display, or it overrides the section's
// Tailwind `hidden` class on screen (unlayered CSS beats Tailwind's layer).
// ---------------------------------------------------------------------------

const sheetRules = topLevelRules.filter((r) => r.selector.split(",").map((s) => s.trim()).includes(".rt-sheet"));

test("the .rt-sheet rule is top-level, outside @media print, so the display check below cannot pass vacuously", () => {
  assert.equal(sheetRules.length, 1);
});

test("the .rt-sheet rule sets no display", () => {
  assert.equal(sheetRules.length, 1, "expected one top-level .rt-sheet rule");
  assert.doesNotMatch(sheetRules[0].body, /display\s*:/);
});

// ---------------------------------------------------------------------------
// Print scope: every print rule must be under body:has([data-routine-page]), so the
// print styles can never reach another page.
// ---------------------------------------------------------------------------

const printSelectors = (printBlock.match(/[^{}]+(?=\{)/g) ?? []).map((s) => s.trim());

test("there is exactly one @media print block", () => {
  assert.equal((css.match(/@media print/g) ?? []).length, 1);
});

test("the print block holds exactly the three routine-scoped rules, so the scope check below cannot pass vacuously", () => {
  assert.deepEqual(printSelectors, [
    "body:has([data-routine-page]) [data-chrome]",
    "body:has([data-routine-page])",
    "body:has([data-routine-page]) main",
  ]);
});

test("every @media print selector starts with body:has([data-routine-page])", () => {
  assert.ok(printSelectors.length > 0, "expected print selectors");
  assert.ok(printSelectors.every((s) => s.startsWith("body:has([data-routine-page])")));
});
