import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";
import { HERO_VIDEO, HeroVideo, METHOD_QUERY, METHOD_VIDEO, WIDE_QUERY, heroVideoMode } from "../hero-video.tsx";

/**
 * hero-video.tsx is a "use client" component with hooks. Its one decision,
 * heroVideoMode, is a pure function and is tested as one. The rest is read
 * as source text, the way promo-video.test.tsx and hero-mascot.test.tsx do,
 * plus one server render: the markup the visitor gets before hydration.
 */
const testDir = path.dirname(fileURLToPath(import.meta.url));
const source = readFileSync(path.resolve(testDir, "../hero-video.tsx"), "utf8").replace(/\r\n/g, "\n");
const pageSource = readFileSync(path.resolve(testDir, "../page.tsx"), "utf8").replace(/\r\n/g, "\n");
const css = readFileSync(path.resolve(testDir, "../globals.css"), "utf8").replace(/\r\n/g, "\n");
const publicDir = path.resolve(testDir, "../../../public");

// ---------------------------------------------------------------------------
// heroVideoMode
// ---------------------------------------------------------------------------

test("heroVideoMode picks the wide cut on a wide screen with motion allowed", () => {
  assert.equal(heroVideoMode({ reducedMotion: false, wide: true }), "wide");
});

test("heroVideoMode picks the tall cut on a narrow screen with motion allowed", () => {
  assert.equal(heroVideoMode({ reducedMotion: false, wide: false }), "tall");
});

test("heroVideoMode is poster-only under reduced motion, whatever the width", () => {
  assert.equal(heroVideoMode({ reducedMotion: true, wide: true }), "poster");
  assert.equal(heroVideoMode({ reducedMotion: true, wide: false }), "poster");
});

test("heroVideoMode is poster-only with data saver on, whatever the width", () => {
  assert.equal(heroVideoMode({ reducedMotion: false, saveData: true, wide: true }), "poster");
  assert.equal(heroVideoMode({ reducedMotion: false, saveData: true, wide: false }), "poster");
});

test("heroVideoMode treats a missing saveData as off", () => {
  assert.equal(heroVideoMode({ reducedMotion: false, wide: true }), heroVideoMode({ reducedMotion: false, saveData: false, wide: true }));
});

// ---------------------------------------------------------------------------
// Sources and the breakpoint
// ---------------------------------------------------------------------------

test("HERO_VIDEO names the two cuts and their posters under /healthy/video", () => {
  assert.deepEqual(HERO_VIDEO, {
    wide: { src: "/healthy/video/home-hero-v2-16x9.mp4", poster: "/healthy/video/home-hero-v2-16x9-poster.webp", width: 1920, height: 1080 },
    // Square: the band below lg is close to square (375 x 416 on a phone), so the tall cut is a 1:1 crop.
    tall: { src: "/healthy/video/home-hero-v2-1x1.mp4", poster: "/healthy/video/home-hero-v2-1x1-poster.webp", width: 1080, height: 1080 },
  });
});

test("WIDE_QUERY is Tailwind's lg breakpoint, the one the hero section goes full-bleed at", () => {
  assert.equal(WIDE_QUERY, "(min-width: 64rem)");
  // The section's full-bleed and the band's absolute positioning both switch at lg.
  assert.match(pageSource, /lg:absolute lg:inset-0/);
});

// ---------------------------------------------------------------------------
// Server markup: the poster alone, as the LCP element. No <video>, no button.
// ---------------------------------------------------------------------------

const markup = renderToStaticMarkup(<HeroVideo alt="A kitchen" />);

test("the server render carries the poster as a <picture> with the wide source gated by WIDE_QUERY", () => {
  assert.match(markup, /<picture>/);
  assert.match(markup, new RegExp(`<source media="${WIDE_QUERY.replace(/[()]/g, "\\$&")}"[^>]*src[sS]et="/healthy/video/home-hero-v2-16x9-poster\\.webp"`));
  assert.match(markup, /<img[^>]*src="\/healthy\/video\/home-hero-v2-1x1-poster\.webp"/);
});

