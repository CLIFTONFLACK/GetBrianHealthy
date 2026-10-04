import test from "node:test";
import assert from "node:assert/strict";
import {
  AFFILIATE_DISCLOSURE,
  BuyButton,
  FdaDisclaimer,
  GoalChooser,
  PriceLine,
  ProductCard,
  SupplementCard,
  supplementHref,
} from "../components.tsx";
import {
  AMAZON_ASSOCIATE_STATEMENT,
  buyHref,
  getProductFor,
  productsFor,
  getSupplement,
  goals,
  localizeGoal,
  products,
  tileGoals,
  type Product,
  type Supplement,
} from "../data.ts";

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

/**
 * BuyButton takes no hooks and no context, so calling it as a plain function
 * (rather than rendering it to a DOM) returns the React element tree
 * directly — enough to assert on structure without a rendering dependency.
 */
function renderButton(product: Product, from = "product") {
  return BuyButton({ product, from });
}

function children(el: ReturnType<typeof renderButton>): unknown[] {
  const kids = (el.props as { children: unknown }).children;
  return Array.isArray(kids) ? kids : [kids];
}

test("BuyButton always renders the affiliate disclosure paragraph after the link", () => {
  const product = baseProduct({ affiliateUrl: null });
  const [link, disclosure] = children(renderButton(product)) as [
    { type: string; props: Record<string, unknown> },
    { type: string; props: Record<string, unknown> },
  ];
  assert.equal(link.type, "a");
  assert.equal(disclosure.props["data-affiliate-disclosure"], true);
  assert.equal(disclosure.props.children, AFFILIATE_DISCLOSURE);
});

test("BuyButton still renders the disclosure when the link bypasses the redirect", () => {
  // The case the rule exists for: once a product has a direct affiliate
  // link (redirectAllowed programme), the disclosure must not quietly
  // disappear along with the /go wrapper.
  const product = baseProduct({
    affiliateUrl: "https://affiliate.example.com/x",
    redirectAllowed: false,
  });
  const [, disclosure] = children(renderButton(product)) as [
    unknown,
    { props: Record<string, unknown> },
  ];
  assert.equal(disclosure.props["data-affiliate-disclosure"], true);
});

test("BuyButton renders the link but no disclosure paragraph when showDisclosure is false", () => {
  const product = baseProduct();
  const el = BuyButton({ product, from: "picks", showDisclosure: false });
  const kids = children(el);
  const [link, disclosure] = kids as [{ type: string }, unknown];
  assert.equal(link.type, "a");
  // The disclosure slot is `showDisclosure && (<p ... />)`, so with
  // showDisclosure false it's the boolean `false`, not a <p> element —
  // React renders nothing for it, but it's still present in the children
  // array, which is why this doesn't just assert kids.length === 1.
  assert.equal(disclosure, false);
  assert.ok(
    kids.every((k) => !(k as { props?: Record<string, unknown> })?.props?.["data-affiliate-disclosure"]),
    "expected no element carrying data-affiliate-disclosure",
  );
});

test("BuyButton link href matches buyHref for the given product and source", () => {
  const product = baseProduct({ slug: "abc", affiliateUrl: null });
  const [link] = children(renderButton(product, "compare-creatine")) as [
    { props: Record<string, unknown> },
  ];
  assert.equal(link.props.href, buyHref(product, "compare-creatine"));
});

test("BuyButton link opens in a new tab with sponsored/nofollow rel", () => {
  const product = baseProduct();
  const [link] = children(renderButton(product)) as [{ props: Record<string, unknown> }];
  assert.equal(link.props.target, "_blank");
  assert.equal(link.props.rel, "sponsored nofollow noopener");
});

// Clifton's call (2026-09-24, D2): the button names where it sends the reader,
// taken from the data so a lineup change needs no code change.
function buttonLabel(product: Product): string {
  const [link] = children(renderButton(product)) as [{ props: { children: unknown[] } }];
  return link.props.children.filter((child) => typeof child === "string").join("");
}

