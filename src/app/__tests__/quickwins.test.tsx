import test, { mock } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import Link from "next/link";
import { JobRail } from "../job-rail.tsx";
import { ProductCard, supplementHref } from "../components.tsx";
import { faqs, getSupplement, localizeGoal, localizeSupplement, productsFor, tileGoals, type Product } from "../data.ts";
import type { Region } from "../region.ts";

// page.tsx pulls in signup -> actions -> the root layout (next/font/google, a
// global .css import), which cannot load outside Next's build. Stub it, as the
// other /healthy page tests do.
let HealthyHome: () => Promise<unknown>;
// region-server.ts reads cookies() and headers(), which throw outside a
// request, so it is stubbed; the home page is rendered once per region up front.
let currentRegion: Region = "US";
const trees: Record<Region, unknown> = { US: null, GB: null };

test.before(async () => {
  mock.module(new URL("../site.ts", import.meta.url), {
    exports: { siteUrl: "https://example.test" },
  });
  mock.module(new URL("../region-server.ts", import.meta.url), {
    exports: { getRegion: async () => currentRegion },
  });
  ({ default: HealthyHome } = await import("../page.tsx"));
  currentRegion = "US";
  trees.US = await HealthyHome();
  currentRegion = "GB";
  trees.GB = await HealthyHome();
  currentRegion = "US";
});

/**
 * Walks the element tree of the homepage without a DOM. Only JobRail is
 * expanded (it is a hook-free function); every other component is left as an
 * element, so the walk sees exactly what page.tsx hands each of them.
 */
type El = { type: unknown; props: Record<string, unknown> };

function walk(node: unknown, visit: (el: El) => void): void {
  if (node === null || node === undefined || typeof node === "boolean") return;
  if (Array.isArray(node)) {
    for (const child of node) walk(child, visit);
    return;
  }
  if (typeof node === "object" && "type" in node) {
    const el = node as El;
    visit(el);
    if (el.type === JobRail) {
      walk(JobRail(el.props as { products: Product[]; region?: Region }), visit);
      return;
    }
    if (el.props && "children" in el.props) walk(el.props.children, visit);
  }
}

function textOf(node: unknown): string {
  if (node === null || node === undefined || typeof node === "boolean") return "";
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join("");
  const el = node as El;
  return el.props && "children" in el.props ? textOf(el.props.children) : "";
}

function allElements(root: unknown): El[] {
  const out: El[] = [];
  walk(root, (el) => out.push(el));
  return out;
}

function homeLinks(region: Region = "US"): El[] {
  return allElements(trees[region]).filter((el) => el.type === Link);
}

function railList(): El {
  return allElements(JobRail({ products: productsFor("US") })).find((el) => el.type === "ul") as El;
}

// ---------------------------------------------------------------------------
// Hero link target
// ---------------------------------------------------------------------------

