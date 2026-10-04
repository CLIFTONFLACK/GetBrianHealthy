import { Icon, type IconName } from "./icons";
import { MascotAnimation } from "./mascot-animation";

/**
 * "How Brian picks" as one continuous loop rather than a list that ends:
 * Brian finds the clinical data, the checks run, a human gives final approval,
 * and it goes round again. The animated mascot sits in the middle of the ring.
 *
 * Desktop draws the ring as an ellipse in a fixed-aspect box, so the steps can
 * be placed with plain percentages on the same geometry the SVG uses. Below
 * `lg` it becomes a numbered list.
 */
type Step = { title: string; icon: IconName; human?: boolean };

const STEPS: Step[] = [
  { title: "Clinical Reviews", icon: "flask" },
  { title: "Evaluate Data", icon: "book" },
  { title: "Products Matched", icon: "clipboardCheck" },
  { title: "Shortlist Built", icon: "listChecks" },
  { title: "Final Approval", icon: "shieldCheck", human: true },
];

// Ring geometry, in the SVG's own units. The box is W x H; the ring is an
// ellipse centred in it. Steps sit on the ring, the first at the top, then
// clockwise at equal angles. The box is square because the loop shares its row
// with the square promo video (page.tsx), half the width each. The cards are
// 36% wide so every title fits on one line at the narrowest lg box (460px,
// where "Products Matched" needs 34.4%); RX leaves room for the side cards
// inside the box. Steps 1 and 2 overlap horizontally but sit ~105px apart
// vertically, more than a one-line card is tall.
const W = 1000;
const H = 1000;
const RX = 330;
const RY = 330;
const CX = W / 2;
const CY = H / 2;
const angle = (k: number) => ((-90 + (360 / STEPS.length) * k) * Math.PI) / 180;
const point = (a: number) => ({ x: CX + RX * Math.cos(a), y: CY + RY * Math.sin(a) });
const pct = ({ x, y }: { x: number; y: number }) => ({ left: `${(x / W) * 100}%`, top: `${(y / H) * 100}%` });

// Clockwise on screen (y grows downward), starting at the top of the ring.
const RING = `M ${CX} ${CY - RY} A ${RX} ${RY} 0 1 1 ${CX - 0.01} ${CY - RY} Z`;

// Spokes: the mark feeds each step and hears back. Each runs from just outside
// the mark (an ellipse roughly its size) to the step card's centre, where the
// card itself covers the end of the line.
const HUB_RX = 170;
const HUB_RY = 150;
const spoke = (k: number) => {
  const a = angle(k);
  const end = point(a);
  return `M ${CX + HUB_RX * Math.cos(a)} ${CY + HUB_RY * Math.sin(a)} L ${end.x} ${end.y}`;
};

/** Seconds between one spoke's pulse and the next; the steps take turns, clockwise. */
export const SPOKE_STAGGER_S = 2;

/** A chevron on the ring halfway between step k and the next, pointing the way the loop runs. */
function chevron(k: number) {
  const a = (angle(k) + angle(k + 1)) / 2;
  const { x, y } = point(a);
  const deg = (Math.atan2(RY * Math.cos(a), -RX * Math.sin(a)) * 180) / Math.PI;
  return { x, y, deg };
}

