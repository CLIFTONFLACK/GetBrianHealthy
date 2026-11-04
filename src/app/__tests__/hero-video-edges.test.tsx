import test from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { HERO_VIDEO, HeroVideo, heroVideoMode } from "../hero-video.tsx";

/**
 * The edge cases the main hero-video.test.tsx does not reach: the rest of the
 * heroVideoMode input grid (reduced motion x Save-Data x width, with Save-Data
 * both set and omitted), and the server markup for alt text that is empty,
 * contains markup characters, or is not ASCII.
 */

// ---------------------------------------------------------------------------
// heroVideoMode: the combinations hero-video.test.tsx does not pin
// ---------------------------------------------------------------------------

test("reduced motion and Save-Data both on is poster on a wide screen", () => {
  assert.equal(heroVideoMode({ reducedMotion: true, saveData: true, wide: true }), "poster");
});

test("reduced motion and Save-Data both on is poster on a narrow screen", () => {
  assert.equal(heroVideoMode({ reducedMotion: true, saveData: true, wide: false }), "poster");
});

test("reduced motion with Save-Data omitted is poster on a wide screen", () => {
  assert.equal(heroVideoMode({ reducedMotion: true, wide: true }), "poster");
});

test("reduced motion with Save-Data omitted is poster on a narrow screen", () => {
  assert.equal(heroVideoMode({ reducedMotion: true, wide: false }), "poster");
});

test("motion allowed with Save-Data omitted is tall on a narrow screen", () => {
  assert.equal(heroVideoMode({ reducedMotion: false, wide: false }), "tall");
});

test("motion allowed with Save-Data explicitly off is tall, the same as omitting it", () => {
  assert.equal(heroVideoMode({ reducedMotion: false, saveData: false, wide: false }), heroVideoMode({ reducedMotion: false, wide: false }));
});

test("Save-Data on with motion allowed on a wide screen is poster, not wide", () => {
  // wide: true is what the component passes at 64rem and above. Save-Data must still win there.
  assert.equal(heroVideoMode({ reducedMotion: false, saveData: true, wide: true }), "poster");
});

test("the mode names heroVideoMode returns for the two clips are the keys of HERO_VIDEO the component indexes", () => {
  assert.equal(heroVideoMode({ reducedMotion: false, wide: true }), "wide");
  assert.equal(heroVideoMode({ reducedMotion: false, wide: false }), "tall");
  assert.deepEqual(Object.keys(HERO_VIDEO).sort(), ["tall", "wide"]);
  assert.equal(HERO_VIDEO.wide.width, 1920);
  assert.equal(HERO_VIDEO.tall.width, 1080);
});

// ---------------------------------------------------------------------------
// Server markup: alt text edge cases. The poster <img> is the only element
// that carries alt, so these read it from the poster's own tag.
// ---------------------------------------------------------------------------

function imgTag(alt: string): string {
  const markup = renderToStaticMarkup(<HeroVideo alt={alt} />);
  return markup.match(/<img[^>]*>/)?.[0] ?? "";
}

test("an empty alt renders as alt=\"\" so screen readers skip the decorative hero poster", () => {
  assert.match(imgTag(""), /alt=""/);
});

test("alt text with ampersands and quotes is HTML-escaped inside the attribute", () => {
  assert.match(imgTag('Tom & "Jerry" <3'), /alt="Tom &amp; &quot;Jerry&quot; &lt;3"/);
});

test("non-ASCII alt text (accents and emoji) is passed through unchanged", () => {
  assert.match(imgTag("Café kitchen 🥗"), /alt="Café kitchen 🥗"/);
});

test("the alt text is set on the poster only: the server render has no other alt attribute", () => {
  const markup = renderToStaticMarkup(<HeroVideo alt="A kitchen" />);
  assert.equal((markup.match(/\salt="/g) ?? []).length, 1);
});
