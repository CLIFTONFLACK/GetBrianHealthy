/**
 * The one-page routine (/routine): which steps make up a day, in what order,
 * and the small amount of date and storage logic the tracker needs.
 *
 * Pure functions only, so the page's server half and its client half share one
 * definition and the tests can run it without a browser.
 *
 * Wording rules, same as data.ts: the "why" of a supplement step is always
 * that supplement's own `contribution` line (region-localised), never new
 * copy, so the routine cannot say more than the review pages do. Timing is
 * Brian's suggestion for fitting a pick into a day, not a dosing instruction:
 * the amount is always the label's serving.
 */

import { getSupplement, goals, localizeGoal, localizeSupplement, pickFor, type Supplement } from "./data";
import type { Region } from "./region";

export type SupplementId = Supplement["id"];

export type StepId = "walk" | "creatine" | "strength" | "magnesium" | "l-theanine" | "winddown";

export type RoutineStep = {
  id: StepId;
  /** "habit" steps are always in the day; "supplement" steps are added when the reader chooses that pick. */
  kind: "habit" | "supplement";
  supplement?: SupplementId;
  /** Minutes after midnight. Orders the day. */
  minutes: number;
  /** "7:30 am" */
  time: string;
  /** Part of the day, for the day bar. */
  part: "Morning" | "Afternoon" | "Evening" | "Night";
  title: string;
  detail: string;
  /** Supplement steps: the review's own one-line description of the ingredient. */
  why?: string;
  /** Supplement steps: the product and its label serving. */
  product?: { name: string; brand: string; serving: string | null; image: string | null; imageAlt: string; href: string };
  /** Clip for the card, or null for a packshot instead. Under /public. */
  clip: { src: string; poster: string; label: string } | null;
  /** False for a step that is not meant for every day (strength). It is left out of "day complete". */
  daily: boolean;
  icon: "zap" | "dumbbell" | "moon" | "target" | "book";
};

export const WHO_ACTIVITY_URL = "https://www.who.int/publications/i/item/9789240015128";

const CLIP = (name: string, label: string) => ({
  src: `/healthy/video/routine-${name}.mp4`,
  poster: `/healthy/video/routine-${name}-poster.webp`,
  label,
});

