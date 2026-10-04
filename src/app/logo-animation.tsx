"use client";

import Image from "next/image";
import { useEffect, useRef } from "react";

/*
 * The Healthy mark, animated to show "AI-assisted, human verified": the circuit
 * traces draw in (AI gathering the research), a pulse runs each into the
 * letterform, the cross lights, and a check seal stamps on (a person signing it
 * off). The loop and its reduced-motion fallback live in globals.css under
 * `.healthy-anim`.
 *
 * The base image is the solo cut from scripts/gen-healthy-brand.mjs: the mark
 * with its traces, terminals and cross painted out. This SVG redraws them in
 * the source logo's own pixel coordinates (docs/GetBrian_Healthy_Logo.png,
 * 1254px), and VIEW_BOX is exactly the crop the generator cuts the solo PNG to,
 * so the two line up at any size. Re-measure both if the logo art changes.
 */
const VIEW_BOX = { x: 178, y: 206, w: 982, h: 839 };
const TEAL = "var(--kinetic-teal)";
const STROKE = 19;

/** Each trace: its run, the terminal it starts from and the stud it ends in. */
const TRACES = [
  { d: "M260 443 H410 L485 518 H623", start: { cx: 220, cy: 443, ring: true }, end: { cx: 653, cy: 519 } },
  { d: "M368 557 H415 L471 613 H648", start: { cx: 338, cy: 557, ring: false }, end: { cx: 678, cy: 616 } },
  { d: "M268 692 H502 L535 678", start: { cx: 227, cy: 692, ring: true }, end: { cx: 565, cy: 677 } },
];

const STAGGER_S = 0.25;

/** `showSteps` adds the two captions under the mark; the pick loop draws its own steps and turns it off. */
export function LogoAnimation({ className = "", showSteps = true }: { className?: string; showSteps?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);

  // Pause the loop while it is off screen; it resumes where it left off.
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

  const { x, y, w, h } = VIEW_BOX;
  return (
    <div ref={ref} className={`healthy-anim ${className}`}>
      <div
        className="relative mx-auto w-full max-w-[220px]"
        style={{ aspectRatio: `${w} / ${h}` }}
        role="img"
        aria-label="The GetBrian Healthy logo: circuit lines, standing for the AI-assisted research, run into the mark, then a check seal shows a person has verified it."
      >
        <Image src="/healthy/brand/healthy-mark-solo.png" alt="" fill unoptimized className="object-contain" />
        <svg viewBox={`${x} ${y} ${w} ${h}`} className="absolute inset-0 h-full w-full" aria-hidden="true">
          {TRACES.map((t, i) => {
            const delay = { animationDelay: `${i * STAGGER_S}s` };
            return (
              <g key={t.d}>
                <path
                  d={t.d}
                  pathLength={1}
                  fill="none"
                  stroke={TEAL}
                  strokeWidth={STROKE}
                  strokeLinejoin="miter"
                  className="healthy-anim-trace"
                  style={delay}
                />
                {/* The start terminal lights just before its trace draws; the
                    negative delay shifts its cycle ahead of the trace's. */}
                <circle
                  cx={t.start.cx}
                  cy={t.start.cy}
                  r={30}
                  fill={t.start.ring ? "#fcfcfc" : TEAL}
                  stroke={t.start.ring ? TEAL : "none"}
                  strokeWidth={t.start.ring ? 20 : 0}
                  className="healthy-anim-node"
                  style={{ animationDelay: `${i * STAGGER_S - 0.9}s` }}
                />
                <circle cx={t.end.cx} cy={t.end.cy} r={30} fill={TEAL} className="healthy-anim-node" style={delay} />
                <circle
                  r={11}
                  fill="#ffffff"
                  stroke={TEAL}
                  strokeWidth={6}
                  className="healthy-anim-pulse"
                  style={{ ...delay, offsetPath: `path('${t.d}')` }}
                />
              </g>
            );
          })}

          {/* The medical cross, arms 61px wide, measured from the source. */}
          <path
            d="M792 390 H837 Q845 390 845 398 V437 H883 Q891 437 891 445 V490 Q891 498 883 498 H845 V537 Q845 545 837 545 H792 Q784 545 784 537 V498 H746 Q738 498 738 490 V445 Q738 437 746 437 H784 V398 Q784 390 792 390 Z"
            fill={TEAL}
            className="healthy-anim-cross"
          />

          {/* Human sign-off: a check seal on the letterform's lower right. */}
          <g className="healthy-anim-seal">
            <circle cx={1070} cy={955} r={72} fill="var(--kinetic-primary-electric)" stroke="#ffffff" strokeWidth={12} />
            <path d="M1036 956 L1060 980 L1106 932" fill="none" stroke="#ffffff" strokeWidth={16} strokeLinecap="round" strokeLinejoin="round" />
          </g>
        </svg>
      </div>

      {showSteps && (
      <ol className="mt-4 grid gap-2 text-center text-xs font-bold text-slate-700 sm:text-sm">
        <li className="healthy-anim-step rounded-lg bg-kinetic-primary-light px-2 py-1.5 text-kinetic-primary-electric">
          AI gathers the research
        </li>
        <li className="healthy-anim-step rounded-lg bg-slate-100 px-2 py-1.5 text-kinetic-primary">
          A person checks and signs off
        </li>
      </ol>
      )}
    </div>
  );
}