export function PickLoop() {
  return (
    <>
      {/* Desktop: the ring. */}
      <div className="relative mx-auto hidden w-full lg:block" style={{ aspectRatio: `${W} / ${H}` }}>
        <svg viewBox={`0 0 ${W} ${H}`} className="absolute inset-0 h-full w-full" aria-hidden="true">
          <path d={RING} fill="none" stroke="var(--kinetic-teal)" strokeOpacity={0.35} strokeWidth={3} />
          {STEPS.map((_, k) => {
            const c = chevron(k);
            return (
              <path
                key={k}
                d="M -7 -9 L 5 0 L -7 9"
                transform={`translate(${c.x} ${c.y}) rotate(${c.deg})`}
                fill="none"
                stroke="var(--kinetic-teal)"
                strokeWidth={3}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            );
          })}
          {/* Two pulses a half-loop apart travel the ring for good. Hidden under reduced motion. */}
          {[0, 0.5].map((phase) => (
            <circle
              key={phase}
              r={7}
              fill="var(--kinetic-teal)"
              stroke="#fff"
              strokeWidth={3}
              className="healthy-loop-dot"
              style={{ offsetPath: `path('${RING}')`, animationDelay: `calc(var(--healthy-loop-lap) * -${phase})` }}
            />
          ))}
          {/* The mark feeding each step: a glow behind it, a spoke to every card,
              and a pulse that runs out along each spoke and back, one step at a time. */}
          <g>
            <ellipse cx={CX} cy={CY} rx={HUB_RX} ry={HUB_RY} fill="var(--kinetic-teal)" className="healthy-hub-glow" />
            {STEPS.map((_, k) => (
              <path
                key={`spoke-${k}`}
                d={spoke(k)}
                fill="none"
                stroke="var(--kinetic-teal)"
                strokeOpacity={0.3}
                strokeWidth={2}
                strokeDasharray="2 8"
                strokeLinecap="round"
              />
            ))}
            {STEPS.map((_, k) => (
              <circle
                key={`spoke-dot-${k}`}
                r={6}
                fill="var(--kinetic-teal)"
                stroke="#fff"
                strokeWidth={2.5}
                className="healthy-spoke-dot"
                style={{ offsetPath: `path('${spoke(k)}')`, animationDelay: `${k * SPOKE_STAGGER_S}s` }}
              />
            ))}
          </g>
        </svg>

        {/* The mascot in the middle, hopping toward each step as its pulse leaves. */}
        {/* 20% keeps its outstretched hands clear of the wide step 2 and 5 cards
            through every hop and lean (measured: 7.8px at the narrowest lg box;
            24% dips under step 2). */}
        <div className="absolute top-1/2 left-1/2 w-[20%] -translate-x-1/2 -translate-y-1/2">
          <MascotAnimation />
        </div>

        <ol>
          {STEPS.map((s, k) => (
            <li
              key={s.title}
              className="absolute w-[36%] -translate-x-1/2 -translate-y-1/2"
              style={pct(point(angle(k)))}
            >
              <StepCard step={s} n={k + 1} compact />
            </li>
          ))}
        </ol>
      </div>

      {/* Phones and tablets: the same loop as a list, closing back on step 1. */}
      <div className="lg:hidden">
        <MascotAnimation className="mx-auto w-44" />
        <ol className="relative mt-8 space-y-4 border-l-2 border-kinetic-teal/40 pl-6">
          {STEPS.map((s, k) => (
            <li key={s.title} className="relative">
              <span
                className="healthy-step-lit healthy-step-marker absolute top-5 -left-[33px] h-4 w-4 rounded-full border-2 border-white bg-kinetic-teal"
                style={{ animationDelay: `${k * SPOKE_STAGGER_S}s` }}
                aria-hidden="true"
              />
              <StepCard step={s} n={k + 1} />
            </li>
          ))}
        </ol>
      </div>
    </>
  );
}

/** `compact` tightens the card for the ring, where it has a quarter of a half-width column. */
function StepCard({ step, n, compact = false }: { step: Step; n: number; compact?: boolean }) {
  // The whole card inverts to navy as the mark's pulse reaches this step (same
  // timing as its spoke). The colours live in globals.css, driven by one
  // animated --step-lit on the card that its badge, label and title inherit.
  return (
    <div
      className={`healthy-step-lit healthy-step-card rounded-xl border shadow-sm ${compact ? "p-3" : "p-4"} ${step.human ? "border-2 border-kinetic-teal/50" : "border-slate-200"}`}
      style={{ animationDelay: `${(n - 1) * SPOKE_STAGGER_S}s` }}
    >
      <div className="flex items-center gap-2">
        <span className="healthy-step-glow flex h-7 w-7 shrink-0 items-center justify-center rounded-lg">
          <Icon name={step.icon} size={16} />
        </span>
        <span className="healthy-step-label text-[11px] font-extrabold tracking-wider uppercase">Step {n}</span>
      </div>
      <h3 className={`healthy-step-title font-kinetic-heading mt-2 leading-snug font-bold whitespace-nowrap ${compact ? "text-sm" : "text-base"}`}>
        {step.title}
      </h3>
    </div>
  );
}
