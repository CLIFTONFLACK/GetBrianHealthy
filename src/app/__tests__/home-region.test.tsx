import test, { mock } from "node:test";
import assert from "node:assert/strict";
import Link from "next/link";
import Image from "next/image";
import { Icon } from "../icons.tsx";
import { productsFor } from "../data.ts";
import type { Region } from "../region.ts";

// Same stubs as quickwins.test.tsx: the root layout pulls in next/font and a
// global .css import, and region-server reads cookies() outside a request.
let currentRegion: Region = "US";
let HealthyHome: () => Promise<unknown>;
const trees: Record<Region, unknown> = { US: null, GB: null };

test.before(async () => {
  mock.module(new URL("../site.ts", import.meta.url), {
    exports: { siteUrl: "https://example.test" },
  });
  mock.module(new URL("../region-server.ts", import.meta.url), {
    exports: { getRegion: async () => currentRegion },
  });
  ({ default: HealthyHome } = await import("../page.tsx"));
  currentRegion = "US";
  trees.US = await HealthyHome();
  currentRegion = "GB";
  trees.GB = await HealthyHome();
  currentRegion = "US";
});

type El = { type: unknown; props: Record<string, unknown> };

/**
 * Walks everything a visitor would see: host elements, plus the output of every
 * local component. Components that need hooks or Next internals throw when
 * called outside React, so for those the walk falls back to their children.
 */
function expand(node: unknown, onEl: (el: El) => void, onText: (s: string) => void): void {
  if (node === null || node === undefined || typeof node === "boolean") return;
  if (typeof node === "string") return onText(node);
  if (typeof node === "number") return onText(String(node));
  if (Array.isArray(node)) {
    for (const child of node) expand(child, onEl, onText);
    return;
  }
  if (typeof node === "object" && "type" in node) {
    const el = node as El;
    onEl(el);
    if (typeof el.type === "function" && el.type !== Link && el.type !== Image && el.type !== Icon) {
      try {
        expand((el.type as (p: unknown) => unknown)(el.props), onEl, onText);
        return;
      } catch {
        // needs React context: use what it was handed instead
      }
    }
    if (el.props && "children" in el.props) expand(el.props.children, onEl, onText);
  }
}

function elements(region: Region): El[] {
  const out: El[] = [];
  expand(trees[region], (el) => out.push(el), () => {});
  return out;
}

function text(region: Region): string {
  const out: string[] = [];
  expand(trees[region], () => {}, (s) => out.push(s));
  return out.join(" ");
}

test("sanity: the expanding walk reaches card and goal text, so the absence checks below are not vacuous", () => {
  assert.match(text("US"), /Lifting after 40/);
  assert.match(text("US"), /Strength and physical performance/);
  assert.match(text("US"), /Calm/);
});

// Note: the US home page shows no Focus text either (the focus goal has no
// tile and the rail shows only a card's lead goal), so "GB renders no Focus"
// above cannot fail through this page alone. The GB focus removal is pinned
// where it is reachable: goalsForSupplement and the product page.

// ---------------------------------------------------------------------------
// GB: nothing that amounts to an unauthorised claim
// ---------------------------------------------------------------------------

test("GB home page renders no 'Focus'", () => {
  assert.doesNotMatch(text("GB"), /Focus/);
});

test("GB home page does not render the US creatine strapline 'Strength and physical performance'", () => {
  assert.doesNotMatch(text("GB"), /Strength and physical performance/);
});

test("GB home page renders no 'Calm' in the hero points or anywhere else", () => {
  assert.doesNotMatch(text("GB"), /Calm/);
});

test("US home page keeps 'Calm' in the hero points", () => {
  assert.match(text("US"), /Energy, Strength and Calm When You Need It Most/);
});

test("GB home page renders no calm/relax/stress/sleep wording from the goals or supplements", () => {
  const gb = text("GB");
  assert.doesNotMatch(gb, /Calm and relaxation|Support your wind-down|Still wired at 10pm|managing everyday stress/);
});

function iconCount(region: Region, name: string): number {
  return elements(region).filter((el) => el.type === Icon && el.props.name === name).length;
}

test("GB home page has no moon icon anywhere: the calm tile no longer hints at sleep", () => {
  assert.equal(iconCount("GB", "moon"), 0);
});

test("US home page keeps its moon icon on the calm tile and rail", () => {
  assert.ok(iconCount("US", "moon") >= 1);
});

test("GB home page uses the book icon for the evening tile, one more than the US page uses", () => {
  assert.ok(iconCount("GB", "book") > iconCount("US", "book"));
});

test("GB home page labels the strength tile 'Exercise'", () => {
  assert.match(text("GB"), /Exercise/);
  assert.doesNotMatch(text("GB"), /Strength: Creatine|Lifting after 40/);
});

// ---------------------------------------------------------------------------
// Amazon sentence on every card
// ---------------------------------------------------------------------------

function statements(region: Region): El[] {
  return elements(region).filter((el) => el.props["data-amazon-statement"] === true);
}

test("US home page carries the Amazon sentence once per product card", () => {
  assert.equal(statements("US").length, productsFor("US").length);
  assert.equal(statements("US").length, 3);
});

test("GB home page carries the Amazon sentence once per product card", () => {
  assert.equal(statements("GB").length, productsFor("GB").length);
  assert.equal(statements("GB").length, 3);
});

test("every card statement is exactly the Associate sentence", () => {
  for (const region of ["US", "GB"] as const) {
    for (const s of statements(region)) {
      assert.equal(s.props.children, "As an Amazon Associate I earn from qualifying purchases.");
    }
  }
});
