import test from "node:test";
import assert from "node:assert/strict";
import { REGIONS, REGION_COOKIE, REGION_LABELS, parseRegion, regionFromCountry, resolveRegion } from "../region.ts";

// ---------------------------------------------------------------------------
// constants
// ---------------------------------------------------------------------------

test("the region cookie is named hl-region", () => {
  assert.equal(REGION_COOKIE, "hl-region");
});

test("there are exactly two regions, US then GB", () => {
  assert.deepEqual(REGIONS, ["US", "GB"]);
});

test("every region has a label", () => {
  assert.deepEqual(REGION_LABELS, { US: "United States", GB: "United Kingdom" });
});

// ---------------------------------------------------------------------------
// parseRegion: exact match only
// ---------------------------------------------------------------------------

test("parseRegion accepts US", () => {
  assert.equal(parseRegion("US"), "US");
});

test("parseRegion accepts GB", () => {
  assert.equal(parseRegion("GB"), "GB");
});

test("parseRegion rejects a lowercase value", () => {
  assert.equal(parseRegion("us"), null);
  assert.equal(parseRegion("gb"), null);
});

test("parseRegion rejects a value with surrounding whitespace", () => {
  assert.equal(parseRegion("GB "), null);
  assert.equal(parseRegion(" US"), null);
});

test("parseRegion rejects an empty string", () => {
  assert.equal(parseRegion(""), null);
});

test("parseRegion rejects null and undefined", () => {
  assert.equal(parseRegion(null), null);
  assert.equal(parseRegion(undefined), null);
});

test("parseRegion rejects a country that is not a region", () => {
  assert.equal(parseRegion("FR"), null);
  assert.equal(parseRegion("UK"), null);
});

test("parseRegion rejects a value that merely contains a region", () => {
  assert.equal(parseRegion("US,GB"), null);
  assert.equal(parseRegion("GBR"), null);
});

test("parseRegion rejects an object-prototype key", () => {
  assert.equal(parseRegion("__proto__"), null);
  assert.equal(parseRegion("constructor"), null);
});

// ---------------------------------------------------------------------------
// regionFromCountry
// ---------------------------------------------------------------------------

test("regionFromCountry maps GB to GB", () => {
  assert.equal(regionFromCountry("GB"), "GB");
});

test("regionFromCountry maps US to US", () => {
  assert.equal(regionFromCountry("US"), "US");
});

test("regionFromCountry maps the Isle of Man, Jersey and Guernsey to GB", () => {
  assert.equal(regionFromCountry("IM"), "GB");
  assert.equal(regionFromCountry("JE"), "GB");
  assert.equal(regionFromCountry("GG"), "GB");
});

test("regionFromCountry accepts a lowercase gb country code", () => {
  assert.equal(regionFromCountry("gb"), "GB");
  assert.equal(regionFromCountry("im"), "GB");
});

test("regionFromCountry sends other countries to US", () => {
  assert.equal(regionFromCountry("FR"), "US");
  assert.equal(regionFromCountry("IE"), "US");
  assert.equal(regionFromCountry("AU"), "US");
});

test("regionFromCountry sends an unknown or empty country to US", () => {
  assert.equal(regionFromCountry(""), "US");
  assert.equal(regionFromCountry(null), "US");
  assert.equal(regionFromCountry(undefined), "US");
  assert.equal(regionFromCountry("XX"), "US");
});

test("regionFromCountry does not treat the non-ISO code UK as Great Britain", () => {
  assert.equal(regionFromCountry("UK"), "US");
});

test("regionFromCountry sends a padded country code to US", () => {
  assert.equal(regionFromCountry(" GB"), "US");
  assert.equal(regionFromCountry("GBR"), "US");
});

// ---------------------------------------------------------------------------
// resolveRegion: an explicit choice beats detection
// ---------------------------------------------------------------------------

test("resolveRegion lets a US choice beat a GB country", () => {
  assert.equal(resolveRegion("US", "GB"), "US");
});

test("resolveRegion lets a GB choice beat a US country", () => {
  assert.equal(resolveRegion("GB", "US"), "GB");
});

test("resolveRegion uses the country when there is no cookie", () => {
  assert.equal(resolveRegion(null, "GB"), "GB");
  assert.equal(resolveRegion(undefined, "GB"), "GB");
});

test("resolveRegion falls through to country detection for a tampered lowercase cookie", () => {
  assert.equal(resolveRegion("us", "GB"), "GB");
  assert.equal(resolveRegion("gb", "US"), "US");
});

test("resolveRegion falls through to country detection for a padded cookie", () => {
  assert.equal(resolveRegion("GB ", "US"), "US");
});

test("resolveRegion falls through to country detection for an empty cookie", () => {
  assert.equal(resolveRegion("", "GB"), "GB");
});

test("resolveRegion falls through to country detection for a garbage cookie", () => {
  assert.equal(resolveRegion("<script>", "GB"), "GB");
});

test("resolveRegion defaults to US with no cookie and no country", () => {
  assert.equal(resolveRegion(null, null), "US");
  assert.equal(resolveRegion(undefined, undefined), "US");
});

test("resolveRegion defaults to US with a tampered cookie and no country", () => {
  assert.equal(resolveRegion("xx", ""), "US");
});
