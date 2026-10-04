"use client";

import Image from "next/image";
import { Fragment, useEffect, useRef, type CSSProperties } from "react";
import { Icon, type IconName } from "./icons";

/*
 * A small mascot above each pick, tossing that pick's goal icons (energy,
 * strength, calm...) from its hands, alternating left and right, down into
 * its card in a steady waterfall, where each one bursts: what the pick gives
 * you, falling into the product. Used by job-rail.tsx between each goal's
 * label and its card.
 *
 * The keyframes are `.healthy-shower-*` in globals.css. Each icon falls on the
 * same clock at its own delay and drift, read from CSS variables set here.
 * Under reduced motion nothing moves: the icons rest where they are scattered
 * down the column, so the column still reads as a shower. Off screen it pauses.
 */
const MASCOT = "/healthy/brand/healthy-mascot.webp";
const MASCOT_W = 96;
const MASCOT_H = (MASCOT_W * 372) / 473;

// Where the hands are, measured from the image's alpha: palm centres sit 43%
// of the width either side of centre, 52% of the way down. As offsets from
// the top centre of the icon column, which starts at the mascot's feet.
const HAND_X = Math.round(MASCOT_W * 0.43);
const HAND_Y = -Math.round(MASCOT_H * (1 - 0.52));

// The icon column runs from the mascot's feet to the top of the card, which
// sits straight below it in job-rail.tsx. Icons fall SINK px past its foot,
// into the card, and burst there.
const COLUMN_H = 90;
const SINK = 20;

/** One falling icon: which hand throws it (-1 left, 1 right), where it lands
 *  (px from centre; each lands nearer the middle than its hand, so the two
 *  streams pour inward onto the card), spin, delay (s), size (px), resting height (px). */
const DROPS = [
  { hand: -1, x1: -22, r: 35, delay: 0, size: 22, rest: 16 },
  { hand: 1, x1: 18, r: -30, delay: 0.3, size: 21, rest: 53 },
  { hand: -1, x1: -10, r: 20, delay: 0.6, size: 18, rest: 32 },
  { hand: 1, x1: 24, r: -40, delay: 0.9, size: 22, rest: 69 },
  { hand: -1, x1: -26, r: 45, delay: 1.2, size: 20, rest: 8 },
  { hand: 1, x1: 8, r: -25, delay: 1.5, size: 16, rest: 45 },
  { hand: -1, x1: -4, r: 15, delay: 1.8, size: 19, rest: 77 },
  { hand: 1, x1: 4, r: -35, delay: 2.1, size: 19, rest: 59 },
  { hand: -1, x1: -16, r: 30, delay: 2.4, size: 16, rest: 26 },
];

export function MascotShower({ icons }: { icons: IconName[] }) {
  const ref = useRef<HTMLDivElement>(null);

  // Pause while off screen; it resumes where it left off.
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) node.removeAttribute("data-paused");
      else node.setAttribute("data-paused", "");
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  if (icons.length === 0) return null;

  return (
    <div ref={ref} className="healthy-shower pointer-events-none mx-auto flex flex-col items-center" aria-hidden="true">
      <Image
        src={MASCOT}
        alt=""
        width={473}
        height={372}
        unoptimized
        className="healthy-shower-mascot h-auto"
        style={{ width: MASCOT_W }}
      />
      <div className="relative w-40" style={{ height: COLUMN_H }}>
        {DROPS.map((d, i) => {
          const colour = i % 2 ? "text-kinetic-primary" : "text-kinetic-teal";
          return (
            <Fragment key={i}>
              <span
                className={`healthy-shower-icon absolute top-0 left-1/2 ${colour}`}
                style={
                  {
                    // Start centred on the throwing palm; land with the icon's
                    // centre SINK px into the card.
                    "--x0": `${d.hand * HAND_X}px`,
                    "--y0": `${HAND_Y - d.size / 2}px`,
                    "--x1": `${d.x1}px`,
                    "--land": `${COLUMN_H + SINK - d.size / 2}px`,
                    "--r": `${d.r}deg`,
                    "--rest": `${d.rest}px`,
                    marginLeft: `${-d.size / 2}px`,
                    animationDelay: `${d.delay}s`,
                  } as CSSProperties
                }
              >
                <Icon name={icons[i % icons.length]} size={d.size} />
              </span>
              {/* The burst where this icon lands, on the same clock. */}
              <span
                className={`healthy-shower-burst absolute top-0 left-1/2 ${colour}`}
                style={
                  {
                    "--x1": `${d.x1}px`,
                    "--by": `${COLUMN_H + SINK}px`,
                    animationDelay: `${d.delay}s`,
                  } as CSSProperties
                }
              />
            </Fragment>
          );
        })}
      </div>
    </div>
  );
}
