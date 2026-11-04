import test from "node:test";
import assert from "node:assert/strict";
import { getProduct, getProductFor, products, resolveProduct, type Product } from "../data.ts";

/**
 * Product.heroImage through the regional layer. resolveProduct lays a region's
 * `regional` block over the base product, so a region can change the hero
 * photo, inherit it, or clear it. These pin each of those, and that
 * resolveProduct leaves its input alone.
 */

const MAGNESIUM = "pure-encapsulations-magnesium-glycinate";

function magnesiumWith(overrides: Partial<Product>): Product {
  return { ...(getProduct(MAGNESIUM) as Product), slug: "fixture-hero-regional", ...overrides };
}

// ---------------------------------------------------------------------------
// The real data: a region with no hero override inherits the base photo
// ---------------------------------------------------------------------------

test("getProductFor keeps the base magnesium hero for GB, whose override sets no heroImage", () => {
  assert.equal(getProductFor(MAGNESIUM, "GB")?.heroImage, "/healthy/hero/magnesium.jpg");
});

test("getProductFor keeps the creatine hero for the GB Thorne creatine", () => {
  assert.equal(getProductFor("thorne-creatine", "GB")?.heroImage, "/healthy/hero/creatine.jpg");
});

test("getProductFor keeps the L-theanine hero for GB, whose override sets no heroImage", () => {
  assert.equal(getProductFor("pure-encapsulations-l-theanine", "GB")?.heroImage, "/healthy/hero/l-theanine.jpg");
});

test("getProductFor returns undefined for an unknown slug", () => {
  assert.equal(getProductFor("no-such-product", "GB"), undefined);
});

// ---------------------------------------------------------------------------
// A regional override of heroImage
// ---------------------------------------------------------------------------

test("a GB override of heroImage replaces the base photo for GB", () => {
  const fixture = magnesiumWith({
    heroImage: "/healthy/hero/base.jpg",
    regional: { GB: { heroImage: "/healthy/hero/gb.jpg" } },
  });
  assert.equal(resolveProduct(fixture, "GB")?.heroImage, "/healthy/hero/gb.jpg");
});

test("a GB override of heroImage leaves the US photo as the base photo", () => {
  const fixture = magnesiumWith({
    heroImage: "/healthy/hero/base.jpg",
    regional: { GB: { heroImage: "/healthy/hero/gb.jpg" } },
  });
  assert.equal(resolveProduct(fixture, "US")?.heroImage, "/healthy/hero/base.jpg");
});

test("a GB override of heroImage set to undefined clears the base photo, as imageNote is cleared in data.ts", () => {
  const fixture = magnesiumWith({
    heroImage: "/healthy/hero/base.jpg",
    regional: { GB: { heroImage: undefined } },
  });
  // The spread copies the explicit undefined over the base value. The page then falls back to the goal photo.
  assert.equal(resolveProduct(fixture, "GB")?.heroImage, undefined);
});

test("a GB override of heroImage set to an empty string replaces the base photo with the empty string", () => {
  const fixture = magnesiumWith({
    heroImage: "/healthy/hero/base.jpg",
    regional: { GB: { heroImage: "" } },
  });
  assert.equal(resolveProduct(fixture, "GB")?.heroImage, "");
});

// ---------------------------------------------------------------------------
// The input is not changed
// ---------------------------------------------------------------------------

test("resolveProduct does not change the base product or its regional block", () => {
  const fixture = magnesiumWith({
    heroImage: "/healthy/hero/base.jpg",
    regional: { GB: { heroImage: "/healthy/hero/gb.jpg" } },
  });
  const before = structuredClone(fixture);
  resolveProduct(fixture, "GB");
  assert.deepEqual(fixture, before);
  assert.equal(fixture.heroImage, "/healthy/hero/base.jpg");
});

test("resolveProduct does not change the shared products array", () => {
  const before = structuredClone(products);
  resolveProduct(getProduct(MAGNESIUM) as Product, "GB");
  assert.deepEqual(products, before);
});
