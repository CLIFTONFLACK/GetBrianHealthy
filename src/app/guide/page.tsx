import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { FdaDisclaimer } from "../components";
import { Icon, type IconName } from "../icons";
import { healthyOpenGraph, ogImages } from "../layout";
import { guideSignupEnabled } from "../newsletter";
import { getRegion } from "../region-server";
import { GuideSignup } from "./guide-signup";

const TITLE = "Free guide: Energy. Strength. Calm.";
const DESCRIPTION =
  "Brian's free 19-page guide for adults 40+: what 18 clinical papers say about magnesium, creatine and L-theanine, plus the food, training and sleep habits that do most of the work.";

/** UK visitors get a neutral title and description, to match the note they see instead of the guide. */
const TITLE_GB = "Free guide";
const DESCRIPTION_GB = "GetBrian Healthy's free guide is written for US readers. A UK edition is being prepared.";

export async function generateMetadata(): Promise<Metadata> {
  const gb = (await getRegion()) === "GB";
  const title = gb ? TITLE_GB : TITLE;
  const description = gb ? DESCRIPTION_GB : DESCRIPTION;
  return {
    title,
    description,
    alternates: { canonical: "/guide" },
    openGraph: {
      ...healthyOpenGraph,
      title,
      description,
      url: "/guide",
      ...(gb ? {} : { images: [ogImages.guide] }),
    },
  };
}

/** What the reader gets, in the order the guide covers it. */
const INSIDE: { icon: IconName; title: string; body: string }[] = [
  {
    icon: "zap",
    title: "Energy",
    body: "The one-day food plan that covers your magnesium target before any supplement, and an honest look at magnesium and sleep.",
  },
  {
    icon: "dumbbell",
    title: "Strength",
    body: "What 22 trials found when adults aged 57 to 70 on average added creatine to lifting, plus how much protein to aim for.",
  },
  {
    icon: "moon",
    title: "Calm",
    body: "The tea amino acid researchers tested on stressful days, and a free 5-minute breathing reset.",
  },
  {
    icon: "seal",
    title: "Brian's label audit",
    body: "The four checks every pick must pass, and three red flags to spot on any bottle.",
  },
  {
    icon: "book",
    title: "A 7-day starter plan",
    body: "Small, specific steps for each goal, plus a one-page evidence scorecard you can screenshot.",
  },
];

const PREVIEWS = [
  { src: "/healthy/guide/page-method.webp", alt: "Guide page: How Brian audits a supplement, four steps from research to safety and cost" },
  { src: "/healthy/guide/page-strength.webp", alt: "Guide page: Lift, eat enough protein, then add creatine, with the trial results" },
  { src: "/healthy/guide/page-scorecard.webp", alt: "Guide page: the evidence scorecard, every claim with its grade and source" },
];

const STATS = [
  { value: "18", label: "peer-reviewed papers, each checked" },
  { value: "3", label: "supplement labels audited" },
  { value: "19", label: "pages, every claim graded" },
  { value: "7", label: "day starter plan" },
];

const ctaClass =
  "inline-flex min-h-12 items-center rounded-xl bg-kinetic-primary px-6 py-3.5 font-bold text-white shadow-[0_8px_20px_rgba(10,29,59,0.25)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-kinetic-primary-hover focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-kinetic-primary-electric";

/** The form, or a plain note while the guide list is not configured. */
function SignupOrNotice({ enabled }: { enabled: boolean }) {
  if (enabled) return <GuideSignup />;
  return (
    <p id="get-the-guide" className="scroll-mt-24 rounded-2xl border border-slate-200 bg-white p-5 text-base text-slate-700" data-guide-closed>
      The guide opens for downloads soon. In the meantime, <Link href="/" className="font-semibold text-kinetic-primary-electric underline">see Brian&apos;s current picks</Link>.
    </p>
  );
}

/**
 * Landing page for the free ebook, the target of the ManyChat DM button.
 * The guide makes US structure/function statements (L-theanine above all),
 * which are not authorised in Great Britain, so UK visitors get a short note
 * and no form instead.
 */
