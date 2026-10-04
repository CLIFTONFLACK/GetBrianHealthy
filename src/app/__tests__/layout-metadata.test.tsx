import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// layout.tsx cannot be imported under `npm test`: it imports next/font/google,
// a directory import that scripts/test-loader.mjs does not resolve (every other
// test stubs the whole layout module instead), so the metadata function cannot
// be called. Following quickwins.test.tsx, which also reads layout.tsx as text,
// these pin the source's structure rather than its output. They are a weaker
// check than calling generateMetadata and say so by name.
const layout = readFileSync(new URL("../layout.tsx", import.meta.url), "utf8").replace(/\r\n/g, "\n");

test("layout (source) no longer exports a static metadata object, so the description can follow the region", () => {
  assert.doesNotMatch(layout, /export const metadata\b/);
  assert.match(layout, /export async function generateMetadata\(\)/);
});

test("layout (source) picks the claim-free description for GB and the original for everyone else", () => {
  assert.match(layout, /region === "GB" \? descriptionGb : description/);
});

test("layout (source) feeds the same chosen description to the page and to Open Graph", () => {
  assert.match(layout, /\n {2}description: pageDescription,/);
  assert.match(layout, /openGraph: \{ \.\.\.healthyOpenGraph, title: PROGRAM_NAME, description: pageDescription,/);
});

test("layout (source) GB description contains none of the claim words", () => {
  const match = layout.match(/const descriptionGb =\n\s+"([^"]+)"/);
  assert.ok(match, "descriptionGb must be a plain string constant");
  assert.doesNotMatch(match[1], /focus|calm|strength|energy|relax|stress|sleep|mood/i);
});

test("layout (source) US description still carries the claim words, so the GB check can fail", () => {
  const match = layout.match(/const description =\n\s+"([^"]+)"/);
  assert.ok(match, "description must be a plain string constant");
  assert.match(match[1], /focus/i);
});
