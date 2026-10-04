import test from "node:test";
import assert from "node:assert/strict";
import { mock } from "node:test";
import Link from "next/link";
import Image from "next/image";
import { productsFor } from "../../data.ts";
import type { Region } from "../../region.ts";
import { references } from "../references.ts";

// why-these-picks/page.tsx imports `healthyOpenGraph` from ../../layout,
// which pulls in next/font/google and a global .css import that can't run
// outside Next's own build pipeline — the same problem sitemap.test.ts
// documents and solves the same way, via node:test's module mocking (needs
// --experimental-test-module-mocks, already on in the "test" script).
// region-server.ts reads cookies() and headers(), which throw outside a
// request, so it is stubbed the same way and each test chooses its region.
const FAKE_OPEN_GRAPH = { siteName: "Fake", type: "website" as const };

let currentRegion: Region = "US";
let WhyThesePicksPage: () => Promise<unknown>;

test.before(async () => {
  mock.module(new URL("../../layout.tsx", import.meta.url), {
    exports: { healthyOpenGraph: FAKE_OPEN_GRAPH },
  });
  mock.module(new URL("../../region-server.ts", import.meta.url), {
    exports: { getRegion: async () => currentRegion },
  });
  ({ default: WhyThesePicksPage } = await import("../page.tsx"));
});

/**
 * Walks the element tree the same way a reader would encounter it: recurses
 * into every host element's children, and — because the page composes real
 * text through local, hook-free components (BrandCard, GradeBadge, Prose,
 * PageHeading) rather than passing literal strings as children everywhere —
 * also calls those component functions to expand their output. `Link` and
 * `Image` are deliberately never invoked: they're Next built-ins that rely
 * on hooks/context that don't exist outside an actual React render, and
 * nothing here needs their internals, only their `children` prop.
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

async function pageText(region: Region = "US"): Promise<string> {
  currentRegion = region;
  const out: string[] = [];
  collectText(await WhyThesePicksPage(), out);
  return out.join(" ");
}

test("sanity: the walker actually reaches text nested inside BrandCard (proves the test below isn't vacuous)", async () => {
  // "NSF Certified for Sport" only exists inside a BrandCard's rendered
  // output (r.say / r.brandClaims), never as a literal child of the page
  // component itself, so finding it proves collectText expanded BrandCard.
  assert.match(await pageText("GB"), /NSF Certified for Sport/);
});

test("why-these-picks page never renders the retired 'strong evidence' wording", async () => {
  assert.doesNotMatch((await pageText()).toLowerCase(), /strong evidence/);
});

test("why-these-picks page never renders the retired 'moderate evidence' wording", async () => {
  assert.doesNotMatch((await pageText()).toLowerCase(), /moderate evidence/);
});

test("why-these-picks page uses the current grade vocabulary instead (robust / promising / early)", async () => {
  const text = (await pageText()).toLowerCase();
  assert.match(text, /robust evidence/);
  assert.match(text, /promising evidence/);
  assert.match(text, /early evidence/);
});

// ---------------------------------------------------------------------------
// The public page must not leak the creator-only "say" / "don't say" copy,
// and must not link to the noindexed creator-notes page.
// ---------------------------------------------------------------------------

/**
 * Collects every `href` reachable in the tree, expanding local components the
 * same way `collectText` does, but also recording `Link`/`<a>` hrefs instead
 * of skipping them (the opposite trade-off from `collectText`, which only
 * needs the visible words).
 */
function collectHrefs(node: unknown, out: string[]): void {
  if (node === null || node === undefined || typeof node === "boolean") return;
  if (Array.isArray(node)) {
    for (const child of node) collectHrefs(child, out);
    return;
  }
  if (typeof node === "object" && "type" in node) {
    const el = node as { type: unknown; props?: { children?: unknown; href?: unknown } };
    if (el.props && typeof el.props.href === "string") out.push(el.props.href);
    if (typeof el.type === "function" && el.type !== Link && el.type !== Image) {
      const rendered = (el.type as (props: unknown) => unknown)(el.props);
      collectHrefs(rendered, out);
      return;
    }
    if (el.props && "children" in el.props) {
      collectHrefs(el.props.children, out);
    }
  }
}

async function pageHrefs(region: Region = "US"): Promise<string[]> {
  currentRegion = region;
  const out: string[] = [];
  collectHrefs(await WhyThesePicksPage(), out);
  return out;
}

test("sanity: real reference data actually contains 'say' and 'dontSay' copy (proves the absence check below isn't vacuous)", () => {
  assert.ok(references.length > 0, "fixture assumption: at least one reference exists");
  for (const r of references) {
    assert.ok(r.say.length > 0, `fixture assumption: ${r.slug} has 'say' entries`);
    assert.ok(r.dontSay.length > 0, `fixture assumption: ${r.slug} has 'dontSay' entries`);
  }
});

