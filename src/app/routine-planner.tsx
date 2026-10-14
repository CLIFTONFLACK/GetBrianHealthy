"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Icon } from "./icons";
import {
  STORAGE_KEY,
  dateKey,
  isDayComplete,
  parseStored,
  planFor,
  prune,
  strengthDays,
  weekDays,
  type PickOption,
  type RoutineStep,
  type Stored,
  type StepId,
  type SupplementId,
} from "./routine";
import "./routine.css";

/*
 * The interactive half of /routine. The server page hands over every step the
 * day can hold; this picks which are in the day, lights them as the reader
 * scrolls (or plays the day for them), keeps today's ticks and the week's
 * record in this browser only, and prints the same plan as a one-page sheet.
 *
 * Nothing leaves the browser: no account, no request, no analytics event.
 * localStorage can be absent or full (private windows, blocked storage), so
 * every read and write is wrapped and the page works the same without it.
 *
 * Motion is transform and opacity only, armed by JavaScript (`.rt-armed`) so
 * the server HTML is the finished page, and switched off under reduced motion.
 */

const MASCOT = "/healthy/brand/healthy-mascot.webp";
const STEP_MS = 2200;

/**
 * Where step `i` of `n` stands on the day bar, in percent. Steps are spaced evenly rather than by clock time:
 * two steps half an hour apart would sit on top of each other on a phone and could not be tapped.
 */
const pos = (i: number, n: number) => (n <= 1 ? 50 : 6 + (i / (n - 1)) * 88);

const prefersReducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/*
 * What the browser has saved, as a store React can subscribe to: the server
 * and the first client render both see "nothing saved", so they match, and the
 * saved day arrives right after hydration. `cached` holds the latest text so a
 * blocked or full localStorage still lets the page remember for this visit.
 */
let cached: string | null | undefined;
const listeners = new Set<() => void>();

function readRaw(): string | null {
  if (cached === undefined) {
    try {
      cached = window.localStorage.getItem(STORAGE_KEY);
    } catch {
      cached = null;
    }
  }
  return cached;
}

function writeRaw(value: string) {
  cached = value;
  try {
    window.localStorage.setItem(STORAGE_KEY, value);
  } catch {
    // Storage is blocked or full: the page still works, it just does not remember.
  }
  listeners.forEach((l) => l());
}

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY || e.key === null) {
      cached = undefined;
      onChange();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(onChange);
    // Nothing is watching for other tabs' writes any more, so the next read must go to storage.
    if (listeners.size === 0) cached = undefined;
    window.removeEventListener("storage", onStorage);
  };
}

/**
 * Re-reads "today" when the tab comes back into view and at the next local midnight, so a page left open
 * overnight does not keep showing yesterday's ticks as today's.
 */
function subscribeToday(onChange: () => void) {
  let timer = 0;
  const arm = () => {
    window.clearTimeout(timer);
    const now = new Date();
    const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime();
    timer = window.setTimeout(() => {
      onChange();
      arm();
    }, midnight - now.getTime() + 1000);
  };
  const refresh = () => {
    onChange();
    arm();
  };
  arm();
  document.addEventListener("visibilitychange", refresh);
  window.addEventListener("focus", refresh);
  window.addEventListener("pageshow", refresh);
  return () => {
    window.clearTimeout(timer);
    document.removeEventListener("visibilitychange", refresh);
    window.removeEventListener("focus", refresh);
    window.removeEventListener("pageshow", refresh);
  };
}

