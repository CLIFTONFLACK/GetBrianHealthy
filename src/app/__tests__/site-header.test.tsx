import test from "node:test";
import assert from "node:assert/strict";
import { mock } from "node:test";
import { readFileSync } from "node:fs";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

let pathname: string | null = "/";
let SiteHeader: () => React.ReactElement;
let nav: { href: string; label: string }[];
let isCurrent: (href: string, p: string | null) => boolean;

test.before(async () => {
  mock.module("next/navigation", { exports: { usePathname: () => pathname } });
  // Under node:test the CJS default exports of next/link and next/image arrive as objects, so plain stand-ins render instead.
  mock.module("next/link", {
    exports: {
      default: ({ href, children, ...rest }: Record<string, unknown>) =>
        React.createElement("a", { href, ...rest }, children as React.ReactNode),
    },
  });
  mock.module("next/image", {
    exports: { default: ({ src, alt }: Record<string, unknown>) => React.createElement("img", { src, alt }) },
  });
  ({ SiteHeader, nav, isCurrent } = (await import("../site-header.tsx")) as never);
});

const render = (path: string | null) => {
  pathname = path;
  return renderToStaticMarkup(React.createElement(SiteHeader));
};

const HREFS = ["/", "/#picks", "/method", "/routine", "/guide", "/about", "/about#contact"];

/** The two `<nav aria-label="Healthy">` blocks: [desktop row, mobile menu]. */
function navs(html: string): string[] {
  return [...html.matchAll(/<nav aria-label="Healthy"[^>]*>[\s\S]*?<\/nav>/g)].map((m) => m[0]);
}

test("the menu holds the seven links, in order", () => {
  assert.deepEqual(nav.map((n) => n.href), HREFS);
  assert.deepEqual(nav.map((n) => n.label), [
    "Home", "Brian's picks", "How Brian picks", "Daily routine", "Free guide", "About", "Contact",
  ]);
});

test("the header has the brand link, one nav row and one mobile menu, each with every link", () => {
  const html = render("/");
  assert.match(html, /<header data-chrome="true" /);
  assert.match(html, /<a href="\/" aria-label="GetBrian Healthy home"/);
  const [desktop, mobile] = navs(html);
  assert.equal(navs(html).length, 2);
  for (const href of HREFS) {
    assert.ok(desktop.includes(`href="${href}"`), `desktop row: ${href}`);
    assert.ok(mobile.includes(`href="${href}"`), `mobile menu: ${href}`);
  }
});

test("the row shows from lg up and the Menu button only below lg", () => {
  const [desktop] = navs(render("/"));
  assert.match(desktop, /^<nav aria-label="Healthy" class="hidden lg:block"/);
  assert.match(render("/"), /<details class="group relative lg:hidden"/);
});

test("the mobile menu is a closed details with a Menu summary", () => {
  const html = render("/");
  const details = html.match(/<details[^>]*>/)![0];
  assert.doesNotMatch(details, /\sopen(=|>|\s)/);
  assert.match(html, /<summary[^>]*>[\s\S]*Menu<\/summary>/);
});

test("the header sits in the page flow: not fixed, not sticky, not floating", () => {
  const header = render("/").match(/<header[^>]*>/)![0];
  assert.doesNotMatch(header, /\b(fixed|sticky|absolute)\b/);
  assert.match(header, /\brelative\b/);
});

test("aria-current is set on the current page only", () => {
  for (const [path, href] of [["/", "/"], ["/method", "/method"], ["/routine", "/routine"], ["/guide", "/guide"], ["/about", "/about"]]) {
    const html = render(path);
    for (const nv of navs(html)) {
      const current = [...nv.matchAll(/<a [^>]*aria-current="page"[^>]*>/g)].map((m) => m[0]);
      assert.equal(current.length, 1, `${path}: one current link per nav`);
      assert.ok(current[0].includes(`href="${href}"`), `${path}: current is ${href}`);
    }
  }
});

test("no link is current on a page the menu does not list, and anchors are never current", () => {
  assert.doesNotMatch(render("/disclosures"), /aria-current/);
  assert.doesNotMatch(render(null), /aria-current/);
  assert.equal(isCurrent("/#picks", "/"), false);
  assert.equal(isCurrent("/about#contact", "/about"), false);
  assert.equal(isCurrent("/about", "/about"), true);
});

// A hook cannot run under renderToStaticMarkup, so the open/close wiring is
// pinned in the source text. Weaker than driving a browser, and it says so by name.
test("(source) Escape closes the menu and returns focus to the Menu button; outside click and a new page close it too", () => {
  const src = readFileSync(new URL("../site-header.tsx", import.meta.url), "utf8");
  assert.match(src, /e\.key !== "Escape"/);
  assert.match(src, /querySelector\("summary"\)\?\.focus\(\)/);
  assert.match(src, /addEventListener\("pointerdown"/);
  assert.match(src, /setOpen\(false\);\s*\}, \[pathname\]\)/);
});

test("(source) layout has no floating menu, pull-up or <main> clearance left behind", () => {
  const rd = (p: string) => readFileSync(new URL(p, import.meta.url), "utf8");
  assert.match(rd("../layout.tsx"), /<main className="flex-1">/);
  for (const p of ["../layout.tsx", "../page.tsx", "../method/page.tsx", "../products/[slug]/page.tsx"]) {
    const src = rd(p);
    assert.doesNotMatch(src, /\b-mt-16\b|lg:-mt-16|pt-16 min-\[1544px\]|min-\[1544px\]/, p);
  }
});
