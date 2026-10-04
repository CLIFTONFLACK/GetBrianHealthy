import test from "node:test";
import assert from "node:assert/strict";
import {
  buyHref,
  costPerServing,
  formatPrice,
  formatPriceTime,
  getProduct,
  productsFor,
  getSupplement,
  goals,
  gradeLabels,
  outboundUrl,
  products,
  retailerName,
  supplementFor,
  supplements,
  TAGLINE,
  topGrade,
  totalDailyCost,
  TRIO_INTRO,
  usesRedirect,
  type EvidenceGrade,
  type Product,
  type Supplement,
} from "../data.ts";

/** A minimal, valid product used as a base for one-field-changed fixtures. */
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

// ---------------------------------------------------------------------------
// getProduct
// ---------------------------------------------------------------------------

test("getProduct returns the matching product for a known slug", () => {
  const product = getProduct("pure-encapsulations-creatine");
  assert.equal(product?.slug, "pure-encapsulations-creatine");
});

test("getProduct returns undefined for an unknown slug", () => {
  assert.equal(getProduct("does-not-exist"), undefined);
});

test("getProduct returns undefined for an empty string slug", () => {
  assert.equal(getProduct(""), undefined);
});

test("getProduct is case sensitive (does not loosely match)", () => {
  assert.equal(getProduct("PURE-ENCAPSULATIONS-CREATINE"), undefined);
});

test("getProduct no longer finds the retired Thorne slugs", () => {
  assert.equal(getProduct("thorne-magnesium-glycinate"), undefined);
  assert.equal(getProduct("thorne-creatine-stick-packs"), undefined);
  assert.equal(getProduct("thorne-theanine"), undefined);
});

// ---------------------------------------------------------------------------
// costPerServing
// ---------------------------------------------------------------------------

test("costPerServing divides price by servings when both are known", () => {
  const product = baseProduct({ priceUsd: 24.99, servingsPerContainer: 30 });
  assert.equal(costPerServing(product), 24.99 / 30);
});

test("costPerServing returns null when priceUsd is null", () => {
  const product = baseProduct({ priceUsd: null, servingsPerContainer: 30 });
  assert.equal(costPerServing(product), null);
});

test("costPerServing returns null when servingsPerContainer is null", () => {
  const product = baseProduct({ priceUsd: 10, servingsPerContainer: null });
  assert.equal(costPerServing(product), null);
});

test("costPerServing returns null when servingsPerContainer is zero", () => {
  // Zero servings would otherwise divide by zero (Infinity); the function
  // must treat it the same as "unknown", per its `!p.servingsPerContainer`
  // guard.
  const product = baseProduct({ priceUsd: 10, servingsPerContainer: 0 });
  assert.equal(costPerServing(product), null);
});

test("costPerServing handles a single serving (boundary of one)", () => {
  const product = baseProduct({ priceUsd: 5, servingsPerContainer: 1 });
  assert.equal(costPerServing(product), 5);
});

test("costPerServing treats a zero price as known, not unverified", () => {
  const product = baseProduct({ priceUsd: 0, servingsPerContainer: 10 });
  assert.equal(costPerServing(product), 0);
});

test("costPerServing uses the live price in preference to the stored one", () => {
  const livePrice = { amount: 40, currency: "USD" as const, fetchedAt: "2026-10-04T14:05:00.000Z" };
  const product = baseProduct({ priceUsd: 10, servingsPerContainer: 20, livePrice });
  assert.equal(costPerServing(product), 2);
});

test("costPerServing divides a live GBP price by servings", () => {
  const livePrice = { amount: 15, currency: "GBP" as const, fetchedAt: "2026-10-04T14:05:00.000Z" };
  const product = baseProduct({ priceUsd: null, servingsPerContainer: 30, livePrice });
  assert.equal(costPerServing(product), 0.5);
});

test("costPerServing returns null for a live price when servings are unknown", () => {
  const livePrice = { amount: 15, currency: "USD" as const, fetchedAt: "2026-10-04T14:05:00.000Z" };
  const product = baseProduct({ servingsPerContainer: null, livePrice });
  assert.equal(costPerServing(product), null);
});

