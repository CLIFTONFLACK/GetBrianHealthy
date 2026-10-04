import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { FdaDisclaimer, GoalChooser, supplementHref } from "./components";
import { Icon } from "./icons";
import { PickLoop } from "./pick-loop";
import { PromoVideo } from "./promo-video";
import { JobRail } from "./job-rail";
import { HealthyHeroMascot } from "./hero-mascot";
import { signupEnabled } from "./newsletter";
import { Signup } from "./signup";
import {
  AMAZON_ASSOCIATE_STATEMENT,
  PROGRAM_NAME,
  TAGLINE,
  faqs,
  getSupplement,
  localizeGoal,
  localizeSupplement,
  productsFor,
  tileGoals,
} from "./data";
import { getRegion } from "./region-server";
import { withPrices } from "../lib/amazon-prices";

export const metadata: Metadata = {
  title: { absolute: `${PROGRAM_NAME} | GetBrian Healthy` },
  alternates: { canonical: "/" },
};

const primaryCta =
  "inline-flex min-h-12 items-center rounded-xl bg-kinetic-primary px-6 py-3.5 font-bold text-white shadow-[0_8px_20px_rgba(10,29,59,0.25)] transition-all hover:-translate-y-0.5 hover:bg-kinetic-primary-hover hover:shadow-[0_12px_28px_rgba(10,29,59,0.35)]";


const HERO_POINTS = [
  { icon: "traces", text: "3 Supplements, 3 Jobs" },
  { icon: "seal", text: "Carefully Researched, Honestly Reviewed" },
  { icon: "crossSolid", text: "Energy, Strength and Calm When You Need It Most" },
] as const;