test("BuyButton label names the brand when the link goes to the brand's own site", () => {
  assert.equal(buttonLabel(baseProduct()), "Check price at Fixture Brand");
});

test("BuyButton label names the retailer when one is set, not the brand", () => {
  assert.equal(buttonLabel(baseProduct({ retailer: "iHerb" })), "Check price at iHerb");
});

test("FdaDisclaimer renders the required DSHEA disclaimer text", () => {
  const el = FdaDisclaimer();
  assert.match(
    el.props.children as string,
    /not intended to diagnose, treat, cure, or prevent any disease/,
  );
});

test("FdaDisclaimer defaults to the US wording with the data-fda-disclaimer marker", () => {
  const el = FdaDisclaimer();
  assert.equal(el.props["data-fda-disclaimer"], true);
  assert.equal(el.props["data-uk-disclaimer"], undefined);
});

test("FdaDisclaimer for US is the same as the default", () => {
  assert.deepEqual(FdaDisclaimer({ region: "US" }), FdaDisclaimer());
});

test("FdaDisclaimer for GB renders the UK wording and never mentions the FDA", () => {
  const el = FdaDisclaimer({ region: "GB" });
  const text = (el.props.children as string).replace(/\s+/g, " ");
  assert.equal(el.props["data-uk-disclaimer"], true);
  assert.equal(el.props["data-fda-disclaimer"], undefined);
  assert.match(text, /Food supplements should not replace a varied, balanced diet/);
  assert.match(text, /Do not exceed the recommended intake/);
  assert.doesNotMatch(text, /Food and Drug Administration|diagnose, treat, cure/);
});

test("FdaDisclaimer for US does not carry the UK wording", () => {
  const el = FdaDisclaimer({ region: "US" });
  assert.doesNotMatch(String(el.props.children), /Food supplements should not replace/);
});

test("FdaDisclaimer keeps the dark tone in both regions", () => {
  assert.match(FdaDisclaimer({ dark: true, region: "US" }).props.className as string, /bg-slate-900\/90/);
  assert.match(FdaDisclaimer({ dark: true, region: "GB" }).props.className as string, /bg-slate-900\/90/);
  assert.match(FdaDisclaimer({ region: "GB" }).props.className as string, /bg-bg-panel/);
});

test("AFFILIATE_DISCLOSURE starts with the Amazon Associate sentence", () => {
  assert.ok(AFFILIATE_DISCLOSURE.startsWith("As an Amazon Associate I earn from qualifying purchases."));
  assert.ok(AFFILIATE_DISCLOSURE.startsWith(AMAZON_ASSOCIATE_STATEMENT));
});

test("PriceLine shows a dollar price when the product has one", () => {
  const el = PriceLine({ product: baseProduct({ priceUsd: 24.5 }) });
  assert.equal(el.type, "span");
  assert.equal(el.props.children, "$24.50");
});

test("PriceLine sends the reader to the retailer when there is no price", () => {
  const el = PriceLine({ product: baseProduct({ priceUsd: null, retailer: "Amazon" }) });
  assert.deepEqual(el.props.children, ["Price on ", "Amazon"]);
});

test("PriceLine shows the being-verified marker when there is no price and no retailer", () => {
  const el = PriceLine({ product: baseProduct({ priceUsd: null, retailer: undefined }) });
  assert.equal(typeof el.type, "function");
  assert.equal((el.type as { name: string }).name, "Pending");
});

test("PriceLine treats a price of zero as a price, not as missing", () => {
  const el = PriceLine({ product: baseProduct({ priceUsd: 0, retailer: "Amazon" }) });
  assert.equal(el.props.children, "$0.00");
});

test("BuyButton for a resolved Amazon product links straight to Amazon and is labelled Amazon", () => {
  const product = getProductFor("pure-encapsulations-creatine", "US") as Product;
  const [link] = children(renderButton(product)) as [{ props: Record<string, unknown> }];
  assert.equal(link.props.href, "https://www.amazon.com/dp/B0FSGYKS5Z?tag=getbrian-20");
  assert.equal(buttonLabel(product), "Check price at Amazon");
});

