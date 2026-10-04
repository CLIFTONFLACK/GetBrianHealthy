import test from "node:test";
import assert from "node:assert/strict";
import nextConfig from "../../../next.config.ts";
import { getProduct, products } from "../data.ts";

type Redirect = { source: string; destination: string; permanent: boolean };

async function redirects(): Promise<Redirect[]> {
  assert.ok(nextConfig.redirects, "next.config.ts must define redirects()");
  return (await nextConfig.redirects()) as Redirect[];
}

const EXPECTED: Redirect[] = [
  {
    source: "/products/thorne-magnesium-glycinate",
    destination: "/products/pure-encapsulations-magnesium-glycinate",
    permanent: true,
  },
  {
    source: "/products/thorne-creatine-stick-packs",
    destination: "/products/pure-encapsulations-creatine",
    permanent: true,
  },
  {
    source: "/products/thorne-theanine",
    destination: "/products/pure-encapsulations-l-theanine",
    permanent: true,
  },
];

test("the three retired Thorne slugs redirect permanently to their Pure Encapsulations pages", async () => {
  assert.deepEqual(await redirects(), EXPECTED);
});

test("every redirect destination is a live product page", async () => {
  for (const r of await redirects()) {
    const slug = r.destination.replace("/products/", "");
    assert.ok(getProduct(slug), `${r.destination} has no product`);
  }
});

test("no redirect source is still a live product slug, so a redirect never hides a real page", async () => {
  const live = new Set(products.map((p) => `/products/${p.slug}`));
  for (const r of await redirects()) {
    assert.ok(!live.has(r.source), `${r.source} is both a live page and a redirect source`);
  }
});

test("each redirect keeps the old slug's ingredient: the destination is in the same category", async () => {
  const expected: Record<string, string> = {
    "/products/thorne-magnesium-glycinate": "Magnesium",
    "/products/thorne-creatine-stick-packs": "Creatine",
    "/products/thorne-theanine": "L-theanine",
  };
  for (const r of await redirects()) {
    const slug = r.destination.replace("/products/", "");
    assert.equal(getProduct(slug)?.category, expected[r.source], r.source);
  }
});

test("/favicon.ico is served from the brand icon, not a 404", async () => {
  assert.ok(nextConfig.rewrites, "next.config.ts must define rewrites()");
  const rewrites = (await nextConfig.rewrites()) as { source: string; destination: string }[];
  assert.deepEqual(rewrites, [{ source: "/favicon.ico", destination: "/healthy/brand/favicon-32.png" }]);
});
