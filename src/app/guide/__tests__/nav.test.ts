import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// layout.tsx imports next/font/google and a global .css file, which cannot load
// under `npm test`, so the menu is checked in the source text instead.
const here = path.dirname(fileURLToPath(import.meta.url));
const layoutSource = readFileSync(path.resolve(here, "../../layout.tsx"), "utf8").replace(/\r\n/g, "\n");

/** The `nav` array, so the checks cannot match a /guide link elsewhere in the layout. */
const navBlock = layoutSource.match(/const nav = \[\n([\s\S]*?)\n\];/)?.[1] ?? "";

test("sanity: the nav block was found and holds the existing entries", () => {
  assert.match(navBlock, /href: "\/routine"/);
  assert.match(navBlock, /href: "\/about"/);
});

test("the menu has a Free guide entry pointing at /guide", () => {
  assert.match(navBlock, /\{ href: "\/guide", label: "Free guide" \}/);
});

test("the Free guide entry sits after Daily routine and before About", () => {
  const order = [...navBlock.matchAll(/href: "([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(order.slice(order.indexOf("/routine"), order.indexOf("/about") + 1), ["/routine", "/guide", "/about"]);
});
