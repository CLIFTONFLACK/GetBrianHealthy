import test from "node:test";
import assert from "node:assert/strict";
import { mock } from "node:test";
import Link from "next/link";
import Image from "next/image";
import { AFFILIATE_DISCLOSURE } from "../../../components.tsx";
import { goals, products, type Product } from "../../../data.ts";
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

/** A rendered host element (a tag, or a next/link or next/image element), as collectElements returns it. */
type Host = { type: unknown; props: Record<string, unknown> };

/** The children of the page's one <header>: the hero. */
async function heroChildren(slug: string, region: Region = "US"): Promise<unknown> {
  const all: Host[] = [];
  collectElements(await renderPage(slug, region), all);
  const headers = all.filter((el) => el.type === "header");
  assert.equal(headers.length, 1, "expected exactly one <header> on the product page: the hero");
  return headers[0].props.children;
}

/** Every host element inside the hero, in document order. */
async function heroHosts(slug: string, region: Region = "US"): Promise<Host[]> {
  const out: Host[] = [];
  collectElements(await heroChildren(slug, region), out);
  return out;
}

/** The hero's text, joined with no separators so JSX pieces read exactly as they are written. */
async function heroText(slug: string, region: Region = "US"): Promise<string> {
  const out: string[] = [];
  collectText(await heroChildren(slug, region), out);
  return out.join("");
}

async function heroHeading(slug: string, region: Region = "US"): Promise<string> {
  const headings = (await heroHosts(slug, region)).filter((el) => el.type === "h1");
  assert.equal(headings.length, 1, "expected exactly one h1 in the hero");
  const out: string[] = [];
  collectText(headings[0].props.children, out);
  return out.join("");
}

/** The text of each fact chip (the <li>s of the hero's "At a glance" list), in order. */
async function heroChips(slug: string, region: Region = "US"): Promise<string[]> {
  const items = (await heroHosts(slug, region)).filter((el) => el.type === "li");
  return items.map((li) => {
    const out: string[] = [];
    collectText(li.props.children, out);
    return out.join("");
  });
}

/** Every inline background-image the hero sets, in order. */
async function heroBackgrounds(slug: string, region: Region = "US"): Promise<string[]> {
  const hosts = await heroHosts(slug, region);
  return hosts.flatMap((el) => {
    const style = el.props.style as { backgroundImage?: string } | undefined;
    return style?.backgroundImage ? [style.backgroundImage] : [];
  });
}

/** Every href the hero renders (Link and plain anchor alike), in order. */
async function heroHrefs(slug: string, region: Region = "US"): Promise<string[]> {
  const hosts = await heroHosts(slug, region);
  return hosts.filter((el) => typeof el.props.href === "string").map((el) => el.props.href as string);
}

/** Every next/image element inside the hero. */
async function heroImages(slug: string, region: Region = "US"): Promise<{ src: unknown }[]> {
  const out: { src: unknown }[] = [];
  collectImages(await heroChildren(slug, region), out);
  return out;
}

/** Every host element on the whole page, in document order. */
async function pageHosts(slug: string, region: Region = "US"): Promise<Host[]> {
  const out: Host[] = [];
  collectElements(await renderPage(slug, region), out);
  return out;
}

/** The space-separated class names on every host element in the hero that has a className. */
async function heroClassNames(slug: string, region: Region = "US"): Promise<string[]> {
  const hosts = await heroHosts(slug, region);
  return hosts.flatMap((el) => (typeof el.props.className === "string" ? [el.props.className] : []));
}

const REAL_SLUG = "pure-encapsulations-magnesium-glycinate";
const US_MAGNESIUM_BUY = "https://www.amazon.com/dp/B07P5K7DQP?tag=getbrian-20";
const GB_MAGNESIUM_BUY = "https://www.amazon.co.uk/dp/B087B93NJB?tag=getbrian-21";

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