export default async function GuidePage() {
  const region = await getRegion();

  if (region === "GB") {
    return (
      <div className="px-4 py-12 sm:px-6 sm:py-16" data-guide-gb>
        <div className="mx-auto max-w-3xl space-y-5">
          <p className="text-sm font-semibold tracking-wider text-kinetic-primary-electric uppercase">Free guide</p>
          <h1 className="font-kinetic-heading text-4xl font-extrabold tracking-tight text-kinetic-primary sm:text-5xl">
            Brian&apos;s guide is coming to the UK
          </h1>
          <p className="text-lg leading-relaxed text-slate-700">
            Our first guide is written for readers in the United States, under US rules on what supplements may say. A UK
            edition is being prepared.
          </p>
          <Link href="/" className={ctaClass}>
            See Brian&apos;s UK picks
          </Link>
        </div>
      </div>
    );
  }

  const enabled = guideSignupEnabled();

  return (
    <>
      {/* HERO */}
      <section className="relative overflow-hidden border-b border-slate-200 bg-white pt-6 pb-12 sm:pt-12 sm:pb-16">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 sm:px-6 lg:grid-cols-[1fr_24rem]">
          <div className="animate-fade-in-up space-y-5">
            <span className="block text-xs font-extrabold tracking-widest text-kinetic-primary-electric uppercase">
              Free guide for adults 40+
            </span>
            <h1 className="font-kinetic-heading text-5xl leading-[1.02] font-extrabold tracking-tight text-kinetic-primary sm:text-7xl">
              Energy. Strength. <span className="text-kinetic-primary-electric">Calm.</span>
            </h1>
            <p className="max-w-xl text-lg leading-relaxed text-slate-700">
              What 18 clinical papers really say about magnesium, creatine and L-theanine, plus the food, training and sleep
              habits that do most of the work. Checked by Brian, graded in plain words.
            </p>
            <div className="max-w-md pt-1">
              <SignupOrNotice enabled={enabled} />
            </div>
            <ul className="flex flex-wrap gap-x-5 gap-y-2 pt-1 text-sm font-semibold text-slate-600">
              <li className="flex items-center gap-1.5"><Icon name="shield" size={16} className="text-kinetic-teal" /> No brand pays to be included</li>
              <li className="flex items-center gap-1.5"><Icon name="flask" size={16} className="text-kinetic-teal" /> Every claim graded</li>
              <li className="flex items-center gap-1.5"><Icon name="refresh" size={16} className="text-kinetic-teal" /> Re-checked every 6 months</li>
            </ul>
          </div>
          <div className="mx-auto w-64 sm:w-80 lg:w-full">
            <Image
              src="/healthy/guide/cover.webp"
              alt="Cover of the guide Energy. Strength. Calm.: a couple walking a coastal path at sunrise, with the GetBrian mascot"
              width={900}
              height={1165}
              priority
              className="h-auto w-full rotate-2 rounded-lg shadow-[0_30px_60px_rgba(10,29,59,0.35)] ring-1 ring-slate-900/10"
            />
          </div>
        </div>
      </section>

      {/* STATS */}
      <section className="bg-brand-navy py-10 text-white">
        <dl className="mx-auto grid max-w-6xl grid-cols-2 gap-6 px-4 sm:grid-cols-4 sm:px-6">
          {STATS.map((s) => (
            <div key={s.label}>
              <dt className="sr-only">{s.label}</dt>
              <dd>
                <span className="block font-kinetic-heading text-4xl font-extrabold text-kinetic-teal-on-dark">{s.value}</span>
                <span className="mt-1 block text-sm text-slate-300">{s.label}</span>
              </dd>
            </div>
          ))}
        </dl>
      </section>

      {/* INSIDE */}
      <section aria-labelledby="inside-heading" className="px-4 py-14 sm:px-6 sm:py-20">
        <div className="mx-auto max-w-6xl">
          <h2 id="inside-heading" className="font-kinetic-heading text-3xl font-extrabold tracking-tight text-kinetic-primary sm:text-4xl">
            What&apos;s inside
          </h2>
          <ul className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {INSIDE.map((item) => (
              <li key={item.title} className="rounded-2xl border border-slate-200 bg-white p-5">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-kinetic-primary text-white">
                  <Icon name={item.icon} size={20} />
                </span>
                <h3 className="mt-3 font-kinetic-heading text-xl font-bold text-kinetic-primary">{item.title}</h3>
                <p className="mt-1.5 text-base leading-relaxed text-slate-600">{item.body}</p>
              </li>
            ))}
          </ul>

          <div className="mt-12 grid gap-6 sm:grid-cols-3">
            {PREVIEWS.map((p) => (
              <Image
                key={p.src}
                src={p.src}
                alt={p.alt}
                width={640}
                height={828}
                className="h-auto w-full rounded-lg shadow-[0_16px_36px_rgba(10,29,59,0.18)] ring-1 ring-slate-900/10"
              />
            ))}
          </div>
        </div>
      </section>

      {/* WHY BRIAN */}
      <section aria-labelledby="why-heading" className="border-y border-slate-200 bg-slate-50 px-4 py-14 sm:px-6 sm:py-20">
        <div className="mx-auto max-w-3xl text-center">
          <h2 id="why-heading" className="font-kinetic-heading text-3xl font-extrabold tracking-tight text-kinetic-primary sm:text-4xl">
            Most supplement advice skips the boring part
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-slate-700">
            Brian reads the reviews and trials first, then holds a real label up against them: the form, the dose, the testing
            and the safety notes. The guide also tells you where the evidence is thin, and where a placebo did just as well.
          </p>
          <div className="mt-8">
            <Link href="#get-the-guide" className={ctaClass}>
              Get the free guide
            </Link>
          </div>
          <p className="mt-6 text-sm text-slate-500">
            Brian is the voice of GetBrian. The research is gathered with the help of AI tools, then checked and signed off by
            Clifton Flack, who founded GetBrian. <Link href="/method" className="underline">How Brian picks</Link>
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <FdaDisclaimer region={region} />
      </div>
    </>
  );
}
