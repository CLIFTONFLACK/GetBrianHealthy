"use client";

import { useEffect, useState } from "react";
import { Icon } from "./icons";

/*
 * Makes the picks carousel (job-rail.tsx, below lg) visibly swipeable:
 *
 * - A hint, "Swipe to see all 3 picks", with a hand sweeping left. It fades
 *   once the reader has swiped or used a dot, since by then it has done its job.
 * - One dot per pick, filled for the card in view. Each dot is a button that
 *   brings its card in, for anyone who doesn't swipe.
 * - A single nudge the first time the row comes on screen: it slides a little
 *   way left and springs back, showing that it moves.
 *
 * The carousel itself stays plain server HTML; this finds it by id. Under
 * reduced motion there is no nudge and the hand stays still.
 */
/** The row's scrollLeft that snaps this slide into place. The row is
 *  `position: relative`, so a slide's offsetLeft is measured from it. */
function slideLeft(row: HTMLElement, slide: HTMLElement): number {
  return slide.offsetLeft - (parseFloat(getComputedStyle(row).scrollPaddingLeft) || 0);
}

export function SwipeControls({ targetId, labels }: { targetId: string; labels: string[] }) {
  const [active, setActive] = useState(0);
  const [swiped, setSwiped] = useState(false);

  useEffect(() => {
    const row = document.getElementById(targetId);
    if (!row) return;
    // The card whose snap position is nearest the row's scroll position. Each
    // stop is capped at the furthest the row can scroll: on wider screens the
    // last card's own stop is out of reach, and at full scroll it is the one showing.
    const onScroll = () => {
      const x = row.scrollLeft;
      const max = row.scrollWidth - row.clientWidth;
      const stops = Array.from(row.children, (s) => Math.min(slideLeft(row, s as HTMLElement), max));
      let best = 0;
      stops.forEach((stop, i) => {
        if (Math.abs(stop - x) < Math.abs(stops[best] - x)) best = i;
      });
      setActive(best);
    };
    row.addEventListener("scroll", onScroll, { passive: true });

    // The nudge: out 56px, back to 0, snap off meanwhile so it can't snap back
    // early. Any touch, click or wheel on the row ends it on the spot and
    // leaves the row where the reader put it.
    let timer: ReturnType<typeof setTimeout> | undefined;
    let nudging = false;
    const endNudge = () => {
      clearTimeout(timer);
      if (!nudging) return;
      nudging = false;
      row.style.scrollSnapType = "";
    };
    // A reader's own input is the only thing that counts as having swiped;
    // the nudge's scrolling never does.
    const onInput = () => {
      endNudge();
      setSwiped(true);
    };
    const inputs = ["pointerdown", "touchstart", "wheel"] as const;
    inputs.forEach((type) => row.addEventListener(type, onInput, { passive: true }));

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        observer.disconnect();
        // Only where it is a carousel (below lg) and the reader hasn't moved it yet.
        if (reduced || row.scrollWidth <= row.clientWidth || row.scrollLeft > 0) return;
        nudging = true;
        row.style.scrollSnapType = "none";
        row.scrollTo({ left: 56, behavior: "smooth" });
        timer = setTimeout(() => {
          if (!nudging) return;
          row.scrollTo({ left: 0, behavior: "smooth" });
          // Snap back on once the return has finished, or after 1s if the
          // browser never reports the end of the scroll.
          row.addEventListener("scrollend", endNudge, { once: true });
          timer = setTimeout(endNudge, 1000);
        }, 550);
      },
      { threshold: 0.25 },
    );
    observer.observe(row);

    return () => {
      row.removeEventListener("scroll", onScroll);
      row.removeEventListener("scrollend", endNudge);
      inputs.forEach((type) => row.removeEventListener(type, onInput));
      observer.disconnect();
      endNudge();
    };
  }, [targetId]);

  const goTo = (i: number) => {
    const row = document.getElementById(targetId);
    const slide = row?.children[i] as HTMLElement | undefined;
    if (!row || !slide) return;
    setSwiped(true);
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    row.scrollTo({ left: slideLeft(row, slide), behavior: reduced ? "auto" : "smooth" });
  };

  return (
    <div className="-mt-4 flex flex-col items-center gap-3 lg:hidden">
      <div className="flex items-center" role="group" aria-label="Choose a pick">
        {labels.map((label, i) => (
          <button
            key={i}
            type="button"
            onClick={() => goTo(i)}
            aria-label={`Show pick ${i + 1} of ${labels.length}: ${label}`}
            aria-current={i === active ? "true" : undefined}
            className="flex h-11 w-11 items-center justify-center focus-visible:outline-2 focus-visible:outline-kinetic-primary-electric"
          >
            <span
              className={`block h-2.5 rounded-full transition-all duration-300 ${
                i === active ? "w-6 bg-kinetic-primary" : "w-2.5 bg-slate-300"
              }`}
            />
          </button>
        ))}
      </div>
      <p
        className={`flex items-center gap-2 text-sm font-semibold text-slate-500 transition-opacity duration-500 ${
          swiped ? "opacity-0" : "opacity-100"
        }`}
        aria-hidden="true"
      >
        <Icon name="pointer" size={20} className="healthy-swipe-hand text-kinetic-teal" />
        Swipe to see all {labels.length} picks
      </p>
    </div>
  );
}