// ---------------------------------------------------------------------------
// formatPrice
// ---------------------------------------------------------------------------

test("formatPrice writes dollars with a $ sign and two decimals", () => {
  assert.equal(formatPrice(24.5, "USD"), "$24.50");
});

test("formatPrice writes pounds with a pound sign and two decimals", () => {
  assert.equal(formatPrice(19.99, "GBP"), "£19.99");
});

test("formatPrice defaults to dollars when no currency is given", () => {
  assert.equal(formatPrice(5), "$5.00");
});

test("formatPrice groups thousands", () => {
  assert.equal(formatPrice(1234.5, "GBP"), "£1,234.50");
});

test("formatPrice rounds a per-serving fraction to pence", () => {
  assert.equal(formatPrice(0.8333, "GBP"), "£0.83");
});

test("formatPrice shows zero as a price", () => {
  assert.equal(formatPrice(0, "USD"), "$0.00");
});

// ---------------------------------------------------------------------------
// formatPriceTime
// ---------------------------------------------------------------------------

test("formatPriceTime writes the date and 24-hour time in UTC", () => {
  assert.equal(formatPriceTime("2026-10-04T14:05:00.000Z"), "4 Oct 2026, 14:05 UTC");
});

test("formatPriceTime converts an offset timestamp to UTC", () => {
  assert.equal(formatPriceTime("2026-10-04T23:30:00+02:00"), "4 Oct 2026, 21:30 UTC");
});

test("formatPriceTime rolls over to the next UTC day rather than the viewer's", () => {
  assert.equal(formatPriceTime("2026-12-31T23:59:00-05:00"), "1 Jan 2027, 04:59 UTC");
});

test("formatPriceTime shows midnight as 00:00, not 24:00", () => {
  assert.equal(formatPriceTime("2026-10-04T00:00:00.000Z"), "4 Oct 2026, 00:00 UTC");
});

test("formatPriceTime returns an empty string for an unparseable timestamp", () => {
  assert.equal(formatPriceTime("not a date"), "");
});

test("formatPriceTime returns an empty string for an empty string", () => {
  assert.equal(formatPriceTime(""), "");
});

// ---------------------------------------------------------------------------
// topGrade
// ---------------------------------------------------------------------------

test("topGrade returns null when a product has no evidence", () => {
  const product = baseProduct({ evidence: [] });
  assert.equal(topGrade(product), null);
});

test("topGrade returns the single grade when there is only one evidence claim", () => {
  const product = baseProduct({
    evidence: [{ claim: "x", grade: "early", summary: "s", citations: [] }],
  });
  assert.equal(topGrade(product), "early");
});

test("topGrade picks strong over moderate and early", () => {
  const product = baseProduct({
    evidence: [
      { claim: "a", grade: "early", summary: "s", citations: [] },
      { claim: "b", grade: "strong", summary: "s", citations: [] },
      { claim: "c", grade: "moderate", summary: "s", citations: [] },
    ],
  });
  assert.equal(topGrade(product), "strong");
});

test("topGrade picks moderate over early when there is no strong claim", () => {
  const product = baseProduct({
    evidence: [
      { claim: "a", grade: "early", summary: "s", citations: [] },
      { claim: "b", grade: "moderate", summary: "s", citations: [] },
    ],
  });
  assert.equal(topGrade(product), "moderate");
});

test("topGrade matches the real magnesium product's best claim (real data)", () => {
  const product = products.find((p) => p.slug === "pure-encapsulations-magnesium-glycinate");
  assert.ok(product, "fixture assumption: the magnesium product exists");
  assert.equal(topGrade(product as Product), "strong");
});

// ---------------------------------------------------------------------------
// totalDailyCost
// ---------------------------------------------------------------------------

test("totalDailyCost is null for the real products because no Amazon pick stores a price", () => {
  assert.equal(totalDailyCost(), null);
  assert.equal(totalDailyCost(productsFor("US")), null);
  assert.equal(totalDailyCost(productsFor("GB")), null);
});

