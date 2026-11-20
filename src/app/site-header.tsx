"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

export const nav = [
  { href: "/", label: "Home" },
  { href: "/#picks", label: "Brian's picks" },
  { href: "/method", label: "How Brian picks" },
  { href: "/routine", label: "Daily routine" },
  { href: "/guide", label: "Free guide" },
  { href: "/about", label: "About" },
  { href: "/about#contact", label: "Contact" },
];

/** A link to a page is current on that page. A link to a part of a page ("/#picks") is never current. */
export function isCurrent(href: string, pathname: string | null): boolean {
  return !href.includes("#") && href === pathname;
}

const focusRing =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kinetic-primary-electric";

const linkClass = `inline-flex min-h-11 items-center rounded-xl px-3 text-base font-medium text-fg-muted transition-colors duration-200 hover:text-brand-navy aria-[current=page]:bg-kinetic-primary-light aria-[current=page]:font-semibold aria-[current=page]:text-brand-navy ${focusRing}`;

/**
 * The site header: in the normal page flow, brand on the left, the links on
 * the right. From lg up the links sit in a row. Below lg they fold into a
 * Menu button. The button is a <details>, so the menu also opens with no
 * JavaScript; the effects below add Escape, outside click and close-on-navigate.
 */
export function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDetailsElement>(null);

  // A new page closes the menu.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      menuRef.current?.querySelector("summary")?.focus();
    };
    const onPointer = (e: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [open]);

  return (
    <header data-chrome className="relative z-40 border-b border-slate-200 bg-white">
      <div className="mx-auto flex min-h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link
          href="/"
          aria-label="GetBrian Healthy home"
          className={`flex min-h-11 items-center gap-3 rounded-xl ${focusRing}`}
        >
          <Image src="/healthy/brand/healthy-mark.png" alt="" aria-hidden="true" width={40} height={34} unoptimized className="h-8 w-auto" />
          <span className="font-kinetic-heading text-lg font-extrabold tracking-tight whitespace-nowrap text-brand-navy">
            GetBrian <span className="text-kinetic-primary-electric">Healthy</span>
          </span>
        </Link>

        <nav aria-label="Healthy" className="hidden lg:block">
          <ul className="flex items-center gap-0.5">
            {nav.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={isCurrent(item.href, pathname) ? "page" : undefined}
                  className={`${linkClass} px-2.5 text-sm whitespace-nowrap`}
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <details
          ref={menuRef}
          open={open}
          onToggle={(e) => setOpen(e.currentTarget.open)}
          className="group relative lg:hidden"
        >
          <summary
            className={`flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-xl border border-border-strong px-4 font-semibold text-brand-navy select-none [&::-webkit-details-marker]:hidden ${focusRing}`}
          >
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M4 7h16M4 12h16M4 17h16" />
            </svg>
            Menu
          </summary>
          <nav
            aria-label="Healthy"
            className="absolute right-0 z-50 mt-2 w-56 rounded-2xl border border-border bg-bg p-2 shadow-lg"
          >
            <ul>
              {nav.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={isCurrent(item.href, pathname) ? "page" : undefined}
                    // A hash link on the current page (/#picks, /about#contact) keeps the pathname, so the
                    // pathname effect would leave the sheet open over the target.
                    onClick={() => setOpen(false)}
                    className={`${linkClass} w-full`}
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </details>
      </div>
    </header>
  );
}
