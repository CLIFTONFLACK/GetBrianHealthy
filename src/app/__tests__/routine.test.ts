import test from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  KEEP_DAYS,
  STORAGE_KEY,
  allSteps,
  dateKey,
  emptyStored,
  isDayComplete,
  parseStored,
  pickOptions,
  planFor,
  prune,
  strengthDays,
  weekDays,
  type RoutineStep,
  type Stored,
} from "../routine.ts";
import { getProduct, getSupplement, goals, localizeGoal, localizeSupplement, products } from "../data.ts";

const US_IDS = ["walk", "creatine", "strength", "magnesium", "l-theanine", "winddown"];
const US_HABIT_IDS = ["walk", "strength", "winddown"];

// ---------------------------------------------------------------------------
// weekDays: Monday first, whatever weekday the reader is on, across month,
// year and time-zone edges
// ---------------------------------------------------------------------------

test("weekDays lists the seven days Monday to Sunday for a Wednesday", () => {
  const week = weekDays(new Date(2026, 9, 14, 12));
  assert.deepEqual(week.map((d) => d.key), [
    "2026-10-12",
    "2026-10-13",
    "2026-10-14",
    "2026-10-15",
    "2026-10-16",
    "2026-10-17",
    "2026-10-18",
  ]);
});

test("weekDays labels the days Mon to Sun", () => {
  const week = weekDays(new Date(2026, 9, 14, 12));
  assert.deepEqual(week.map((d) => d.label), ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]);
});

test("weekDays puts a Sunday in the week that began six days earlier, not the next Monday", () => {
  const week = weekDays(new Date(2026, 9, 18, 9));
  assert.equal(week[0].key, "2026-10-12");
  assert.equal(week[6].key, "2026-10-18");
});

test("weekDays starts on the same day when today is a Monday", () => {
  const week = weekDays(new Date(2026, 9, 12, 0, 1));
  assert.equal(week[0].key, "2026-10-12");
  assert.equal(week[6].key, "2026-10-18");
});

test("weekDays crosses a month boundary when the week spans two months", () => {
  const week = weekDays(new Date(2026, 8, 30, 12));
  assert.deepEqual(week.map((d) => d.key), [
    "2026-09-28",
    "2026-09-29",
    "2026-09-30",
    "2026-10-01",
    "2026-10-02",
    "2026-10-03",
    "2026-10-04",
  ]);
});

test("weekDays crosses a year boundary when the week spans New Year", () => {
  const week = weekDays(new Date(2026, 11, 31, 12));
  assert.deepEqual(week.map((d) => d.key), [
    "2026-12-28",
    "2026-12-29",
    "2026-12-30",
    "2026-12-31",
    "2027-01-01",
    "2027-01-02",
    "2027-01-03",
  ]);
});

test("weekDays returns each day as local midnight", () => {
  const week = weekDays(new Date(2026, 9, 14, 15, 45));
  assert.equal(week[0].date.getTime(), new Date(2026, 9, 12).getTime());
});

test("weekDays keeps the local Monday in a zone far east of UTC", () => {
  const saved = process.env.TZ;
  process.env.TZ = "Pacific/Kiritimati";
  try {
    // Fixture assumption: the zone took effect, so a UTC-based implementation would fail here.
    assert.equal(new Date(2026, 9, 12, 0, 30).getTimezoneOffset(), -840);
    const week = weekDays(new Date(2026, 9, 12, 0, 30));
    assert.equal(week[0].key, "2026-10-12");
    assert.equal(week[6].key, "2026-10-18");
  } finally {
    if (saved === undefined) delete process.env.TZ;
    else process.env.TZ = saved;
  }
});

// ---------------------------------------------------------------------------
// dateKey: the reader's local calendar day, never UTC
// ---------------------------------------------------------------------------

test("dateKey gives the local day for a time late in the evening", () => {
  assert.equal(dateKey(new Date(2026, 9, 14, 23, 59)), "2026-10-14");
});

test("dateKey gives the local day just after midnight", () => {
  assert.equal(dateKey(new Date(2026, 9, 14, 0, 1)), "2026-10-14");
});

test("dateKey zero-pads a single-digit month and day", () => {
  assert.equal(dateKey(new Date(2026, 0, 5, 12)), "2026-01-05");
});