test("the poster <img> is fetched at high priority and carries the alt text", () => {
  const img = markup.match(/<img[^>]*>/)?.[0] ?? "";
  assert.match(img, /fetchpriority="high"/i);
  assert.match(img, /alt="A kitchen"/);
  assert.doesNotMatch(img, /loading="lazy"/);
});

test("the poster sources declare their pixel size, so the band reserves its space before the file lands", () => {
  const img = markup.match(/<img[^>]*>/)?.[0] ?? "";
  assert.match(img, /width="1080"/);
  assert.match(img, /height="1080"/);
  const wide = markup.match(/<source[^>]*>/)?.[0] ?? "";
  assert.match(wide, /width="1920"/);
  assert.match(wide, /height="1080"/);
});

test("the server render has no <video> and no pause button: both wait for the browser's answer", () => {
  assert.doesNotMatch(markup, /<video/);
  assert.doesNotMatch(markup, /<button/);
});

test("the wrapper carries the healthy-hero-video class the reduced-motion CSS hooks on to", () => {
  assert.match(markup, /class="healthy-hero-video /);
});

// ---------------------------------------------------------------------------
// The <video>, once mounted
// ---------------------------------------------------------------------------

// The JSX element, not the "<video>" mentioned in the header comment: it is
// the one that opens on a tag followed by its props on the next line.
const videoElement = source.match(/<video\n[\s\S]*?\/>/)?.[0] ?? "";

test("the video element is found in the source, so the attribute checks below cannot pass vacuously", () => {
  assert.match(videoElement, /src=\{source\.src\}/);
});

for (const attr of ["muted", "loop", "playsInline", "autoPlay"]) {
  test(`the video is ${attr}`, () => {
    assert.match(videoElement, new RegExp(`^\\s*${attr}\\s*$`, "m"));
  });
}

test("the video preloads in full: it is the hero, not a below-the-fold clip", () => {
  assert.match(videoElement, /preload="auto"/);
});

test("the video is hidden from assistive tech; the poster's alt describes the scene", () => {
  assert.match(videoElement, /aria-hidden="true"/);
});

test("the video takes its poster from the same cut, so the first painted frame matches the still", () => {
  assert.match(videoElement, /poster=\{source\.poster\}/);
});

test("the home hero keeps its own object-position by default (the prop must not change it)", () => {
  assert.match(source, /fit = "object-\[center_60%\] lg:object-center",/);
});

test("the method page clip: files exist, the query is Tailwind sm, and the page passes all four props", () => {
  assert.equal(METHOD_QUERY, "(min-width: 40rem)");
  const publicDir = path.resolve(testDir, "../../../public");
  for (const cut of [METHOD_VIDEO.wide, METHOD_VIDEO.tall]) {
    for (const url of [cut.src, cut.poster]) {
      assert.ok(statSync(path.join(publicDir, url)).size > 1000, `${url} is missing or empty`);
    }
  }
  const methodSource = readFileSync(path.resolve(testDir, "../method/page.tsx"), "utf8");
  assert.match(methodSource, /video=\{METHOD_VIDEO\}/);
  assert.match(methodSource, /query=\{METHOD_QUERY\}/);
  assert.match(methodSource, /sm:aspect-\[4\/3\]/);
});

test("the clip is remounted when the cut changes (HeroClip keyed on mode), so its flags start over", () => {
  assert.match(source, /<HeroClip key=\{mode\} source=\{source\} isUserPaused=\{isUserPaused\} setUserPaused=\{setUserPaused\} onFail=\{\(\) => setMode\("poster"\)\} fit=\{fit\} label=\{label\} \/>/);
  // ready and playing belong to the clip, not the parent: a remount resets them.
  const clip = source.slice(source.indexOf("function HeroClip"));
  assert.match(clip, /const \[ready, setReady\] = useState\(false\);/);
  assert.match(clip, /const \[playing, setPlaying\] = useState\(false\);/);
  const parent = source.slice(source.indexOf("export function HeroVideo"), source.indexOf("function HeroClip"));
  assert.doesNotMatch(parent, /useState\(false\)/);
});

test("a visitor's pause survives the cut swap: the new clip is paused before autoplay can start it", () => {
  const clip = source.slice(source.indexOf("function HeroClip"));
  assert.match(clip, /if \(isUserPaused\(\)\) video\.pause\(\);[\s\S]*?new IntersectionObserver/);
  // The flag lives in the parent as a ref, so it is the same across remounts; the
  // clip reads and writes it only through the two stable callbacks.
  const parent = source.slice(source.indexOf("export function HeroVideo"), source.indexOf("function HeroClip"));
  assert.match(parent, /const userPaused = useRef\(false\);/);
  assert.match(parent, /const isUserPaused = useCallback\(\(\) => userPaused\.current, \[\]\);/);
  assert.match(parent, /const setUserPaused = useCallback\(\(paused: boolean\) => \{\s*userPaused\.current = paused;\s*\}, \[\]\);/);
  assert.doesNotMatch(clip, /userPaused\.current/);
});

test("the video is transparent until its first frame paints, then fades in on onPlaying", () => {
  assert.match(videoElement, /onPlaying=\{\(\) => \{\s*setReady\(true\);/);
  assert.match(videoElement, /transition-opacity[^"`]*\$\{ready \? "opacity-100" : "opacity-0"\}/);
});

test("a decode error drops the video and leaves the poster", () => {
  assert.match(videoElement, /onError=\{onFail\}/);
  assert.match(source, /onFail=\{\(\) => setMode\("poster"\)\}/);
});

test("the video is mounted only for the wide and tall modes, never for poster or pending", () => {
  assert.match(source, /const source = mode === "wide" \|\| mode === "tall" \? video\[mode\] : null;/);
  // The home hero passes no props, so it still plays the home clip.
  assert.match(source, /video = HERO_VIDEO,/);
  assert.match(source, /\{source && <HeroClip /);
  // The <video> itself lives only inside HeroClip.
  assert.ok(source.indexOf("<video\n") > source.indexOf("function HeroClip"));
});

// ---------------------------------------------------------------------------
// Deciding the mode: reduced motion, Save-Data and the breakpoint are all
// read in the browser, after hydration.
// ---------------------------------------------------------------------------

test("the mode starts as pending, so server and first client render agree on the poster alone", () => {
  assert.match(source, /useState<HeroVideoMode \| "pending">\("pending"\)/);
});

test("reduced motion is read from prefers-reduced-motion", () => {
  assert.match(source, /matchMedia\("\(prefers-reduced-motion: reduce\)"\)\.matches/);
});

test("Save-Data is read from navigator.connection.saveData, strictly true", () => {
  assert.match(source, /connection\?\.saveData === true/);
});

test("the width is read from WIDE_QUERY and re-read when it changes, with the listener removed on cleanup", () => {
  // The query is a prop that defaults to WIDE_QUERY, so the home hero reads WIDE_QUERY.
  assert.match(source, /query = WIDE_QUERY,/);
  assert.match(source, /const wideQuery = window\.matchMedia\(query\);/);
  assert.match(source, /wideQuery\.addEventListener\("change", decide\);/);
  assert.match(source, /return \(\) => wideQuery\.removeEventListener\("change", decide\);\s*\}, \[query\]\);/);
});

test("all three inputs go through heroVideoMode, not a second copy of the rule", () => {
  assert.match(source, /setMode\(heroVideoMode\(\{ reducedMotion: reduced, saveData, wide: wideQuery\.matches \}\)\)/);
});

// ---------------------------------------------------------------------------
// Playback: off screen it pauses; the visitor's pause sticks.
// ---------------------------------------------------------------------------

test("the intersection observer plays on screen unless the visitor paused it, and always pauses off screen", () => {
  const fn = source.match(/new IntersectionObserver\(\s*\(\[entry\]\) => \{([\s\S]*?)\n\s*\},/);
  assert.ok(fn, "expected an IntersectionObserver callback");
  assert.match(fn![1], /if \(entry\.isIntersecting && !isUserPaused\(\)\) video\.play\(\)\.catch\(\(\) => \{\}\);/);
  assert.match(fn![1], /else if \(!entry\.isIntersecting\) video\.pause\(\);/);
});

test("the observer belongs to the clip (re-armed on each remount) and is disconnected on cleanup", () => {
  assert.match(source, /return \(\) => observer\.disconnect\(\);\s*\}, \[isUserPaused\]\);/);
  assert.ok(source.indexOf("new IntersectionObserver") > source.indexOf("function HeroClip"));
});

test("the observer effect bails out when no video is mounted", () => {
  const fn = source.match(/useEffect\(\(\) => \{\s*const video = ref\.current;\s*if \(!video\) return;/);
  assert.ok(fn, "expected the observer effect to return early without a video");
});

test("togglePlay records the visitor's intent both ways", () => {
  const fn = source.match(/function togglePlay\(\)\s*\{([\s\S]*?)\n  \}/);
  assert.ok(fn, "expected a togglePlay function");
  assert.match(fn![1], /if \(video\.paused\)\s*\{[\s\S]*?setUserPaused\(false\);[\s\S]*?video\.play\(\)/);
  assert.match(fn![1], /\} else \{[\s\S]*?setUserPaused\(true\);[\s\S]*?video\.pause\(\)/);
});

// ---------------------------------------------------------------------------
// The one button: 44px, labelled both ways, above the mascot layer.
// ---------------------------------------------------------------------------

test("there is exactly one button, and it is type=button", () => {
  assert.equal((source.match(/<button/g) ?? []).length, 1);
  assert.equal((source.match(/type="button"/g) ?? []).length, 1);
});

test("the button's label flips between pause and play and names what it controls", () => {
  assert.match(source, /aria-label=\{playing \? `Pause \$\{label\}` : `Play \$\{label\}`\}/);
  // The default label keeps the home hero's button reading "Pause background video".
  assert.match(source, /label = "background video",/);
  assert.match(source, /<Icon name=\{playing \? "pause" : "play"\}/);
});

test("the button is a 44px target in the bottom-right corner, above the z-20 mascot layer", () => {
  const button = source.match(/<button[\s\S]*?>/)?.[0] ?? "";
  assert.match(button, /\bh-11\b/);
  assert.match(button, /\bw-11\b/);
  assert.match(button, /\bright-4\b/);
  assert.match(button, /\bbottom-4\b/);
  assert.match(button, /\bz-30\b/);
  assert.match(button, /cursor-pointer/);
});

test("the button is rendered only when a video is", () => {
  // The button is rendered by HeroClip beside the <video>, and HeroClip only mounts with a source.
  const clip = source.slice(source.indexOf("function HeroClip"));
  assert.match(clip, /<button/);
  const parent = source.slice(source.indexOf("export function HeroVideo"), source.indexOf("function HeroClip"));
  assert.doesNotMatch(parent, /<button/);
});

// ---------------------------------------------------------------------------
// page.tsx: the clip replaces the couple photo, and the band grew for it.
// ---------------------------------------------------------------------------

test("page.tsx mounts HeroVideo in the hero band and no longer mentions the couple photo", () => {
  assert.match(pageSource, /import \{ HeroVideo \} from "\.\/hero-video";/);
  assert.match(pageSource, /<HeroVideo alt="[^"]+" \/>/);
  assert.doesNotMatch(pageSource, /hero-couple/);
});

test("the small-screen band is 26rem, 30rem from sm, and absolute from lg", () => {
  assert.match(pageSource, /className="relative mt-16 h-\[26rem\] sm:mt-10 sm:h-\[30rem\] lg:absolute lg:inset-0 lg:mt-0 lg:h-auto"/);
});

test("the caption keeps clear of the pause button on the right", () => {
  assert.match(pageSource, /<p className="absolute right-16 bottom-4 left-36 [^"]*sm:right-\[4\.5rem\]/);
});

test("the home hero no longer carries the one-time zoom; that now belongs to the product hero only", () => {
  assert.doesNotMatch(pageSource, /animate-kinetic-hero-zoom/);
});

// ---------------------------------------------------------------------------
// globals.css: the reduced-motion block hides the video outright.
// ---------------------------------------------------------------------------

test("globals.css hides .healthy-hero-video video under prefers-reduced-motion", () => {
  const block = css.match(/@media \(prefers-reduced-motion: reduce\) \{([\s\S]*?)\n\}/);
  assert.ok(block, "expected a prefers-reduced-motion block");
  assert.match(block![1], /\.healthy-hero-video video \{\s*display: none;\s*\}/);
});

test("globals.css records the loop as the one exception to the one-time-motion rule", () => {
  assert.match(css, /The home hero is the one exception/);
  assert.match(css, /hero-video\.tsx/);
});

// ---------------------------------------------------------------------------
// The files: both cuts and both posters exist, with no audio, at the declared
// size, and loop without a seam.
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

function ffprobe(file: string, entries: string): string {
  return execFileSync("ffprobe", ["-v", "error", "-show_entries", entries, "-of", "csv=p=0", file], { encoding: "utf8" }).trim();
}

function grabFrame(file: string, extraArgs: string[]): Buffer {
  return execFileSync(
    "ffmpeg",
    ["-y", ...extraArgs, "-i", file, "-vf", "scale=16:16", "-frames:v", "1", "-f", "rawvideo", "-pix_fmt", "rgba", "pipe:1"],
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

for (const [cut, { src, poster, width, height }] of Object.entries(HERO_VIDEO)) {
  const file = path.join(publicDir, src);
  const posterFile = path.join(publicDir, poster);

  test(`${cut}: the mp4 exists and is a real file (over 1 MB, under 4 MB)`, () => {
    const stat = statSync(file);
    assert.ok(stat.isFile());
    assert.ok(stat.size > 1_000_000 && stat.size < 4_000_000, `got ${stat.size} bytes`);
  });

  test(`${cut}: the poster exists and is a real image`, () => {
    const stat = statSync(posterFile);
    assert.ok(stat.isFile());
    assert.ok(stat.size > 5_000, `got ${stat.size} bytes`);
  });

  test(`${cut}: the mp4 is ${width}x${height} h264 and carries no audio stream`, { skip: !hasFfmpeg }, () => {
    const streams = ffprobe(file, "stream=codec_type,codec_name,width,height").split("\n");
    assert.deepEqual(streams, [`h264,video,${width},${height}`]);
  });

  test(`${cut}: the mp4 is tagged bt709 with moov first (faststart)`, { skip: !hasFfmpeg }, () => {
    assert.equal(ffprobe(file, "stream=color_space,color_transfer,color_primaries"), "bt709,bt709,bt709");
    const head = readFileSync(file).subarray(0, 64);
    assert.ok(head.includes("moov"), "expected the moov atom in the first 64 bytes");
  });

  test(`${cut}: the last frame matches the first (seamless loop tail), and the frame before the tail does not`, { skip: !hasFfmpeg }, () => {
    const first = grabFrame(file, []);
    const last = grabFrame(file, ["-sseof", "-0.15"]);
    const beforeTail = grabFrame(file, ["-sseof", "-0.7"]);
    const seam = meanDiff(first, last);
    assert.ok(seam < 20, `expected first/last frame mean channel diff < 20, got ${seam.toFixed(2)}`);
    // Negative control: a clip that is simply static would pass the line above for nothing.
    assert.ok(meanDiff(first, beforeTail) > seam, "the frame before the tail should differ from frame 1 more than the seam does");
  });

  test(`${cut}: the poster is frame 1 of the clip`, { skip: !hasFfmpeg }, () => {
    const posterFrame = grabFrame(posterFile, []);
    const first = grabFrame(file, []);
    const diff = meanDiff(posterFrame, first);
    assert.ok(diff < 12, `expected the poster to match frame 1 (mean channel diff < 12), got ${diff.toFixed(2)}`);
  });
}