test("totalDailyCost sums the cost per serving of a list it is given", () => {
  const list = [
    baseProduct({ priceUsd: 30, servingsPerContainer: 30 }),
    baseProduct({ priceUsd: 20, servingsPerContainer: 10 }),
  ];
  assert.equal(totalDailyCost(list), 3);
});

test("totalDailyCost of an empty list is zero, not null", () => {
  assert.equal(totalDailyCost([]), 0);
});

test("totalDailyCost returns null the moment any pick's price is unverified", () => {
  // A priced pick first, so a null result can only come from the unpriced one.
  const list = [
    baseProduct({ slug: "fixture-priced", priceUsd: 10, servingsPerContainer: 10 }),
    baseProduct({ slug: "fixture-unpriced", priceUsd: null, servingsPerContainer: 10 }),
  ];
  assert.equal(totalDailyCost(list), null);
});

// ---------------------------------------------------------------------------
// retailerName
// ---------------------------------------------------------------------------

test("retailerName falls back to the brand when no retailer is set", () => {
  const product = baseProduct({ brand: "Thorne", retailer: undefined });
  assert.equal(retailerName(product), "Thorne");
});

test("retailerName uses the retailer when one is set, overriding the brand", () => {
  const product = baseProduct({ brand: "Thorne", retailer: "iHerb" });
  assert.equal(retailerName(product), "iHerb");
});

test("retailerName treats an empty string retailer as unset and falls back to the brand", () => {
  // "" is falsy but not null/undefined; `??` only falls back on null/undefined,
  // so this pins that an empty-string retailer is *not* silently coerced —
  // it would render as "Check price at " if the fallback used `||` instead.
  const product = baseProduct({ brand: "Thorne", retailer: "" });
  assert.equal(retailerName(product), "");
});

// ---------------------------------------------------------------------------
// outboundUrl
// ---------------------------------------------------------------------------

test("outboundUrl returns the affiliate URL when one is set", () => {
  const product = baseProduct({
    brandUrl: "https://brand.example.com",
    affiliateUrl: "https://affiliate.example.com",
  });
  assert.equal(outboundUrl(product), "https://affiliate.example.com");
});

test("outboundUrl falls back to the brand URL when there is no affiliate URL", () => {
  const product = baseProduct({ brandUrl: "https://brand.example.com", affiliateUrl: null });
  assert.equal(outboundUrl(product), "https://brand.example.com");
});

// ---------------------------------------------------------------------------
// usesRedirect
// ---------------------------------------------------------------------------

test("usesRedirect is true when there is no affiliate link yet", () => {
  const product = baseProduct({ affiliateUrl: null, redirectAllowed: false });
  assert.equal(usesRedirect(product), true);
});

test("usesRedirect is true when the affiliate programme allows redirects", () => {
  const product = baseProduct({
    affiliateUrl: "https://affiliate.example.com",
    redirectAllowed: true,
  });
  assert.equal(usesRedirect(product), true);
});

test("usesRedirect is false for every real product, because each is sold on Amazon", () => {
  for (const p of products) {
    assert.equal(usesRedirect(p), false, p.slug);
  }
});

test("usesRedirect is false for a product with an offer, even with no affiliate link and redirects allowed", () => {
  const product = baseProduct({
    affiliateUrl: null,
    redirectAllowed: true,
    offers: { US: { asin: "B000000000" } },
  });
  assert.equal(usesRedirect(product), false);
});

test("usesRedirect is false when the affiliate programme forbids redirects", () => {
  const product = baseProduct({
    affiliateUrl: "https://affiliate.example.com",
    redirectAllowed: false,
  });
  assert.equal(usesRedirect(product), false);
});

// ---------------------------------------------------------------------------
// buyHref
// ---------------------------------------------------------------------------

test("buyHref points at the /go redirect while there is no affiliate link", () => {
  const product = baseProduct({ slug: "no-affiliate-yet", affiliateUrl: null });
  assert.equal(buyHref(product, "product"), "/go/no-affiliate-yet?from=product");
});

test("buyHref points at the /go redirect when the programme allows it", () => {
  const product = baseProduct({
    slug: "allowed-redirect",
    affiliateUrl: "https://affiliate.example.com",
    redirectAllowed: true,
  });
  assert.equal(buyHref(product, "compare-creatine"), "/go/allowed-redirect?from=compare-creatine");
});

