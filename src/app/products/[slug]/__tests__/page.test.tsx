import test from "node:test";
import assert from "node:assert/strict";
import { mock } from "node:test";
import Link from "next/link";
import Image from "next/image";
import { AFFILIATE_DISCLOSURE } from "../../../components.tsx";
import { products, type Product } from "../../../data.ts";
import type { Region } from "../../../region.ts";

// page.tsx imports `siteUrl` from ../../site and
// `healthyOpenGraph` from ../../layout, which
// pull in next/font/google and a global .css import that can't run outside
// Next's own build pipeline. Stubbed via node:test's module mocking, the
// same approach used by sitemap.test.ts and why-these-picks/page.test.tsx
// (needs --experimental-test-module-mocks, already on in the "test" script).
//
// region-server.ts reads cookies() and headers(), which throw outside a
// request, so it is stubbed too. Each test sets `currentRegion` itself.
const FAKE_SITE_URL = "https://example.test";
const FAKE_OPEN_GRAPH = { siteName: "Fake", type: "website" as const };

let currentRegion: Region = "US";

let ProductPage: (props: { params: Promise<{ slug: string }> }) => Promise<unknown>;
let generateMetadata: (props: { params: Promise<{ slug: string }> }) => Promise<{ title?: string }>;

test.before(async () => {
  mock.module(new URL("../../../site.ts", import.meta.url), {
    exports: { siteUrl: FAKE_SITE_URL },
  });
  mock.module(new URL("../../../layout.tsx", import.meta.url), {
    exports: { healthyOpenGraph: FAKE_OPEN_GRAPH },
  });
  mock.module(new URL("../../../region-server.ts", import.meta.url), {
    exports: { getRegion: async () => currentRegion },
  });
  ({ default: ProductPage, generateMetadata } = await import("../page.tsx"));
});

/**
 * Same walker as the other /healthy page tests: recurses into every host
 * element's children, expanding local (hook-free) components by calling
 * them as functions, while leaving `Link`/`Image` un-invoked.
 */
function collectText(node: unknown, out: string[]): void {
  if (node === null || node === undefined || typeof node === "boolean") return;
  if (typeof node === "string") {
    out.push(node);
    return;
  }
  if (typeof node === "number") {
    out.push(String(node));
    return;
  }
  if (Array.isArray(node)) {
    for (const child of node) collectText(child, out);
    return;
  }
  if (typeof node === "object" && "type" in node) {
    const el = node as { type: unknown; props?: { children?: unknown } };
    if (typeof el.type === "function" && el.type !== Link && el.type !== Image) {
      const rendered = (el.type as (props: unknown) => unknown)(el.props);
      collectText(rendered, out);
      return;
    }
    if (el.props && "children" in el.props) {
      collectText(el.props.children, out);
    }
  }
}

/**
 * Finds every rendered `next/image` element in the tree (the mirror image of
 * `collectText`, which deliberately skips them) so tests can assert on
 * whether the packshot rendered at all, not just its alt text.
 */
function collectImages(node: unknown, out: { src: unknown }[]): void {
  if (node === null || node === undefined || typeof node === "boolean") return;
  if (Array.isArray(node)) {
    for (const child of node) collectImages(child, out);
    return;
  }
  if (typeof node === "object" && "type" in node) {
    const el = node as { type: unknown; props?: { src?: unknown; children?: unknown } };
    if (el.type === Image) {
      out.push({ src: el.props?.src });
      return;
    }
    if (typeof el.type === "function" && el.type !== Link) {
      const rendered = (el.type as (props: unknown) => unknown)(el.props);
      collectImages(rendered, out);
      return;
    }
    if (el.props && "children" in el.props) {
      collectImages(el.props.children, out);
    }
  }
}

/** Every host element in the tree, with its props. */
function collectElements(node: unknown, out: { type: unknown; props: Record<string, unknown> }[]): void {
  if (node === null || node === undefined || typeof node === "boolean") return;
  if (Array.isArray(node)) {
    for (const child of node) collectElements(child, out);
    return;
  }
  if (typeof node === "object" && "type" in node) {
    const el = node as { type: unknown; props: Record<string, unknown> };
    if (typeof el.type === "function" && el.type !== Link && el.type !== Image) {
      collectElements((el.type as (props: unknown) => unknown)(el.props), out);
      return;
    }
    out.push(el);
    if (el.props && "children" in el.props) collectElements(el.props.children, out);
  }
}

async function renderPage(slug: string, region: Region = "US") {
  currentRegion = region;
  return ProductPage({ params: Promise.resolve({ slug }) });
}

