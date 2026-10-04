import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

// Regression: the shipped footage had his waving hand cut off because opaque
// pixels touched the canvas edge. The bottom edge is exempt (his soles sit on
// it by design); left, right and top must be clear in every frame.

const testDir = path.dirname(fileURLToPath(import.meta.url));
const mascotDir = path.resolve(testDir, "../../../public/healthy/mascot");
const ALPHA_THRESHOLD = 40;

type Frames = { width: number; frameHeight: number; count: number; data: Buffer };

async function decode(file: string): Promise<Frames> {
  const input = path.join(mascotDir, file);
  const meta = await sharp(input, { animated: true }).metadata();
  const { data, info } = await sharp(input, { animated: true })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const count = meta.pages ?? 1;
  const frameHeight = meta.pageHeight ?? info.height;
  assert.equal(info.channels, 4);
  assert.equal(frameHeight * count, info.height, `${file}: stacked height mismatch`);
  return { width: info.width, frameHeight, count, data };
}

function alphaAt(f: Frames, frame: number, x: number, y: number): number {
  return f.data[((frame * f.frameHeight + y) * f.width + x) * 4 + 3];
}

/** Returns "frame N edge" for the first offending frame/edge, or null. */
function firstEdgeTouch(f: Frames): string | null {
  for (let frame = 0; frame < f.count; frame++) {
    for (let y = 0; y < f.frameHeight; y++) {
      if (alphaAt(f, frame, 0, y) > ALPHA_THRESHOLD) return `frame ${frame} left edge (y=${y})`;
      if (alphaAt(f, frame, f.width - 1, y) > ALPHA_THRESHOLD) return `frame ${frame} right edge (y=${y})`;
    }
    for (let x = 0; x < f.width; x++) {
      if (alphaAt(f, frame, x, 0) > ALPHA_THRESHOLD) return `frame ${frame} top edge (x=${x})`;
    }
  }
  return null;
}

// Soles sit on the ground line, which the cut leaves 1-2 rows above the last row.
const GROUND_BAND = 4;

function bottomEdgeOpaque(f: Frames, frame: number): number {
  let n = 0;
  for (let x = 0; x < f.width; x++) {
    for (let y = f.frameHeight - GROUND_BAND; y < f.frameHeight; y++) {
      if (alphaAt(f, frame, x, y) > ALPHA_THRESHOLD) n++;
    }
  }
  return n;
}

test("hero-burst.webp has several frames to check", async () => {
  const f = await decode("hero-burst.webp");
  assert.ok(f.count > 1, `expected an animated file, got ${f.count} frame(s)`);
});

test("hero-wave.webp has several frames to check", async () => {
  const f = await decode("hero-wave.webp");
  assert.ok(f.count > 1, `expected an animated file, got ${f.count} frame(s)`);
});

test("hero-burst-still.webp is a single frame", async () => {
  const f = await decode("hero-burst-still.webp");
  assert.equal(f.count, 1);
});

test("hero-burst.webp has no opaque pixel on the left, right or top edge in any frame", async () => {
  assert.equal(firstEdgeTouch(await decode("hero-burst.webp")), null, "opaque pixel on canvas edge");
});

test("hero-wave.webp has no opaque pixel on the left, right or top edge in any frame", async () => {
  assert.equal(firstEdgeTouch(await decode("hero-wave.webp")), null, "opaque pixel on canvas edge");
});

test("hero-burst-still.webp has no opaque pixel on the left, right or top edge", async () => {
  assert.equal(firstEdgeTouch(await decode("hero-burst-still.webp")), null, "opaque pixel on canvas edge");
});

test("hero-burst-still.webp has opaque pixels at the bottom edge (feet on the ground line)", async () => {
  const f = await decode("hero-burst-still.webp");
  assert.ok(bottomEdgeOpaque(f, 0) > 0, "no opaque pixel in the bottom 4 rows: he is floating");
});

test("hero-wave.webp has opaque pixels on the bottom edge of its last frame (feet planted)", async () => {
  const f = await decode("hero-wave.webp");
  assert.ok(bottomEdgeOpaque(f, f.count - 1) > 0, "no opaque pixel in the bottom 4 rows: he is floating");
});
