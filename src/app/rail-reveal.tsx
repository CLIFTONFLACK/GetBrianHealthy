"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * Runs the "One job each" rail's draw-in once, when it scrolls into view.
 *
 * Unlike the site's Reveal, this never hides its content in the server HTML:
 * the rail's hidden starting state only applies under `.rail-armed`, which is
 * added here once JavaScript is running, and swapped for `.is-visible` when
 * the row comes on screen. Without JavaScript the picks (prices, Buy buttons)
 * render in their finished state instead of as blank space.
 */
export function RailReveal({ children, className = "" }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    node.classList.add("rail-armed");
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        node.classList.remove("rail-armed");
        node.classList.add("is-visible");
        observer.disconnect();
      },
      { threshold: 0.15 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