async function pageText(slug: string, region: Region = "US"): Promise<string> {
  const out: string[] = [];
  collectText(await renderPage(slug, region), out);
  return out.join(" ");
}

async function pageImages(slug: string, region: Region = "US"): Promise<{ src: unknown }[]> {
  const out: { src: unknown }[] = [];
  collectImages(await renderPage(slug, region), out);
  return out;
}

async function pageHrefs(slug: string, region: Region = "US"): Promise<string[]> {
  const els: { type: unknown; props: Record<string, unknown> }[] = [];
  collectElements(await renderPage(slug, region), els);
  return els.filter((el) => typeof el.props.href === "string").map((el) => el.props.href as string);
}

/** The digest Next puts on the error thrown by redirect(). */
async function redirectDigest(slug: string, region: Region): Promise<string> {
  try {
    await renderPage(slug, region);
  } catch (err) {
    return String((err as { digest?: string }).digest);
  }
  return "did not throw";
}

const REAL_SLUG = "pure-encapsulations-magnesium-glycinate";

test("sanity: the real magnesium product exists (proves the checks below aren't vacuous)", () => {
  assert.ok(products.some((p) => p.slug === REAL_SLUG), "fixture assumption: the real magnesium product exists");
});

// ---------------------------------------------------------------------------
// Header: "by {brand}"
// ---------------------------------------------------------------------------

test('product page header shows "by {brand}"', async () => {
  const text = await pageText(REAL_SLUG);
  assert.match(text, /by\s+Pure Encapsulations/);
});

test('product page header shows "by Thorne" for the UK creatine', async () => {
  const text = await pageText("thorne-creatine", "GB");
  assert.match(text, /by\s+Thorne/);
});

// ---------------------------------------------------------------------------
// Packshot: renders next/image only when product.image is set
// ---------------------------------------------------------------------------

test("product page renders the packshot image when product.image is set", async () => {
  const fixture: Product = {
    ...(products.find((p) => p.slug === REAL_SLUG) as Product),
    slug: "fixture-with-image",
    image: "/products/fixture.jpg",
  };
  products.push(fixture);
  try {
    const images = await pageImages("fixture-with-image");
    assert.deepEqual(images, [{ src: "/products/fixture.jpg" }]);
  } finally {
    const i = products.indexOf(fixture);
    if (i !== -1) products.splice(i, 1);
  }
});

test("product page renders no packshot image when product.image is null", async () => {
  // Push a fixture with image: null, exercise it, then always remove it in
  // `finally` so the real product list is untouched for later tests.
  const fixture: Product = {
    ...(products.find((p) => p.slug === REAL_SLUG) as Product),
    slug: "fixture-no-image",
    image: null,
  };
  products.push(fixture);
  try {
    const images = await pageImages("fixture-no-image");
    assert.deepEqual(images, []);
  } finally {
    const i = products.indexOf(fixture);
    if (i !== -1) products.splice(i, 1);
  }
});

// ---------------------------------------------------------------------------
// generateMetadata title
// ---------------------------------------------------------------------------

test('generateMetadata title is "{brand} {name} review"', async () => {
  currentRegion = "US";
  const metadata = await generateMetadata({ params: Promise.resolve({ slug: REAL_SLUG }) });
  assert.equal(metadata.title, "Pure Encapsulations Magnesium Glycinate review");
});

test("generateMetadata returns an empty object for an unknown slug", async () => {
  currentRegion = "US";
  const metadata = await generateMetadata({ params: Promise.resolve({ slug: "does-not-exist" }) });
  assert.deepEqual(metadata, {});
});

test("generateMetadata returns an empty object for a retired Thorne slug", async () => {
  currentRegion = "US";
  const metadata = await generateMetadata({ params: Promise.resolve({ slug: "thorne-theanine" }) });
  assert.deepEqual(metadata, {});
});

test("generateMetadata returns an empty object for a product sold only in the other country (GB on the US creatine)", async () => {
  currentRegion = "GB";
  const metadata = await generateMetadata({ params: Promise.resolve({ slug: "pure-encapsulations-creatine" }) });
  assert.deepEqual(metadata, {});
});

test("generateMetadata returns an empty object for a product sold only in the other country (US on the UK creatine)", async () => {
  currentRegion = "US";
  const metadata = await generateMetadata({ params: Promise.resolve({ slug: "thorne-creatine" }) });
  assert.deepEqual(metadata, {});
});

test("generateMetadata titles each country's own creatine", async () => {
  currentRegion = "GB";
  const gb = await generateMetadata({ params: Promise.resolve({ slug: "thorne-creatine" }) });
  currentRegion = "US";
  const us = await generateMetadata({ params: Promise.resolve({ slug: "pure-encapsulations-creatine" }) });
  assert.equal(gb.title, "Thorne Creatine Monohydrate review");
  assert.equal(us.title, "Pure Encapsulations Creatine Monohydrate review");
});