test("why-these-picks page renders none of the creator-only 'say' lines", async () => {
  for (const region of ["US", "GB"] as const) {
    const text = await pageText(region);
    for (const r of references) {
      for (const line of r.say) {
        assert.doesNotMatch(text, new RegExp(line.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
      }
    }
  }
});

test("why-these-picks page renders none of the creator-only 'dontSay' lines", async () => {
  for (const region of ["US", "GB"] as const) {
    const text = await pageText(region);
    for (const r of references) {
      for (const line of r.dontSay) {
        assert.doesNotMatch(text, new RegExp(line.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
      }
    }
  }
});

test("why-these-picks page has no link to the noindexed creator-notes page", async () => {
  const hrefs = await pageHrefs();
  assert.ok(hrefs.length > 0, "sanity: the page renders at least one link");
  assert.ok(
    hrefs.every((href) => !href.includes("creator-notes")),
    `found a link to creator-notes: ${hrefs.filter((h) => h.includes("creator-notes")).join(", ")}`,
  );
});

// ---------------------------------------------------------------------------
// Brand heading and per-country cards
// ---------------------------------------------------------------------------

test('heading is "Why these brands" in both countries, not the retired Thorne heading', async () => {
  for (const region of ["US", "GB"] as const) {
    const text = await pageText(region);
    assert.match(text, /Why these brands/);
    assert.doesNotMatch(text, /Why Thorne across all three/);
  }
});

test("every reference has a product in at least one region (so no card is unreachable)", () => {
  const sold = new Set([...productsFor("US"), ...productsFor("GB")].map((p) => p.slug));
  assert.deepEqual(references.filter((r) => !sold.has(r.slug)).map((r) => r.slug), []);
});

test("US page has a card heading for each US pick, with brand and name together", async () => {
  const text = await pageText("US");
  assert.match(text, /Pure Encapsulations\s+Magnesium Glycinate/);
  assert.match(text, /Pure Encapsulations\s+Creatine Monohydrate/);
  assert.match(text, /Pure Encapsulations\s+L-Theanine/);
});

test("GB page has a card heading for each GB pick, with brand and name together", async () => {
  const text = await pageText("GB");
  assert.match(text, /Pure Encapsulations\s+Magnesium Glycinate/);
  assert.match(text, /Thorne\s+Creatine Monohydrate/);
  assert.match(text, /Pure Encapsulations\s+L-Theanine/);
});

test("US page has no card for the UK-only Thorne creatine", async () => {
  const hrefs = await pageHrefs("US");
  assert.ok(!hrefs.includes("/products/thorne-creatine"));
  assert.ok(hrefs.includes("/products/pure-encapsulations-creatine"));
});

test("GB page has no card for the US-only Pure Encapsulations creatine", async () => {
  const hrefs = await pageHrefs("GB");
  assert.ok(!hrefs.includes("/products/pure-encapsulations-creatine"));
  assert.ok(hrefs.includes("/products/thorne-creatine"));
});

test("each card links only to products sold in the visitor's country", async () => {
  for (const region of ["US", "GB"] as const) {
    const sold = productsFor(region).map((p) => `/products/${p.slug}`);
    const cardLinks = (await pageHrefs(region)).filter((h) => h.startsWith("/products/"));
    assert.deepEqual([...cardLinks].sort(), [...sold].sort(), region);
  }
});

test("US page shows the FDA statement and GB page shows the UK wording instead", async () => {
  const us = await pageText("US");
  const gb = await pageText("GB");
  assert.match(us, /Food and Drug Administration/);
  assert.doesNotMatch(gb, /Food and Drug Administration/);
  assert.match(gb, /Food supplements should not replace a varied, balanced diet/);
});

// No L-theanine health claim is authorised in Great Britain, so the UK card uses
// the `gb` override in references.ts instead of the US listing's wording.
test("GB page's L-theanine card carries none of relax, stress, calm, sleep, mood, focus", async () => {
  const text = await pageText("GB");
  const start = text.search(/Pure Encapsulations\s+L-Theanine/);
  assert.ok(start >= 0, "the L-theanine card must be on the page");
  const card = text.slice(start);
  assert.doesNotMatch(card, /relax|stress|calm|sleep|mood|focus/i);
});

test("US page's L-theanine card still carries the US relaxation wording (so the GB check can fail)", async () => {
  const text = await pageText("US");
  const start = text.search(/Pure Encapsulations\s+L-Theanine/);
  assert.ok(start >= 0, "the L-theanine card must be on the page");
  assert.match(text.slice(start), /relax|stress/i);
});