test("BuyButton for the UK pick links straight to amazon.co.uk with the -21 tag", () => {
  const product = getProductFor("thorne-creatine", "GB") as Product;
  const [link] = children(renderButton(product)) as [{ props: Record<string, unknown> }];
  assert.equal(link.props.href, "https://www.amazon.co.uk/dp/B07978VPPH?tag=getbrian-21");
});

test("BuyButton label can be overridden, as the homepage cards do", () => {
  const el = BuyButton({ product: baseProduct(), from: "picks", label: "Buy Now" });
  const [link] = children(el) as [{ props: { children: unknown[] } }];
  assert.equal(link.props.children.filter((c) => typeof c === "string").join(""), "Buy Now");
});

// ---------------------------------------------------------------------------
// ProductCard. contentDiv children:
// [category span, h3 name, price row, summary, dl, button row]
// ---------------------------------------------------------------------------

function cardContent(product: Product): unknown[] {
  const el = ProductCard({ product });
  const articleKids = (el.props as { children: unknown[] }).children;
  const contentDiv = articleKids[articleKids.length - 1] as { props: { children: unknown[] } };
  // The price-time paragraph is conditional, so a card without a live price ends in `undefined`.
  return contentDiv.props.children.filter(Boolean);
}

function cardButtons(product: Product) {
  const kids = cardContent(product);
  // The button row is second to last: the Amazon statement paragraph follows it.
  const row = kids[kids.length - 2] as { props: { children: unknown[] } };
  return row.props.children as [
    { props: Record<string, unknown> },
    { props: { href: string; children: unknown } },
  ];
}

test("ProductCard shows its packshot by default and drops it when showImage is false (so a row stays even)", () => {
  const product = baseProduct({ image: "/healthy/products/x.png" });
  const kids = (el: { props: unknown }) => (el.props as { children: unknown[] }).children;
  // Children of the article: [image panel or false, content div].
  assert.ok(kids(ProductCard({ product }))[0], "the image panel renders by default");
  assert.ok(!kids(ProductCard({ product, showImage: false }))[0], "no image panel when showImage is false");
});

test('ProductCard button row holds "Buy Now" then "View Product", side by side', () => {
  const product = baseProduct({ slug: "abc" });
  const [buy, view] = cardButtons(product);
  assert.equal(buy.props.label, "Buy Now");
  assert.equal(view.props.href, "/products/abc");
  // No icon or other node inside the link, so its accessible name is exactly the label.
  assert.equal(view.props.children, "View Product");
});

test("ProductCard's Buy button omits the full affiliate disclosure paragraph", () => {
  const [buy] = cardButtons(baseProduct());
  assert.equal(buy.props.showDisclosure, false);
  const text = textOf(cardContent(baseProduct()));
  assert.doesNotMatch(text, /may earn a commission at no extra cost to you/);
});

test("ProductCard shows the Amazon Associate sentence in its own paragraph under the buttons, for every real pick in both regions", () => {
  for (const region of ["US", "GB"] as const) {
    for (const product of productsFor(region)) {
      const kids = cardContent(product) as { type: unknown; props: Record<string, unknown> }[];
      const last = kids[kids.length - 1];
      assert.equal(last.type, "p", `${product.slug} ${region}`);
      assert.equal(last.props["data-amazon-statement"], true, `${product.slug} ${region}`);
      assert.equal(last.props.children, "As an Amazon Associate I earn from qualifying purchases.");
    }
  }
});

test("ProductCard for an Amazon pick shows no dollar amount and names Amazon as where the price is", () => {
  const product = getProductFor("pure-encapsulations-magnesium-glycinate", "US") as Product;
  const text = textOf(cardContent(product));
  assert.match(text, /Current price on\s+Amazon/);
  assert.doesNotMatch(text, /\$\d/);
});