test("dateKey gives the local day in a zone far west of UTC, where UTC would be the next day", () => {
  const saved = process.env.TZ;
  process.env.TZ = "America/Los_Angeles";
  try {
    // Fixture assumption: 23:59 Pacific is 06:59 UTC the next day, so UTC arithmetic would say the 15th.
    assert.equal(new Date(2026, 9, 14, 23, 59).getTimezoneOffset(), 420);
    assert.equal(dateKey(new Date(2026, 9, 14, 23, 59)), "2026-10-14");
  } finally {
    if (saved === undefined) delete process.env.TZ;
    else process.env.TZ = saved;
  }
});

// ---------------------------------------------------------------------------
// parseStored: never throws, keeps only well-formed values
// ---------------------------------------------------------------------------

test("parseStored returns an empty store for null", () => {
  assert.deepEqual(parseStored(null), emptyStored());
});

test("parseStored returns an empty store for undefined", () => {
  assert.deepEqual(parseStored(undefined), emptyStored());
});

test("parseStored returns an empty store for an empty string", () => {
  assert.deepEqual(parseStored(""), emptyStored());
});

test("parseStored returns an empty store for malformed JSON", () => {
  assert.deepEqual(parseStored("{"), emptyStored());
});

test("parseStored returns an empty store for a JSON array", () => {
  assert.deepEqual(parseStored('[{"chosen":["creatine"]}]'), emptyStored());
});

test("parseStored returns an empty store for the JSON literal null", () => {
  assert.deepEqual(parseStored("null"), emptyStored());
});

test("parseStored returns an empty store for a bare number", () => {
  assert.deepEqual(parseStored("42"), emptyStored());
});

test("parseStored returns an empty store for a bare JSON string", () => {
  assert.deepEqual(parseStored('"creatine"'), emptyStored());
});

test("parseStored returns an empty store for text that is not JSON at all, emoji included", () => {
  assert.deepEqual(parseStored("🥦🥦 not json"), emptyStored());
});

test("parseStored returns an empty store for a very long non-JSON string", () => {
  assert.deepEqual(parseStored("x".repeat(1_000_000)), emptyStored());
});

test("parseStored ignores a __proto__ key and does not pollute Object.prototype", () => {
  const parsed = parseStored('{"__proto__":{"polluted":true}}');
  assert.deepEqual(parsed, emptyStored());
  assert.equal(({} as Record<string, unknown>).polluted, undefined);
});

test("parseStored ignores a chosen field that is not an array", () => {
  assert.deepEqual(parseStored('{"chosen":"creatine"}').chosen, []);
});

test("parseStored ignores a done field that is an array rather than an object", () => {
  assert.deepEqual(parseStored('{"done":[["2026-10-14",["walk"]]]}').done, {});
});

test("parseStored ignores a done entry whose value is a string rather than an array", () => {
  assert.deepEqual(parseStored('{"done":{"2026-10-14":"walk"}}').done, {});
});

test("parseStored ignores a complete field that is a string rather than an array", () => {
  assert.deepEqual(parseStored('{"complete":"2026-10-14"}').complete, []);
});

test("parseStored keeps only string dates in complete", () => {
  assert.deepEqual(parseStored('{"complete":[1,null,"2026-10-14",{"d":1}]}').complete, ["2026-10-14"]);
});

test("parseStored drops supplement ids it does not know, and step ids are not supplement ids", () => {
  assert.deepEqual(parseStored('{"chosen":["creatine","vitamin-d","walk","CREATINE"]}').chosen, ["creatine"]);
});

test("parseStored drops step ids it does not know from done", () => {
  const parsed = parseStored('{"done":{"2026-10-14":["walk","vitamin-d","CREATINE"]}}');
  assert.deepEqual(parsed.done, { "2026-10-14": ["walk"] });
});

test("parseStored drops done keys that are not YYYY-MM-DD", () => {
  const parsed = parseStored('{"done":{"yesterday":["walk"],"2026/10/14":["walk"],"2026-10-14":["walk"]}}');
  assert.deepEqual(parsed.done, { "2026-10-14": ["walk"] });
});

test("parseStored drops date keys that are well-formed but not real calendar days", () => {
  // BUG: routine.ts DATE_RE (line 233) checks only the shape, so month 13 and February 31 survive.
  const parsed = parseStored('{"done":{"2026-13-45":["walk"]},"complete":["2026-02-31"]}');
  assert.deepEqual(parsed.done, {});
  assert.deepEqual(parsed.complete, []);
});