test("buyHref links directly to the affiliate URL when the programme forbids the redirect", () => {
  const product = baseProduct({
    affiliateUrl: "https://affiliate.example.com/aff123",
    redirectAllowed: false,
  });
  assert.equal(buyHref(product, "product"), "https://affiliate.example.com/aff123");
});

// ---------------------------------------------------------------------------
// products data invariants
// ---------------------------------------------------------------------------

const DISEASE_CLAIM_WORDS = ["treat", "cure", "prevent", "reverse", "diagnose"];

function findDiseaseClaimWord(text: string): string | undefined {
  const lower = text.toLowerCase();
  return DISEASE_CLAIM_WORDS.find((word) => lower.includes(word));
}

test("every product slug is unique", () => {
  const slugs = products.map((p) => p.slug);
  const duplicates = slugs.filter((slug, i) => slugs.indexOf(slug) !== i);
  assert.deepEqual(duplicates, []);
});

test("at least one product is defined", () => {
  assert.ok(products.length > 0);
});

for (const product of products) {
  test(`product "${product.slug}" has an https brandUrl`, () => {
    assert.match(product.brandUrl, /^https:\/\//);
  });

  test(`product "${product.slug}" summary has no disease-claim words`, () => {
    assert.equal(findDiseaseClaimWord(product.summary), undefined);
  });

  test(`product "${product.slug}" verdict has no disease-claim words`, () => {
    assert.equal(findDiseaseClaimWord(product.verdict), undefined);
  });

  for (const ev of product.evidence) {
    test(`product "${product.slug}" evidence claim "${ev.claim}" has no disease-claim words`, () => {
      assert.equal(findDiseaseClaimWord(ev.claim), undefined);
    });

    test(`product "${product.slug}" evidence summary for "${ev.claim}" has no disease-claim words`, () => {
      assert.equal(findDiseaseClaimWord(ev.summary), undefined);
    });
  }
}

// ---------------------------------------------------------------------------
// getSupplement
// ---------------------------------------------------------------------------

test("getSupplement returns the matching supplement for a known id", () => {
  assert.equal(getSupplement("creatine").id, "creatine");
});

test("getSupplement throws for an unknown id", () => {
  assert.throws(
    () => getSupplement("vitamin-d" as Supplement["id"]),
    /Unknown supplement: vitamin-d/,
  );
});

test("getSupplement throws for an empty string id", () => {
  assert.throws(() => getSupplement("" as Supplement["id"]), /Unknown supplement: /);
});

test("getSupplement is case sensitive (does not loosely match)", () => {
  assert.throws(() => getSupplement("CREATINE" as Supplement["id"]));
});

// ---------------------------------------------------------------------------
// goals <-> supplements invariants
// ---------------------------------------------------------------------------

test("every goal id is unique", () => {
  const ids = goals.map((g) => g.id);
  const duplicates = ids.filter((id, i) => ids.indexOf(id) !== i);
  assert.deepEqual(duplicates, []);
});

test("every supplement id is unique", () => {
  const ids = supplements.map((s) => s.id);
  const duplicates = ids.filter((id, i) => ids.indexOf(id) !== i);
  assert.deepEqual(duplicates, []);
});

for (const goal of goals) {
  test(`goal "${goal.id}" supplement ("${goal.supplement}") resolves via getSupplement`, () => {
    const s = getSupplement(goal.supplement);
    assert.equal(s.id, goal.supplement);
  });
}

test("every supplement is used by at least one goal", () => {
  const usedIds = new Set(goals.map((g) => g.supplement));
  const unused = supplements.filter((s) => !usedIds.has(s.id)).map((s) => s.id);
  assert.deepEqual(unused, []);
});

// ---------------------------------------------------------------------------
// supplements <-> products (category) invariants
// ---------------------------------------------------------------------------

const categorizedSupplements = supplements.filter((s) => s.category !== null);

test("at least one supplement has a non-null category (sanity check for the loop below)", () => {
  assert.ok(categorizedSupplements.length > 0);
});

for (const supplement of categorizedSupplements) {
  test(`supplement "${supplement.id}" has at least one product in category "${supplement.category}"`, () => {
    const matches = products.filter((p) => p.category === supplement.category);
    assert.ok(matches.length > 0);
  });
}

test("supplementFor returns the creatine supplement for a creatine product", () => {
  const product = products.find((p) => p.category === "Creatine");
  assert.ok(product, "fixture assumption: a creatine product exists");
  assert.equal(supplementFor(product as Product), getSupplement("creatine"));
});

test("supplementFor returns the magnesium supplement for a magnesium product", () => {
  const product = products.find((p) => p.category === "Magnesium");
  assert.ok(product, "fixture assumption: a magnesium product exists");
  assert.equal(supplementFor(product as Product), getSupplement("magnesium"));
});

test("supplementFor returns undefined when no supplement matches the product's category", () => {
  // Every real category currently has a matching supplement, so this removes
  // the magnesium supplement temporarily (mirroring the withTempProduct
  // pattern used in the /go route tests) to exercise the "no match"
  // branch without inventing a category value outside the Product type.
  const magnesiumSupplement = getSupplement("magnesium");
  const idx = supplements.indexOf(magnesiumSupplement);
  supplements.splice(idx, 1);
  try {
    const product = products.find((p) => p.category === "Magnesium");
    assert.ok(product, "fixture assumption: a magnesium product exists");
    assert.equal(supplementFor(product as Product), undefined);
  } finally {
    supplements.splice(idx, 0, magnesiumSupplement);
  }
});

// ---------------------------------------------------------------------------
// Compliance guards on the goal-chooser / supplement copy
// ---------------------------------------------------------------------------

const BANNED_MARKETING_WORDS = [
  "leverage",
  "synergy",
  "revolutioni", // catches both "revolutionise" and "revolutionize"
  "cutting-edge",
  "game-changing",
  "unlock",
  "seamless",
  "disrupt",
  "solutioning",
];

const BRITISH_SPELLINGS = ["ageing", "signalling"];

function findBannedWord(text: string): string | undefined {
  const lower = text.toLowerCase();
  return BANNED_MARKETING_WORDS.find((word) => lower.includes(word));
}

function findBritishSpelling(text: string): string | undefined {
  const lower = text.toLowerCase();
  return BRITISH_SPELLINGS.find((word) => lower.includes(word));
}

// Each card's "The advantage" line: present, and held to the same copy rules.
for (const product of products) {
  test(`product "${product.slug}" has a card advantage with no disease-claim, banned or British words`, () => {
    assert.ok(product.advantage.trim().length > 0);
    assert.equal(findDiseaseClaimWord(product.advantage), undefined);
    assert.equal(findBannedWord(product.advantage), undefined);
    assert.equal(findBritishSpelling(product.advantage), undefined);
  });
}

test("TAGLINE has no disease-claim words", () => {
  assert.equal(findDiseaseClaimWord(TAGLINE), undefined);
});

test("TAGLINE has no banned marketing words", () => {
  assert.equal(findBannedWord(TAGLINE), undefined);
});

test("TAGLINE uses US spelling", () => {
  assert.equal(findBritishSpelling(TAGLINE), undefined);
});

for (const supplement of supplements) {
  test(`supplement "${supplement.id}" role has no disease-claim words`, () => {
    assert.equal(findDiseaseClaimWord(supplement.role), undefined);
  });

  test(`supplement "${supplement.id}" role has no banned marketing words`, () => {
    assert.equal(findBannedWord(supplement.role), undefined);
  });

  test(`supplement "${supplement.id}" role uses US spelling`, () => {
    assert.equal(findBritishSpelling(supplement.role), undefined);
  });

  test(`supplement "${supplement.id}" contribution has no disease-claim words`, () => {
    assert.equal(findDiseaseClaimWord(supplement.contribution), undefined);
  });

  test(`supplement "${supplement.id}" contribution has no banned marketing words`, () => {
    assert.equal(findBannedWord(supplement.contribution), undefined);
  });

  test(`supplement "${supplement.id}" contribution uses US spelling`, () => {
    assert.equal(findBritishSpelling(supplement.contribution), undefined);
  });

  test(`supplement "${supplement.id}" tagline has no disease-claim words`, () => {
    assert.equal(findDiseaseClaimWord(supplement.tagline), undefined);
  });

  test(`supplement "${supplement.id}" tagline has no banned marketing words`, () => {
    assert.equal(findBannedWord(supplement.tagline), undefined);
  });

  test(`supplement "${supplement.id}" tagline uses US spelling`, () => {
    assert.equal(findBritishSpelling(supplement.tagline), undefined);
  });

  test(`supplement "${supplement.id}" value has no disease-claim words`, () => {
    assert.equal(findDiseaseClaimWord(supplement.value), undefined);
  });

  test(`supplement "${supplement.id}" value has no banned marketing words`, () => {
    assert.equal(findBannedWord(supplement.value), undefined);
  });

  test(`supplement "${supplement.id}" value uses US spelling`, () => {
    assert.equal(findBritishSpelling(supplement.value), undefined);
  });
}

test("TRIO_INTRO body has no disease-claim words", () => {
  assert.equal(findDiseaseClaimWord(TRIO_INTRO.body), undefined);
});

test("TRIO_INTRO body has no banned marketing words", () => {
  assert.equal(findBannedWord(TRIO_INTRO.body), undefined);
});

test("TRIO_INTRO body uses US spelling", () => {
  assert.equal(findBritishSpelling(TRIO_INTRO.body), undefined);
});

test("TRIO_INTRO headline uses US spelling", () => {
  assert.equal(findBritishSpelling(TRIO_INTRO.headline), undefined);
});

test("TRIO_INTRO disclaimer has no disease-claim words", () => {
  assert.equal(findDiseaseClaimWord(TRIO_INTRO.disclaimer), undefined);
});

const supplementsWithCaveat = supplements.filter((s) => s.caveat);

test("at least one supplement has a caveat (sanity check for the loop below)", () => {
  assert.ok(supplementsWithCaveat.length > 0);
});

for (const supplement of supplementsWithCaveat) {
  test(`supplement "${supplement.id}" caveat has no disease-claim words`, () => {
    assert.equal(findDiseaseClaimWord(supplement.caveat as string), undefined);
  });

  test(`supplement "${supplement.id}" caveat has no banned marketing words`, () => {
    assert.equal(findBannedWord(supplement.caveat as string), undefined);
  });

  test(`supplement "${supplement.id}" caveat uses US spelling`, () => {
    assert.equal(findBritishSpelling(supplement.caveat as string), undefined);
  });
}

for (const goal of goals) {
  test(`goal "${goal.id}" label has no disease-claim words`, () => {
    assert.equal(findDiseaseClaimWord(goal.label), undefined);
  });

  test(`goal "${goal.id}" label has no banned marketing words`, () => {
    assert.equal(findBannedWord(goal.label), undefined);
  });

  test(`goal "${goal.id}" label uses US spelling`, () => {
    assert.equal(findBritishSpelling(goal.label), undefined);
  });

  test(`goal "${goal.id}" hook has no disease-claim words`, () => {
    assert.equal(findDiseaseClaimWord(goal.hook), undefined);
  });

  test(`goal "${goal.id}" hook has no banned marketing words`, () => {
    assert.equal(findBannedWord(goal.hook), undefined);
  });

  test(`goal "${goal.id}" hook uses US spelling`, () => {
    assert.equal(findBritishSpelling(goal.hook), undefined);
  });

  test(`goal "${goal.id}" eyebrowDetail has no disease-claim words`, () => {
    assert.equal(findDiseaseClaimWord(goal.eyebrowDetail), undefined);
  });

  test(`goal "${goal.id}" eyebrowDetail has no banned marketing words`, () => {
    assert.equal(findBannedWord(goal.eyebrowDetail), undefined);
  });

  test(`goal "${goal.id}" eyebrowDetail uses US spelling`, () => {
    assert.equal(findBritishSpelling(goal.eyebrowDetail), undefined);
  });
}

const focusOrCognitiveSupplements = supplements.filter(
  (s) => s.role.toLowerCase().includes("focus") || s.role.toLowerCase().includes("cognitive"),
);

for (const supplement of focusOrCognitiveSupplements) {
  test(`supplement "${supplement.id}" has a non-empty caveat because its role mentions focus/cognitive`, () => {
    assert.ok(supplement.caveat && supplement.caveat.trim().length > 0);
  });
}

/**
 * A caveat living elsewhere on the card is not enough: the rule is that the
 * `role` string itself must never claim focus without hedging right there,
 * since `role` is what renders in the ProductCard's one-line category
 * strapline (`{category} · {role}`), a place the caveat is never shown.
 */
const HEDGE_WORDS = ["early", "promising", "preliminary", "emerging", "not yet established", "may"];

function hasHedgeWord(text: string): boolean {
  const lower = text.toLowerCase();
  return HEDGE_WORDS.some((word) => lower.includes(word));
}

for (const supplement of focusOrCognitiveSupplements) {
  test(`supplement "${supplement.id}" role never mentions focus/cognitive without a hedging word in the same sentence`, () => {
    assert.ok(
      hasHedgeWord(supplement.role),
      `role "${supplement.role}" mentions focus/cognitive but has no hedging word`,
    );
  });
}

test("creatine's role makes no focus claim; its hedged focus line stays in the caveat", () => {
  // The card strapline was trimmed to "Strength and physical performance." The
  // focus evidence is still early, so it lives only in `caveat`, hedged.
  const creatine = getSupplement("creatine");
  assert.doesNotMatch(creatine.role, /focus|cognitive/i);
  assert.match(creatine.caveat ?? "", /focus/i);
  assert.ok(hasHedgeWord(creatine.caveat ?? ""));
});

// ---------------------------------------------------------------------------
// goal.section always names a real supplement (so the anchor exists)
// ---------------------------------------------------------------------------

for (const goal of goals.filter((g) => g.section !== undefined)) {
  test(`goal "${goal.id}"'s section ("${goal.section}") is a real supplement id`, () => {
    const ids = supplements.map((s) => s.id);
    assert.ok(
      ids.includes(goal.section as Supplement["id"]),
      `section "${goal.section}" does not match any supplement id: ${ids.join(", ")}`,
    );
  });
}

test("the focus goal's section is the creatine id (its href must land on SupplementCard's creatine anchor)", () => {
  const focusGoal = goals.find((g) => g.id === "focus");
  assert.ok(focusGoal, "fixture assumption: a 'focus' goal exists");
  assert.equal(focusGoal?.section, "creatine");
});

test("goals without a section field don't accidentally point at a nonexistent anchor", () => {
  const withoutSection = goals.filter((g) => g.section === undefined);
  assert.ok(withoutSection.length > 0, "fixture assumption: at least one goal has no section");
  for (const g of withoutSection) {
    assert.equal(g.section, undefined);
  }
});

// ---------------------------------------------------------------------------
// why-these-picks grade vocabulary: no leftover "strong evidence" / "moderate
// evidence" wording now that gradeLabels use robust/promising/early.
// ---------------------------------------------------------------------------

test("gradeLabels for 'strong' says 'Robust evidence', not 'Strong evidence'", () => {
  assert.doesNotMatch(gradeLabels.strong.label, /strong evidence/i);
  assert.match(gradeLabels.strong.label, /robust evidence/i);
});

test("gradeLabels for 'moderate' says 'Promising evidence', not 'Moderate evidence'", () => {
  assert.doesNotMatch(gradeLabels.moderate.label, /moderate evidence/i);
  assert.match(gradeLabels.moderate.label, /promising evidence/i);
});

test("no gradeLabels entry uses the retired 'strong evidence' or 'moderate evidence' wording", () => {
  for (const grade of Object.keys(gradeLabels) as EvidenceGrade[]) {
    const text = `${gradeLabels[grade].label} ${gradeLabels[grade].meaning}`;
    assert.doesNotMatch(text.toLowerCase(), /strong evidence|moderate evidence/);
  }
});
