import test from "node:test";
import assert from "node:assert/strict";
import robots from "../robots.ts";
import { siteUrl } from "../site.ts";

type Rules = { allow?: string | string[]; disallow?: string | string[] };

function asList(value: string | string[] | undefined): string[] {
  return Array.isArray(value) ? value : value === undefined ? [] : [value];
}

test("disallows crawling the Buy-button redirect path", () => {
  const rules = robots().rules as Rules;
  assert.deepEqual(asList(rules.disallow), ["/go/"]);
});

test("still allows crawling the site generally", () => {
  const rules = robots().rules as Rules;
  assert.ok(asList(rules.allow).includes("/"));
});

test("points crawlers at the sitemap on the canonical host", () => {
  const result = robots();
  assert.equal(result.sitemap, `${siteUrl}/sitemap.xml`);
  assert.equal(result.host, siteUrl);
});