test("parseStored removes duplicate supplement ids from chosen", () => {
  assert.deepEqual(parseStored('{"chosen":["creatine","creatine"]}').chosen, ["creatine"]);
});

test("parseStored removes duplicate step ids from a day's ticks", () => {
  assert.deepEqual(parseStored('{"done":{"2026-10-14":["walk","walk"]}}').done, { "2026-10-14": ["walk"] });
});

test("parseStored returns well-formed data unchanged", () => {
  const stored: Stored = {
    chosen: ["creatine", "magnesium"],
    done: { "2026-10-14": ["walk", "winddown"] },
    complete: ["2026-10-14"],
  };
  assert.deepEqual(parseStored(JSON.stringify(stored)), stored);
});

// ---------------------------------------------------------------------------
// prune: KEEP_DAYS back from today, boundary day kept
// ---------------------------------------------------------------------------

test("prune keeps the boundary day exactly KEEP_DAYS back", () => {
  const stored: Stored = { chosen: [], done: { "2026-09-23": ["walk"] }, complete: [] };
  assert.deepEqual(prune(stored, new Date(2026, 9, 14, 12)).done, { "2026-09-23": ["walk"] });
});

test("prune drops the day one before the boundary", () => {
  const stored: Stored = { chosen: [], done: { "2026-09-22": ["walk"] }, complete: [] };
  assert.deepEqual(prune(stored, new Date(2026, 9, 14, 12)).done, {});
});

test("prune keeps today and days after it", () => {
  const stored: Stored = { chosen: [], done: { "2026-10-14": ["walk"], "2026-10-15": ["walk"] }, complete: [] };
  assert.deepEqual(prune(stored, new Date(2026, 9, 14, 12)).done, { "2026-10-14": ["walk"], "2026-10-15": ["walk"] });
});

test("prune drops old complete days and keeps the boundary and newer ones", () => {
  const stored: Stored = { chosen: [], done: {}, complete: ["2026-09-22", "2026-09-23", "2026-10-14"] };
  assert.deepEqual(prune(stored, new Date(2026, 9, 14, 12)).complete, ["2026-09-23", "2026-10-14"]);
});

test("prune computes the cutoff across a year boundary", () => {
  const stored: Stored = { chosen: [], done: { "2025-12-14": ["walk"], "2025-12-15": ["walk"] }, complete: [] };
  assert.deepEqual(prune(stored, new Date(2026, 0, 5, 12)).done, { "2025-12-15": ["walk"] });
});

test("prune keeps the chosen picks however old the ticks are", () => {
  const stored: Stored = { chosen: ["creatine"], done: {}, complete: [] };
  assert.deepEqual(prune(stored, new Date(2026, 9, 14, 12)).chosen, ["creatine"]);
});

test("prune does not mutate the store it is given", () => {
  const stored: Stored = { chosen: ["creatine"], done: { "2026-09-01": ["walk"] }, complete: ["2026-09-01"] };
  const snapshot = structuredClone(stored);
  prune(stored, new Date(2026, 9, 14, 12));
  assert.deepEqual(stored, snapshot);
});

test("KEEP_DAYS is 21, the window the boundary tests above rely on", () => {
  assert.equal(KEEP_DAYS, 21);
});

test("STORAGE_KEY is the versioned key the saved day lives under", () => {
  assert.equal(STORAGE_KEY, "hl-routine-v1");
});

// ---------------------------------------------------------------------------
// isDayComplete
// ---------------------------------------------------------------------------

test("isDayComplete is false for an empty plan", () => {
  assert.equal(isDayComplete([], ["walk"]), false);
});

test("isDayComplete is false for a plan with only non-daily steps, even when they are ticked", () => {
  const plan = allSteps("US").filter((s) => s.id === "strength");
  assert.equal(isDayComplete(plan, ["strength"]), false);
});

test("isDayComplete is false while a daily step is still unticked", () => {
  assert.equal(isDayComplete(planFor(allSteps("US"), []), ["walk"]), false);
});

test("isDayComplete is true once every daily step is ticked", () => {
  assert.equal(isDayComplete(planFor(allSteps("US"), []), ["walk", "winddown"]), true);
});