export function RoutinePlanner({
  steps,
  options,
  disclaimer,
}: {
  steps: RoutineStep[];
  options: PickOption[];
  disclaimer: string;
}) {
  const raw = useSyncExternalStore(subscribe, readRaw, () => null);
  const stored = useMemo(() => parseStored(raw), [raw]);
  // "" on the server and first render; the reader's local date after.
  const todayKey = useSyncExternalStore(subscribeToday, () => dateKey(new Date()), () => "");
  const today = useMemo(() => {
    if (!todayKey) return null;
    const [y, m, d] = todayKey.split("-").map(Number);
    return new Date(y, m - 1, d);
  }, [todayKey]);
  const [active, setActive] = useState<StepId | null>(null);
  const [playing, setPlaying] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const plan = useMemo(() => planFor(steps, stored.chosen), [steps, stored.chosen]);
  const doneToday = stored.done[todayKey] ?? [];
  const week = useMemo(() => (today ? weekDays(today) : []), [today]);
  const dayComplete = today !== null && isDayComplete(plan, doneToday);

  const update = useCallback(
    (fn: (s: Stored) => Stored) => {
      const next = fn(parseStored(readRaw()));
      writeRaw(JSON.stringify(today ? prune(next, today) : next));
    },
    [today],
  );

  function togglePick(id: SupplementId) {
    update((s) => {
      const chosen = s.chosen.includes(id) ? s.chosen.filter((c) => c !== id) : [...s.chosen, id];
      // Adding or removing a pick changes what "every daily step" means, so today's record is worked out again.
      const key = dateKey(new Date());
      const complete = isDayComplete(planFor(steps, chosen), s.done[key] ?? []);
      return { ...s, chosen, complete: complete ? [...new Set([...s.complete, key])] : s.complete.filter((d) => d !== key) };
    });
  }

  function toggleDone(id: StepId) {
    if (!todayKey) return;
    // The date at the click, not at the last render: a tab left open past midnight must tick the new day.
    const key = dateKey(new Date());
    update((s) => {
      const ids = s.done[key] ?? [];
      const nextIds = ids.includes(id) ? ids.filter((i) => i !== id) : [...ids, id];
      const complete = isDayComplete(planFor(steps, s.chosen), nextIds);
      return {
        ...s,
        done: { ...s.done, [key]: nextIds },
        complete: complete ? [...new Set([...s.complete, key])] : s.complete.filter((d) => d !== key),
      };
    });
  }

  function clearToday() {
    if (!todayKey) return;
    const key = dateKey(new Date());
    update((s) => ({
      ...s,
      done: { ...s.done, [key]: [] },
      complete: s.complete.filter((d) => d !== key),
    }));
  }

  // Ticks are by step id and only the plan's steps are drawn, so a tick for a pick taken out of the day is
  // harmless and comes back if the pick is added again.

  // Reveal each card once as it scrolls in, and track which one is in the middle of the screen.
  const playingRef = useRef(false);
  useEffect(() => {
    playingRef.current = playing;
  }, [playing]);
  const planKey = plan.map((s) => s.id).join(",");
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const cards = Array.from(root.querySelectorAll<HTMLElement>("[data-step-id]"));
    const reduced = prefersReducedMotion();
    if (!reduced) root.classList.add("rt-armed");
    const reveal = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add("is-in");
            reveal.unobserve(e.target);
          }
        }
      },
      { threshold: 0.15 },
    );
    // The step Brian stands at: the card in the middle band of the screen, or, when a jump has carried the
    // reader past every card, the last one that is now above it.
    const inBand = new Set<number>();
    const above = new Set<number>();
    const focus = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          const i = cards.indexOf(e.target as HTMLElement);
          inBand.delete(i);
          above.delete(i);
          if (e.isIntersecting) inBand.add(i);
          else if (e.boundingClientRect.top < window.innerHeight / 2) above.add(i);
        }
        if (playingRef.current) return;
        const pick = inBand.size ? Math.max(...inBand) : above.size ? Math.max(...above) : -1;
        if (pick >= 0) setActive(cards[pick].dataset.stepId as StepId);
      },
      { rootMargin: "-45% 0px -45% 0px" },
    );
    for (const c of cards) {
      if (!reduced) reveal.observe(c);
      focus.observe(c);
    }
    return () => {
      reveal.disconnect();
      focus.disconnect();
      root.classList.remove("rt-armed");
    };
  }, [planKey]);

  // "Play my day": step the marker through the plan, scrolling each card to the middle. The plan is read
  // through a ref: every saved tick makes a new plan array, and depending on it would restart the tour.
  const planIdsRef = useRef<StepId[]>([]);
  useEffect(() => {
    planIdsRef.current = plan.map((s) => s.id);
  }, [plan]);
  useEffect(() => {
    if (!playing) return;
    const ids = planIdsRef.current;
    let i = 0;
    const go = () => {
      const id = ids[i];
      setActive(id);
      document.getElementById(`step-${id}`)?.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "center" });
    };
    go();
    const timer = window.setInterval(() => {
      i += 1;
      if (i >= ids.length) {
        window.clearInterval(timer);
        setPlaying(false);
        return;
      }
      go();
    }, STEP_MS);
    return () => window.clearInterval(timer);
  }, [playing]);

  const activeStep = plan.find((s) => s.id === active) ?? plan[0];
  const weekComplete = week.filter((d) => stored.complete.includes(d.key)).length;
  const sessions = strengthDays(stored, week);
  const chosenCount = stored.chosen.length;

  return (
    <div ref={rootRef} data-routine-page className="rt-root">
      {/* PICKER */}
      <section aria-labelledby="rt-pick-heading" className="border-b border-slate-200 bg-slate-50 py-12 sm:py-16 print:hidden">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <span className="mb-1 block text-xs font-extrabold tracking-widest text-kinetic-primary-electric uppercase">Step 1</span>
          <h2 id="rt-pick-heading" className="font-kinetic-heading text-3xl font-extrabold tracking-tight text-slate-950 sm:text-4xl">
            What do you want to work on?
          </h2>
          <p className="mt-3 max-w-2xl text-base leading-relaxed text-slate-600">
            Your day already has a walk, a strength session and a wind-down. Add a pick only for a job you want done: one is enough for most
            people. Tap again to take it out.
          </p>
          <ul className="mt-6 flex flex-wrap gap-3" aria-label="Picks you can add to your day">
            {options.map((o) => {
              const on = stored.chosen.includes(o.id);
              return (
                <li key={o.id}>
                  <button
                    type="button"
                    aria-pressed={on}
                    onClick={() => togglePick(o.id)}
                    className={`rt-chip inline-flex min-h-12 cursor-pointer items-center gap-2 rounded-full border-2 px-5 py-2 text-left font-bold transition-colors duration-200 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-kinetic-primary-electric ${
                      on
                        ? "border-kinetic-primary bg-kinetic-primary text-white"
                        : "border-slate-300 bg-white text-slate-800 hover:border-kinetic-primary-electric hover:text-kinetic-primary-electric"
                    }`}
                  >
                    <span className={`flex h-6 w-6 items-center justify-center rounded-full ${on ? "bg-white text-kinetic-primary" : "bg-slate-100 text-transparent"}`}>
                      <Icon name="badgeCheck" size={16} />
                    </span>
                    <span>
                      {o.goal} <span className="font-medium opacity-80">· {o.supplement}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          <div role="status">
            {chosenCount > 1 && (
              <p className="mt-4 max-w-2xl rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm leading-relaxed text-slate-800">
                You have added {chosenCount} picks. Each does a different job, and taking more than one has not been shown to work better than one.
                Check with your doctor first, especially alongside medication.
              </p>
            )}
          </div>
        </div>
      </section>

      {/* THE DAY */}
      <section aria-labelledby="rt-day-heading" className="border-b border-slate-200 bg-white pb-16 sm:pb-24 print:hidden">
        {/* Sticky day bar: Brian walks along it to whichever step is on screen. */}
        <div className="sticky top-[4.5rem] z-30 border-b border-slate-200 bg-white/90 backdrop-blur-md min-[1544px]:top-0">
          <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2 sm:gap-5 sm:px-6">
            <button
              type="button"
              onClick={() => setPlaying((p) => !p)}
              className="inline-flex min-h-11 min-w-11 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-xl bg-kinetic-primary px-3 text-sm sm:px-4 font-bold text-white transition-colors duration-200 hover:bg-kinetic-primary-hover focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-kinetic-primary-electric"
            >
              <Icon name={playing ? "pause" : "play"} size={16} />
              <span className="sr-only sm:not-sr-only">{playing ? "Stop" : "Play my day"}</span>
            </button>
            <div className="min-w-0 flex-1">
              <div className="relative h-[4.25rem]" role="group" aria-label="Your day, step by step">
                <div className="rt-sky absolute inset-x-0 bottom-[1.375rem] h-2.5 rounded-full" aria-hidden="true" />
                {plan.map((s, i) => (
                  <button
                    key={s.id}
                    type="button"
                    aria-label={`${s.time}: ${s.title}`}
                    aria-current={activeStep?.id === s.id ? "step" : undefined}
                    onClick={() => {
                      setPlaying(false);
                      setActive(s.id);
                      document.getElementById(`step-${s.id}`)?.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "center" });
                    }}
                    style={{ left: `${pos(i, plan.length)}%` }}
                    className="absolute bottom-[5px] flex h-11 w-11 -translate-x-1/2 cursor-pointer items-center justify-center rounded-full focus-visible:outline-3 focus-visible:outline-offset-1 focus-visible:outline-kinetic-primary-electric"
                  >
                    <span
                      className={`block rounded-full border-2 border-white transition-transform duration-300 ${
                        activeStep?.id === s.id ? "h-4 w-4 scale-125 bg-kinetic-primary" : "h-3 w-3 bg-kinetic-teal"
                      } ${doneToday.includes(s.id) ? "ring-2 ring-kinetic-evidence-strong" : ""}`}
                    />
                  </button>
                ))}
                {activeStep && (
                  <span
                    className="rt-marker pointer-events-none absolute bottom-[2.25rem] w-10 -translate-x-1/2"
                    style={{ left: `${pos(Math.max(0, plan.indexOf(activeStep)), plan.length)}%` }}
                    aria-hidden="true"
                  >
                    <Image src={MASCOT} alt="" width={473} height={372} unoptimized className="rt-hop h-auto w-10" />
                  </span>
                )}
              </div>
              <p className="truncate text-center text-[11px] font-bold tracking-wider text-slate-600 uppercase" aria-hidden="true">
                {activeStep ? `${activeStep.time} · ${activeStep.title}` : "\u00a0"}
              </p>
            </div>
          </div>
        </div>

        <div className="mx-auto max-w-4xl px-4 pt-12 sm:px-6 sm:pt-16">
          <span className="mb-1 block text-xs font-extrabold tracking-widest text-kinetic-primary-electric uppercase">Step 2</span>
          <h2 id="rt-day-heading" className="font-kinetic-heading text-3xl font-extrabold tracking-tight text-slate-950 sm:text-4xl">
            Your day
          </h2>
          <p className="mt-3 max-w-2xl text-base leading-relaxed text-slate-600">
            {today ? "Tick each step as you do it. " : ""}Ticks and your picks stay in this browser only. Timings are Brian&apos;s suggestion: move them to fit
            your day.
          </p>

          <ol className="relative mt-10 space-y-6">
            {/* The rail the cards hang on. */}
            <span className="rt-rail absolute top-2 bottom-2 left-4 w-0.5 bg-slate-200 sm:left-5" aria-hidden="true" />
            {plan.map((s) => {
              const done = doneToday.includes(s.id);
              const lit = activeStep?.id === s.id;
              return (
                <li key={s.id} id={`step-${s.id}`} data-step-id={s.id} className="rt-card relative scroll-mt-40 pl-12 sm:pl-14">
                  <span
                    className={`absolute top-6 left-0 flex h-8 w-8 items-center justify-center rounded-full border-2 border-white text-white shadow-sm transition-colors duration-300 sm:h-10 sm:w-10 ${
                      done ? "bg-kinetic-evidence-strong" : lit ? "bg-kinetic-primary" : "bg-kinetic-teal"
                    }`}
                    aria-hidden="true"
                  >
                    <Icon name={done ? "badgeCheck" : s.icon} size={18} />
                  </span>
                  <article
                    className={`rt-step flex overflow-hidden rounded-2xl border bg-white shadow-sm transition-[box-shadow,border-color] duration-300 ${
                      lit ? "rt-lit border-kinetic-primary-electric shadow-lg" : "border-slate-200"
                    }`}
                  >
                    <div className="relative w-28 shrink-0 bg-slate-100 sm:w-44">
                      {s.clip ? (
                        <RoutineClip clip={s.clip} />
                      ) : s.product?.image ? (
                        <div className="flex h-full min-h-48 items-center justify-center bg-gradient-to-b from-kinetic-primary-light to-white p-3">
                          <Image src={s.product.image} alt={s.product.imageAlt} width={140} height={180} className="rt-float h-auto w-full max-w-32 object-contain" />
                        </div>
                      ) : null}
                    </div>
                    <div className="flex min-w-0 flex-1 flex-col gap-2 p-4 sm:p-6">
                      <p className="text-xs font-extrabold tracking-wider text-kinetic-primary-electric uppercase">
                        {s.time} · {s.part}
                        {!s.daily && " · not daily"}
                      </p>
                      <h3 className="font-kinetic-heading text-lg leading-snug font-bold text-slate-950 sm:text-2xl">{s.title}</h3>
                      <p className="text-sm leading-relaxed text-slate-700 sm:text-base">{s.detail}</p>
                      {s.why && <p className="text-sm leading-relaxed text-slate-600">{s.why}</p>}
                      {s.product && (
                        <p className="text-sm leading-relaxed text-slate-700">
                          <span className="font-bold">Brian&apos;s pick:</span> {s.product.brand} {s.product.name}
                          {s.product.serving && <> · Label serving: {s.product.serving}</>}{" "}
                          <Link href={s.product.href} className="font-semibold text-kinetic-primary-electric underline underline-offset-4">
                            Read the review
                          </Link>
                        </p>
                      )}
                      {s.id === "walk" && (
                        <a
                          href="https://www.who.int/publications/i/item/9789240015128"
                          className="text-sm font-semibold text-kinetic-primary-electric underline underline-offset-4"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          WHO activity guidelines
                        </a>
                      )}
                      <div className="mt-auto pt-2">
                        <button
                          type="button"
                          aria-pressed={done}
                          aria-label={`${done ? "Done today" : "Mark done today"}: ${s.title}`}
                          disabled={!today}
                          onClick={() => toggleDone(s.id)}
                          className={`inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border-2 px-4 text-sm font-bold transition-colors duration-200 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-kinetic-primary-electric disabled:cursor-wait disabled:opacity-60 ${
                            done
                              ? "border-kinetic-evidence-strong bg-kinetic-evidence-strong text-white"
                              : "border-slate-300 bg-white text-slate-800 hover:border-kinetic-primary-electric"
                          }`}
                        >
                          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <rect x="3" y="3" width="18" height="18" rx="4" strokeWidth="2" className={done ? "opacity-0" : ""} />
                            <path d="m7 12.5 3.5 3.5L17 9" className={`rt-tick ${done ? "is-done" : ""}`} pathLength={1} />
                          </svg>
                          {done ? "Done today" : "Mark done today"}
                        </button>
                      </div>
                    </div>
                  </article>
                </li>
              );
            })}
          </ol>

          <p role="status" className="sr-only">
            {dayComplete ? "Day done. Every daily step is ticked." : ""}
          </p>
          {/* Day complete: Brian hops and the confetti falls once. */}
          <div className={`rt-done mt-10 overflow-hidden rounded-2xl border border-kinetic-evidence-strong bg-green-50 p-6 text-center ${dayComplete ? "" : "hidden"}`}>
            {dayComplete && (
              <>
                <div className="rt-confetti" aria-hidden="true">
                  {Array.from({ length: 14 }, (_, i) => (
                    <span key={i} style={{ ["--i" as string]: i }} />
                  ))}
                </div>
                <Image src={MASCOT} alt="" width={473} height={372} unoptimized className="rt-hop mx-auto h-auto w-24" aria-hidden="true" />
                <p className="mt-2 font-kinetic-heading text-2xl font-extrabold text-slate-950">Day done.</p>
                <p className="mt-1 text-slate-700">Same again tomorrow. A routine is the days you keep it going.</p>
              </>
            )}
          </div>
        </div>
      </section>

      {/* WEEK + PRINT */}
      <section aria-labelledby="rt-week-heading" className="border-b border-slate-200 bg-slate-50 py-12 sm:py-16 print:hidden">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 sm:px-6 lg:grid-cols-2">
          <div>
            <span className="mb-1 block text-xs font-extrabold tracking-widest text-kinetic-primary-electric uppercase">Step 3</span>
            <h2 id="rt-week-heading" className="font-kinetic-heading text-3xl font-extrabold tracking-tight text-slate-950 sm:text-4xl">
              Your week
            </h2>
            <p className="mt-3 text-base leading-relaxed text-slate-600">A day counts when every daily step in your plan is ticked.</p>
            <ol className="mt-6 grid grid-cols-7 gap-1.5 sm:gap-3" aria-label="This week">
              {(week.length ? week : weekDays(new Date(2026, 0, 5))).map((d) => {
                const isToday = d.key === todayKey;
                const full = stored.complete.includes(d.key);
                return (
                  <li key={d.key} className="flex flex-col items-center gap-1.5">
                    <span className="text-xs font-bold tracking-wide text-slate-600 uppercase">{d.label}</span>
                    <span
                      className={`flex aspect-square w-full max-w-14 items-center justify-center rounded-full border-2 transition-colors duration-300 ${
                        full ? "border-kinetic-evidence-strong bg-kinetic-evidence-strong text-white" : isToday ? "border-kinetic-primary bg-white" : "border-slate-300 bg-white"
                      }`}
                    >
                      {full && <Icon name="badgeCheck" size={22} />}
                      <span className="sr-only">{full ? `${d.label}: complete` : isToday ? `${d.label}: today` : `${d.label}: not complete`}</span>
                    </span>
                  </li>
                );
              })}
            </ol>
            <p className="mt-5 text-sm font-semibold text-slate-800" aria-live="polite">
              {today ? `${weekComplete} of 7 days complete · ${sessions} strength ${sessions === 1 ? "session" : "sessions"} (aim for 2 or more)` : " "}
            </p>
            <button
              type="button"
              onClick={clearToday}
              className="mt-3 inline-flex min-h-11 cursor-pointer items-center text-sm font-semibold text-slate-600 underline underline-offset-4 hover:text-slate-900 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-kinetic-primary-electric"
            >
              Clear today&apos;s ticks
            </button>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <span className="mb-1 block text-xs font-extrabold tracking-widest text-kinetic-primary-electric uppercase">Step 4</span>
            <h2 className="font-kinetic-heading text-2xl font-extrabold tracking-tight text-slate-950 sm:text-3xl">Put it on the fridge</h2>
            <p className="mt-3 text-base leading-relaxed text-slate-600">
              Prints as one page: your steps, a label serving for each pick, and a week of tick boxes to fill in by hand.
            </p>
            <button
              type="button"
              onClick={() => window.print()}
              className="mt-5 inline-flex min-h-12 cursor-pointer items-center gap-2 rounded-xl bg-kinetic-primary px-6 py-3.5 font-bold text-white shadow-[0_8px_20px_rgba(10,29,59,0.25)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-kinetic-primary-hover focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-kinetic-primary-electric"
            >
              <Icon name="clipboardCheck" size={20} />
              Print my one-page routine
            </button>
          </div>
        </div>
      </section>

      {/* PRINT SHEET: hidden on screen, the only thing printed. */}
      {/* Images here load eagerly: the section is display:none on screen, and a lazy image inside it
          may not have loaded by the time the browser lays out the printout. */}
      <section className="rt-sheet hidden print:block" aria-label="Printable routine">
        <div className="rt-sheet-page">
          <header className="rt-sheet-band">
            <span className="rt-sheet-mark">
              <Image src="/healthy/brand/healthy-mark.png" alt="" width={40} height={34} unoptimized loading="eager" />
            </span>
            <div className="rt-sheet-titles">
              <p className="rt-sheet-eyebrow">GetBrian Healthy</p>
              <h2>Brian&apos;s one-page routine</h2>
              <p className="rt-sheet-sub">Tick a box each time you do a step. Stick it on the fridge.</p>
            </div>
            <div className="rt-sheet-week">
              <span>Week of</span>
              <span className="rt-sheet-line" />
            </div>
            <Image src={MASCOT} alt="" width={473} height={372} unoptimized loading="eager" className="rt-sheet-mascot" />
          </header>

          {/* The day bar from the page, as a printed strip. */}
          <div className="rt-sheet-sky" aria-hidden="true">
            <span>Morning</span>
            <span>Afternoon</span>
            <span>Evening</span>
            <span>Night</span>
          </div>

          <table className="rt-sheet-table">
            <thead>
              <tr>
                <th scope="col">Time</th>
                <th scope="col">Step</th>
                {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
                  <th key={d} scope="col" className="rt-day">
                    {d}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {plan.map((s) => (
                <tr key={s.id}>
                  <td>
                    <span className="rt-sheet-time">{s.time}</span>
                  </td>
                  <td>
                    <div className="rt-sheet-step">
                      {s.product?.image ? (
                        <Image src={s.product.image} alt="" width={64} height={64} loading="eager" className="rt-sheet-pack" />
                      ) : (
                        <span className="rt-sheet-icon">
                          <Icon name={s.icon} size={16} />
                        </span>
                      )}
                      <div>
                        <strong>{s.title}</strong>
                        {s.product && (
                          <span>
                            {s.product.brand} {s.product.name}
                            {s.product.serving && <> · Label serving: {s.product.serving}</>}
                          </span>
                        )}
                        {!s.daily && <span>2 or more days a week</span>}
                      </div>
                    </div>
                  </td>
                  {Array.from({ length: 7 }, (_, i) => (
                    <td key={i} className="rt-day">
                      <span className="rt-box" />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>

          <div className="rt-sheet-notes">
            <strong>Notes for the week</strong>
          </div>

          <div className="rt-sheet-tip">
            <strong>Brian&apos;s tip</strong>
            <p>
              Tie each step to something you already do: breakfast, the evening meal, putting the kettle on. Timings are suggestions, so move them to
              suit your day. The walk follows WHO guidance of at least 150 minutes of moderate activity a week. Take supplements as the label directs.
            </p>
          </div>
          <p className="rt-sheet-note">{disclaimer}</p>
          <footer className="rt-sheet-foot">
            <span>getbrianhealthy.xyz/routine</span>
            <span>Re-checked every 6 months · No paid placements</span>
          </footer>
        </div>
      </section>
    </div>
  );
}

/**
 * A step's looping clip. Plays muted while on screen and pauses off screen. Under reduced motion it
 * does not start by itself: the poster shows and the button plays it. The clip is 360 x 640 and has no audio.
 */
function RoutineClip({ clip }: { clip: NonNullable<RoutineStep["clip"]> }) {
  const ref = useRef<HTMLVideoElement>(null);
  const userPaused = useRef(false);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    if (prefersReducedMotion()) userPaused.current = true;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !userPaused.current) video.play().catch(() => {});
        else if (!entry.isIntersecting) video.pause();
      },
      { threshold: 0.4 },
    );
    observer.observe(video);
    return () => observer.disconnect();
  }, []);

  function toggle() {
    const video = ref.current;
    if (!video) return;
    if (video.paused) {
      userPaused.current = false;
      video.play().catch(() => {});
    } else {
      userPaused.current = true;
      video.pause();
    }
  }

  return (
    <>
      <video
        ref={ref}
        src={clip.src}
        poster={clip.poster}
        muted
        loop
        playsInline
        preload="none"
        aria-label={clip.label}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        className="absolute inset-0 h-full w-full object-cover"
      />
      <button
        type="button"
        onClick={toggle}
        aria-label={playing ? `Pause clip: ${clip.label}` : `Play clip: ${clip.label}`}
        className="absolute right-1 bottom-1 flex h-11 w-11 cursor-pointer items-center justify-center rounded-full bg-white/90 text-kinetic-primary shadow-sm transition-colors duration-200 hover:bg-white focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-kinetic-primary-electric"
      >
        <Icon name={playing ? "pause" : "play"} size={16} />
      </button>
    </>
  );
}
