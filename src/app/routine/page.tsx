import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { FdaDisclaimer } from "../components";
import { Icon } from "../icons";
import { healthyOpenGraph } from "../layout";
import { PromoVideo } from "../promo-video";
import { getRegion } from "../region-server";
import { RoutinePlanner } from "../routine-planner";
import { allSteps, pickOptions } from "../routine";

const TITLE = "Daily routine";
const DESCRIPTION =
  "A one-page daily routine from GetBrian Healthy: a walk, a strength session, a wind-down and the supplement picks you choose. Tick it off online or print it for the fridge.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/routine" },
  openGraph: { ...healthyOpenGraph, title: TITLE, description: DESCRIPTION, url: "/routine" },
};

/** What the printed sheet carries in place of the page's footer. */
const PRINT_DISCLAIMER = {
  US: "These statements have not been evaluated by the Food and Drug Administration. These products are not intended to diagnose, treat, cure, or prevent any disease. General information, not medical advice. Talk to your doctor before starting a supplement, especially if you are pregnant, have a medical condition or take medication.",
  GB: "Food supplements should not replace a varied, balanced diet and a healthy lifestyle. Do not exceed the recommended intake on the label. General information, not medical advice. Talk to your doctor or pharmacist before starting a supplement, especially if you are pregnant or breastfeeding, have a medical condition or take medication.",
} as const;

export default async function RoutinePage() {
  const region = await getRegion();
  const steps = allSteps(region);
  const options = pickOptions(region);

  return (
    <>
      {/* HERO */}
      <section className="relative overflow-hidden border-b border-slate-200 bg-white pt-3 pb-12 sm:pt-10 sm:pb-16 print:hidden">
        <div className="mx-auto grid max-w-6xl items-center gap-8 px-4 sm:px-6 md:grid-cols-[1fr_auto]">
          <div className="animate-fade-in-up space-y-5">
            <span className="block text-xs font-extrabold tracking-widest text-kinetic-primary-electric uppercase">Brian&apos;s daily routine</span>
            <h1 className="font-kinetic-heading text-4xl leading-[1.05] font-extrabold tracking-tight text-kinetic-primary text-balance sm:text-6xl">
              Your whole day, <span className="text-kinetic-primary-electric">on one page.</span>
            </h1>
            <p className="max-w-xl text-lg leading-relaxed text-slate-700">
              A program is what you do on a Tuesday. Pick the job you want done, watch it slot into your day, tick it off, then print it for the
              fridge.
            </p>
            <div className="flex flex-wrap items-center gap-3 pt-1">
              <Link
                href="#rt-pick-heading"
                className="inline-flex min-h-12 items-center rounded-xl bg-kinetic-primary px-6 py-3.5 font-bold text-white shadow-[0_8px_20px_rgba(10,29,59,0.25)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-kinetic-primary-hover focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-kinetic-primary-electric"
              >
                Build my day
                <Icon name="arrow" size={20} className="ml-2 text-kinetic-teal-on-dark" />
              </Link>
              <Link
                href="#rt-week-heading"
                className="inline-flex min-h-12 items-center px-3 font-bold text-kinetic-primary underline underline-offset-4 hover:text-kinetic-primary-electric"
              >
                Jump to the printable sheet
              </Link>
            </div>
          </div>
          <Image
            src="/healthy/mascot/hero-wave.webp"
            alt="Brian's assistant, the GetBrian Healthy mascot, waving"
            width={336}
            height={320}
            unoptimized
            priority
            className="mx-auto h-auto w-56 sm:w-72"
          />
        </div>
      </section>

      <RoutinePlanner steps={steps} options={options} disclaimer={PRINT_DISCLAIMER[region]} />

      {/* BRIAN, 30 SECONDS */}
      <section aria-labelledby="rt-video-heading" className="border-b border-slate-200 bg-white py-12 sm:py-16 print:hidden">
        <div className="mx-auto grid max-w-6xl items-center gap-8 px-4 sm:px-6 md:grid-cols-2">
          <PromoVideo className="max-w-sm" />
          <div>
            <h2 id="rt-video-heading" className="font-kinetic-heading text-3xl font-extrabold tracking-tight text-slate-950 sm:text-4xl">
              Why one job, not a cabinet full of bottles
            </h2>
            <p className="mt-3 max-w-xl text-base leading-relaxed text-slate-600">
              Each pick does a different job, and taking more than one has not been shown to work better than one. Start with the job that matters
              most to you, and see{" "}
              <Link href="/why-these-picks" className="font-semibold text-kinetic-primary-electric underline underline-offset-4">
                why these picks
              </Link>
              .
            </p>
          </div>
        </div>
      </section>

      <section className="bg-white pb-16 print:hidden">
        <div className="mx-auto max-w-3xl px-4 sm:px-6">
          <FdaDisclaimer region={region} />
        </div>
      </section>
    </>
  );
}