test("isDayComplete does not require the strength session", () => {
  assert.equal(isDayComplete(planFor(allSteps("US"), []), ["walk", "winddown"]), true);
});

test("isDayComplete counts a chosen supplement as a daily step", () => {
  const plan = planFor(allSteps("US"), ["magnesium"]);
  assert.equal(isDayComplete(plan, ["walk", "winddown"]), false);
  assert.equal(isDayComplete(plan, ["walk", "winddown", "magnesium"]), true);
});

test("isDayComplete ignores ticks for steps that are not in the plan", () => {
  assert.equal(isDayComplete(planFor(allSteps("US"), []), ["walk", "winddown", "creatine"]), true);
});

// ---------------------------------------------------------------------------
// strengthDays
// ---------------------------------------------------------------------------

test("strengthDays counts only this week's days with the strength session ticked", () => {
  const week = weekDays(new Date(2026, 9, 14, 12));
  const stored: Stored = {
    chosen: [],
    done: {
      "2026-10-12": ["strength"],
      "2026-10-13": ["walk"],
      "2026-10-14": ["walk", "strength"],
      "2026-10-15": ["walk"],
      "2026-10-19": ["strength"],
    },
    complete: [],
  };
  assert.equal(strengthDays(stored, week), 2);
});

test("strengthDays is zero when nothing is ticked", () => {
  assert.equal(strengthDays(emptyStored(), weekDays(new Date(2026, 9, 14, 12))), 0);
});

// ---------------------------------------------------------------------------
// emptyStored: a fresh object, so edits never leak into the next caller
// ---------------------------------------------------------------------------

test("emptyStored has no picks, no ticks and no complete days", () => {
  assert.deepEqual(emptyStored(), { chosen: [], done: {}, complete: [] });
});

test("emptyStored returns a new object each call, so an edit does not leak into the next", () => {
  const first = emptyStored();
  first.chosen.push("creatine");
  first.done["2026-10-14"] = ["walk"];
  first.complete.push("2026-10-14");
  assert.deepEqual(emptyStored(), { chosen: [], done: {}, complete: [] });
});

// ---------------------------------------------------------------------------
// allSteps: the day for each region
// ---------------------------------------------------------------------------

test("allSteps for the US lists the three habits and three picks in time order", () => {
  assert.deepEqual(allSteps("US").map((s) => s.id), US_IDS);
});

test("allSteps for the US gives each step a 12-hour time", () => {
  assert.deepEqual(allSteps("US").map((s) => s.time), ["7:30 am", "8:00 am", "5:30 pm", "7:00 pm", "9:00 pm", "9:30 pm"]);
});

test("allSteps for the US sorts by minutes after midnight", () => {
  assert.deepEqual(allSteps("US").map((s) => s.minutes), [450, 480, 1050, 1140, 1260, 1290]);
});

test("allSteps for the GB lists the same six steps in the same order", () => {
  assert.deepEqual(allSteps("GB").map((s) => s.id), US_IDS);
});

test("allSteps for the GB sorts by minutes after midnight", () => {
  assert.deepEqual(allSteps("GB").map((s) => s.minutes), [450, 480, 1050, 1140, 1260, 1290]);
});

test("allSteps for the US links each supplement step to its own product page", () => {
  const hrefs = allSteps("US").flatMap((s) => (s.product ? [s.product.href] : []));
  assert.deepEqual(hrefs, [
    "/products/pure-encapsulations-creatine",
    "/products/pure-encapsulations-magnesium-glycinate",
    "/products/pure-encapsulations-l-theanine",
  ]);
});

test("allSteps for the GB links creatine to the GB pick, not the US one", () => {
  const hrefs = allSteps("GB").flatMap((s) => (s.product ? [s.product.href] : []));
  assert.deepEqual(hrefs, [
    "/products/thorne-creatine",
    "/products/pure-encapsulations-magnesium-glycinate",
    "/products/pure-encapsulations-l-theanine",
  ]);
});

test("every supplement step links to a product that exists in the data", () => {
  const slugs = [...allSteps("US"), ...allSteps("GB")].flatMap((s) =>
    s.product ? [s.product.href.replace("/products/", "")] : [],
  );
  assert.ok(slugs.length >= 6, "fixture assumption: both regions name their supplement picks");
  assert.deepEqual(
    slugs.filter((slug) => getProduct(slug) === undefined),
    [],
  );
});

