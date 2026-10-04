import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { isExcludedPath } from "../consent.ts";

// The private-pages list in consent.ts is a denylist, so a route added later is measured by
// default. This walks the real route tree: every route must be one of the two lists below,
// so adding a page fails this test until someone decides whether it is private.

const APP = join(import.meta.dirname, "..", "..", "app");
const PUBLIC = new Set(["/", "/about", "/disclosures", "/method", "/products/x", "/why-these-picks", "/why-these-picks/creator-notes"]);
const PRIVATE = new Set(["/confirm", "/go/x"]);
// Non-HTML handlers: they never render the component.
const SKIP = new Set(["/robots.txt", "/sitemap.xml"]);

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (name === "__tests__") continue;
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/^(page|route)\.(tsx|ts)$/.test(name)) out.push(full);
  }
  return out;
}

function toRoute(file: string): string {
  const parts = relative(APP, file).split(sep);
  parts.pop();
  return "/" + parts.map((p) => (p.startsWith("[") ? "x" : p)).join("/");
}

test("every route is classified: private ones are excluded, public ones measured", () => {
  const files = walk(APP);
  assert.ok(files.length > 5, "found the route tree");
  for (const f of files) {
    const route = toRoute(f).replace(/\/$/, "") || "/";
    if (SKIP.has(route)) continue;
    if (PRIVATE.has(route)) assert.equal(isExcludedPath(route), true, `${route} must be excluded`);
    else if (PUBLIC.has(route)) assert.equal(isExcludedPath(route), false, `${route} must be measured`);
    else assert.fail(`${route} is not classified: decide whether it is private or public in consent.ts and this test`);
  }
});
