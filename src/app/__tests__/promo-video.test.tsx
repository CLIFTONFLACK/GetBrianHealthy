import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * promo-video.tsx is a "use client" component with hooks in its own body
 * (useRef/useState/useEffect + IntersectionObserver), the same shape
 * mascot-animation.tsx and logo-animation.tsx have, and hits the same
 * CJS/ESM next/image interop gap under this project's node:test loader.
 * This reads the source as text and pins the literal values, the same
 * trade-off those two test files already make.
 */
const sourcePath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../promo-video.tsx",
);
const source = readFileSync(sourcePath, "utf8");

test("the video references the mascot promo clip and its poster", () => {
  assert.match(source, /const SRC = "\/healthy\/video\/mascot-promo\.mp4";/);
  assert.match(source, /const POSTER = "\/healthy\/video\/mascot-promo-poster\.webp";/);
  assert.match(source, /src=\{SRC\}/);
  assert.match(source, /poster=\{POSTER\}/);
});

test("the video is muted, loops, and plays inline", () => {
  assert.match(source, /<video[\s\S]*?\bmuted\b[\s\S]*?\/>/);
  assert.match(source, /<video[\s\S]*?\bloop\b[\s\S]*?\/>/);
  assert.match(source, /<video[\s\S]*?playsInline[\s\S]*?\/>/);
});

test("the video carries the healthy-feather class", () => {
  assert.match(source, /className="healthy-feather[^"]*"/);
});

// ---------------------------------------------------------------------------
// Play / pause
// ---------------------------------------------------------------------------

test("the play button's onClick toggles play state via togglePlay", () => {
  assert.match(source, /onClick=\{togglePlay\}/);
});

test("the play button's aria-label and icon flip between play and pause", () => {
  assert.match(source, /aria-label=\{playing \? "Pause video" : "Play video"\}/);
  assert.match(source, /<Icon name=\{playing \? "pause" : "play"\}/);
});

test("togglePlay calls video.play() when paused and video.pause() when playing, marking user intent both ways", () => {
  const fn = source.match(/function togglePlay\(\)\s*\{([\s\S]*?)\n  \}/);
  assert.ok(fn, "expected a togglePlay function");
  const body = fn![1];
  assert.match(body, /if \(video\.paused\)\s*\{[\s\S]*?userPaused\.current = false;[\s\S]*?video\.play\(\)/);
  assert.match(body, /\} else \{[\s\S]*?userPaused\.current = true;[\s\S]*?video\.pause\(\)/);
});

// ---------------------------------------------------------------------------
// Sound
// ---------------------------------------------------------------------------

test("the sound button's onClick toggles sound state via toggleSound", () => {
  assert.match(source, /onClick=\{toggleSound\}/);
});

test("the sound button's aria-label and icon flip between muted and unmuted", () => {
  assert.match(source, /aria-label=\{muted \? "Turn sound on" : "Turn sound off"\}/);
  assert.match(source, /<Icon name=\{muted \? "volumeOff" : "volume"\}/);
});

test("toggleSound flips video.muted and syncs the muted state", () => {
  const fn = source.match(/function toggleSound\(\)\s*\{([\s\S]*?)\n  \}/);
  assert.ok(fn, "expected a toggleSound function");
  const body = fn![1];
  assert.match(body, /video\.muted = !video\.muted;/);
  assert.match(body, /setMuted\(video\.muted\);/);
});

// ---------------------------------------------------------------------------
// Buttons: 44px targets (h-11 w-11), both carry an aria-label so the
// accessible name comes from the label, never from the bare icon inside.
// ---------------------------------------------------------------------------

test("both buttons use a 44px (h-11 w-11) tap target", () => {
  const buttonVar = source.match(/const button =\s*\n?\s*"([^"]*)"/);
  assert.ok(buttonVar, "expected a shared `button` class string");
  assert.match(buttonVar![1], /\bh-11\b/);
  assert.match(buttonVar![1], /\bw-11\b/);
});

test("both buttons are type=\"button\" so they never submit a form", () => {
  const matches = source.match(/type="button"/g) ?? [];
  assert.equal(matches.length, 2);
});

// ---------------------------------------------------------------------------
// Reduced motion: the effect must not autostart when the visitor has asked
// for reduced motion, but the play button must still work (userPaused is a
// ref, not a prop, so togglePlay can still flip it back to false).
// ---------------------------------------------------------------------------

test("reduced motion is detected via prefers-reduced-motion and marks the video user-paused up front", () => {
  assert.match(source, /matchMedia\("\(prefers-reduced-motion: reduce\)"\)\.matches/);
  assert.match(source, /if \(reduced\) userPaused\.current = true;/);
});

test("the intersection observer only auto-plays when intersecting AND not user-paused, but always pauses when off screen", () => {
  const fn = source.match(/new IntersectionObserver\(\s*\(\[entry\]\) => \{([\s\S]*?)\n\s*\},/);
  assert.ok(fn, "expected an IntersectionObserver callback");
  const body = fn![1];
  assert.match(body, /if \(entry\.isIntersecting && !userPaused\.current\) video\.play\(\)/);
  assert.match(body, /else if \(!entry\.isIntersecting\) video\.pause\(\)/);
});

test("the observer is disconnected on cleanup, not left running after unmount", () => {
  assert.match(source, /return \(\) => observer\.disconnect\(\);/);
});

test("the observer bails out cleanly when the video ref isn't attached yet", () => {
  const fn = source.match(/useEffect\(\(\) => \{([\s\S]*?)\n\s*\}, \[\]\);/);
  assert.ok(fn, "expected the mount effect");
  assert.match(fn![1], /if \(!video\) return;/);
});

// ---------------------------------------------------------------------------
// The asset files themselves exist under public/, matching the SRC/POSTER
// constants above.
// ---------------------------------------------------------------------------

const publicDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../public",
);

