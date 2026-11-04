import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * The /routine hero's day clip. routine/page.tsx cannot be imported under
 * `npm test` (see routine-page.test.tsx), so, like that file, this reads the
 * source as text and pins the literal contracts, then checks the clip file.
 */
const testDir = path.dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => readFileSync(path.resolve(testDir, rel), "utf8").replace(/\r\n/g, "\n");
const pageSource = read("../routine/page.tsx");
const plannerSource = read("../routine-planner.tsx");
const publicDir = path.resolve(testDir, "../../../public");

const SRC = "/healthy/video/routine-day.mp4";
const POSTER = "/healthy/video/routine-day-poster.webp";

// ---------------------------------------------------------------------------
// The planner exports RoutineClip, unchanged otherwise
// ---------------------------------------------------------------------------

test("routine-planner.tsx exports RoutineClip", () => {
  assert.match(plannerSource, /export function RoutineClip\(\{ clip \}: \{ clip: NonNullable<RoutineStep\["clip"\]> \}\)/);
});

test("RoutineClip still fills a positioned box its parent supplies (absolute video and button)", () => {
  const fn = plannerSource.slice(plannerSource.indexOf("export function RoutineClip"));
  assert.match(fn, /<video[\s\S]*?className="absolute inset-0 h-full w-full object-cover"/);
  assert.match(fn, /<button[\s\S]*?className="absolute right-1 bottom-1 [^"]*h-11 w-11/);
});

// ---------------------------------------------------------------------------
// The page's HERO_CLIP and where it goes
// ---------------------------------------------------------------------------

test("the page imports RoutineClip beside RoutinePlanner", () => {
  assert.match(pageSource, /import \{ RoutineClip, RoutinePlanner \} from "\.\.\/routine-planner";/);
});

test("HERO_CLIP names the day clip, its poster and a label", () => {
  const block = pageSource.match(/const HERO_CLIP = \{([\s\S]*?)\n\};/);
  assert.ok(block, "expected a HERO_CLIP constant");
  assert.match(block![1], new RegExp(`src: "${SRC.replace(/[./]/g, "\\$&")}",`));
  assert.match(block![1], new RegExp(`poster: "${POSTER.replace(/[./]/g, "\\$&")}",`));
  assert.match(block![1], /label: "[^"]{20,}",/);
});

test("the hero renders RoutineClip with HERO_CLIP inside a positioned 16:9 card", () => {
  assert.match(pageSource, /<div className="relative aspect-video overflow-hidden rounded-3xl[^"]*">\s*<RoutineClip clip=\{HERO_CLIP\} \/>\s*<\/div>/);
});

test("the hero grid gives the clip a 30rem column from lg", () => {
  assert.match(pageSource, /lg:grid-cols-\[1fr_30rem\]/);
});

test("the waving mascot is still in the hero, now standing over the card's bottom-left corner", () => {
  const hero = pageSource.slice(pageSource.indexOf("{/* HERO */}"), pageSource.indexOf("<RoutinePlanner"));
  assert.match(hero, /src="\/healthy\/mascot\/hero-wave\.webp"/);
  assert.match(hero, /className="absolute bottom-0 left-0 z-10 h-auto w-36 sm:w-44"/);
  // The mascot is a sibling of the clipped card, not inside it.
  assert.ok(hero.indexOf("<RoutineClip") < hero.indexOf('src="/healthy/mascot/hero-wave.webp"'));
  assert.ok(hero.indexOf("</div>", hero.indexOf("<RoutineClip")) < hero.indexOf('src="/healthy/mascot/hero-wave.webp"'));
});

test("the hero clip is only ever shown through RoutineClip (one <video> on the page, in the planner)", () => {
  assert.doesNotMatch(pageSource, /<video/);
});

