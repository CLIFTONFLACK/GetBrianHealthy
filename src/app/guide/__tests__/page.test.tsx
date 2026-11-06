import test, { mock } from "node:test";
import assert from "node:assert/strict";
import Link from "next/link";
import Image from "next/image";
import { Icon } from "../../icons.tsx";
import type { Region } from "../../region.ts";

// The guide page reads two Open Graph constants from the root layout. The layout
// pulls in next/font/google and a global .css import, which cannot load under
// `npm test`, so it is stubbed with exactly the exports the guide page uses.
// region-server.ts reads cookies() and headers(), which throw outside a request.
// The form is a client component: it is matched by type and never called, since
// calling a hook outside React is not a meaningful render.
const GUIDE_CARD = {
  url: "/healthy/brand/og-guide.jpg",
  width: 1200,
  height: 630,
  alt: "Free guide from GetBrian Healthy: Energy. Strength. Calm.",
};
/** The site-wide card every page without its own photo card falls back to. */
const MARK_CARD = {
  url: "/healthy/brand/og-image.png",
  width: 1200,
  height: 630,
  alt: "GetBrian Healthy",
};

type El = { type: unknown; props: Record<string, unknown> };
type GuideMeta = { title?: unknown; description?: unknown; openGraph?: { images?: unknown } };

let GuidePage: () => Promise<unknown>;
let metadata: GuideMeta;
let GuideSignup: unknown;
let currentRegion: Region = "US";
/** Component types the walker must not call: they are leaves for this test. */
let leafTypes: unknown[] = [];

test.before(async () => {
  mock.module(new URL("../../layout.tsx", import.meta.url), {
    exports: {
      healthyOpenGraph: { siteName: "GetBrian Healthy", type: "website", locale: "en_US", images: [MARK_CARD] },
      ogImages: { guide: GUIDE_CARD },
    },
  });
  mock.module(new URL("../../region-server.ts", import.meta.url), {
    exports: { getRegion: async () => currentRegion },
  });
  const page = await import("../page.tsx");
  GuidePage = page.default as unknown as () => Promise<unknown>;
  metadata = page.metadata as GuideMeta;
  ({ GuideSignup } = await import("../guide-signup.tsx"));
  leafTypes = [Link, Image, Icon, GuideSignup];
});

const ENV_KEYS = [
  "RESEND_API_KEY",
  "RESEND_SEGMENT_ID",
  "RESEND_GUIDE_SEGMENT_ID",
  "NEWSLETTER_SECRET",
  "NEWSLETTER_FROM",
] as const;

let savedEnv: Record<string, string | undefined>;

test.beforeEach(() => {
  savedEnv = {};
  for (const key of ENV_KEYS) savedEnv[key] = process.env[key];
});

test.afterEach(() => {
  for (const key of ENV_KEYS) {
    const v = savedEnv[key];
    if (v === undefined) delete process.env[key];
    else process.env[key] = v;
  }
});

/** Sets the updates sign-up variables, and the guide segment only when `guideEnabled` is true. */
function setEnv(guideEnabled: boolean) {
  process.env.RESEND_API_KEY = "re_test_key";
  process.env.RESEND_SEGMENT_ID = "seg_123";
  process.env.NEWSLETTER_SECRET = "a".repeat(32);
  process.env.NEWSLETTER_FROM = "Brian <brian@getbrian.xyz>";
  if (guideEnabled) process.env.RESEND_GUIDE_SEGMENT_ID = "seg_guide";
  else delete process.env.RESEND_GUIDE_SEGMENT_ID;
}

async function renderPage(region: Region, guideEnabled: boolean): Promise<unknown> {
  currentRegion = region;
  setEnv(guideEnabled);
  return GuidePage();
}

/**
 * Walks everything a visitor would see: host elements, plus the output of every
 * function component except the leaf types. A component that needs React
 * context throws when called here; the walk then falls back to its children.
 */
function expand(node: unknown, onEl: (el: El) => void, onText: (s: string) => void): void {
  if (node === null || node === undefined || typeof node === "boolean") return;
  if (typeof node === "string") return onText(node);
  if (typeof node === "number") return onText(String(node));
  if (Array.isArray(node)) {
    for (const child of node) expand(child, onEl, onText);
    return;
  }
  if (typeof node === "object" && "type" in node) {
    const el = node as El;
    onEl(el);
    if (typeof el.type === "function" && !leafTypes.includes(el.type)) {
      try {
        expand((el.type as (p: unknown) => unknown)(el.props), onEl, onText);
        return;
      } catch {
        // needs React context: use what it was handed instead
      }
    }
    if (el.props && "children" in el.props) expand(el.props.children, onEl, onText);
  }
}

function elements(tree: unknown): El[] {
  const out: El[] = [];
  expand(tree, (el) => out.push(el), () => {});
  return out;
}

function text(tree: unknown): string {
  const out: string[] = [];
  expand(tree, () => {}, (s) => out.push(s));
  return out.join(" ");
}

function countType(tree: unknown, type: unknown): number {
  return elements(tree).filter((el) => el.type === type).length;
}

function countMarker(tree: unknown, marker: string): number {
  return elements(tree).filter((el) => el.props[marker] === true).length;
}

// ---------------------------------------------------------------------------
// Sanity: the walk reaches the page copy
// ---------------------------------------------------------------------------

test("sanity: the page text names magnesium, creatine and L-theanine", async () => {
  const tree = await renderPage("US", true);
  assert.match(text(tree), /magnesium/i);
  assert.match(text(tree), /creatine/i);
  assert.match(text(tree), /L-theanine/i);
});

// ---------------------------------------------------------------------------
// Sign-up form: shown only when the guide list is configured
// ---------------------------------------------------------------------------

test("the sign-up form shows when the guide list is configured", async () => {
  const tree = await renderPage("US", true);
  assert.equal(countType(tree, GuideSignup), 1);
  assert.equal(countMarker(tree, "data-guide-closed"), 0);
});

test("the closed notice, and no form, shows when the guide list is not configured", async () => {
  const tree = await renderPage("US", false);
  assert.equal(countType(tree, GuideSignup), 0);
  assert.equal(countMarker(tree, "data-guide-closed"), 1);
});

// ---------------------------------------------------------------------------
// One global guide: a GB visitor gets exactly what a US visitor gets
// ---------------------------------------------------------------------------

test("a GB visitor sees the sign-up form and the guide copy, the same as a US visitor", async () => {
  const tree = await renderPage("GB", true);
  assert.equal(countType(tree, GuideSignup), 1);
  assert.match(text(tree), /L-theanine/i);
  assert.equal(text(tree), text(await renderPage("US", true)));
});

test("the page text names no country", async () => {
  const tree = await renderPage("GB", true);
  assert.doesNotMatch(text(tree), /\bUK\b|United Kingdom|Great Britain|\bUS\b|United States/);
});

// ---------------------------------------------------------------------------
// Metadata: one title, description and share card for everyone
// ---------------------------------------------------------------------------

test("the title names the guide", () => {
  assert.equal(metadata.title, "Free guide: Energy. Strength. Calm.");
});

test("the description names no country", () => {
  assert.equal(typeof metadata.description, "string");
  assert.doesNotMatch(String(metadata.description), /\bUK\b|\bUS\b|United|Britain/);
});

test("the share card is the guide card", () => {
  assert.deepEqual(metadata.openGraph?.images, [GUIDE_CARD]);
});