test("habit steps carry no product and no why", () => {
  const habits = allSteps("US").filter((s) => s.kind === "habit");
  assert.deepEqual(habits.map((s) => s.id), US_HABIT_IDS);
  assert.ok(habits.every((s) => s.product === undefined && s.why === undefined));
});

test("supplement steps carry the supplement's own contribution line as their why, for the US", () => {
  const whys = allSteps("US")
    .filter((s) => s.kind === "supplement")
    .map((s) => s.why);
  assert.deepEqual(whys, [
    localizeSupplement(getSupplement("creatine"), "US").contribution,
    localizeSupplement(getSupplement("magnesium"), "US").contribution,
    localizeSupplement(getSupplement("l-theanine"), "US").contribution,
  ]);
});

test("supplement steps carry the GB contribution line as their why, for the GB", () => {
  const whys = allSteps("GB")
    .filter((s) => s.kind === "supplement")
    .map((s) => s.why);
  assert.deepEqual(whys, [
    localizeSupplement(getSupplement("creatine"), "GB").contribution,
    localizeSupplement(getSupplement("magnesium"), "GB").contribution,
    localizeSupplement(getSupplement("l-theanine"), "GB").contribution,
  ]);
});

test("GB l-theanine why is the GB line, not the US line that claims relaxation", () => {
  const gbTheanine = allSteps("GB").find((s) => s.id === "l-theanine");
  assert.match(gbTheanine?.why ?? "", /^L-theanine is an amino acid found naturally in tea\./);
  assert.doesNotMatch(gbTheanine?.why ?? "", /relaxation|stress/);
});

test("GB l-theanine title is the GB wording, which only says when it sits in the day", () => {
  const gbTheanine = allSteps("GB").find((s) => s.id === "l-theanine");
  assert.equal(gbTheanine?.title, "L-theanine in the evening");
});

test("GB l-theanine title and detail make no relax, calm, stress, sleep or wind-down claim", () => {
  const gbTheanine = allSteps("GB").find((s) => s.id === "l-theanine");
  assert.doesNotMatch(`${gbTheanine?.title} ${gbTheanine?.detail}`, /relax|calm|stress|sleep|wind-down/i);
});

test("US l-theanine keeps its wind-down wording, so the GB copy is a real regional switch", () => {
  const usTheanine = allSteps("US").find((s) => s.id === "l-theanine");
  assert.equal(usTheanine?.title, "L-theanine to start your wind-down");
});

test("allSteps leaves a supplement out of a region that has no pick for it, and keeps it in the other", () => {
  const index = products.findIndex((p) => p.slug === "thorne-creatine");
  assert.ok(index >= 0, "fixture assumption: the GB creatine pick exists");
  const [removed] = products.splice(index, 1);
  try {
    assert.deepEqual(allSteps("GB").map((s) => s.id), ["walk", "strength", "magnesium", "l-theanine", "winddown"]);
    assert.ok(allSteps("US").some((s) => s.id === "creatine"));
  } finally {
    products.splice(index, 0, removed);
  }
});

// ---------------------------------------------------------------------------
// planFor: habits always, a supplement only when chosen
// ---------------------------------------------------------------------------

test("planFor keeps the three habits and no supplement when no pick is chosen", () => {
  assert.deepEqual(planFor(allSteps("US"), []).map((s) => s.id), US_HABIT_IDS);
});

test("planFor adds a supplement step only when that pick was chosen", () => {
  assert.deepEqual(planFor(allSteps("US"), ["magnesium"]).map((s) => s.id), ["walk", "strength", "magnesium", "winddown"]);
});

test("planFor adds every chosen pick, still in time order", () => {
  assert.deepEqual(planFor(allSteps("US"), ["l-theanine", "creatine"]).map((s) => s.id), [
    "walk",
    "creatine",
    "strength",
    "l-theanine",
    "winddown",
  ]);
});

test("planFor returns an empty plan when given no steps", () => {
  assert.deepEqual(planFor([], ["creatine"]), []);
});

test("planFor does not change the steps it is given", () => {
  const steps: RoutineStep[] = allSteps("US");
  const before = steps.map((s) => s.id);
  planFor(steps, []);
  assert.deepEqual(steps.map((s) => s.id), before);
});

// ---------------------------------------------------------------------------
// pickOptions: one chip per supplement sold in the region, labelled as the home page labels it
// ---------------------------------------------------------------------------