test("hero 'See Brian's Choices' link points at an id that exists on exactly one element in the page", () => {
  const els = allElements(trees.US);
  const hero = els.find((el) => el.type === Link && textOf(el).includes("See Brian"));
  assert.ok(hero, "hero link must be found");
  const href = hero.props.href as string;

  const target = els.filter((el) => `#${el.props?.id}` === href);

  assert.match(href, /^#.+/);
  assert.equal(target.length, 1, `exactly one element must carry the id from ${href}`);
});

test("hero link target is the JobRail list, so the products (not the heading) are scrolled into view", () => {
  const hero = homeLinks().find((el) => textOf(el).includes("See Brian")) as El;

  assert.equal(hero.props.href, `#${railList().props.id}`);
});

test("JobRail list has scroll-mt-20 so the fixed top bar does not cover the picks after the jump", () => {
  assert.match(railList().props.className as string, /(^|\s)scroll-mt-20(\s|$)/);
});

// ---------------------------------------------------------------------------
// Picks rail follows the visitor's country
// ---------------------------------------------------------------------------

function railCards(region: Region): El[] {
  return allElements(trees[region]).filter((el) => el.type === ProductCard);
}

test("US home page rail shows the three US picks, each told it is for a US visitor", () => {
  const cards = railCards("US");
  assert.deepEqual(
    cards.map((c) => (c.props.product as Product).slug),
    ["pure-encapsulations-magnesium-glycinate", "pure-encapsulations-creatine", "pure-encapsulations-l-theanine"],
  );
  assert.deepEqual(cards.map((c) => c.props.region), ["US", "US", "US"]);
});

test("GB home page rail shows the Thorne creatine and no US-only creatine, each card told it is for GB", () => {
  const cards = railCards("GB");
  assert.deepEqual(
    cards.map((c) => (c.props.product as Product).slug),
    ["pure-encapsulations-magnesium-glycinate", "thorne-creatine", "pure-encapsulations-l-theanine"],
  );
  assert.deepEqual(cards.map((c) => c.props.region), ["GB", "GB", "GB"]);
});

test("every rail card links to the Amazon store and tag of the visitor's country", () => {
  for (const c of railCards("US")) {
    assert.match((c.props.product as Product).affiliateUrl as string, /^https:\/\/www\.amazon\.com\/dp\/[A-Z0-9]{10}\?tag=getbrian-20$/);
  }
  for (const c of railCards("GB")) {
    assert.match((c.props.product as Product).affiliateUrl as string, /^https:\/\/www\.amazon\.co\.uk\/dp\/[A-Z0-9]{10}\?tag=getbrian-21$/);
  }
});

// ---------------------------------------------------------------------------
// Closing section
// ---------------------------------------------------------------------------

function closingLinks(region: Region = "US"): El[] {
  const labels = tileGoals.map((g) => {
    const goal = localizeGoal(g, region);
    return `${goal.label}: ${localizeSupplement(getSupplement(goal.supplement), region).name}`;
  });
  return homeLinks(region).filter((el) => labels.includes(textOf(el).trim()));
}

test("closing section has exactly one link per tile goal", () => {
  assert.ok(tileGoals.length > 0);
  assert.equal(closingLinks().length, tileGoals.length);
});

test("each closing link is labelled '<goal>: <supplement>' and goes to that goal's review page", () => {
  const links = closingLinks();

  for (const [i, goal] of tileGoals.entries()) {
    const s = getSupplement(goal.supplement);
    assert.equal(textOf(links[i]).trim(), `${goal.label}: ${s.name}`);
    assert.equal(links[i].props.href, supplementHref(s));
    assert.match(links[i].props.href as string, /^\/products\/[a-z0-9-]+$/);
  }
});

test("US closing links go to the US picks: magnesium, Pure Encapsulations creatine, L-theanine", () => {
  assert.deepEqual(
    closingLinks("US").map((l) => l.props.href),
    [
      "/products/pure-encapsulations-magnesium-glycinate",
      "/products/pure-encapsulations-creatine",
      "/products/pure-encapsulations-l-theanine",
    ],
  );
});

test("GB closing links go to the UK picks: the creatine link is Thorne's", () => {
  assert.deepEqual(
    closingLinks("GB").map((l) => l.props.href),
    [
      "/products/pure-encapsulations-magnesium-glycinate",
      "/products/thorne-creatine",
      "/products/pure-encapsulations-l-theanine",
    ],
  );
});

test("GB closing link for the calm goal is labelled 'Evening: L-theanine', not 'Calm'", () => {
  const labels = closingLinks("GB").map((l) => textOf(l).trim());
  assert.ok(labels.includes("Evening: L-theanine"));
  assert.ok(!labels.some((l) => l.startsWith("Calm")));
});

test("no home-page link in either country goes through /go", () => {
  for (const region of ["US", "GB"] as const) {
    const hrefs = homeLinks(region).map((l) => String(l.props.href));
    assert.deepEqual(hrefs.filter((h) => h.startsWith("/go")), [], region);
  }
});

test("the hero in GB drops the 'Calm' bullet but the US hero keeps it", () => {
  const us = allElements(trees.US).map((el) => textOf(el)).join(" ");
  const gb = allElements(trees.GB).map((el) => textOf(el)).join(" ");
  assert.match(us, /Energy, Strength and Calm When You Need It Most/);
  assert.doesNotMatch(gb, /Energy, Strength and Calm When You Need It Most/);
  assert.match(gb, /Energy and Exercise, Explained From the Research/);
  assert.doesNotMatch(gb, /Strength/);
});

test("the home page shows the Amazon Associate sentence on the phone disclosure line", () => {
  const paras = allElements(trees.US).filter((el) => el.type === "p" && textOf(el).includes("Amazon Associate"));
  assert.ok(paras.length >= 1);
  assert.ok(textOf(paras[0]).startsWith("As an Amazon Associate I earn from qualifying purchases."));
});

test("no closing link falls back to #start", () => {
  const hrefs = closingLinks().map((l) => l.props.href);

  assert.equal(hrefs.includes("#start"), false);
});

test("the old single 'Find my pick' link is gone", () => {
  assert.equal(homeLinks().some((l) => textOf(l).includes("Find my pick")), false);
});

test("FAQ 'More detail' paragraph links to why-these-picks and about", () => {
  const hrefs = homeLinks().map((l) => l.props.href);

  assert.ok(hrefs.includes("/why-these-picks"));
  assert.ok(hrefs.includes("/about"));
});

test("every FAQ summary carries the padding and a focus-visible outline", () => {
  const summaries = allElements(trees.US).filter((el) => el.type === "summary");

  assert.equal(summaries.length, faqs.length);
  for (const s of summaries) {
    assert.match(s.props.className as string, /(^|\s)p-5(\s|$)/);
    assert.match(s.props.className as string, /focus-visible:outline-2/);
  }
});

// ---------------------------------------------------------------------------
// ProductCard
// ---------------------------------------------------------------------------

function baseProduct(overrides: Partial<Product> = {}): Product {
  return {
    slug: "fixture-product",
    name: "Fixture Product",
    brand: "Fixture Brand",
    category: "Creatine",
    format: "Powder",
    image: null,
    imageAlt: "",
    summary: "A fixture product for tests.",
    verdict: "It is a fixture.",
    bestFor: [],
    notFor: [],
    servingSize: null,
    servingsPerContainer: null,
    ingredients: [],
    priceUsd: null,
    priceCheckedAt: null,
    testing: [],
    evidence: [],
    safety: [],
    pros: [],
    cons: [],
    advantage: "",
    brandUrl: "https://brand.example.com",
    affiliateUrl: null,
    redirectAllowed: false,
    lastReviewed: null,
    verified: false,
    regions: [],
    offers: {},
    ...overrides,
  };
}

function cardElements(product: Product): El[] {
  return allElements(ProductCard({ product }));
}

function titleLink(product: Product): El {
  return cardElements(product).find(
    (el) => el.type === Link && el.props.href === `/products/${product.slug}`,
  ) as El;
}

test("ProductCard title link contains both the brand and the name", () => {
  const link = titleLink(baseProduct({ slug: "abc", brand: "Acme", name: "Widget" }));

  // The space matters: without it screen readers and crawlers get "AcmeWidget".
  assert.equal(textOf(link), "Acme Widget");
});

test("ProductCard puts the brand in its own element before the name", () => {
  const link = titleLink(baseProduct({ slug: "abc", brand: "Acme", name: "Widget" }));

  const kids = (link.props.children as unknown[]).filter((c) => c !== null && c !== undefined);
  assert.equal(textOf(kids[0]), "Acme");
  assert.equal((kids[0] as El).type, "span");
  assert.equal(kids[1], " ");
  assert.equal(kids[2], "Widget");
});

test("ProductCard title link has min-h-11 for a full-size tap target", () => {
  const link = titleLink(baseProduct({ slug: "abc" }));

  assert.match(link.props.className as string, /(^|\s)min-h-11(\s|$)/);
});

test("ProductCard price note shows servings count and cost per serving", () => {
  const product = baseProduct({ priceUsd: 30, servingsPerContainer: 60 });

  const notes = cardElements(product).filter((el) => el.type === "span" && textOf(el).includes("/serving"));

  assert.equal(notes.length, 1);
  assert.equal(textOf(notes[0]), "60 ct · $0.50/serving");
});

test("ProductCard renders no per-serving note when servingsPerContainer is null", () => {
  const product = baseProduct({ priceUsd: 30, servingsPerContainer: null });

  const notes = cardElements(product).filter((el) => textOf(el).includes("/serving"));

  assert.equal(notes.length, 0);
});

test("ProductCard renders no per-serving note when servingsPerContainer is zero", () => {
  const product = baseProduct({ priceUsd: 30, servingsPerContainer: 0 });

  const notes = cardElements(product).filter((el) => textOf(el).includes("/serving"));

  assert.equal(notes.length, 0);
});

test("ProductCard renders no per-serving note when price is unverified", () => {
  const product = baseProduct({ priceUsd: null, servingsPerContainer: 60 });

  const notes = cardElements(product).filter((el) => textOf(el).includes("/serving"));

  assert.equal(notes.length, 0);
});

// ---------------------------------------------------------------------------
// FAQ copy (the compliance loops in data.test.ts do not cover faqs)
// ---------------------------------------------------------------------------

const DISEASE_CLAIM_WORDS = ["treat", "cure", "prevent", "reverse", "diagnose"];
const BANNED_MARKETING_WORDS = [
  "leverage", "synergy", "revolutioni", "cutting-edge", "game-changing", "unlock", "seamless", "disrupt", "solutioning",
];
const BRITISH_SPELLINGS = ["ageing", "signalling"];

test("the two new FAQ entries exist", () => {
  const questions = faqs.map((f) => f.question);

  assert.ok(questions.includes("Who is Brian?"));
  assert.ok(questions.includes("Why these brands?"));
  assert.ok(questions.includes("Why do I see different products in the UK and the US?"));
  assert.ok(!questions.includes("Why are all three from Thorne?"));
});

for (const faq of faqs) {
  test(`FAQ "${faq.question}" has no disease-claim, banned or British words`, () => {
    const text = `${faq.question} ${faq.answer}`.toLowerCase();

    assert.deepEqual(DISEASE_CLAIM_WORDS.filter((w) => text.includes(w)), []);
    assert.deepEqual(BANNED_MARKETING_WORDS.filter((w) => text.includes(w)), []);
    assert.deepEqual(BRITISH_SPELLINGS.filter((w) => text.includes(w)), []);
  });
}

test("FAQ questions are unique (they are React keys on the homepage)", () => {
  const questions = faqs.map((f) => f.question);

  assert.equal(new Set(questions).size, questions.length);
});

test("'Who is Brian?' and the About page agree: AI involved, Brian is not a doctor", () => {
  const faq = faqs.find((f) => f.question === "Who is Brian?");
  const about = readFileSync(new URL("../about/page.tsx", import.meta.url), "utf8").replace(/\s+/g, " ");

  assert.ok(faq);
  assert.match(faq.answer, /\bAI\b/);
  assert.match(faq.answer, /Brian is not a doctor/);
  assert.match(about, /\bAI tools\b/);
  assert.match(about, /Brian is not a doctor/);
});

test("'Why these brands?' answer matches the data: each region shows three picks and more than one brand exists", () => {
  // The answer says the same brand is not sold in every country, and the
  // homepage shows "three" picks, so both must stay true of the data.
  const faq = faqs.find((f) => f.question === "Why these brands?");
  assert.ok(faq);
  assert.match(faq.answer, /not sold in every country/);
  assert.equal(productsFor("US").length, 3);
  assert.equal(productsFor("GB").length, 3);
  assert.deepEqual([...new Set(productsFor("US").map((p) => p.brand))], ["Pure Encapsulations"]);
  assert.deepEqual([...new Set(productsFor("GB").map((p) => p.brand))], ["Pure Encapsulations", "Thorne"]);
});

// ---------------------------------------------------------------------------
// Buy-bar / footer pairing
// ---------------------------------------------------------------------------

test("layout footer padding keys on the same data-buy-bar attribute the product page sets", () => {
  const layout = readFileSync(new URL("../layout.tsx", import.meta.url), "utf8");
  const page = readFileSync(new URL("../products/[slug]/page.tsx", import.meta.url), "utf8");

  const footerRef = layout.match(/group-has-\[\[([a-z-]+)\]\]\/page:pb-24/);

  assert.ok(footerRef, "footer must use group-has-[[attr]]/page:pb-24");
  assert.ok(page.includes(`<div ${footerRef[1]} className="fixed inset-x-0 bottom-0`));
  assert.ok(layout.includes('className="group/page flex flex-1 flex-col"'));
});
