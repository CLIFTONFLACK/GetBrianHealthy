import test from "node:test";
import assert from "node:assert/strict";
import { mock } from "node:test";
import * as realData from "../data.ts";
import type { Product } from "../data.ts";

/**
 * Real `goals` happens to list creatine's uncaveated "strength" before its
 * caveated "focus", so a lead-selection bug that just took `jobGoals[0]`
 * instead of "the first goal without a caveat" would still pick the right
 * one by coincidence and no test against the real data would catch it. This
 * file mocks `../data.ts` (via node:test's --experimental-test-module-mocks,
 * already on in the "test" script, same pattern as why-these-picks/page.test)
 * with the caveated goal listed *first*, so the two selection strategies
 * disagree and the assertion actually exercises the caveat check.
 *
 * JobRail must be imported dynamically, after the mock is installed: this
 * file (deliberately) has no top-level static import of job-rail.tsx, since
 * that would bind it to the real ../data.ts before test.before() runs.
 */
type AnyEl = { type: unknown; props: Record<string, unknown> };

let JobRail: (props: { products: Product[] }) => AnyEl;

test.before(async () => {
  // Every other export (products, supplementFor, etc.) stays real — job-rail
  // pulls those in transitively via ProductCard — only `goals`' order for
  // creatine is swapped, so focus (caveated) now precedes strength.
  const focus = realData.goals.find((g) => g.id === "focus")!;
  const strength = realData.goals.find((g) => g.id === "strength")!;
  const reordered = realData.goals.map((g) => (g.id === "focus" ? strength : g.id === "strength" ? focus : g));
  assert.equal(reordered[1].id, "focus", "fixture: focus now sits where strength used to");
  assert.equal(reordered[2].id, "strength", "fixture: strength now sits where focus used to");

  mock.module(new URL("../data.ts", import.meta.url), {
    // job-rail reads goals through goalsForSupplement, which closes over the
    // real list, so it is rebuilt here over the reordered one.
    exports: {
      ...realData,
      goals: reordered,
      goalsForSupplement: (id: string, region: "US" | "GB") =>
        reordered
          .filter((g) => g.supplement === id && !(region === "GB" && g.id === "focus"))
          .map((g) => realData.localizeGoal(g, region)),
    },
  });
  ({ JobRail } = await import("../job-rail.tsx"));
});

function baseProduct(): Product {
  return {
    slug: "p-creatine",
    name: "Fixture Creatine",
    brand: "Fixture Brand",
    category: "Creatine",
    format: "Powder",
    image: null,
    imageAlt: "",
    summary: "",
    verdict: "",
    bestFor: [],
    notFor: [],
    servingSize: null,
    servingsPerContainer: null,
    ingredients: [],
    priceUsd: null,
    priceCheckedAt: null,
    testing: [],
    evidence: [],
    safety: [],
    pros: [],
    cons: [],
    advantage: "",
    brandUrl: "https://brand.example.com",
    affiliateUrl: null,
    redirectAllowed: false,
    lastReviewed: null,
    verified: false,
  };
}

test("lead goal is the first without a caveat, even when the caveated goal is listed first", () => {
  const el = JobRail({ products: [baseProduct()] });

  const railDiv = (el.props as { children: AnyEl }).children;
  const [, ul] = (railDiv.props as { children: AnyEl[] }).children;
  const [li] = (ul.props as { children: AnyEl[] | AnyEl }).children as AnyEl[];
  const [nodeDiv] = (li.props as { children: AnyEl[] }).children;
  const [, fragment] = (nodeDiv.props as { children: [AnyEl, AnyEl] }).children;
  const [headingSpan, , caveatSpan] = (fragment.props as { children: [AnyEl, AnyEl, AnyEl | undefined] }).children;

  assert.equal((headingSpan.props as { children: string }).children, "Strength");
  // Strength has no caveat, so no line beneath the name; picking focus
  // (jobGoals[0]) instead would render its caveat here.
  assert.ok(!caveatSpan, "expected no caveat line under an uncaveated lead");
});