test("HERO_CLIP has exactly the three keys a step's clip declares: src, poster, label", () => {
  const block = pageSource.match(/const HERO_CLIP = \{([\s\S]*?)\n\};/);
  assert.ok(block, "expected a HERO_CLIP constant");
  const keys = [...block![1].matchAll(/^\s+(\w+):/gm)].map((m) => m[1]);
  assert.deepEqual(keys, ["src", "poster", "label"]);
});

test("routine.ts types a step's clip as exactly { src, poster, label } or null, the shape HERO_CLIP is given", () => {
  const routine = read("../routine.ts");
  assert.match(routine, /clip: \{ src: string; poster: string; label: string \} \| null;/);
});

test("HERO_CLIP follows the routine-<name> file naming that CLIP() in routine.ts uses", () => {
  const routine = read("../routine.ts");
  assert.match(routine, /src: `\/healthy\/video\/routine-\$\{name\}\.mp4`/);
  assert.match(SRC, /^\/healthy\/video\/routine-[a-z]+\.mp4$/);
  assert.equal(POSTER, SRC.replace(/\.mp4$/, "-poster.webp"));
});

// ---------------------------------------------------------------------------
// The file: 1280x720 h264, no audio, loops without a seam
// ---------------------------------------------------------------------------

function ffmpegAvailable(): boolean {
  try {
    execFileSync("ffmpeg", ["-version"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}
const hasFfmpeg = ffmpegAvailable();
const file = path.join(publicDir, SRC);

function grabFrame(target: string, extraArgs: string[]): Buffer {
  return execFileSync(
    "ffmpeg",
    ["-y", ...extraArgs, "-i", target, "-vf", "scale=16:16", "-frames:v", "1", "-f", "rawvideo", "-pix_fmt", "rgba", "pipe:1"],
    { maxBuffer: 10 * 1024 * 1024, stdio: ["ignore", "pipe", "ignore"] },
  );
}

function meanDiff(a: Buffer, b: Buffer): number {
  assert.equal(a.length, b.length);
  assert.equal(a.length, 16 * 16 * 4);
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += Math.abs(a[i] - b[i]);
  return sum / a.length;
}

test("routine-day.mp4 exists and is a real file (under 2.5 MB)", () => {
  const stat = statSync(file);
  assert.ok(stat.isFile());
  assert.ok(stat.size > 300_000 && stat.size < 2_500_000, `got ${stat.size} bytes`);
});

test("routine-day-poster.webp exists and is a real image", () => {
  const stat = statSync(path.join(publicDir, POSTER));
  assert.ok(stat.isFile());
  assert.ok(stat.size > 5_000, `got ${stat.size} bytes`);
});

test("routine-day.mp4 is 1280x720 h264 with no audio stream", { skip: !hasFfmpeg }, () => {
  const streams = execFileSync("ffprobe", ["-v", "error", "-show_entries", "stream=codec_type,codec_name,width,height", "-of", "csv=p=0", file], { encoding: "utf8" })
    .trim()
    .split("\n");
  assert.deepEqual(streams, ["h264,video,1280,720"]);
});

test("routine-day.mp4's last frame matches its first (seamless loop tail), and the frame before the tail does not", { skip: !hasFfmpeg }, () => {
  const first = grabFrame(file, []);
  const last = grabFrame(file, ["-sseof", "-0.15"]);
  const beforeTail = grabFrame(file, ["-sseof", "-0.7"]);
  const seam = meanDiff(first, last);
  assert.ok(seam < 20, `expected first/last frame mean channel diff < 20, got ${seam.toFixed(2)}`);
  assert.ok(meanDiff(first, beforeTail) > seam, "the frame before the tail should differ from frame 1 more than the seam does");
});

test("the poster is frame 1 of the clip", { skip: !hasFfmpeg }, () => {
  const diff = meanDiff(grabFrame(path.join(publicDir, POSTER), []), grabFrame(file, []));
  assert.ok(diff < 12, `expected the poster to match frame 1 (mean channel diff < 12), got ${diff.toFixed(2)}`);
});