const fmt = (minutes: number): string => {
  const h24 = Math.floor(minutes / 60);
  const m = minutes % 60;
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${h24 < 12 ? "am" : "pm"}`;
};

type Base = Omit<RoutineStep, "time" | "product" | "why">;

const HABITS: Base[] = [
  {
    id: "walk",
    kind: "habit",
    minutes: 7 * 60 + 30,
    part: "Morning",
    title: "Walk, outside if you can",
    detail:
      "About 30 minutes, most days. The WHO recommends at least 150 minutes of moderate activity a week for adults.",
    clip: CLIP("walk", "Two people climbing steps on a morning walk"),
    daily: true,
    icon: "zap",
  },
  {
    id: "strength",
    kind: "habit",
    minutes: 17 * 60 + 30,
    part: "Afternoon",
    title: "Strength session",
    detail:
      "Two or more days a week, working the big muscle groups. Tick it on the days you do it: it is not a daily step.",
    clip: CLIP("strength", "A man lifting a kettlebell in a gym"),
    daily: false,
    icon: "dumbbell",
  },
  {
    id: "winddown",
    kind: "habit",
    minutes: 21 * 60 + 30,
    part: "Night",
    title: "Screens down, lights low",
    detail: "Put the phone away about 30 minutes before bed. A steady wind-down is a habit, not a supplement.",
    clip: CLIP("winddown", "A person reading by lamplight in the evening"),
    daily: true,
    icon: "moon",
  },
];

/** When each pick sits in the day, and the clip (if any) its card shows. */
const SUPPLEMENT_SLOTS: Record<SupplementId, { id: StepId; minutes: number; part: RoutineStep["part"]; title: string; detail: string; clip: RoutineStep["clip"]; icon: RoutineStep["icon"] }> = {
  creatine: {
    id: "creatine",
    minutes: 8 * 60,
    part: "Morning",
    title: "Creatine with breakfast",
    detail: "Tie it to something you already do every day, so it never gets skipped. The label's serving, mixed into a drink.",
    clip: CLIP("creatine", "A hand stirring a glass of water"),
    icon: "dumbbell",
  },
  magnesium: {
    id: "magnesium",
    minutes: 19 * 60,
    part: "Evening",
    title: "Magnesium with your evening meal",
    detail: "Many people take it with a meal. Follow the label's serving.",
    clip: CLIP("magnesium", "Hands holding a supplement bottle at a kitchen table"),
    icon: "zap",
  },
  "l-theanine": {
    id: "l-theanine",
    minutes: 21 * 60,
    part: "Night",
    title: "L-theanine to start your wind-down",
    detail: "Take it as you begin to wind down for the evening. Follow the label's serving.",
    clip: null,
    icon: "moon",
  },
};

/**
 * No health claim is authorised for L-theanine in Great Britain, and "wind-down" says what it is for,
 * so UK visitors get a title and line that only say when it sits in the day.
 */
const GB_SLOT_COPY: Partial<Record<SupplementId, Pick<RoutineStep, "title" | "detail" | "icon" | "part">>> = {
  "l-theanine": {
    title: "L-theanine in the evening",
    detail: "Take it in the evening. Follow the label's serving.",
    // The moon and "Night" would hint at the sleep claim that is not allowed here, as in data.ts.
    icon: "book",
    part: "Evening",
  },
};

export const SUPPLEMENT_IDS: SupplementId[] = ["creatine", "magnesium", "l-theanine"];

const isSupplementId = (v: unknown): v is SupplementId => typeof v === "string" && (SUPPLEMENT_IDS as string[]).includes(v);

/**
 * Every step the day can contain for a region, in time order. A supplement
 * with no pick sold in the region is left out, never shown without a product.
 */
export function allSteps(region: Region): RoutineStep[] {
  const steps: RoutineStep[] = HABITS.map((h) => ({ ...h, time: fmt(h.minutes) }));
  for (const id of SUPPLEMENT_IDS) {
    const supplement = localizeSupplement(getSupplement(id), region);
    const pick = supplement.category ? pickFor(supplement.category, region) : undefined;
    if (!pick) continue;
    const slot = SUPPLEMENT_SLOTS[id];
    steps.push({
      ...slot,
      ...(region === "GB" ? GB_SLOT_COPY[id] : undefined),
      kind: "supplement",
      supplement: id,
      time: fmt(slot.minutes),
      daily: true,
      why: supplement.contribution,
      product: {
        name: pick.name,
        brand: pick.brand,
        serving: pick.servingSize,
        image: pick.image,
        imageAlt: pick.imageAlt,
        href: `/products/${pick.slug}`,
      },
    });
  }
  return steps.sort((a, b) => a.minutes - b.minutes);
}

/** One chip in the "what do you want to work on" picker. */
export type PickOption = { id: SupplementId; supplement: string; goal: string };

/**
 * The picks a reader can add, labelled by the goal they serve in their region
 * ("Strength" in the US, "Exercise" in Great Britain), so the chips use the
 * same words as the goal tiles on the home page. A pick with no product in the
 * region is not offered.
 */
export function pickOptions(region: Region): PickOption[] {
  return SUPPLEMENT_IDS.flatMap((id) => {
    const supplement = localizeSupplement(getSupplement(id), region);
    if (!supplement.category || !pickFor(supplement.category, region)) return [];
    // The first tile goal for the supplement; Focus is creatine's caveated second angle and has no tile.
    const goal = goals.find((g) => g.supplement === id && g.showTile !== false);
    return [{ id, supplement: supplement.name, goal: goal ? localizeGoal(goal, region).label : supplement.role }];
  });
}

/** The day for the supplements a reader chose: habits always, plus those picks. */
export function planFor(steps: RoutineStep[], chosen: SupplementId[]): RoutineStep[] {
  return steps.filter((s) => s.kind === "habit" || (s.supplement !== undefined && chosen.includes(s.supplement)));
}

// ---------------------------------------------------------------------------
// Tracker: dates and storage
// ---------------------------------------------------------------------------

/** Local calendar date as YYYY-MM-DD (not UTC: the reader's day ends at their midnight). */
export function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** The seven days of the week containing `today`, Monday first. */
export function weekDays(today: Date): { key: string; label: string; date: Date }[] {
  const labels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const sinceMonday = (today.getDay() + 6) % 7;
  return labels.map((label, i) => {
    const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() - sinceMonday + i);
    return { key: dateKey(date), label, date };
  });
}

export type Stored = {
  /** The picks the reader added to their day. */
  chosen: SupplementId[];
  /** Steps ticked, by date. */
  done: Record<string, StepId[]>;
  /** Dates on which every daily step in the day's plan was ticked. */
  complete: string[];
};

export const STORAGE_KEY = "hl-routine-v1";
/** Older days are dropped on save so the stored object stays small. */
export const KEEP_DAYS = 21;

const STEP_IDS: StepId[] = ["walk", "creatine", "strength", "magnesium", "l-theanine", "winddown"];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** A well-formed key that is also a real calendar day: "2026-02-31" is not. */
function isDateKey(value: string): boolean {
  if (!DATE_RE.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d;
}

export const emptyStored = (): Stored => ({ chosen: [], done: {}, complete: [] });

/** Reads what the browser saved, keeping only values that are well-formed. Anything else is dropped. */
export function parseStored(raw: string | null | undefined): Stored {
  if (!raw) return emptyStored();
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return emptyStored();
  }
  if (typeof data !== "object" || data === null) return emptyStored();
  const obj = data as Record<string, unknown>;
  const out = emptyStored();
  if (Array.isArray(obj.chosen)) out.chosen = [...new Set(obj.chosen.filter(isSupplementId))];
  if (typeof obj.done === "object" && obj.done !== null && !Array.isArray(obj.done)) {
    for (const [date, ids] of Object.entries(obj.done)) {
      if (!isDateKey(date) || !Array.isArray(ids)) continue;
      out.done[date] = [...new Set(ids.filter((i): i is StepId => STEP_IDS.includes(i as StepId)))];
    }
  }
  if (Array.isArray(obj.complete)) out.complete = [...new Set(obj.complete.filter((d): d is string => typeof d === "string" && isDateKey(d)))];
  return out;
}

/** Drops anything older than KEEP_DAYS before `today`. */
export function prune(stored: Stored, today: Date): Stored {
  const cutoff = dateKey(new Date(today.getFullYear(), today.getMonth(), today.getDate() - KEEP_DAYS));
  return {
    chosen: stored.chosen,
    done: Object.fromEntries(Object.entries(stored.done).filter(([d]) => d >= cutoff)),
    complete: stored.complete.filter((d) => d >= cutoff),
  };
}

/** True when every daily step in the plan is ticked. A plan with no daily steps is never complete. */
export function isDayComplete(plan: RoutineStep[], doneIds: StepId[]): boolean {
  const daily = plan.filter((s) => s.daily);
  return daily.length > 0 && daily.every((s) => doneIds.includes(s.id));
}

/** Days this week on which the strength session was ticked. */
export function strengthDays(stored: Stored, week: { key: string }[]): number {
  return week.filter((d) => stored.done[d.key]?.includes("strength")).length;
}