export default async function HealthyHome() {
  const region = await getRegion();
  const products = await withPrices(productsFor(region), region);
  // "Calm" is a claim for L-theanine, which has no authorised health claim in the UK.
  const heroPoints = region === "GB" ? HERO_POINTS.map((p, i) => (i === 2 ? { ...p, text: "Energy and Exercise, Explained From the Research" } : p)) : HERO_POINTS;
  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.question,
      acceptedAnswer: { "@type": "Answer", text: f.answer },
    })),
  };

  // Splits TAGLINE after its last ", " so the closing phrase ("Choose Brian.")
  // takes the highlight. Falls back to the whole line with no highlight if
  // TAGLINE ever stops containing a comma.
  const split = TAGLINE.lastIndexOf(", ");
  const taglineLead = split === -1 ? TAGLINE : TAGLINE.slice(0, split + ", ".length);
  const taglineHighlight = split === -1 ? "" : TAGLINE.slice(split + ", ".length);

  return (
    <>
      <script
        type="application/ld+json"
        // Built from our own data file only, and "<" is escaped so no value can close the tag.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd).replace(/</g, "\\u003c") }}
      />

      {/* HERO: the photo runs full-bleed behind the section on large screens,
          feathered to white on the left so the lockup and copy read over it.
          On small screens it sits as a band under the copy, feathered at the
          top. One <Image> serves both, repositioned by breakpoint. On large
          screens below 1544px the section pulls up over <main>'s pt-16 (the
          floating Menu's clearance) so the photo starts at the top of the page,
          and adds that 4rem back to its own padding to keep the copy clear. */}
      <section className="relative overflow-hidden border-b border-slate-200 bg-white pt-3 sm:pt-10 lg:-mt-16 lg:flex lg:min-h-[680px] lg:items-start lg:pt-28 lg:pb-20 min-[1544px]:mt-0 min-[1544px]:pt-12">
        <div className="relative z-10 mx-auto w-full max-w-6xl px-4 sm:px-6">
          <div className="flex flex-col space-y-6 lg:max-w-[36rem]">
            {/* Brand lockup: the mark and "GetBrian Healthy" lead the page. The
                wordmark is text, so it stays readable and selectable; the H1
                below is still the page's headline. */}
            <div className="animate-fade-in-up flex items-center gap-4 sm:gap-5">
              <Image
                src="/healthy/brand/healthy-mark-lg.png"
                alt=""
                aria-hidden="true"
                width={131}
                height={112}
                loading="eager"
                unoptimized
                className="h-20 w-auto sm:h-28"
              />
              <p className="font-kinetic-heading text-4xl leading-none font-extrabold tracking-tight text-kinetic-primary sm:text-6xl">
                GetBrian <span className="block text-kinetic-primary-electric sm:inline">Healthy</span>
              </p>
            </div>
            <h1 className="font-kinetic-heading text-[5.2vw] leading-[1.1] font-semibold tracking-tight text-slate-950 sm:text-[32px]">
              {taglineLead}
              {taglineHighlight && (
                <span className="bg-gradient-to-r from-kinetic-primary via-kinetic-primary-electric to-kinetic-teal bg-clip-text text-transparent">
                  {taglineHighlight}
                </span>
              )}
            </h1>
            {/* Three points, each marked with a piece of the logo: the traces
                (three supplements), the check seal (reviewed), the cross (the
                benefit). */}
            <ul className="space-y-5">
              {heroPoints.map((point) => (
                <li key={point.text} className="flex items-center gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-kinetic-teal/40 bg-white text-kinetic-teal shadow-sm">
                    <Icon name={point.icon} size={22} />
                  </span>
                  {/* One line each: below sm the size tracks the viewport so the longest
                      point fits beside its 52px tile (about 24px of width per px of
                      font); from sm up 20px fits the narrowest column. */}
                  <span className="text-[min(1.125rem,calc((100vw-5.5rem)/24))] leading-snug font-medium whitespace-nowrap text-slate-800 sm:text-xl">{point.text}</span>
                </li>
              ))}
            </ul>
            <div className="flex flex-col items-start gap-3 pt-2">
              {/* Lands on the picks row itself, not the section heading above it,
                  so the products are on screen after the jump. */}
              <Link id="healthy-hero-cta" href="#healthy-picks-row" className={primaryCta}>
                See Brian&apos;s Choices
                <Icon name="arrow" size={20} className="ml-2 text-kinetic-teal-on-dark" />
              </Link>
              <p className="font-kinetic-heading text-base font-semibold text-kinetic-primary-electric italic">
                Brian&apos;s done the work so you don&apos;t have to.
              </p>
            </div>
          </div>
        </div>

        {/* The couple stand in the right half of the frame, so the crop anchors
            right to keep both of them clear of the feathered side. On large
            screens the wide section crops the photo vertically, so it also
            anchors to the top to keep their heads in frame. */}
        <div className="relative mt-16 h-72 sm:mt-10 sm:h-96 lg:absolute lg:inset-0 lg:mt-0 lg:h-auto">
          <Image
            src="/healthy/hero-couple-v2.jpg"
            alt="A couple in their fifties hiking a coastal trail at sunrise"
            fill
            sizes="100vw"
            className="animate-kinetic-hero-zoom object-cover object-right lg:origin-top lg:object-[right_top]"
            priority
          />
          <div
            className="healthy-hero-feather absolute inset-0 bg-gradient-to-b from-white via-white/0 via-35% to-transparent"
            aria-hidden="true"
          />
          {/* Caption legibility: a scrim on the small-screen band; on large screens a text
              shadow instead, since a scrim there would grey the feathered copy side. */}
          <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-slate-950/60 to-transparent lg:hidden" aria-hidden="true" />
          {/* left-36/left-64: below lg the mascot stands in the bottom-left of
              this band, so the caption keeps clear of him and wraps sooner. */}
          <p className="absolute right-4 bottom-4 left-36 text-right text-sm font-semibold text-white [text-shadow:0_1px_10px_rgba(2,6,23,0.75)] sm:right-6 sm:left-64 lg:left-4">
            An active, evidence-checked routine for the decades ahead
          </p>
        </div>

        {/* The mascot bursts out of the hero button and lands here, at the foot
            of the hero. His ground is the section's bottom edge; the inner box
            repeats the copy column's container so he lines up with it. */}
        <div className="absolute inset-x-0 bottom-0 z-20">
          <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
            <HealthyHeroMascot
              originSelector="#healthy-hero-cta"
              // Wider than the figure: his canvas keeps a fifth of its width
              // free on the left for the waving hand. The offsets are set so
              // the figure, not the box, clears the copy and the caption.
              className="absolute bottom-0 left-0 w-[clamp(7.9rem,29vw,13.4rem)] sm:left-4 lg:left-[22.5rem] xl:left-[25rem]"
            />
          </div>
        </div>
      </section>

      {/* GOAL SELECTOR */}
      <section id="start" aria-labelledby="start-heading" className="scroll-mt-6 border-b border-slate-200 bg-slate-50 py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <span className="mb-1 block text-xs font-extrabold tracking-widest text-kinetic-primary-electric uppercase">
            Start with your goal
          </span>
          <h2 id="start-heading" className="font-kinetic-heading text-3xl font-extrabold tracking-tight text-slate-950 sm:text-4xl">
            What do you need to boost?
          </h2>
          <div className="mt-8">
            <GoalChooser region={region} />
          </div>
        </div>
      </section>

      {/* CURRENT PICKS */}
      <section id="picks" aria-labelledby="picks-heading" className="border-b border-slate-200 bg-white py-16 sm:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mb-10 flex flex-col justify-between gap-4 md:flex-row md:items-end">
            <div className="max-w-2xl">
              <span className="mb-1 block text-xs font-extrabold tracking-widest text-kinetic-primary-electric uppercase">
                Brian&apos;s picks
              </span>
              <h2 id="picks-heading" className="font-kinetic-heading text-3xl font-extrabold tracking-tight text-slate-950 sm:text-4xl">
                Brian&apos;s Healthy Longevity Plan Starts Here...
              </h2>
            </div>
          </div>
          {/* Phones don't get the site-wide disclosure bar (layout.tsx), so it
              sits here instead, above the Buy buttons it covers. */}
          <p className="-mt-6 mb-6 text-xs text-slate-500 sm:hidden">
            {AMAZON_ASSOCIATE_STATEMENT} Brian may earn a commission when you buy through these links.{" "}
            <Link href="/disclosures" className="font-semibold underline">
              How that works
            </Link>
          </p>
          <JobRail products={products} region={region} />
        </div>
      </section>

      {/* EMAIL UPDATES: shown only once the Resend variables are set (see newsletter.ts). */}
      {signupEnabled() && (
        <section aria-labelledby="updates-heading" className="border-b border-slate-200 bg-white py-16 sm:py-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <Signup />
          </div>
        </section>
      )}

      {/* HOW BRIAN PICKS: one continuous loop (pick-loop.tsx). AI gathers the
          research, the checks run, a person signs off, and the re-check sends it
          round again, with the animated mascot at the centre and the mascot
          promo video beside it. */}
      <section aria-labelledby="why-heading" className="border-b border-slate-200 bg-slate-50 py-16 sm:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
            <div className="max-w-2xl">
              <span className="mb-1 block text-xs font-extrabold tracking-widest text-kinetic-primary-electric uppercase">
                How Brian picks
              </span>
              <h2 id="why-heading" className="font-kinetic-heading text-3xl font-extrabold tracking-tight text-slate-950 sm:text-4xl">
                How Brian Gets You Healthy
              </h2>
            </div>
            <Link href="/why-these-picks" className="group inline-flex min-h-11 items-center text-sm font-bold text-kinetic-primary hover:text-kinetic-primary-electric">
              See the full comparison
              <Icon name="arrow" size={18} className="ml-1 transition-transform group-hover:translate-x-1.5" />
            </Link>
          </div>
          {/* The promo video and the loop share one row, half the width each;
              below lg the video sits above the loop's list. */}
          <div className="mt-10 grid grid-cols-1 items-center gap-10 lg:grid-cols-2">
            <PromoVideo className="max-w-md lg:max-w-none" />
            <div>
              <PickLoop />
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" aria-labelledby="faq-heading" className="border-b border-slate-200 bg-white py-16 sm:py-24">
        <div className="mx-auto max-w-[840px] px-4 sm:px-6">
          <div className="mb-12 text-center">
            <span className="mb-1 block text-xs font-extrabold tracking-widest text-kinetic-primary-electric uppercase">
              Straight answers
            </span>
            <h2 id="faq-heading" className="font-kinetic-heading text-3xl font-extrabold tracking-tight text-slate-950 sm:text-4xl">
              Questions
            </h2>
          </div>
          <dl className="space-y-3">
            {faqs.map((f) => (
              <details key={f.question} className="group rounded-xl border border-slate-200 bg-slate-50 transition-all hover:bg-slate-100/80">
                {/* The padding sits on the summary, so the whole row is the tap target, not just the text. */}
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-xl p-5 text-left marker:content-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kinetic-primary-electric">
                  <span className="font-kinetic-heading text-base font-bold text-slate-900 sm:text-lg">{f.question}</span>
                  <Icon name="plus" size={22} className="text-slate-400 transition-transform duration-200 group-open:rotate-45" />
                </summary>
                <dd className="px-5 pb-5 text-sm leading-relaxed text-slate-600">{f.answer}</dd>
              </details>
            ))}
          </dl>
          <p className="mt-6 text-center text-sm text-slate-600">
            More detail:{" "}
            <Link href="/why-these-picks" className="inline-flex min-h-11 items-center font-semibold text-kinetic-primary underline underline-offset-4 hover:text-kinetic-primary-electric">
              Why these picks
            </Link>{" "}
            and{" "}
            <Link href="/about" className="inline-flex min-h-11 items-center font-semibold text-kinetic-primary underline underline-offset-4 hover:text-kinetic-primary-electric">
              who is behind this
            </Link>
            .
          </p>
        </div>
      </section>

      {/* FINAL CTA */}
      <section aria-labelledby="close-heading" className="relative overflow-hidden bg-slate-950 py-20 text-white sm:py-24">
        <div className="blob blob-kinetic-primary pointer-events-none absolute -top-32 -left-32 h-96 w-96" aria-hidden="true" />
        <div className="blob blob-kinetic-cyan pointer-events-none absolute -bottom-32 -right-32 h-96 w-96" aria-hidden="true" />
        <div className="relative z-10 mx-auto max-w-6xl px-4 text-center sm:px-6">
          <h2 id="close-heading" className="mx-auto max-w-3xl font-kinetic-heading text-3xl leading-tight font-extrabold text-balance text-white sm:text-5xl lg:text-6xl">
            Ready? Pick the one that matches your goal.
          </h2>
          <p className="mx-auto mt-4 mb-10 max-w-2xl text-base leading-relaxed text-slate-400 sm:text-lg">
            One job, not a cabinet full of bottles. Check with your doctor first if you take
            medication.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            {/* Orange is kept for retailer (Buy) buttons only. One button per goal,
                each straight to that goal's review, rather than back up the page. */}
            {tileGoals.map((baseGoal) => {
              const goal = localizeGoal(baseGoal, region);
              const s = localizeSupplement(getSupplement(goal.supplement), region);
              const review = supplementHref(s, region);
              return (
                <Link
                  key={goal.id}
                  href={review ?? "#start"}
                  className="inline-flex min-h-12 items-center justify-center rounded-xl bg-white px-6 py-3.5 font-bold text-slate-950 transition-colors hover:bg-slate-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                >
                  <Icon name={goal.icon} size={18} className="mr-2 text-kinetic-teal" />
                  {goal.label}: {s.name}
                </Link>
              );
            })}
          </div>
          <div className="mt-4 flex justify-center">
            <Link href="/disclosures" className="inline-flex min-h-11 items-center px-2 text-sm font-semibold text-slate-300 underline underline-offset-4 hover:text-white">
              How we earn money
            </Link>
          </div>
          <div className="mx-auto mt-14 max-w-3xl text-left">
            <FdaDisclaimer dark region={region} />
          </div>
        </div>
      </section>
    </>
  );
}
