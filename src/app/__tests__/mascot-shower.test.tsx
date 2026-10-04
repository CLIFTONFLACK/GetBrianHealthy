import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * mascot-shower.tsx is a "use client" component with hooks in its own body
 * (useRef/useEffect + IntersectionObserver), the same shape mascot-animation.tsx
 * and promo-video.tsx have, and hits the same CJS/ESM next/image interop gap
 * under this project's node:test loader. This reads the source as text and
 * pins the literal values, the same trade-off those files already make.
 */
const sourcePath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../mascot-shower.tsx",
);
const source = readFileSync(sourcePath, "utf8");

/** The DROPS array's individual objects, parsed as plain records, so tests
 *  can assert on delay spacing etc. without re-implementing the component. */
function parseDrops(): Array<Record<string, number>> {
  const m = source.match(/const DROPS = \[([\s\S]*?)\n\];/);
  assert.ok(m, "expected a DROPS array declaration");
  const entries = m![1].match(/\{[^}]*\}/g) ?? [];
  return entries.map((entry) => {
    const obj: Record<string, number> = {};
    for (const pair of entry.replace(/[{}]/g, "").split(",")) {
      const [key, value] = pair.split(":").map((s) => s.trim());
      if (key) obj[key] = Number(value);
    }
    return obj;
  });
}

test("the mascot image references the mascot cutout with an empty (decorative) alt", () => {
  assert.match(source, /const MASCOT = "\/healthy\/brand\/healthy-mascot\.webp";/);
  assert.match(source, /src=\{MASCOT\}/);
  assert.match(source, /alt=""/);
});

test("the whole shower is aria-hidden", () => {
  assert.match(source, /className="healthy-shower[^"]*"\s+aria-hidden="true"/);
});

test("returns null when there are no goal icons to show", () => {
  assert.match(source, /if \(icons\.length === 0\) return null;/);
});

test("each falling icon cycles through the icons array by index (wraps for fewer icons than drops)", () => {
  assert.match(source, /icons\[i % icons\.length\]/);
});

test("pauses via an IntersectionObserver toggling data-paused, not by tearing the animation down", () => {
  assert.match(source, /new IntersectionObserver/);
  assert.match(source, /setAttribute\("data-paused", ""\)/);
  assert.match(source, /removeAttribute\("data-paused"\)/);
});

// ---------------------------------------------------------------------------
// DROPS: the nine falling icons' own delay/x/r/rest values.
// ---------------------------------------------------------------------------

test("DROPS has nine entries, one per icon in a fall cycle", () => {
  assert.equal(parseDrops().length, 9);
});

test("DROPS delays start at 0 and step evenly by 0.3s, in order", () => {
  const delays = parseDrops().map((d) => d.delay);
  for (let i = 0; i < delays.length; i++) {
    const expected = Number((i * 0.3).toFixed(10));
    assert.equal(delays[i], expected, `expected delay[${i}] to be ${expected}, got ${delays[i]}`);
  }
});

test("every DROPS entry has a distinct rest height (icons don't stack at the same resting spot)", () => {
  const rests = parseDrops().map((d) => d.rest);
  assert.equal(new Set(rests).size, rests.length);
});

// ---------------------------------------------------------------------------
// globals.css's .healthy-shower-* contract: CSS parsing approach matches
// globals-healthy-anim.test.ts and mascot-animation.test.tsx (no CSS engine
// here, so declaration blocks are read out of the stylesheet text directly).
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

function durationOf(selector: string, keyframeName: string): number {
  const body = ruleBody(selector);
  const m = body.match(new RegExp(`animation:\\s*${keyframeName}\\s+(\\d+(?:\\.\\d+)?)s\\b`));
  assert.ok(m, `expected a duration for ${keyframeName} in ${selector}`);
  return Number(m![1]);
}