// ---------------------------------------------------------------------------
// Unknown slugs
// ---------------------------------------------------------------------------

test("product page calls notFound for an unknown slug", async () => {
  await assert.rejects(renderPage("does-not-exist", "US"), (err: { digest?: string }) =>
    String(err.digest).includes("404"),
  );
});

test("product page calls notFound for a retired Thorne slug (the redirect lives in next.config.ts)", async () => {
  await assert.rejects(renderPage("thorne-magnesium-glycinate", "GB"), (err: { digest?: string }) =>
    String(err.digest).includes("404"),
  );
});

// ---------------------------------------------------------------------------
// A visitor is sent to their own country's pick
// ---------------------------------------------------------------------------

test("a GB visitor on pure-encapsulations-creatine is redirected to thorne-creatine with a 307", async () => {
  const digest = await redirectDigest("pure-encapsulations-creatine", "GB");
  assert.match(digest, /^NEXT_REDIRECT;(replace|push);\/products\/thorne-creatine;307;?/);
});

test("a US visitor on thorne-creatine is redirected to pure-encapsulations-creatine with a 307", async () => {
  const digest = await redirectDigest("thorne-creatine", "US");
  assert.match(digest, /^NEXT_REDIRECT;(replace|push);\/products\/pure-encapsulations-creatine;307;?/);
});

test("a US visitor on pure-encapsulations-creatine is not redirected", async () => {
  const digest = await redirectDigest("pure-encapsulations-creatine", "US");
  assert.equal(digest, "did not throw");
});

test("a GB visitor on thorne-creatine is not redirected", async () => {
  const digest = await redirectDigest("thorne-creatine", "GB");
  assert.equal(digest, "did not throw");
});

test("a visitor on a product sold in both countries is not redirected in either", async () => {
  assert.equal(await redirectDigest("pure-encapsulations-l-theanine", "GB"), "did not throw");
  assert.equal(await redirectDigest("pure-encapsulations-l-theanine", "US"), "did not throw");
});

// ---------------------------------------------------------------------------
// Buy links: straight to the visitor's Amazon, with that country's tag
// ---------------------------------------------------------------------------

test("US page links to amazon.com with the -20 tag", async () => {
  const hrefs = await pageHrefs("pure-encapsulations-creatine", "US");
  const buy = hrefs.filter((h) => h.includes("amazon"));
  assert.ok(buy.length >= 2, "sidebar button and mobile bar both link out");
  assert.deepEqual([...new Set(buy)], ["https://www.amazon.com/dp/B0FSGYKS5Z?tag=getbrian-20"]);
});

test("GB page links to amazon.co.uk with the -21 tag", async () => {
  const hrefs = await pageHrefs("thorne-creatine", "GB");
  const buy = hrefs.filter((h) => h.includes("amazon"));
  assert.ok(buy.length >= 2, "sidebar button and mobile bar both link out");
  assert.deepEqual([...new Set(buy)], ["https://www.amazon.co.uk/dp/B07978VPPH?tag=getbrian-21"]);
});

test("the same product links to a different ASIN in each country", async () => {
  const us = await pageHrefs("pure-encapsulations-l-theanine", "US");
  const gb = await pageHrefs("pure-encapsulations-l-theanine", "GB");
  assert.ok(us.includes("https://www.amazon.com/dp/B0016CXZJO?tag=getbrian-20"));
  assert.ok(gb.includes("https://www.amazon.co.uk/dp/B07JZFQWTL?tag=getbrian-21"));
});

test("no page links through the /go redirect", async () => {
  for (const [slug, region] of [
    [REAL_SLUG, "US"],
    [REAL_SLUG, "GB"],
    ["thorne-creatine", "GB"],
    ["pure-encapsulations-l-theanine", "US"],
  ] as const) {
    const hrefs = await pageHrefs(slug, region);
    assert.deepEqual(hrefs.filter((h) => h.startsWith("/go")), [], `${slug} ${region}`);
  }
});

test("the Buy button is labelled with Amazon", async () => {
  const text = await pageText(REAL_SLUG, "US");
  assert.match(text, /Check price at Amazon/);
});

// ---------------------------------------------------------------------------
// No price on an Amazon page
// ---------------------------------------------------------------------------

test("an Amazon page with no live price shows no dollar price and points to Amazon", async () => {
  const text = await pageText(REAL_SLUG, "US");
  assert.doesNotMatch(text, /\$\d/);
  assert.match(text, /No current price is available here right now/);
  assert.match(text, /Price on\s+Amazon/);
});