test("mascot-promo.mp4 exists and is a non-trivial file", () => {
  const stat = statSync(path.join(publicDir, "healthy/video/mascot-promo.mp4"));
  assert.ok(stat.isFile());
  assert.ok(stat.size > 10_000, `expected a real video file, got ${stat.size} bytes`);
});

test("mascot-promo-poster.webp exists and is a non-trivial file", () => {
  const stat = statSync(path.join(publicDir, "healthy/video/mascot-promo-poster.webp"));
  assert.ok(stat.isFile());
  assert.ok(stat.size > 500, `expected a real poster image, got ${stat.size} bytes`);
});

// ---------------------------------------------------------------------------
// The clip's own last frame must match its first frame closely, so the
// `loop` attribute produces no visible seam (per the file comment: "its
// last frame is its first"). Uses ffmpeg directly, the same tool the video
// was authored with; skipped outright if ffmpeg isn't on PATH rather than
// failing the whole suite over an environment gap.
// ---------------------------------------------------------------------------

function ffmpegAvailable(): boolean {
  try {
    execFileSync("ffmpeg", ["-version"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function grabFrame(extraArgs: string[]): Buffer {
  return execFileSync(
    "ffmpeg",
    [
      "-y",
      ...extraArgs,
      "-i",
      path.join(publicDir, "healthy/video/mascot-promo.mp4"),
      "-vf",
      "scale=16:16",
      "-frames:v",
      "1",
      "-f",
      "rawvideo",
      "-pix_fmt",
      "rgba",
      "pipe:1",
    ],
    { maxBuffer: 10 * 1024 * 1024, stdio: ["ignore", "pipe", "ignore"] },
  );
}

test("the mp4's last frame closely matches its first frame (seamless loop tail)", { skip: !ffmpegAvailable() }, () => {
  const first = grabFrame([]);
  const last = grabFrame(["-sseof", "-0.15"]);
  assert.equal(first.length, last.length);
  assert.equal(first.length, 16 * 16 * 4);
  let sum = 0;
  for (let i = 0; i < first.length; i++) sum += Math.abs(first[i] - last[i]);
  const meanDiff = sum / first.length;
  assert.ok(meanDiff < 20, `expected first/last frame mean channel diff < 20, got ${meanDiff.toFixed(2)}`);
});

// ---------------------------------------------------------------------------
// globals.css's .healthy-feather contract: both the prefixed and
// unprefixed mask properties, intersecting the two gradients (x and y) so
// all four edges fade, not just left/right or top/bottom alone.
// ---------------------------------------------------------------------------

const cssPath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../globals.css",
);
const css = readFileSync(cssPath, "utf8");
const cssNoComments = css.replace(/\/\*[\s\S]*?\*\//g, "");
const topLevelCss = cssNoComments.replace(/@media[^{]*\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g, "");

function ruleBody(selector: string): string {
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m: RegExpExecArray | null;
  const bodies: string[] = [];
  while ((m = re.exec(topLevelCss))) {
    const selectors = m[1].split(",").map((s) => s.trim());
    if (selectors.includes(selector)) bodies.push(m[2]);
  }
  assert.ok(bodies.length > 0, `expected a top-level rule for "${selector}"`);
  return bodies.join("\n");
}

test(".healthy-feather masks with a horizontal AND a vertical gradient", () => {
  const body = ruleBody(".healthy-feather");
  assert.match(body, /linear-gradient\(to right,\s*transparent,\s*#000\s*9%,\s*#000\s*91%,\s*transparent\)/);
  assert.match(body, /linear-gradient\(to bottom,\s*transparent,\s*#000\s*9%,\s*#000\s*91%,\s*transparent\)/);
});

test(".healthy-feather sets both the prefixed and unprefixed mask-image", () => {
  const body = ruleBody(".healthy-feather");
  assert.match(body, /-webkit-mask-image:\s*var\(--feather\)\s*;/);
  assert.match(body, /(?<!-webkit-)mask-image:\s*var\(--feather\)\s*;/);
});

test(".healthy-feather intersects the two gradients rather than layering them additively", () => {
  const body = ruleBody(".healthy-feather");
  assert.match(body, /mask-composite:\s*intersect\s*;/);
  assert.match(body, /-webkit-mask-composite:\s*source-in\s*;/);
});

// ---------------------------------------------------------------------------
// page.tsx: PromoVideo and PickLoop share one row, half width each at lg.
// ---------------------------------------------------------------------------

const pageSource = readFileSync(
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../page.tsx"),
  "utf8",
);

test("page.tsx imports PromoVideo from ./promo-video", () => {
  assert.match(pageSource, /import \{ PromoVideo \} from "\.\/promo-video";/);
});

test("page.tsx places PromoVideo and PickLoop in a single lg:grid-cols-2 row", () => {
  const rowMatch = pageSource.match(
    /className="mt-10 grid grid-cols-1[^"]*lg:grid-cols-2"[^>]*>([\s\S]*?)<\/div>\s*<\/div>\s*<\/section>/,
  );
  assert.ok(rowMatch, "expected a grid row wrapping the video and the loop");
  assert.match(rowMatch![1], /<PromoVideo\b/);
  assert.match(rowMatch![1], /<PickLoop\s*\/>/);
});

test("PromoVideo appears before PickLoop in the row (video first, loop second)", () => {
  const videoIndex = pageSource.indexOf("<PromoVideo");
  const loopIndex = pageSource.indexOf("<PickLoop");
  assert.ok(videoIndex >= 0 && loopIndex >= 0);
  assert.ok(videoIndex < loopIndex, "expected PromoVideo to come before PickLoop in source order");
});