test("an Amazon page shows no dollar price and says why", async () => {
  const text = await pageText(REAL_SLUG, "US");
  assert.doesNotMatch(text, /\$\d/);
  assert.match(text, /this page does not show one/);
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

test("every Buy button carries the Amazon Associate sentence: hero, sidebar and mobile bar", async () => {
  const text = await pageText(REAL_SLUG, "US");
  const occurrences = text.split("As an Amazon Associate I earn from qualifying purchases.").length - 1;
  assert.equal(occurrences, 3, "once beside the hero button, once beside the sidebar button, once in the mobile bar");
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

// ---------------------------------------------------------------------------
// Hero: a full-bleed header above the body, rendered for every pick in both countries.
// ---------------------------------------------------------------------------

test("hero shows the US magnesium name as its only h1", async () => {
  assert.equal(await heroHeading(REAL_SLUG, "US"), "Magnesium Glycinate");
});

test("hero shows the US creatine name as its only h1", async () => {
  assert.equal(await heroHeading("pure-encapsulations-creatine", "US"), "Creatine Monohydrate");
});

test("hero shows the US L-theanine name as its only h1", async () => {
  assert.equal(await heroHeading("pure-encapsulations-l-theanine", "US"), "L-Theanine");
});

test("hero shows the GB magnesium name as its only h1", async () => {
  assert.equal(await heroHeading(REAL_SLUG, "GB"), "Magnesium Glycinate");
});

test("hero shows the GB creatine name as its only h1", async () => {
  assert.equal(await heroHeading("thorne-creatine", "GB"), "Creatine Monohydrate");
});

test("hero shows the GB L-theanine name as its only h1", async () => {
  assert.equal(await heroHeading("pure-encapsulations-l-theanine", "GB"), "L-Theanine");
});

test("hero names the US magnesium brand as 'by Pure Encapsulations'", async () => {
  assert.match(await heroText(REAL_SLUG, "US"), /by Pure Encapsulations/);
});

test("hero names the GB creatine brand as 'by Thorne'", async () => {
  assert.match(await heroText("thorne-creatine", "GB"), /by Thorne/);
});

test("hero carries the US magnesium summary", async () => {
  assert.match(
    await heroText(REAL_SLUG, "US"),
    /Single-ingredient magnesium glycinate, 120 mg a capsule, so you can build your dose up one capsule at a time\./,
  );
});

// ---------------------------------------------------------------------------
// Hero eyebrow: "{category} · {first goal label}", in the region's own wording.
// ---------------------------------------------------------------------------

test("hero eyebrow reads 'Magnesium · Energy' for the US magnesium", async () => {
  assert.match(await heroText(REAL_SLUG, "US"), /Magnesium · Energy/);
});

test("hero eyebrow reads 'Creatine · Strength' for the US creatine", async () => {
  assert.match(await heroText("pure-encapsulations-creatine", "US"), /Creatine · Strength/);
});

test("hero eyebrow uses the UK goal label 'Exercise' for the GB creatine", async () => {
  assert.match(await heroText("thorne-creatine", "GB"), /Creatine · Exercise/);
});

test("hero eyebrow uses the UK goal label 'Evening' for the GB L-theanine", async () => {
  assert.match(await heroText("pure-encapsulations-l-theanine", "GB"), /L-theanine · Evening/);
});

test("hero drops the goal photo and the goal name together when its supplement has no goal", async () => {
  const index = goals.findIndex((g) => g.supplement === "magnesium");
  assert.notEqual(index, -1, "fixture assumption: a goal serves magnesium");
  const removed = goals[index];
  goals.splice(index, 1);
  try {
    assert.deepEqual(await heroBackgrounds(REAL_SLUG, "US"), []);
    assert.equal(await heroHeading(REAL_SLUG, "US"), "Magnesium Glycinate");
    assert.doesNotMatch(await heroText(REAL_SLUG, "US"), /·/);
  } finally {
    goals.splice(index, 0, removed);
  }
});

// ---------------------------------------------------------------------------
// Hero background: the goal photo, as a CSS background (decoration, not an <Image>).
// ---------------------------------------------------------------------------

test("hero background is the energy photo for the US magnesium pick", async () => {
  assert.deepEqual(await heroBackgrounds(REAL_SLUG, "US"), ["url(/healthy/goals/energy.jpg)"]);
});

test("hero background is the strength photo for the US creatine, not the focus photo", async () => {
  assert.deepEqual(await heroBackgrounds("pure-encapsulations-creatine", "US"), ["url(/healthy/goals/strength.jpg)"]);
});

test("hero background is the strength photo for the GB creatine", async () => {
  assert.deepEqual(await heroBackgrounds("thorne-creatine", "GB"), ["url(/healthy/goals/strength.jpg)"]);
});

test("hero background is the calm photo for the GB L-theanine", async () => {
  assert.deepEqual(await heroBackgrounds("pure-encapsulations-l-theanine", "GB"), ["url(/healthy/goals/calm.jpg)"]);
});

// ---------------------------------------------------------------------------
// Hero packshot: still the page's one next/image, with its note under it.
// ---------------------------------------------------------------------------

test("hero packshot is the US magnesium packshot", async () => {
  assert.deepEqual(await heroImages(REAL_SLUG, "US"), [{ src: "/healthy/products/pure-encapsulations-magnesium-glycinate.png" }]);
});

test("hero packshot is the UK magnesium packshot for GB", async () => {
  assert.deepEqual(await heroImages(REAL_SLUG, "GB"), [{ src: "/healthy/products/pure-encapsulations-magnesium-glycinate-uk.png" }]);
});

test("the US magnesium page has exactly one next/image, the packshot", async () => {
  assert.deepEqual(await pageImages(REAL_SLUG, "US"), [{ src: "/healthy/products/pure-encapsulations-magnesium-glycinate.png" }]);
});

test("the GB L-theanine page has exactly one next/image, the UK packshot", async () => {
  assert.deepEqual(await pageImages("pure-encapsulations-l-theanine", "GB"), [
    { src: "/healthy/products/pure-encapsulations-l-theanine-uk.png" },
  ]);
});

test("the US magnesium packshot note sits in the hero", async () => {
  assert.match(await heroText(REAL_SLUG, "US"), /The photo shows the 30-capsule bottle\. The pack linked here is 90 capsules\./);
});

test("the GB magnesium hero shows no packshot note, because the UK pack has none", async () => {
  assert.doesNotMatch(await heroText(REAL_SLUG, "GB"), /The photo shows/);
});

test("the hero packshot wrapper carries the animate-healthy-float class from globals.css", async () => {
  const floats = (await heroClassNames(REAL_SLUG, "US")).filter((c) => c.split(" ").includes("animate-healthy-float"));
  assert.equal(floats.length, 1);
});

// ---------------------------------------------------------------------------
// Hero fact chips: format, serving, servings, then the evidence badge only when there is evidence.
// ---------------------------------------------------------------------------

test("US magnesium chips are format, serving, servings and the grade", async () => {
  assert.deepEqual(await heroChips(REAL_SLUG, "US"), ["Capsules", "Serving: 1 capsule", "90 servings", "Robust evidence"]);
});

test("US L-theanine chips end with its Promising evidence grade", async () => {
  assert.deepEqual(await heroChips("pure-encapsulations-l-theanine", "US"), [
    "Capsules",
    "Serving: 2 capsules",
    "30 servings",
    "Promising evidence",
  ]);
});

test("US creatine chips are format, serving, servings and the grade", async () => {
  assert.deepEqual(await heroChips("pure-encapsulations-creatine", "US"), [
    "Powder",
    "Serving: 1.5 teaspoons (5 g)",
    "60 servings",
    "Robust evidence",
  ]);
});

test("GB magnesium chips use the UK serving and servings count", async () => {
  assert.deepEqual(await heroChips(REAL_SLUG, "GB"), ["Capsules", "Serving: 2 capsules", "45 servings", "Robust evidence"]);
});

test("GB creatine chips use the scoop serving and the grade", async () => {
  assert.deepEqual(await heroChips("thorne-creatine", "GB"), ["Powder", "Serving: 1 scoop (5 g)", "90 servings", "Robust evidence"]);
});

test("GB L-theanine hero has no evidence badge: its chips stop at the servings count", async () => {
  assert.deepEqual(await heroChips("pure-encapsulations-l-theanine", "GB"), ["Capsules", "Serving: 1 capsule", "60 servings"]);
});

test("GB L-theanine hero names no evidence grade", async () => {
  assert.doesNotMatch(await heroText("pure-encapsulations-l-theanine", "GB"), /evidence/i);
});

test("GB L-theanine hero uses no claim words", async () => {
  assert.doesNotMatch(await heroText("pure-encapsulations-l-theanine", "GB"), /relax|stress|calm|sleep|mood|focus|wind/i);
});

test("US L-theanine hero does carry a claim word, its Calm goal in the eyebrow (so the GB check can fail)", async () => {
  assert.match(await heroText("pure-encapsulations-l-theanine", "US"), /L-theanine · Calm/);
});

test("hero shows no empty chip when servingSize and servingsPerContainer are both null", async () => {
  const fixture: Product = {
    ...(products.find((p) => p.slug === REAL_SLUG) as Product),
    slug: "fixture-null-serving",
    servingSize: null,
    servingsPerContainer: null,
    evidence: [],
  };
  products.push(fixture);
  try {
    assert.deepEqual(await heroChips("fixture-null-serving", "US"), ["Capsules"]);
  } finally {
    const i = products.indexOf(fixture);
    if (i !== -1) products.splice(i, 1);
  }
});

test("hero drops only the serving chip when servingSize is null and servings are known", async () => {
  const fixture: Product = {
    ...(products.find((p) => p.slug === REAL_SLUG) as Product),
    slug: "fixture-null-serving-size",
    servingSize: null,
    evidence: [],
  };
  products.push(fixture);
  try {
    assert.deepEqual(await heroChips("fixture-null-serving-size", "US"), ["Capsules", "90 servings"]);
  } finally {
    const i = products.indexOf(fixture);
    if (i !== -1) products.splice(i, 1);
  }
});

test("hero shows no '0 servings' chip when servingsPerContainer is zero", async () => {
  const fixture: Product = {
    ...(products.find((p) => p.slug === REAL_SLUG) as Product),
    slug: "fixture-zero-servings",
    servingSize: null,
    servingsPerContainer: 0,
    evidence: [],
  };
  products.push(fixture);
  try {
    assert.deepEqual(await heroChips("fixture-zero-servings", "US"), ["Capsules"]);
  } finally {
    const i = products.indexOf(fixture);
    if (i !== -1) products.splice(i, 1);
  }
});

// ---------------------------------------------------------------------------
// Hero Buy link, its disclosure, and the links beside them.
// ---------------------------------------------------------------------------

test("hero Buy link goes straight to the US Amazon listing, not through /go", async () => {
  const amazon = (await heroHrefs(REAL_SLUG, "US")).filter((h) => h.includes("amazon"));
  assert.deepEqual(amazon, [US_MAGNESIUM_BUY]);
});

test("hero Buy link goes straight to the UK Amazon listing for GB", async () => {
  const amazon = (await heroHrefs(REAL_SLUG, "GB")).filter((h) => h.includes("amazon"));
  assert.deepEqual(amazon, [GB_MAGNESIUM_BUY]);
});

test("hero links are the breadcrumb, the Buy link, the research section and the routine, in that order", async () => {
  assert.deepEqual(await heroHrefs(REAL_SLUG, "US"), ["/#picks", US_MAGNESIUM_BUY, "#research", "/routine"]);
});

test("hero has exactly one disclosure, and it is the full affiliate sentence", async () => {
  const disclosures = (await heroHosts(REAL_SLUG, "US")).filter((el) => "data-affiliate-disclosure" in el.props);
  assert.equal(disclosures.length, 1);
  const out: string[] = [];
  collectText(disclosures[0].props.children, out);
  assert.equal(out.join(""), AFFILIATE_DISCLOSURE);
});

test("hero disclosure comes after the hero Buy link, not before it", async () => {
  const hosts = await heroHosts(REAL_SLUG, "US");
  const buyIndex = hosts.findIndex((el) => el.props.href === US_MAGNESIUM_BUY);
  const disclosureIndex = hosts.findIndex((el) => "data-affiliate-disclosure" in el.props);
  assert.ok(buyIndex >= 0, "the hero Buy link renders");
  assert.ok(disclosureIndex >= 0, "the hero disclosure renders");
  assert.ok(disclosureIndex > buyIndex, `disclosure at ${disclosureIndex} should follow the Buy link at ${buyIndex}`);
});

test("the hero's #research link lands on a research section that exists on the page", async () => {
  assert.ok((await heroHrefs(REAL_SLUG, "US")).includes("#research"), "the hero links to #research");
  const sections = (await pageHosts(REAL_SLUG, "US")).filter((el) => el.type === "section" && el.props.id === "research");
  assert.equal(sections.length, 1);
});

// ---------------------------------------------------------------------------
// Brian's verdict moved out of the hero and into the body.
// ---------------------------------------------------------------------------

test("the verdict text is not in the hero but is in the body", async () => {
  const verdict = (products.find((p) => p.slug === REAL_SLUG) as Product).verdict;
  assert.equal((await heroText(REAL_SLUG, "US")).includes(verdict), false);
  assert.equal((await pageText(REAL_SLUG, "US")).includes(verdict), true);
});

test("the body has a Brian's verdict section labelled by its heading", async () => {
  const sections = (await pageHosts(REAL_SLUG, "US")).filter((el) => el.props["aria-labelledby"] === "verdict-heading");
  assert.equal(sections.length, 1);
  assert.equal(sections[0].type, "section");
});
