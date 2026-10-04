import test from "node:test";
import assert from "node:assert/strict";
import { mock } from "node:test";
import Link from "next/link";
import Image from "next/image";
import { productsFor } from "../../../data.ts";
import type { Region } from "../../../region.ts";
import { references } from "../../references.ts";

// creator-notes/page.tsx imports `healthyOpenGraph` from ../../../layout,
// which pulls in next/font/google and a global .css import that can't run
// outside Next's own build pipeline — same problem the why-these-picks and
// sitemap tests solve the same way, via node:test's module mocking (needs
// --experimental-test-module-mocks, already on in the "test" script).
// region-server.ts reads cookies() and headers(), which throw outside a
// request, so it is stubbed too; each test picks its region.
const FAKE_OPEN_GRAPH = { siteName: "Fake", type: "website" as const };

let currentRegion: Region = "US";
let CreatorNotesPage: () => Promise<unknown>;
let metadata: { title: string; robots?: { index: boolean; follow: boolean } };

test.before(async () => {
  mock.module(new URL("../../../layout.tsx", import.meta.url), {
    exports: { healthyOpenGraph: FAKE_OPEN_GRAPH },
  });
  mock.module(new URL("../../../region-server.ts", import.meta.url), {
    exports: { getRegion: async () => currentRegion },
  });
  ({ default: CreatorNotesPage, metadata } = await import("../page.tsx"));
});

/**
 * Same tree walker as why-these-picks/__tests__/page.test.tsx: recurses into
 * every host element's children, expanding local (hook-free) components by
 * calling them as functions, while leaving `Link`/`Image` un-invoked since
 * they rely on Next internals this test never needs.
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
      collectHrefs((el.type as (props: unknown) => unknown)(el.props), out);
      return;
    }
    if (el.props && "children" in el.props) collectHrefs(el.props.children, out);
  }
}

async function pageText(region: Region): Promise<string> {
  currentRegion = region;
  const out: string[] = [];
  collectText(await CreatorNotesPage(), out);
  return out.join(" ");
}

async function pageHrefs(region: Region): Promise<string[]> {
  currentRegion = region;
  const out: string[] = [];
  collectHrefs(await CreatorNotesPage(), out);
  return out;
}

function referencesFor(region: Region) {
  const sold = new Set(productsFor(region).map((p) => p.slug));
  return references.filter((r) => sold.has(r.slug));
}

test("sanity: real reference data actually contains 'say' and 'dontSay' copy (proves the checks below aren't vacuous)", () => {
  assert.ok(references.length > 0, "fixture assumption: at least one reference exists");
  for (const r of references) {
    assert.ok(r.say.length > 0, `fixture assumption: ${r.slug} has 'say' entries`);
    assert.ok(r.dontSay.length > 0, `fixture assumption: ${r.slug} has 'dontSay' entries`);
  }
  assert.ok(references.some((r) => r.sayGb), "fixture assumption: some reference has UK-specific 'say' lines");
});

// ---------------------------------------------------------------------------
// US
// ---------------------------------------------------------------------------

test("US creator-notes page renders every US pick's 'say' line", async () => {
  const text = await pageText("US");
  for (const r of referencesFor("US")) {
    for (const line of r.say) {
      assert.ok(text.includes(line), `missing 'say' line for ${r.slug}: ${line}`);
    }
  }
});

test("US creator-notes page renders every US pick's 'dontSay' line", async () => {
  const text = await pageText("US");
  for (const r of referencesFor("US")) {
    for (const line of r.dontSay) {
      assert.ok(text.includes(line), `missing 'dontSay' line for ${r.slug}: ${line}`);
    }
  }
});

test("US creator-notes page never renders the UK-only 'sayGb' lines", async () => {
  const text = await pageText("US");
  for (const r of references) {
    for (const line of r.sayGb ?? []) {
      assert.ok(!text.includes(line), `UK line leaked to US for ${r.slug}: ${line}`);
    }
  }
});

test("US creator-notes page renders the FDA disclaimer and not the UK wording", async () => {
  const text = await pageText("US");
  assert.match(text, /not intended to diagnose, treat, cure, or prevent any disease/);
  assert.doesNotMatch(text, /Food supplements should not replace a varied, balanced diet/);
});

test("US creator-notes page has no link to the UK-only thorne-creatine and links the US creatine", async () => {
  const hrefs = await pageHrefs("US");
  assert.ok(!hrefs.includes("/products/thorne-creatine"));
  assert.ok(hrefs.includes("/products/pure-encapsulations-creatine"));
});

test("US creator-notes page names the United States", async () => {
  assert.match(await pageText("US"), /Showing the picks sold in the\s+United States/);
});

// ---------------------------------------------------------------------------
// GB
// ---------------------------------------------------------------------------

test("GB creator-notes page renders each UK pick's UK 'say' lines (sayGb when it has one)", async () => {
  const text = await pageText("GB");
  for (const r of referencesFor("GB")) {
    for (const line of r.sayGb ?? r.say) {
      assert.ok(text.includes(line), `missing UK 'say' line for ${r.slug}: ${line}`);
    }
  }
});

test("GB creator-notes page does not render the US 'say' lines where a UK version replaces them", async () => {
  const text = await pageText("GB");
  for (const r of referencesFor("GB").filter((x) => x.sayGb)) {
    for (const line of r.say) {
      assert.ok(!text.includes(line), `US line shown to GB for ${r.slug}: ${line}`);
    }
  }
});

test("GB creator-notes page shows no US-only L-theanine claim lines", async () => {
  const text = await pageText("GB");
  assert.doesNotMatch(text, /may support relaxation|calmer response to everyday stress|alpha brain-wave/i);
});

test("US creator-notes page does show the L-theanine claim lines (so the GB check can fail)", async () => {
  assert.match(await pageText("US"), /may support relaxation/i);
});

test("GB creator-notes page renders every UK pick's 'dontSay' line", async () => {
  const text = await pageText("GB");
  for (const r of referencesFor("GB")) {
    for (const line of r.dontSay) {
      assert.ok(text.includes(line), `missing 'dontSay' line for ${r.slug}: ${line}`);
    }
  }
});

test("GB creator-notes page shows the UK disclaimer and no FDA text", async () => {
  const text = await pageText("GB");
  assert.match(text, /Food supplements should not replace a varied, balanced diet/);
  assert.doesNotMatch(text, /Food and Drug Administration/);
});

test("GB creator-notes page has no link to the US-only creatine and links the UK creatine", async () => {
  const hrefs = await pageHrefs("GB");
  assert.ok(!hrefs.includes("/products/pure-encapsulations-creatine"));
  assert.ok(hrefs.includes("/products/thorne-creatine"));
});

test("GB creator-notes page names the United Kingdom", async () => {
  assert.match(await pageText("GB"), /Showing the picks sold in the\s+United Kingdom/);
});

test("each region's creator-notes page links exactly that region's picks", async () => {
  for (const region of ["US", "GB"] as const) {
    const expected = productsFor(region).map((p) => `/products/${p.slug}`);
    const actual = (await pageHrefs(region)).filter((h) => h.startsWith("/products/"));
    assert.deepEqual([...actual].sort(), [...expected].sort(), region);
  }
});

// ---------------------------------------------------------------------------
// Metadata
// ---------------------------------------------------------------------------

test("creator-notes page metadata sets robots to noindex, nofollow", () => {
  assert.deepEqual(metadata.robots, { index: false, follow: false });
});

test("creator-notes page metadata title is 'Creator notes'", () => {
  assert.equal(metadata.title, "Creator notes");
});
