"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";

export type NavItem = { href: string; label: string; children?: { href: string; label: string }[] };

export const nav: NavItem[] = [
  {
    href: "/",
    label: "Home",
    children: [
      { href: "/about", label: "About" },
      { href: "/about#contact", label: "Contact" },
    ],
  },
  { href: "/routine", label: "Daily routine" },
  { href: "/guide", label: "Free guide" },
];

/** A link to a page is current on that page. A link to a part of a page ("/about#contact") is never current. */
export function isCurrent(href: string, pathname: string | null): boolean {
  return !href.includes("#") && href === pathname;
}

const focusRing =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kinetic-primary-electric";

const linkClass = `inline-flex min-h-11 items-center rounded-xl px-3 text-base font-medium uppercase text-fg-muted transition-colors duration-200 hover:text-brand-navy aria-[current=page]:bg-kinetic-primary-light aria-[current=page]:font-semibold aria-[current=page]:text-brand-navy ${focusRing}`;

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
  // The desktop sub-menu under Home.
  const [subOpen, setSubOpen] = useState(false);
  const subRef = useRef<HTMLLIElement>(null);
  const subButtonRef = useRef<HTMLButtonElement>(null);
  const subId = useId();

  // A new page closes both menus.
  useEffect(() => {
    setOpen(false);
    setSubOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!subOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setSubOpen(false);
      subButtonRef.current?.focus();
    };
    const onPointer = (e: PointerEvent) => {
      if (subRef.current && !subRef.current.contains(e.target as Node)) setSubOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [subOpen]);

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
              <li
                key={item.href}
                ref={item.children ? subRef : undefined}
                className={item.children ? "relative flex items-center" : undefined}
              >
                <Link
                  href={item.href}
                  aria-current={isCurrent(item.href, pathname) ? "page" : undefined}
                  className={`${linkClass} px-2.5 text-sm tracking-wide whitespace-nowrap`}
                >
                  {item.label}
                </Link>
                {item.children && (
                  <>
                    <button
                      ref={subButtonRef}
                      type="button"
                      aria-label={`More: ${item.children.map((c) => c.label).join(" and ")}`}
                      aria-expanded={subOpen}
                      aria-controls={subId}
                      onClick={() => setSubOpen((v) => !v)}
                      className={`inline-flex min-h-11 w-8 items-center justify-center rounded-xl text-fg-muted transition-colors duration-200 hover:text-brand-navy ${focusRing}`}
                    >
                      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={`transition-transform duration-200 ${subOpen ? "rotate-180" : ""}`}>
                        <path d="m6 9 6 6 6-6" />
                      </svg>
                    </button>
                    <ul
                      id={subId}
                      hidden={!subOpen}
                      className="absolute top-full left-0 z-50 mt-1 w-44 rounded-2xl border border-border bg-bg p-2 shadow-lg"
                    >
                      {item.children.map((child) => (
                        <li key={child.href}>
                          <Link
                            href={child.href}
                            aria-current={isCurrent(child.href, pathname) ? "page" : undefined}
                            onClick={() => setSubOpen(false)}
                            className={`${linkClass} w-full text-sm`}
                          >
                            {child.label}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
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
            className={`flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-xl border border-border-strong px-4 font-semibold uppercase text-brand-navy select-none [&::-webkit-details-marker]:hidden ${focusRing}`}
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
                    // A hash link on the current page (/about#contact) keeps the pathname, so the
                    // pathname effect would leave the sheet open over the target.
                    onClick={() => setOpen(false)}
                    className={`${linkClass} w-full`}
                  >
                    {item.label}
                  </Link>
                  {item.children && (
                    <ul className="ml-4 border-l border-border pl-1">
                      {item.children.map((child) => (
                        <li key={child.href}>
                          <Link
                            href={child.href}
                            aria-current={isCurrent(child.href, pathname) ? "page" : undefined}
                            onClick={() => setOpen(false)}
                            className={`${linkClass} w-full`}
                          >
                            {child.label}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          </nav>
        </details>
      </div>
    </header>
  );
}
