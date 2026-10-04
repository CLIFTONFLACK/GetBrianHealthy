"use client";

import Image from "next/image";
import { useEffect, useRef } from "react";

/*
 * The Healthy mascot at the centre of the pick loop, moving in time with it.
 * Each time the mark sends a pulse down a spoke (every SPOKE_STAGGER_S in
 * pick-loop.tsx, one 10s round for all five steps), the mascot hops and leans
 * toward that step, and it gives a bigger hop for the final, human approval.
 * A shadow under its feet shrinks as it leaves the ground. The keyframes live
 * in globals.css under `.healthy-mascot`; under reduced motion it stands still.
 *
 * The image is the mascot cut out and cropped to its own bounds (473 x 372),
 * so its feet sit on the bottom edge and the lean can pivot there.
 */
const SRC = "/healthy/brand/healthy-mascot.webp";
const WIDTH = 473;
const HEIGHT = 372;

export function MascotAnimation({ className = "" }: { className?: string }) {
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

  return (
    <div ref={ref} className={`healthy-mascot ${className}`}>
      <div className="relative mx-auto w-full max-w-[240px] pb-[6%]">
        <span className="healthy-mascot-shadow" aria-hidden="true" />
        <Image
          src={SRC}
          alt="The GetBrian Healthy mascot, hopping toward each step of the loop in turn."
          width={WIDTH}
          height={HEIGHT}
          unoptimized
          className="healthy-mascot-body relative h-auto w-full"
        />
      </div>
    </div>
  );
}