test("an Amazon page shows no per-serving cost", async () => {
  const text = await pageText(REAL_SLUG, "US");
  assert.doesNotMatch(text, /\/serving/);
  assert.doesNotMatch(text, /Per serving\s+\$/);
});

// ---------------------------------------------------------------------------
// Affiliate disclosure: product pages, unlike the homepage's ProductCard,
// must keep the full disclosure sentence beside the Buy button (FTC
// guidance expects it where the endorsement is).
// ---------------------------------------------------------------------------

test("product page still shows the full affiliate disclosure sentence beside the Buy button", async () => {
  const text = await pageText(REAL_SLUG);
  assert.match(text, new RegExp(AFFILIATE_DISCLOSURE.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
});

test("the affiliate disclosure on the product page starts with the Amazon Associate sentence", async () => {
  const text = await pageText(REAL_SLUG, "GB");
  assert.match(text, /As an Amazon Associate I earn from qualifying purchases\. If you buy through this link/);
});

test("the mobile bar carries the Amazon Associate sentence", async () => {
  const text = await pageText(REAL_SLUG, "US");
  const occurrences = text.split("As an Amazon Associate I earn from qualifying purchases.").length - 1;
  assert.equal(occurrences, 2, "once beside the sidebar button, once in the mobile bar");
});

test("mobile sticky bar shows the product's brand and name", async () => {
  const text = await pageText(REAL_SLUG);
  // The header already renders "by {brand}" and the name as a heading, so
  // this pins that the brand and name also appear together, adjacent, the
  // way the sticky bar's own <p>{brand} {name}</p> renders them.
  assert.match(text, /Pure Encapsulations\s+Magnesium Glycinate/);
});

// ---------------------------------------------------------------------------
// Region-specific disclaimer and claims
// ---------------------------------------------------------------------------

test("US page shows the FDA statement and not the UK wording", async () => {
  const text = await pageText(REAL_SLUG, "US");
  assert.match(text, /Food and Drug Administration/);
  assert.doesNotMatch(text, /Food supplements should not replace a varied, balanced diet/);
});

test("GB page shows the UK wording and not the FDA statement", async () => {
  const text = await pageText(REAL_SLUG, "GB");
  assert.match(text, /Food supplements should not replace a varied, balanced diet/);
  assert.doesNotMatch(text, /Food and Drug Administration/);
});

test("GB L-theanine page says no health claim is made and lists no evidence", async () => {
  const text = await pageText("pure-encapsulations-l-theanine", "GB");
  assert.match(text, /No health claim is authorised for this ingredient in the UK/);
});

test("US L-theanine page lists evidence and not the UK no-claim notice", async () => {
  const text = await pageText("pure-encapsulations-l-theanine", "US");
  assert.doesNotMatch(text, /No health claim is authorised for this ingredient in the UK/);
  assert.match(text, /Evidence|evidence/);
});

test("GB L-theanine page text contains none of relax, stress, calm, sleep, mood, focus outside the fixed notice", async () => {
  const text = await pageText("pure-encapsulations-l-theanine", "GB");
  // The page's own explanatory notice and the fixed "Calm" copy are not
  // product claims, so the check runs on the text with that notice removed.
  const withoutNotice = text.replace(/No health claim is authorised[^.]*\./, "");
  assert.doesNotMatch(withoutNotice, /relax|stress|calm|sleep|mood|focus/i);
});

test("GB creatine page lists its job as Exercise and never Strength or Focus", async () => {
  const text = await pageText("thorne-creatine", "GB");
  assert.match(text, /Its job in the program\s+Exercise/);
  assert.doesNotMatch(text, /Strength|Focus|Promising, but not yet established|Cognitive/);
});

test("US creatine page lists Strength and Focus with the focus caveat", async () => {
  const text = await pageText("pure-encapsulations-creatine", "US");
  assert.match(text, /Strength/);
  assert.match(text, /Focus/);
  assert.match(text, /Promising, but not yet established/);
});

test("GB magnesium page's 'rest of the program' list uses the UK creatine and L-theanine wording", async () => {
  const text = await pageText(REAL_SLUG, "GB");
  assert.match(text, /Exercise/);
  assert.match(text, /Evening/);
  assert.doesNotMatch(text, /Lifting after 40|wind down|wired at 10pm/);
});

test("US L-theanine page does carry claim words (so the GB check can fail)", async () => {
  const text = await pageText("pure-encapsulations-l-theanine", "US");
  assert.match(text, /relax|stress|calm|sleep|mood|focus/i);
});
