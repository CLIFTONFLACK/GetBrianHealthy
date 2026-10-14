import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Every Buy button passes a `from` label that /go/[slug] logs, but the route
 * only logs labels in its FROM_VALUES allow-list and records anything else as
 * "unknown". A new Buy button with a label missing from the list loses its
 * click attribution silently, so this pins the two together.
 *
 * Route files may only export route handlers, so FROM_VALUES is read from the
 * route's source text rather than imported.
 */
const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const routeSource = readFileSync(path.join(APP, "go", "[slug]", "route.ts"), "utf8");

function allowList(): Set<string> {
  const m = routeSource.match(/const FROM_VALUES = new Set\(\[([^\]]*)\]\)/);
  assert.ok(m, "FROM_VALUES is declared in the route");
  return new Set([...m![1].matchAll(/"([^"]+)"/g)].map((x) => x[1]));
}

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return name === "__tests__" ? [] : sourceFiles(full);
    return /\.(ts|tsx)$/.test(name) ? [full] : [];
  });
}

/** `from="x"` props on BuyButton / ProductCard and `buyHref(p, "x")` calls. */
function usedLabels(): Map<string, string> {
  const found = new Map<string, string>();
  for (const file of sourceFiles(APP)) {
    const text = readFileSync(file, "utf8");
    for (const m of text.matchAll(/\bfrom="([a-z-]+)"/g)) found.set(m[1], path.relative(APP, file));
    for (const m of text.matchAll(/buyHref\([^,()]+,\s*"([a-z-]+)"\)/g)) found.set(m[1], path.relative(APP, file));
  }
  return found;
}

test("the scan finds the Buy buttons, including the product hero's, so the check below cannot pass empty", () => {
  const used = usedLabels();
  assert.ok(used.has("product-hero"), "the product hero's label is found");
  assert.ok(used.has("product-mobile-bar"), "the phone purchase bar's label is found");
});

test("every Buy-button source label is in the /go route's allow-list", () => {
  const allowed = allowList();
  for (const [label, file] of usedLabels()) {
    assert.ok(allowed.has(label), `"${label}" (used in ${file}) is missing from FROM_VALUES in go/[slug]/route.ts`);
  }
});
