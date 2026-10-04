import test from "node:test";
import assert from "node:assert/strict";
import { mock } from "node:test";
import * as realData from "../data.ts";
import type { Product } from "../data.ts";

/**
 * `lead = jobGoals.find((g) => !g.caveat) ?? jobGoals[0]` only falls back to
 * jobGoals[0] (a caveated goal) once *every* goal of a supplement carries a
 * caveat -- never true in today's data, where strength is creatine's clean
 * lead. This file mocks `../data.ts` (own process, own module cache, same
 * pattern as job-rail-lead-order.test.tsx) to give strength a caveat too, so
 * both of creatine's goals are caveated and the lead-caveat line is reached.
 *
 * JobRail is imported dynamically, after the mock is installed, for the same
 * reason as job-rail-lead-order.test.tsx: a static import would bind it to
 * the real ../data.ts before test.before() runs.
 */
type AnyEl = { type: unknown; props: Record<string, unknown> };

let JobRail: (props: { products: Product[] }) => AnyEl;

test.before(async () => {
  const strength = realData.goals.find((g) => g.id === "strength")!;
  const caveatedStrength = { ...strength, caveat: "results vary by starting fitness level" };
  const reordered = realData.goals.map((g) => (g.id === "strength" ? caveatedStrength : g));
  assert.equal(reordered[1].caveat, "results vary by starting fitness level", "fixture: strength now caveated");

  mock.module(new URL("../data.ts", import.meta.url), {
    // job-rail reads goals through goalsForSupplement, which closes over the
    // real list, so it is rebuilt here over the modified one.
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

test("when every goal of a supplement is caveated, the lead still renders its own caveat", () => {
  const el = JobRail({ products: [baseProduct()] });

  const railDiv = (el.props as { children: AnyEl }).children;
  const [, ul] = (railDiv.props as { children: AnyEl[] }).children;
  const [li] = (ul.props as { children: AnyEl[] | AnyEl }).children as AnyEl[];
  const [nodeDiv] = (li.props as { children: AnyEl[] }).children;
  const [, fragment] = (nodeDiv.props as { children: [AnyEl, AnyEl] }).children;
  const [headingSpan, , caveatSpan] = (fragment.props as { children: [AnyEl, AnyEl, AnyEl] }).children;

  // jobGoals.find(!caveat) now finds nothing, so lead falls back to
  // jobGoals[0] -- strength, first in goals' own order -- and its own caveat
  // must still render beneath the name. Focus gets no line of its own.
  assert.equal((headingSpan.props as { children: string }).children, "Strength");
  assert.ok(caveatSpan, "expected the lead's caveat line");
  assert.equal((caveatSpan.props as { children: string }).children, "results vary by starting fitness level");
});