test("the fall duration equals DROPS.length x the delay step (one icon leaves every step)", () => {
  const drops = parseDrops();
  const step = drops[1].delay - drops[0].delay;
  const fallDuration = durationOf(".healthy-shower-icon", "healthy-shower-fall");
  assert.equal(fallDuration, Number((drops.length * step).toFixed(10)));
});

test("the toss duration is half the fall duration", () => {
  const fallDuration = durationOf(".healthy-shower-icon", "healthy-shower-fall");
  const tossDuration = durationOf(".healthy-shower-mascot", "healthy-shower-toss");
  assert.equal(tossDuration, Number((fallDuration / 2).toFixed(10)));
});

test("both shower keyframes loop (infinite)", () => {
  for (const selector of [".healthy-shower-mascot", ".healthy-shower-icon"]) {
    const body = ruleBody(selector);
    assert.match(body, /animation:\s*healthy-shower-(?:toss|fall)\s+\d+(?:\.\d+)?s\s+[\w()., -]+\s+infinite\b/);
  }
});

test(".healthy-shower-icon's resting frame is visible (opacity not 0), so reduced motion still shows a shower", () => {
  const body = ruleBody(".healthy-shower-icon");
  assert.doesNotMatch(body, /opacity:\s*0[^.\d]/);
  assert.match(body, /opacity:\s*0\.8\s*;/);
});

test(".healthy-shower-icon's resting transform uses --x1 and --rest, not --x0 (rest is the landed position, not the toss point)", () => {
  const body = ruleBody(".healthy-shower-icon");
  assert.match(body, /transform:\s*translate\(var\(--x1\),\s*var\(--rest\)\)\s*rotate\(var\(--r\)\)\s*;/);
});

test(".healthy-shower[data-paused] * pauses every descendant animation", () => {
  const body = ruleBody(".healthy-shower[data-paused] *");
  assert.match(body, /animation-play-state:\s*paused\s*;/);
});

test("a prefers-reduced-motion block forces every .healthy-shower descendant's animation off", () => {
  const block = reducedMotionBlockContaining(".healthy-shower *");
  assert.match(block, /\.healthy-shower \*\s*\{\s*animation:\s*none\s*!important\s*;\s*\}/);
});

test("healthy-shower-fall keyframes start faded out and scaled down at 0%, then land at 100%", () => {
  const re = /@keyframes healthy-shower-fall\s*\{([\s\S]*?)\n\}/;
  const m = css.match(re);
  assert.ok(m, "expected a healthy-shower-fall keyframes block");
  const body = m![1];
  const zeroPercentBlock = body.match(/0%\s*\{([^}]*)\}/);
  assert.ok(zeroPercentBlock, "expected a 0% keyframe step");
  assert.match(zeroPercentBlock![1], /opacity:\s*0\s*;/);
  const hundredPercentBlock = body.match(/100%\s*\{([^}]*)\}/);
  assert.ok(hundredPercentBlock, "expected a 100% keyframe step");
  assert.match(hundredPercentBlock![1], /opacity:\s*0\s*;/);
  assert.match(hundredPercentBlock![1], /translate\(var\(--x1\),\s*var\(--land\)\)/);
});

// ---------------------------------------------------------------------------
// Icons leave from the mascot's hands: alternate palms, start at the palm
// (--x0/--y0 from HAND_X/HAND_Y), and land nearer the middle than they left.
// ---------------------------------------------------------------------------

test("every drop is thrown by a hand (-1 left, 1 right), alternating left and right", () => {
  const drops = parseDrops();
  drops.forEach((d, i) => {
    assert.ok(d.hand === -1 || d.hand === 1, `drop ${i}: hand must be -1 or 1, got ${d.hand}`);
    if (i > 0) assert.notEqual(d.hand, drops[i - 1].hand, `drop ${i} is thrown by the same hand as drop ${i - 1}`);
  });
});

test("each icon starts on its throwing palm: --x0 from HAND_X, --y0 from HAND_Y", () => {
  assert.match(source, /"--x0": `\$\{d\.hand \* HAND_X\}px`/);
  assert.match(source, /"--y0": `\$\{HAND_Y - d\.size \/ 2\}px`/);
});