test("ProductCard for a product with a price still shows it", () => {
  const text = textOf(cardContent(baseProduct({ priceUsd: 30, servingsPerContainer: 60 })));
  assert.match(text, /\$30\.00/);
});

const LIVE_GBP = { amount: 15, currency: "GBP" as const, fetchedAt: "2026-10-04T14:05:00.000Z" };
const LIVE_USD = { amount: 30, currency: "USD" as const, fetchedAt: "2026-10-04T14:05:00.000Z" };

function priceTimeLine(product: Product) {
  const kids = cardContent(product) as { type: unknown; props: Record<string, unknown> }[];
  return kids.filter((k) => k && typeof k === "object" && k.props?.["data-price-time"] === true);
}

test("ProductCard shows a live GBP price with a pound sign, never a dollar sign", () => {
  const text = textOf(cardContent(baseProduct({ livePrice: LIVE_GBP })));
  assert.match(text, /£15\.00/);
  assert.doesNotMatch(text, /\$\d/);
});

test("ProductCard shows a live USD price with a dollar sign", () => {
  const text = textOf(cardContent(baseProduct({ livePrice: LIVE_USD })));
  assert.match(text, /\$30\.00/);
});

test("ProductCard shows the Price from Amazon line with the UTC fetch time when it has a live price", () => {
  const lines = priceTimeLine(baseProduct({ livePrice: LIVE_GBP }));
  assert.equal(lines.length, 1);
  assert.match(textOf(lines[0]), /^Price from Amazon, 4 Oct 2026, 14:05 UTC\. It can change; Amazon's page is current\.$/);
});

test("ProductCard shows no Price from Amazon line when there is no live price", () => {
  const product = baseProduct({ priceUsd: 30, retailer: "Amazon" });
  assert.equal(priceTimeLine(product).length, 0);
  assert.doesNotMatch(textOf(cardContent(product)), /Price from Amazon/);
});

test("ProductCard prefers the live price over a stored price", () => {
  const text = textOf(cardContent(baseProduct({ priceUsd: 99, livePrice: LIVE_GBP })));
  assert.match(text, /£15\.00/);
  assert.doesNotMatch(text, /99/);
});

test("ProductCard prints the per-serving cost in the live price's currency", () => {
  const text = textOf(cardContent(baseProduct({ servingsPerContainer: 30, livePrice: LIVE_GBP })));
  assert.match(text, /ct\s*·\s*£0\.50\/serving/);
});

test("ProductCard keeps the Amazon Associate sentence when it adds the price time line", () => {
  const kids = cardContent(baseProduct({ livePrice: LIVE_GBP })) as { props: Record<string, unknown> }[];
  const statements = kids.filter((k) => k && typeof k === "object" && k.props?.["data-amazon-statement"] === true);
  assert.equal(statements.length, 1);
});

test("PriceLine shows a live GBP price with a pound sign", () => {
  const el = PriceLine({ product: baseProduct({ livePrice: LIVE_GBP }) });
  assert.equal(el.type, "span");
  assert.equal(el.props.children, "£15.00");
});

test("PriceLine shows a live USD price with a dollar sign", () => {
  const el = PriceLine({ product: baseProduct({ livePrice: LIVE_USD }) });
  assert.equal(el.props.children, "$30.00");
});

test("PriceLine prefers the live price over a stored one", () => {
  const el = PriceLine({ product: baseProduct({ priceUsd: 99, livePrice: LIVE_USD }) });
  assert.equal(el.props.children, "$30.00");
});

test("PriceLine without a live price still falls back to the retailer pointer", () => {
  const el = PriceLine({ product: baseProduct({ priceUsd: null, retailer: "Amazon" }) });
  assert.deepEqual(el.props.children, ["Price on ", "Amazon"]);
});

test("ProductCard Buy button for a resolved pick goes straight to Amazon, never through /go", () => {
  const product = getProductFor("pure-encapsulations-l-theanine", "GB") as Product;
  const [buy] = cardButtons(product);
  assert.equal(buy.props.product, product);
  assert.equal(buyHref(buy.props.product as Product, "picks"), "https://www.amazon.co.uk/dp/B07JZFQWTL?tag=getbrian-21");
});

test("ProductCard strapline for GB L-theanine uses the UK role, not the relaxation wording", () => {
  const product = getProductFor("pure-encapsulations-l-theanine", "GB") as Product;
  const gb = textOf(ProductCard({ product, region: "GB" }));
  const us = textOf(ProductCard({ product, region: "US" }));
  assert.match(gb, /Evening routine/);
  assert.doesNotMatch(gb, /Calm and relaxation/);
  assert.match(us, /Calm and relaxation/);
});

test("ProductCard no longer prints the brand and format line", () => {
  const product = baseProduct({ brand: "Thorne", format: "Capsules" });
  // Every string in the content column's element tree (the static tree only,
  // which is where the old "Thorne · Capsules" <p> lived).
  const strings: string[] = [];
  const walk = (node: unknown): void => {
    if (typeof node === "string") strings.push(node);
    else if (Array.isArray(node)) node.forEach(walk);
    else if (node && typeof node === "object" && "props" in node) {
      walk((node as { props: { children?: unknown } }).props.children);
    }
  };
  walk(cardContent(product));
  assert.ok(strings.length > 0, "walker found no text at all");
  assert.equal(strings.includes("Capsules"), false);
});

// ---------------------------------------------------------------------------
// supplementHref
// ---------------------------------------------------------------------------

/**
 * `products` (from data.ts) is a plain, un-frozen array, like in the
 * /go route tests. Pushing/removing fixtures and always restoring in
 * `finally` lets these tests exercise pick counts the real product list
 * doesn't currently have, without forking data.ts.
 */
function withTempProducts<T>(temp: Product[], fn: () => T): T {
  for (const p of temp) products.push(p);
  try {
    return fn();
  } finally {
    for (const p of temp) {
      const i = products.indexOf(p);
      if (i !== -1) products.splice(i, 1);
    }
  }
}

test("supplementHref defaults to the US pick", () => {
  assert.equal(
    supplementHref(getSupplement("creatine")),
    "/products/pure-encapsulations-creatine",
  );
});

test("supplementHref returns the US magnesium review for a US visitor", () => {
  assert.equal(
    supplementHref(getSupplement("magnesium"), "US"),
    "/products/pure-encapsulations-magnesium-glycinate",
  );
});

test("supplementHref returns the US creatine review for a US visitor", () => {
  assert.equal(
    supplementHref(getSupplement("creatine"), "US"),
    "/products/pure-encapsulations-creatine",
  );
});

test("supplementHref returns the UK creatine review for a GB visitor, not the US one", () => {
  assert.equal(supplementHref(getSupplement("creatine"), "GB"), "/products/thorne-creatine");
});

test("supplementHref returns the same magnesium and L-theanine reviews in both countries", () => {
  assert.equal(
    supplementHref(getSupplement("magnesium"), "GB"),
    "/products/pure-encapsulations-magnesium-glycinate",
  );
  assert.equal(
    supplementHref(getSupplement("l-theanine"), "GB"),
    "/products/pure-encapsulations-l-theanine",
  );
  assert.equal(
    supplementHref(getSupplement("l-theanine"), "US"),
    "/products/pure-encapsulations-l-theanine",
  );
});

test("supplementHref returns null when the supplement has no category", () => {
  assert.equal(supplementHref(baseSupplement({ category: null }), "US"), null);
});

test("supplementHref returns only the first pick's page once a category has more than one pick in a region", () => {
  // The program keeps one pick per category on purpose, so this pins the
  // fallback behavior if a category ever temporarily grows to two.
  const extraMagnesium = baseProduct({
    slug: "fixture-magnesium-2",
    category: "Magnesium",
    regions: ["US"],
    offers: { US: { asin: "B000000000" } },
  });
  withTempProducts([extraMagnesium], () => {
    assert.equal(
      supplementHref(getSupplement("magnesium"), "US"),
      "/products/pure-encapsulations-magnesium-glycinate",
    );
  });
});

test("supplementHref ignores a pick that is not sold in the visitor's region", () => {
  const usOnly = baseProduct({
    slug: "fixture-theanine-us-only",
    category: "L-theanine",
    regions: ["US"],
    offers: { US: { asin: "B000000000" } },
  });
  withTempProducts([usOnly], () => {
    assert.equal(
      supplementHref(getSupplement("l-theanine"), "GB"),
      "/products/pure-encapsulations-l-theanine",
    );
  });
});

// ---------------------------------------------------------------------------
// GoalChooser
// ---------------------------------------------------------------------------

function listItems(ul: ReturnType<typeof GoalChooser>): unknown[] {
  const kids = (ul.props as { children: unknown }).children;
  return Array.isArray(kids) ? kids : [kids];
}

test("GoalChooser renders one tile per shown goal: energy, strength, calm", () => {
  const items = listItems(GoalChooser());
  assert.equal(items.length, tileGoals.length);
  assert.deepEqual(tileGoals.map((g) => g.id), ["energy", "strength", "calm"]);
});

test("Focus has no homepage tile but stays a creatine goal (rail and review page)", () => {
  assert.equal(tileGoals.some((g) => g.id === "focus"), false);
  const focus = goals.find((g) => g.id === "focus");
  assert.ok(focus, "focus goal still exists in data");
  assert.equal(focus.supplement, "creatine");
});

for (const [i, goal] of tileGoals.entries()) {
  test(`GoalChooser link for goal "${goal.id}" points straight at that supplement's review`, () => {
    const items = listItems(GoalChooser()) as { props: { children: { props: Record<string, unknown> } } }[];
    const anchor = items[i].props.children;
    const s = getSupplement(goal.supplement);
    const review = supplementHref(s);
    // A goal with a `section` lands on that part of the review (focus lands on creatine's caveat).
    const expected = review ? (goal.section ? `${review}#${goal.section}` : review) : `#${s.id}`;
    assert.equal(anchor.props.href, expected);
  });

  test(`GoalChooser tile for goal "${goal.id}" shows its own label and hook text`, () => {
    // items[i].props.children is the <li>'s single child, the Link itself.
    // The Link's own children: [background Image, gradient overlay div, content div].
    // Content div children: [icon chip, eyebrow, label, hook, CTA].
    const items = listItems(GoalChooser()) as { props: { children: { props: { children: unknown[] } } } }[];
    const anchor = items[i].props.children;
    const anchorChildren = anchor.props.children;
    const contentDiv = anchorChildren[2] as { props: { children: { props: { children: unknown } }[] } };
    const [, , labelSpan, hookParagraph] = contentDiv.props.children;
    assert.equal(labelSpan.props.children, goal.label);
    assert.equal(hookParagraph.props.children, goal.hook);
  });
}

/**
 * Concrete hrefs against the real data, rather than re-deriving the
 * implementation's own href formula (the loop above does that, and would
 * pass even if both GoalChooser and the test flipped the same bug the same
 * way). These pin the actual strings a shopper's browser would navigate to.
 */
test('GoalChooser "strength" goal links to the same creatine review with no hash', () => {
  const items = listItems(GoalChooser()) as { props: { children: { props: Record<string, unknown> } } }[];
  const strengthIndex = tileGoals.findIndex((g) => g.id === "strength");
  const anchor = items[strengthIndex].props.children;
  assert.equal(anchor.props.href, "/products/pure-encapsulations-creatine");
});

test('GoalChooser "strength" goal links to the UK creatine for a GB visitor', () => {
  const items = listItems(GoalChooser({ region: "GB" })) as { props: { children: { props: Record<string, unknown> } } }[];
  const strengthIndex = tileGoals.findIndex((g) => g.id === "strength");
  const anchor = items[strengthIndex].props.children;
  assert.equal(anchor.props.href, "/products/thorne-creatine");
});

test('GoalChooser "calm" tile for a GB visitor is relabelled "Evening" and says nothing about calm or stress', () => {
  const items = listItems(GoalChooser({ region: "GB" })) as { props: { children: { props: { children: unknown[] } } } }[];
  const calmIndex = tileGoals.findIndex((g) => g.id === "calm");
  const anchorChildren = items[calmIndex].props.children.props.children;
  const contentDiv = anchorChildren[2] as { props: { children: { props: { children: unknown } }[] } };
  const [, , labelSpan, hookParagraph] = contentDiv.props.children;
  assert.equal(labelSpan.props.children, "Evening");
  assert.equal(hookParagraph.props.children, "Meet L-theanine, an amino acid found naturally in tea.");
});

test('GoalChooser "calm" tile for a US visitor keeps the "Calm" label', () => {
  const items = listItems(GoalChooser({ region: "US" })) as { props: { children: { props: { children: unknown[] } } } }[];
  const calmIndex = tileGoals.findIndex((g) => g.id === "calm");
  const anchorChildren = items[calmIndex].props.children.props.children;
  const contentDiv = anchorChildren[2] as { props: { children: { props: { children: unknown } }[] } };
  const [, , labelSpan] = contentDiv.props.children;
  assert.equal(labelSpan.props.children, "Calm");
});

test('GoalChooser "energy" goal links to the magnesium review with no hash', () => {
  const items = listItems(GoalChooser()) as { props: { children: { props: Record<string, unknown> } } }[];
  const energyIndex = tileGoals.findIndex((g) => g.id === "energy");
  const anchor = items[energyIndex].props.children;
  assert.equal(anchor.props.href, "/products/pure-encapsulations-magnesium-glycinate");
});

test('GoalChooser "calm" goal links to the l-theanine review with no hash', () => {
  const items = listItems(GoalChooser()) as { props: { children: { props: Record<string, unknown> } } }[];
  const calmIndex = tileGoals.findIndex((g) => g.id === "calm");
  const anchor = items[calmIndex].props.children;
  assert.equal(anchor.props.href, "/products/pure-encapsulations-l-theanine");
});

// ---------------------------------------------------------------------------
// SupplementCard
// ---------------------------------------------------------------------------

function articleChildren(el: ReturnType<typeof SupplementCard>): unknown[] {
  const kids = (el.props as { children: unknown }).children;
  return Array.isArray(kids) ? kids : [kids];
}

function baseSupplement(overrides: Partial<Supplement> = {}): Supplement {
  return {
    id: "magnesium",
    name: "Fixture Supplement",
    tagline: "Fixture tagline",
    value: "Fixture value.",
    role: "Fixture role",
    contribution: "Fixture contribution.",
    category: null,
    ...overrides,
  };
}

test("SupplementCard renders the caveat when the supplement has one", () => {
  const el = SupplementCard({ supplement: getSupplement("creatine") });
  const [, dl] = articleChildren(el) as [unknown, { props: { children: unknown[] } }];
  const [, contributionDiv] = dl.props.children as { props: { children: unknown[] } }[];
  const [, , caveatDd] = contributionDiv.props.children as [unknown, unknown, { props: { children: unknown[] } }];
  assert.ok(caveatDd, "expected a caveat <dd> to render");
  const caveatText = caveatDd.props.children
    .map((child) => (typeof child === "string" ? child : (child as { props: { children: string } }).props.children))
    .join("");
  assert.match(caveatText, /Honest caveat:/);
  assert.match(caveatText, /Cognitive benefits are promising/);
});

test("SupplementCard does not render a caveat when the supplement has none", () => {
  const el = SupplementCard({ supplement: getSupplement("magnesium") });
  const [, dl] = articleChildren(el) as [unknown, { props: { children: unknown[] } }];
  const [, contributionDiv] = dl.props.children as { props: { children: unknown[] } }[];
  const caveatDd = (contributionDiv.props.children as unknown[])[2];
  assert.equal(caveatDd, undefined);
});

test("SupplementCard shows the in-progress message when there is no pick", () => {
  // Every real supplement now has a pick, so a fixture with a null category
  // is what exercises the "no pick yet" branch.
  const el = SupplementCard({ supplement: baseSupplement({ category: null }) });
  const [, , footer] = articleChildren(el) as [unknown, unknown, { type: string; props: { children: string } }];
  assert.equal(footer.type, "p");
  assert.match(footer.props.children, /review is in progress/);
});

test("SupplementCard renders a link instead of the in-progress message when a pick exists", () => {
  const el = SupplementCard({ supplement: getSupplement("magnesium") });
  const [, , footer] = articleChildren(el) as [unknown, unknown, { type: string; props: { href: string } }];
  assert.equal(footer.type, "a");
  assert.equal(footer.props.href, supplementHref(getSupplement("magnesium")));
});

test("SupplementCard link names the supplement for a creatine review", () => {
  const el = SupplementCard({ supplement: getSupplement("creatine") });
  const [, , footer] = articleChildren(el) as [unknown, unknown, { props: { children: unknown[] } }];
  assert.equal(footer.props.children.join(""), "Read the creatine review");
});

test("SupplementCard link names the supplement for a non-creatine review", () => {
  const el = SupplementCard({ supplement: getSupplement("magnesium") });
  const [, , footer] = articleChildren(el) as [unknown, unknown, { props: { children: unknown[] } }];
  assert.equal(footer.props.children.join(""), "Read the magnesium review");
});

test("SupplementCard uses the supplement id as the section anchor", () => {
  const supplement = baseSupplement({ id: "l-theanine" });
  const el = SupplementCard({ supplement });
  assert.equal((el.props as { id: string }).id, "l-theanine");
});

// ---------------------------------------------------------------------------
// Brian's notes: folded behind a <details> below lg, always open from lg, and
// the second note is "The advantage" (the product's own line), never "The catch".
// ---------------------------------------------------------------------------

function notesParts(product: Product) {
  const kids = cardContent(product) as { type: unknown; props: Record<string, unknown> }[];
  const details = kids.find((k) => k && k.type === "details")!;
  const open = kids.find((k) => k && typeof k.type === "function" && k !== details && "product" in k.props)!;
  return { details, open };
}

function textOf(node: unknown): string {
  if (typeof node === "string") return node;
  if (Array.isArray(node)) return node.map(textOf).join("");
  if (node && typeof node === "object" && "props" in node) {
    const el = node as { type: unknown; props: Record<string, unknown> };
    if (typeof el.type === "function") return textOf((el.type as (p: unknown) => unknown)(el.props));
    return textOf(el.props.children);
  }
  return "";
}

test("ProductCard folds Brian's notes into a details element below lg only", () => {
  const { details, open } = notesParts(baseProduct());
  assert.match(details.props.className as string, /\blg:hidden\b/);
  assert.equal(details.props.open, undefined, "folded by default");
  assert.match(open.props.className as string, /\bhidden\b/);
  assert.match(open.props.className as string, /\blg:block\b/);
});

test("ProductCard notes show the product's advantage under 'The advantage', not 'The catch'", () => {
  const product = baseProduct({ pros: ["Picked for X"], cons: ["A downside"], advantage: "Matched to the trials" });
  const { details, open } = notesParts(product);
  for (const node of [details, open]) {
    const text = textOf(node);
    assert.match(text, /The advantage/);
    assert.match(text, /Matched to the trials/);
    assert.doesNotMatch(text, /The catch|A downside/);
  }
});

test("ProductCard notes draw no divider when there is no 'Why Brian picked it' note", () => {
  const { open } = notesParts(baseProduct({ pros: [], advantage: "Matched to the trials" }));
  const dl = (open.type as (p: unknown) => { props: { children: unknown[] } })(open.props);
  const flat = (dl.props.children as unknown[]).flat(Infinity).filter(Boolean) as { props: { className?: string } }[];
  assert.ok(!flat.some((k) => /\bh-px\b/.test(k.props?.className ?? "")), "no stray divider");
});