test("pickOptions for the US offers Strength, Energy and Calm, in picker order", () => {
  assert.deepEqual(pickOptions("US"), [
    { id: "creatine", supplement: "Creatine", goal: "Strength" },
    { id: "magnesium", supplement: "Magnesium", goal: "Energy" },
    { id: "l-theanine", supplement: "L-theanine", goal: "Calm" },
  ]);
});

test("pickOptions for the GB offers Exercise, Energy and Evening, in picker order", () => {
  assert.deepEqual(pickOptions("GB"), [
    { id: "creatine", supplement: "Creatine", goal: "Exercise" },
    { id: "magnesium", supplement: "Magnesium", goal: "Energy" },
    { id: "l-theanine", supplement: "L-theanine", goal: "Evening" },
  ]);
});

test("pickOptions labels match the goal tiles the home page shows for each region", () => {
  const strength = goals.find((g) => g.id === "strength");
  const calm = goals.find((g) => g.id === "calm");
  assert.ok(strength && calm, "fixture assumption: the strength and calm goals exist");
  assert.equal(pickOptions("GB")[0].goal, localizeGoal(strength, "GB").label);
  assert.equal(pickOptions("GB")[2].goal, localizeGoal(calm, "GB").label);
  assert.equal(pickOptions("US")[2].goal, localizeGoal(calm, "US").label);
});

test("pickOptions falls back to the supplement's role when no tile goal serves the pick", () => {
  const index = goals.findIndex((g) => g.id === "calm");
  assert.ok(index >= 0, "fixture assumption: the calm goal exists");
  const [removed] = goals.splice(index, 1);
  try {
    assert.equal(pickOptions("US")[2].goal, getSupplement("l-theanine").role);
  } finally {
    goals.splice(index, 0, removed);
  }
});

test("pickOptions leaves out a supplement with no pick in the region", () => {
  const index = products.findIndex((p) => p.slug === "thorne-creatine");
  assert.ok(index >= 0, "fixture assumption: the GB creatine pick exists");
  const [removed] = products.splice(index, 1);
  try {
    assert.deepEqual(pickOptions("GB").map((o) => o.id), ["magnesium", "l-theanine"]);
  } finally {
    products.splice(index, 0, removed);
  }
});

// ---------------------------------------------------------------------------
// Claims guard: the routine's own copy, both regions
// ---------------------------------------------------------------------------

const BANNED_CLAIM_WORDS = ["cure", "treat", "prevent", "reverse", "boost", "clinically proven"];

function claimWordIn(text: string): string | undefined {
  const lower = text.toLowerCase();
  return BANNED_CLAIM_WORDS.find((word) => lower.includes(word));
}

function stepCopy(steps: RoutineStep[]): string {
  return steps.map((s) => [s.title, s.detail, s.why ?? ""].join(" ")).join(" \n ");
}

test("the claims guard flags a banned word, so the copy checks below can fail", () => {
  assert.equal(claimWordIn("Helps you boost energy"), "boost");
  assert.equal(claimWordIn("Clinically proven results"), "clinically proven");
});

test("the claims guard reads the routine's copy, not an empty string", () => {
  assert.match(stepCopy(allSteps("US")), /Strength session/);
  assert.match(stepCopy(allSteps("GB")), /Creatine with breakfast/);
});

test("the US routine copy contains none of the banned claim words", () => {
  assert.equal(claimWordIn(stepCopy(allSteps("US"))), undefined);
});

test("the GB routine copy contains none of the banned claim words", () => {
  assert.equal(claimWordIn(stepCopy(allSteps("GB"))), undefined);
});

// ---------------------------------------------------------------------------
// Assets: every clip, poster and product image the day names exists under public/
// ---------------------------------------------------------------------------

const publicDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../public");

test("every clip, poster and product image the day names exists under public/", () => {
  const files = [...allSteps("US"), ...allSteps("GB")].flatMap((s) => [
    ...(s.clip ? [s.clip.src, s.clip.poster] : []),
    ...(s.product?.image ? [s.product.image] : []),
  ]);
  assert.ok(files.length >= 10, "fixture assumption: the day names clips and product images");
  assert.deepEqual(
    files.filter((f) => !existsSync(path.join(publicDir, f))),
    [],
  );
});