test("each icon lands nearer the middle than the palm it left, on its own hand's side or centre", () => {
  const handX = Math.round(96 * 0.43);
  assert.match(source, /const MASCOT_W = 96;/);
  for (const d of parseDrops()) {
    assert.ok(Math.abs(d.x1) < handX, `x1=${d.x1} lands outside the palm at ${handX}`);
    assert.ok(d.x1 * d.hand >= 0, `x1=${d.x1} crosses over from hand ${d.hand}`);
  }
});

test("healthy-shower-fall's first frame sits on the palm (var(--x0), var(--y0))", () => {
  const body = css.match(/@keyframes healthy-shower-fall\s*\{([\s\S]*?)\n\}/)![1];
  const zero = body.match(/\b0%\s*\{([^}]*)\}/)![1];
  assert.match(zero, /translate\(var\(--x0\),\s*var\(--y0\)\)/);
});

// ---------------------------------------------------------------------------
// Landing: icons fall SINK px into the card and burst there; no stud.
// ---------------------------------------------------------------------------

test("icons land SINK (20px) past the column's foot, centred, and each has a burst at that same point", () => {
  assert.match(source, /const COLUMN_H = 90;/);
  assert.match(source, /const SINK = 20;/);
  assert.match(source, /"--land": `\$\{COLUMN_H \+ SINK - d\.size \/ 2\}px`/);
  assert.match(source, /"--by": `\$\{COLUMN_H \+ SINK\}px`/);
  assert.match(source, /style=\{\{ height: COLUMN_H \}\}/);
  // One burst per drop, on the drop's own delay.
  assert.match(source, /className=\{`healthy-shower-burst[^`]*`\}\s*style=\{\s*\{\s*"--x1": `\$\{d\.x1\}px`,[\s\S]*?animationDelay: `\$\{d\.delay\}s`/);
});

function keyframeSteps(name: string): Array<{ at: number[]; body: string }> {
  const m = css.match(new RegExp(`@keyframes ${name}\\s*\\{([\\s\\S]*?)\\n\\}`));
  assert.ok(m, `expected @keyframes ${name}`);
  return [...m![1].matchAll(/((?:\d+%\s*,\s*)*\d+%)\s*\{([^}]*)\}/g)].map((s) => ({
    at: s[1].split(",").map((p) => parseFloat(p)),
    body: s[2],
  }));
}

test("the burst goes off only once its icon has landed, and the icon is gone before the burst fades", () => {
  const fall = keyframeSteps("healthy-shower-fall");
  const burst = keyframeSteps("healthy-shower-burst");
  const landed = fall.find((s) => /var\(--land\)/.test(s.body) && /scale\(1\)/.test(s.body));
  assert.ok(landed, "expected a fall step where the icon sits landed at full size");
  const firstVisibleBurst = burst.find((s) => /opacity:\s*1\b/.test(s.body));
  assert.ok(firstVisibleBurst, "expected a burst step at full opacity");
  assert.ok(Math.min(...firstVisibleBurst!.at) >= Math.min(...landed!.at), "burst shows before its icon lands");
  const iconGone = fall.find((s) => /scale\(0\)/.test(s.body) && /opacity:\s*0\b/.test(s.body) && s.at.includes(100));
  assert.ok(iconGone, "expected the icon to end scaled to 0 and hidden");
  const burstFaded = burst.find((s) => s.at.includes(100));
  assert.match(burstFaded!.body, /opacity:\s*0\b/);
  assert.ok(Math.min(...iconGone!.at) < Math.min(...burstFaded!.at), "icon should vanish before the burst finishes");
});

test("bursts are hidden under reduced motion", () => {
  const block = reducedMotionBlockContaining(".healthy-shower-burst");
  assert.match(block, /\.healthy-shower-burst\s*\{\s*display:\s*none\s*;\s*\}/);
});
