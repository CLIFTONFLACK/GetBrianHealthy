import test from "node:test";
import assert from "node:assert/strict";
import {
  AMAZON,
  AMAZON_ASSOCIATE_STATEMENT,
  amazonUrl,
  buyHref,
  faqs,
  getProduct,
  getProductFor,
  getSupplement,
  goals,
  goalsForSupplement,
  localizeGoal,
  localizeSupplement,
  pickFor,
  products,
  productsFor,
  resolveProduct,
  retailerName,
  topGrade,
  type Product,
} from "../data.ts";
import type { Region } from "../region.ts";

const REGIONS: Region[] = ["US", "GB"];

/** A minimal product sold in the US only, used as a base for one-field-changed fixtures. */
function fixture(overrides: Partial<Product> = {}): Product {
  return {
    slug: "fixture",
    name: "Fixture",
    brand: "Brand",
    category: "Creatine",
    format: "Powder",
    image: null,
    imageAlt: "",
    summary: "base summary",
    verdict: "base verdict",
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
    regions: ["US"],
    offers: { US: { asin: "B000000000" } },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// AMAZON, amazonUrl, the Associate statement
// ---------------------------------------------------------------------------

test("AMAZON has the US store on amazon.com with the -20 tag", () => {
  assert.deepEqual(AMAZON.US, { host: "www.amazon.com", tag: "getbrian-20" });
});

test("AMAZON has the UK store on amazon.co.uk with the -21 tag", () => {
  assert.deepEqual(AMAZON.GB, { host: "www.amazon.co.uk", tag: "getbrian-21" });
});

test("amazonUrl builds the US link with the US host and tag", () => {
  assert.equal(amazonUrl("US", "B0016CXYK4"), "https://www.amazon.com/dp/B0016CXYK4?tag=getbrian-20");
});

test("amazonUrl builds the UK link with the UK host and tag", () => {
  assert.equal(amazonUrl("GB", "B07JZFQWTL"), "https://www.amazon.co.uk/dp/B07JZFQWTL?tag=getbrian-21");
});

test("amazonUrl percent-encodes an ASIN so it cannot add a path segment or a query parameter", () => {
  assert.equal(
    amazonUrl("US", "B0/../x?tag=evil"),
    "https://www.amazon.com/dp/B0%2F..%2Fx%3Ftag%3Devil?tag=getbrian-20",
  );
});

test("AMAZON_ASSOCIATE_STATEMENT is the exact sentence Amazon requires", () => {
  assert.equal(AMAZON_ASSOCIATE_STATEMENT, "As an Amazon Associate I earn from qualifying purchases.");
});

// ---------------------------------------------------------------------------
// Data invariants over every real product
// ---------------------------------------------------------------------------

for (const p of products) {
  test(`product "${p.slug}" lists at least one region`, () => {
    assert.ok(p.regions.length > 0);
  });

  for (const region of p.regions) {
    test(`product "${p.slug}" lists ${region} and has a ${region} offer`, () => {
      assert.ok(p.offers[region]?.asin);
    });
  }

  for (const region of Object.keys(p.offers)) {
    test(`product "${p.slug}" has a ${region} offer and lists ${region} in regions`, () => {
      assert.ok(p.regions.includes(region as Region));
    });
  }

  for (const [region, offer] of Object.entries(p.offers)) {
    test(`product "${p.slug}" ${region} ASIN is ten uppercase letters or digits`, () => {
      assert.match(offer.asin, /^[A-Z0-9]{10}$/);
    });
  }

  for (const region of REGIONS) {
    const resolved = resolveProduct(p, region);
    if (!resolved) continue;
    const { host, tag } = AMAZON[region];
    const otherTag = AMAZON[region === "US" ? "GB" : "US"].tag;

    test(`${p.slug} resolved for ${region} links to ${host} with tag ${tag}`, () => {
      assert.equal(resolved.affiliateUrl, `https://${host}/dp/${p.offers[region]?.asin}?tag=${tag}`);
    });

    test(`${p.slug} resolved for ${region} never carries the other region's tag ${otherTag}`, () => {
      assert.ok(!resolved.affiliateUrl?.includes(otherTag));
    });

    test(`${p.slug} resolved for ${region} has no price`, () => {
      assert.equal(resolved.priceUsd, null);
      assert.equal(resolved.priceCheckedAt, null);
    });

    test(`${p.slug} resolved for ${region} is sold by Amazon with no redirect`, () => {
      assert.equal(resolved.retailer, "Amazon");
      assert.equal(resolved.redirectAllowed, false);
      assert.equal(retailerName(resolved), "Amazon");
    });

    test(`${p.slug} resolved for ${region} gets a Buy href that is the Amazon link itself`, () => {
      assert.equal(buyHref(resolved, "product"), resolved.affiliateUrl);
    });
  }

  for (const region of REGIONS) {
    if (p.regions.includes(region)) continue;
    test(`${p.slug} does not resolve for ${region}, where it is not sold`, () => {
      assert.equal(resolveProduct(p, region), null);
    });
  }
}

test("no ASIN is shared between two offers", () => {
  const asins = products.flatMap((p) => Object.values(p.offers).map((o) => o.asin));
  const duplicates = asins.filter((a, i) => asins.indexOf(a) !== i);
  assert.deepEqual(duplicates, []);
});

// ---------------------------------------------------------------------------
// resolveProduct
// ---------------------------------------------------------------------------

test("resolveProduct drops a price that the base product carries", () => {
  const base = fixture({ priceUsd: 24.99, priceCheckedAt: "2026-01-01" });
  const resolved = resolveProduct(base, "US");
  assert.equal(resolved?.priceUsd, null);
  assert.equal(resolved?.priceCheckedAt, null);
});

test("resolveProduct returns null for a region the product is not sold in", () => {
  assert.equal(resolveProduct(fixture(), "GB"), null);
});

test("resolveProduct returns null when the region is listed but has no offer", () => {
  const base = fixture({ regions: ["US", "GB"] });
  assert.equal(resolveProduct(base, "GB"), null);
});

test("resolveProduct returns null when an offer exists but the region is not listed", () => {
  const base = fixture({ offers: { US: { asin: "B000000000" }, GB: { asin: "B111111111" } } });
  assert.equal(resolveProduct(base, "GB"), null);
});

test("resolveProduct lays the regional override over the base fields for that region only", () => {
  const base = fixture({
    regions: ["US", "GB"],
    offers: { US: { asin: "B000000000" }, GB: { asin: "B111111111" } },
    regional: { GB: { summary: "uk summary" } },
  });
  assert.equal(resolveProduct(base, "GB")?.summary, "uk summary");
  assert.equal(resolveProduct(base, "GB")?.verdict, "base verdict");
  assert.equal(resolveProduct(base, "US")?.summary, "base summary");
});

test("resolveProduct does not mutate the product it is given", () => {
  const base = fixture({ priceUsd: 10 });
  resolveProduct(base, "US");
  assert.equal(base.priceUsd, 10);
  assert.equal(base.affiliateUrl, null);
  assert.equal(base.retailer, undefined);
});

test("a regional override cannot reintroduce a price or another region's link", () => {
  const base = fixture({
    regions: ["GB"],
    offers: { GB: { asin: "B111111111" } },
    regional: { GB: { priceUsd: 5, affiliateUrl: "https://www.amazon.com/dp/B1?tag=getbrian-20" } },
  });
  const resolved = resolveProduct(base, "GB");
  assert.equal(resolved?.priceUsd, null);
  assert.equal(resolved?.affiliateUrl, "https://www.amazon.co.uk/dp/B111111111?tag=getbrian-21");
});

// ---------------------------------------------------------------------------
// productsFor / getProductFor / pickFor
// ---------------------------------------------------------------------------

test("productsFor US lists magnesium, creatine and L-theanine in display order", () => {
  assert.deepEqual(
    productsFor("US").map((p) => p.slug),
    ["pure-encapsulations-magnesium-glycinate", "pure-encapsulations-creatine", "pure-encapsulations-l-theanine"],
  );
});

test("productsFor GB lists magnesium, Thorne creatine and L-theanine in display order", () => {
  assert.deepEqual(
    productsFor("GB").map((p) => p.slug),
    ["pure-encapsulations-magnesium-glycinate", "thorne-creatine", "pure-encapsulations-l-theanine"],
  );
});

test("each region has exactly one pick per supplement category", () => {
  assert.deepEqual(
    productsFor("US").map((p) => p.category),
    ["Magnesium", "Creatine", "L-theanine"],
  );
  assert.deepEqual(
    productsFor("GB").map((p) => p.category),
    ["Magnesium", "Creatine", "L-theanine"],
  );
});

test("getProductFor returns the product for a slug sold in the region", () => {
  assert.equal(getProductFor("pure-encapsulations-creatine", "US")?.slug, "pure-encapsulations-creatine");
  assert.equal(getProductFor("thorne-creatine", "GB")?.slug, "thorne-creatine");
});

test("getProductFor returns undefined for a slug sold only in the other region", () => {
  assert.equal(getProductFor("pure-encapsulations-creatine", "GB"), undefined);
  assert.equal(getProductFor("thorne-creatine", "US"), undefined);
});

test("getProductFor returns undefined for an unknown, retired or empty slug", () => {
  assert.equal(getProductFor("does-not-exist", "US"), undefined);
  assert.equal(getProductFor("thorne-theanine", "GB"), undefined);
  assert.equal(getProductFor("", "US"), undefined);
});

test("pickFor returns each region's own creatine", () => {
  assert.equal(pickFor("Creatine", "US")?.slug, "pure-encapsulations-creatine");
  assert.equal(pickFor("Creatine", "GB")?.slug, "thorne-creatine");
});

test("pickFor returns the same magnesium for both regions, linked to each region's Amazon", () => {
  assert.equal(pickFor("Magnesium", "US")?.affiliateUrl, "https://www.amazon.com/dp/B07P5K7DQP?tag=getbrian-20");
  assert.equal(pickFor("Magnesium", "GB")?.affiliateUrl, "https://www.amazon.co.uk/dp/B087B93NJB?tag=getbrian-21");
});

test("pickFor returns undefined for a category nothing is sold in", () => {
  assert.equal(pickFor("Zinc" as Product["category"], "US"), undefined);
});

test("the base product list is unchanged by resolving it", () => {
  const before = JSON.stringify(products);
  productsFor("GB");
  productsFor("US");
  assert.equal(JSON.stringify(products), before);
  assert.equal(getProduct("pure-encapsulations-l-theanine")?.affiliateUrl, null);
});

// ---------------------------------------------------------------------------
// UK L-theanine: no health claim is authorised in Great Britain
// ---------------------------------------------------------------------------

const CLAIM_WORDS = /relax|stress|calm|sleep|mood|focus/i;

test("US L-theanine keeps its evidence", () => {
  assert.ok(getProductFor("pure-encapsulations-l-theanine", "US")!.evidence.length > 0);
});

test("GB L-theanine has no evidence items", () => {
  assert.deepEqual(getProductFor("pure-encapsulations-l-theanine", "GB")!.evidence, []);
});

test("GB L-theanine has no top grade because it has no evidence", () => {
  assert.equal(topGrade(getProductFor("pure-encapsulations-l-theanine", "GB")!), null);
});

test("GB L-theanine text contains none of relax, stress, calm, sleep, mood, focus", () => {
  const p = getProductFor("pure-encapsulations-l-theanine", "GB")!;
  const text = JSON.stringify({
    name: p.name,
    summary: p.summary,
    verdict: p.verdict,
    bestFor: p.bestFor,
    notFor: p.notFor,
    ingredients: p.ingredients,
    testing: p.testing,
    safety: p.safety,
    pros: p.pros,
    cons: p.cons,
    advantage: p.advantage,
    imageAlt: p.imageAlt,
    evidence: p.evidence,
  });
  assert.doesNotMatch(text, CLAIM_WORDS);
});

test("the claim-word check does fail on the US L-theanine evidence (so the GB check can fail)", () => {
  const us = getProductFor("pure-encapsulations-l-theanine", "US")!;
  assert.match(JSON.stringify(us.evidence), CLAIM_WORDS);
});

test("L-theanine pack, serving and ingredient name differ by region", () => {
  const us = getProductFor("pure-encapsulations-l-theanine", "US")!;
  const gb = getProductFor("pure-encapsulations-l-theanine", "GB")!;
  // US: the 60-capsule bottle, whose label serving is 2 capsules (so 30 servings).
  assert.equal(us.servingSize, "2 capsules");
  assert.equal(us.servingsPerContainer, 30);
  assert.equal(us.ingredients[0].name, "L-theanine (as Suntheanine)");
  // UK: the 60-capsule bottle, one capsule a serving.
  assert.equal(gb.servingSize, "1 capsule");
  assert.equal(gb.servingsPerContainer, 60);
  assert.equal(gb.ingredients[0].name, "L-theanine (as Suntheanine)");
});

// ---------------------------------------------------------------------------
// Packshots
// ---------------------------------------------------------------------------

test("every packshot a product can show exists under public/", async () => {
  const { existsSync } = await import("node:fs");
  const { resolve } = await import("node:path");
  const shown = REGIONS.flatMap((r) => productsFor(r)).filter((p) => p.image !== null);
  assert.ok(shown.length >= 4, "the real data must have packshots, or this check is vacuous");
  for (const p of shown) {
    assert.ok(existsSync(resolve("public", `.${p.image}`)), `${p.slug}: missing ${p.image}`);
  }
});

test("UK visitors get the UK-label bottle photo, never the US one, whose label carries US health claims", () => {
  for (const slug of ["pure-encapsulations-magnesium-glycinate", "pure-encapsulations-l-theanine"]) {
    const us = getProductFor(slug, "US")!.image;
    const gb = getProductFor(slug, "GB")!.image;
    assert.ok(us, `${slug} US must have a packshot, or this check is vacuous`);
    assert.match(gb ?? "", /-uk\.png$/, slug);
    assert.notEqual(gb, us, slug);
    assert.equal(getProductFor(slug, "GB")!.imageNote, undefined, slug);
  }
});

test("UK magnesium follows the UK bottle: 2 capsules a serving, 45 servings, 240 mg", () => {
  const gb = getProductFor("pure-encapsulations-magnesium-glycinate", "GB")!;
  assert.equal(gb.servingSize, "2 capsules");
  assert.equal(gb.servingsPerContainer, 45);
  assert.match(gb.ingredients[0].amount ?? "", /^240 mg/);
});

test("the UK creatine and the US creatine each show their own tub", () => {
  assert.match(getProductFor("thorne-creatine", "GB")!.image ?? "", /thorne-creatine\.png$/);
  assert.match(getProductFor("pure-encapsulations-creatine", "US")!.image ?? "", /pure-encapsulations-creatine\.png$/);
});

test("a US packshot that shows a different pack size than the one linked carries a note saying so", () => {
  assert.match(getProductFor("pure-encapsulations-magnesium-glycinate", "US")!.imageNote ?? "", /30-capsule.*90 capsules/);
  // The US theanine photo and link are both the 60-capsule bottle, so no note.
  assert.equal(getProductFor("pure-encapsulations-l-theanine", "US")!.imageNote, undefined);
});

test("the GB magnesium override does not leak into the US version", () => {
  const us = getProductFor("pure-encapsulations-magnesium-glycinate", "US")!;
  assert.match(us.advantage, /350 mg/);
  assert.ok(us.ingredients[0].studiedDose);
});

// ---------------------------------------------------------------------------
// localizeSupplement / localizeGoal
// ---------------------------------------------------------------------------

test("localizeSupplement returns the supplement itself for the US", () => {
  const s = getSupplement("l-theanine");
  assert.equal(localizeSupplement(s, "US"), s);
});

test("localizeSupplement GB removes every claim word from L-theanine", () => {
  const gb = localizeSupplement(getSupplement("l-theanine"), "GB");
  assert.doesNotMatch(`${gb.tagline} ${gb.value} ${gb.role} ${gb.contribution}`, CLAIM_WORDS);
  assert.doesNotMatch(gb.contribution, /may support/i);
});

test("localizeSupplement US L-theanine still carries the claim wording (so the GB check can fail)", () => {
  const us = getSupplement("l-theanine");
  assert.match(`${us.tagline} ${us.value} ${us.role} ${us.contribution}`, CLAIM_WORDS);
});

const GB_FORBIDDEN =
  /strength|lean|muscle mass|focus|cognitive|brain|calm|relax|stress|sleep|mood|wind-down|wind down/i;

function supplementText(s: ReturnType<typeof getSupplement>): string {
  return `${s.tagline} ${s.value} ${s.role} ${s.contribution} ${s.caveat ?? ""}`;
}

test("localizeSupplement GB creatine says only the authorised sentence: no strength, lean-mass, focus or caveat", () => {
  const gb = localizeSupplement(getSupplement("creatine"), "GB");
  assert.doesNotMatch(supplementText(gb), GB_FORBIDDEN);
  assert.equal(gb.caveat, undefined);
  assert.match(gb.contribution, /increases physical performance in successive bursts of short-term, high intensity exercise/);
  assert.match(gb.contribution, /3 g a day/);
});

test("localizeSupplement GB magnesium uses the authorised claim wording", () => {
  const gb = localizeSupplement(getSupplement("magnesium"), "GB");
  assert.doesNotMatch(supplementText(gb), GB_FORBIDDEN);
  assert.match(gb.contribution, /^Contributes to normal muscle function/);
  assert.match(gb.contribution, /reduction of tiredness and fatigue/);
  assert.notEqual(gb.contribution, getSupplement("magnesium").contribution);
});

test("localizeSupplement GB: no supplement carries any forbidden wording", () => {
  for (const id of ["magnesium", "creatine", "l-theanine"] as const) {
    assert.doesNotMatch(supplementText(localizeSupplement(getSupplement(id), "GB")), GB_FORBIDDEN, id);
  }
});

test("the GB forbidden-wording check does fail on the US creatine and magnesium copy", () => {
  assert.match(supplementText(getSupplement("creatine")), GB_FORBIDDEN);
  assert.match(`${getSupplement("magnesium").contribution}`, /signaling/);
  assert.match(supplementText(getSupplement("l-theanine")), GB_FORBIDDEN);
});

test("localizeSupplement GB keeps identity fields of creatine and magnesium", () => {
  const creatine = localizeSupplement(getSupplement("creatine"), "GB");
  const magnesium = localizeSupplement(getSupplement("magnesium"), "GB");
  assert.deepEqual([creatine.id, creatine.name, creatine.category], ["creatine", "Creatine", "Creatine"]);
  assert.deepEqual([magnesium.id, magnesium.name, magnesium.category], ["magnesium", "Magnesium", "Magnesium"]);
});

test("localizeSupplement US returns creatine unchanged, caveat included", () => {
  assert.equal(localizeSupplement(getSupplement("creatine"), "US").caveat, getSupplement("creatine").caveat);
  assert.ok(getSupplement("creatine").caveat);
});

test("localizeSupplement GB keeps the identity fields of L-theanine", () => {
  const gb = localizeSupplement(getSupplement("l-theanine"), "GB");
  assert.equal(gb.id, "l-theanine");
  assert.equal(gb.name, "L-theanine");
  assert.equal(gb.category, "L-theanine");
});

test("localizeSupplement does not mutate the shared supplement", () => {
  localizeSupplement(getSupplement("l-theanine"), "GB");
  assert.equal(getSupplement("l-theanine").role, "Calm and relaxation");
});

test("localizeGoal returns the goal itself for the US", () => {
  const g = goals.find((x) => x.id === "calm")!;
  assert.equal(localizeGoal(g, "US"), g);
});

test("localizeGoal GB removes claim wording from the calm goal and keeps its supplement", () => {
  const gb = localizeGoal(goals.find((x) => x.id === "calm")!, "GB");
  assert.doesNotMatch(`${gb.label} ${gb.hook} ${gb.eyebrowDetail}`, CLAIM_WORDS);
  assert.doesNotMatch(`${gb.hook} ${gb.eyebrowDetail}`, /wind-down|wired/i);
  assert.equal(gb.supplement, "l-theanine");
});

test("the US calm goal still carries claim wording (so the GB check can fail)", () => {
  const us = goals.find((x) => x.id === "calm")!;
  assert.match(`${us.label} ${us.hook} ${us.eyebrowDetail}`, CLAIM_WORDS);
});

test("localizeGoal GB leaves the energy and focus goals unchanged", () => {
  for (const id of ["energy", "focus"] as const) {
    const g = goals.find((x) => x.id === id)!;
    assert.deepEqual(localizeGoal(g, "GB"), g, id);
  }
});

test("localizeGoal GB relabels strength as Exercise with a neutral hook", () => {
  const gb = localizeGoal(goals.find((x) => x.id === "strength")!, "GB");
  assert.equal(gb.label, "Exercise");
  assert.equal(gb.eyebrowDetail, "High-Intensity Exercise");
  assert.doesNotMatch(`${gb.label} ${gb.hook} ${gb.eyebrowDetail}`, GB_FORBIDDEN);
  assert.equal(gb.supplement, "creatine");
  assert.equal(gb.icon, goals.find((x) => x.id === "strength")!.icon);
});

test("localizeGoal GB gives the calm goal the book icon, and US keeps the moon", () => {
  const calm = goals.find((x) => x.id === "calm")!;
  assert.equal(calm.icon, "moon");
  assert.equal(localizeGoal(calm, "GB").icon, "book");
  assert.equal(localizeGoal(calm, "US").icon, "moon");
});

test("localizeGoal US leaves every goal identical", () => {
  for (const g of goals) assert.equal(localizeGoal(g, "US"), g, g.id);
});

// ---------------------------------------------------------------------------
// goalsForSupplement
// ---------------------------------------------------------------------------

test("goalsForSupplement creatine for US includes strength then focus", () => {
  assert.deepEqual(goalsForSupplement("creatine", "US").map((g) => g.id), ["strength", "focus"]);
});

test("goalsForSupplement creatine for GB excludes focus", () => {
  assert.deepEqual(goalsForSupplement("creatine", "GB").map((g) => g.id), ["strength"]);
});

test("goalsForSupplement for GB returns localized goals", () => {
  assert.equal(goalsForSupplement("creatine", "GB")[0].label, "Exercise");
  assert.equal(goalsForSupplement("l-theanine", "GB")[0].label, "Evening");
  assert.equal(goalsForSupplement("creatine", "US")[0].label, "Strength");
});

test("goalsForSupplement returns magnesium's and L-theanine's single goal in both regions", () => {
  for (const region of ["US", "GB"] as const) {
    assert.deepEqual(goalsForSupplement("magnesium", region).map((g) => g.id), ["energy"], region);
    assert.deepEqual(goalsForSupplement("l-theanine", region).map((g) => g.id), ["calm"], region);
  }
});

test("goalsForSupplement does not mutate the shared goals list", () => {
  const before = JSON.stringify(goals);
  goalsForSupplement("creatine", "GB");
  assert.equal(JSON.stringify(goals), before);
});

test("no goal shown to a GB visitor, for any supplement, carries forbidden wording", () => {
  for (const id of ["magnesium", "creatine", "l-theanine"] as const) {
    for (const g of goalsForSupplement(id, "GB")) {
      assert.doesNotMatch(`${g.label} ${g.hook} ${g.eyebrowDetail}`, GB_FORBIDDEN, g.id);
    }
  }
});

test("localizeGoal does not mutate the shared goal", () => {
  localizeGoal(goals.find((x) => x.id === "calm")!, "GB");
  assert.equal(goals.find((x) => x.id === "calm")!.label, "Calm");
});

// ---------------------------------------------------------------------------
// Resolved copy: the existing copy-rule loops only see the base fields
// ---------------------------------------------------------------------------

const DISEASE_CLAIM_WORDS = ["treat", "cure", "prevent", "reverse", "diagnose"];

for (const region of REGIONS) {
  for (const product of productsFor(region)) {
    test(`resolved ${region} "${product.slug}" copy has no disease-claim words`, () => {
      const texts = [
        product.summary,
        product.verdict,
        product.advantage,
        ...product.pros,
        ...product.cons,
        ...product.bestFor,
        ...product.evidence.flatMap((e) => [e.claim, e.summary]),
      ];
      const found = texts.filter((t) => DISEASE_CLAIM_WORDS.some((w) => t.toLowerCase().includes(w)));
      assert.deepEqual(found, []);
    });
  }
}

// ---------------------------------------------------------------------------
// FAQ copy
// ---------------------------------------------------------------------------

test("the earn-money FAQ carries the Amazon Associate sentence", () => {
  const faq = faqs.find((f) => f.question === "Do you earn money if I buy?");
  assert.ok(faq);
  assert.ok(faq.answer.includes(AMAZON_ASSOCIATE_STATEMENT));
});

test("the 'Why these brands?' FAQ replaced the Thorne question", () => {
  assert.ok(faqs.some((f) => f.question === "Why these brands?"));
  assert.ok(faqs.every((f) => !/Thorne/.test(f.question)));
});

test("the UK and US FAQ exists and says the footer switches country", () => {
  const faq = faqs.find((f) => f.question === "Why do I see different products in the UK and the US?");
  assert.ok(faq);
  assert.match(faq.answer, /footer/);
});
