import test from "node:test";
import assert from "node:assert/strict";
import sitemap from "../sitemap.ts";
import { siteUrl } from "../site.ts";

test("lists the home page at the canonical host, with no trailing path", () => {
  const urls = sitemap().map((entry) => entry.url);
  assert.ok(urls.includes(siteUrl));
  assert.equal(siteUrl, "https://www.getbrianhealthy.xyz");
});

test("lists every indexable section page and the US product pages, nothing else", () => {
  const urls = sitemap().map((entry) => entry.url);
  assert.deepEqual(urls, [
    siteUrl,
    `${siteUrl}/method`,
    `${siteUrl}/why-these-picks`,
    `${siteUrl}/about`,
    `${siteUrl}/disclosures`,
    `${siteUrl}/products/pure-encapsulations-magnesium-glycinate`,
    `${siteUrl}/products/pure-encapsulations-creatine`,
    `${siteUrl}/products/pure-encapsulations-l-theanine`,
  ]);
});

test("every URL is on the one host, so none can disagree with a page canonical", () => {
  for (const { url } of sitemap()) {
    assert.ok(url === siteUrl || url.startsWith(`${siteUrl}/`), url);
  }
});

test("never lists the old /healthy prefix", () => {
  assert.ok(sitemap().every((entry) => !entry.url.includes("/healthy")));
});

test("never lists the noindexed creator-notes page, the confirm page or the Buy redirect", () => {
  const urls = sitemap().map((entry) => entry.url);
  assert.ok(urls.every((url) => !url.includes("creator-notes")));
  assert.ok(urls.every((url) => !url.includes("/confirm")));
  assert.ok(urls.every((url) => !url.includes("/go/")));
});

test("never lists a retired Thorne slug that now only redirects", () => {
  const urls = sitemap().map((entry) => entry.url);
  assert.ok(urls.every((url) => !url.includes("thorne-")));
});
