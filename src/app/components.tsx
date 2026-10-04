import Image from "next/image";
import Link from "next/link";
import {
  buyHref,
  costPerServing,
  formatPrice,
  formatPriceTime,
  AMAZON_ASSOCIATE_STATEMENT,
  getSupplement,
  localizeGoal,
  localizeSupplement,
  pickFor,
  tileGoals,
  gradeLabels,
  retailerName,
  supplementFor,
  type EvidenceGrade,
  type GoalAccent,
  type Product,
  type Supplement,
} from "./data";
import { Icon } from "./icons";
import type { Region } from "./region";

/** Shared reading column for prose pages. */
export function Prose({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-5 text-fg-muted [&_a]:text-kinetic-primary-electric [&_a]:underline [&_h2]:mt-12 [&_h2]:font-heading [&_h2]:text-2xl [&_h2]:font-semibold [&_h2]:text-fg [&_h3]:mt-8 [&_h3]:font-heading [&_h3]:text-xl [&_h3]:font-semibold [&_h3]:text-fg [&_li]:leading-relaxed [&_p]:leading-relaxed [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-6">
      {children}
    </div>
  );
}

export function PageHeading({
  eyebrow,
  title,
  lead,
}: {
  eyebrow?: string;
  title: string;
  lead?: string;
}) {
  return (
    <div className="max-w-3xl">
      {eyebrow && (
        <p className="text-sm font-semibold uppercase tracking-wider text-kinetic-primary-electric">{eyebrow}</p>
      )}
      <h1 className="mt-3 font-heading text-4xl font-semibold tracking-tight text-brand-navy text-balance sm:text-5xl">
        {title}
      </h1>
      {lead && <p className="mt-5 text-xl leading-relaxed text-fg-muted text-pretty">{lead}</p>}
    </div>
  );
}

/**
 * Written out beside the Buy button on product pages, because FTC guidance
 * expects the disclosure where the endorsement is, not only in a footer. The
 * homepage cards leave it out and rely on the site-wide banner in layout.tsx.
 */
export const AFFILIATE_DISCLOSURE = `${AMAZON_ASSOCIATE_STATEMENT} If you buy through this link, GetBrian may earn a commission at no extra cost to you. It never decides which products we pick.`;

/**
 * The Buy button goes through our own /go redirect while it points at
 * a plain brand URL, so clicks are counted from day one. Once a programme
 * issues an affiliate link it goes direct, unless that programme's terms allow
 * redirects (see `usesRedirect` in data.ts).
 */
export function BuyButton({
  product,
  from,
  showDisclosure = true,
  label,
  compact = false,
}: {
  product: Product;
  from: string;
  showDisclosure?: boolean;
  /** Overrides the default "Check price at <retailer>" wording. */
  label?: string;
  /** Tighter padding and smaller text, for a half-width slot beside another button. */
  compact?: boolean;
}) {
  const sizing = compact ? "px-3 text-sm" : "px-6";
  return (
    <div className="flex flex-col gap-3">
      <a
        href={buyHref(product, from)}
        target="_blank"
        rel="sponsored nofollow noopener"
        className={`inline-flex min-h-12 items-center justify-center whitespace-nowrap rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 py-3 font-bold ${sizing} text-fg shadow-[0_4px_14px_rgba(217,119,6,0.3)] transition-all duration-200 hover:-translate-y-0.5 hover:from-amber-400 hover:to-amber-500 hover:shadow-[0_6px_20px_rgba(217,119,6,0.4)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kinetic-primary-electric`}
      >
        {label ?? `Check price at ${retailerName(product)}`}
        <span className="sr-only"> (opens in a new tab)</span>
      </a>
      {showDisclosure && (
        <p className="text-sm leading-relaxed text-fg-subtle" data-affiliate-disclosure>
          {AFFILIATE_DISCLOSURE}
        </p>
      )}
    </div>
  );
}

export function GradeBadge({ grade }: { grade: EvidenceGrade }) {
  const tone: Record<EvidenceGrade, string> = {
    strong: "bg-green-100 text-green-800 border border-green-200",
    moderate: "bg-slate-100 text-brand-navy border border-slate-300",
    early: "bg-amber-100 text-amber-900 border border-amber-200",
  };
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm font-bold ${tone[grade]}`}
      title={gradeLabels[grade].meaning}
    >
      <Icon name="badgeCheck" size={15} />
      {gradeLabels[grade].label}
    </span>
  );
}

/** Rendered wherever a figure is still `null` in data.ts. Never a guess. */
export function Pending() {
  return <span className="text-fg-subtle italic">Being verified</span>;
}

export function DraftBanner() {
  return (
    <div
      role="note"
      className="rounded-xl border border-kinetic-teal/40 bg-kinetic-primary-light px-5 py-4 text-base text-fg"
    >
      <strong className="font-semibold">Draft review.</strong> Label figures, prices and citations
      on this page are still being checked against the manufacturer and the published research.
    </div>
  );
}

/**
 * Required alongside structure/function statements on supplements in the US
 * (DSHEA, 21 U.S.C. 343(r)(6)). The FDA wording means nothing to a UK reader,
 * so the UK version says what applies there instead.
 */
export function FdaDisclaimer({ dark = false, region = "US" }: { dark?: boolean; region?: Region } = {}) {
  const toneClass = dark
    ? "border-slate-800 bg-slate-900/90 text-slate-400"
    : "border-border bg-bg-panel text-fg-muted";
  if (region === "GB") {
    return (
      <p className={`rounded-xl border px-5 py-4 text-sm leading-relaxed ${toneClass}`} data-uk-disclaimer>
        Food supplements should not replace a varied, balanced diet and a healthy lifestyle. Do not
        exceed the recommended intake on the label. This page is general information, not medical
        advice. Talk to your doctor or pharmacist before starting a supplement, especially if you
        are pregnant or breastfeeding, have a medical condition or take medication.
      </p>
    );
  }
  return (
    <p className={`rounded-xl border px-5 py-4 text-sm leading-relaxed ${toneClass}`} data-fda-disclaimer>
      These statements have not been evaluated by the Food and Drug Administration. These
      products are not intended to diagnose, treat, cure, or prevent any disease. This page is
      general information, not medical advice. Talk to your doctor before starting a supplement,
      especially if you are pregnant, have a medical condition or take medication.
    </p>
  );
}

/** The price on show: Amazon's live price when we have a fresh one, else a stored one, in that price's own currency. */
function shownPrice(product: Product): { amount: number; currency: "USD" | "GBP" } | null {
  if (product.livePrice) return product.livePrice;
  return product.priceUsd !== null ? { amount: product.priceUsd, currency: "USD" } : null;
}

/** What stands where a price would be: Amazon's live price if fresh, else a pointer to Amazon for it. */
export function PriceLine({ product }: { product: Product }) {
  const price = shownPrice(product);
  if (price) return <span>{formatPrice(price.amount, price.currency)}</span>;
  if (product.retailer) return <span className="text-fg-muted">Price on {product.retailer}</span>;
  return <Pending />;
}

export function ProductCard({
  product,
  region = "US",
  showImage = true,
}: {
  product: Product;
  region?: Region;
  /** False when a sibling card has no packshot, so the row stays even instead of one card standing taller. */
  showImage?: boolean;
}) {
  const perServing = costPerServing(product);
  const price = shownPrice(product);
  const baseSupplement = supplementFor(product);
  const role = baseSupplement ? localizeSupplement(baseSupplement, region).role : undefined;
  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-md transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl">
      {showImage && product.image && (
        // The packshots are trimmed to the pack itself, so the image sits
        // inside the panel at its own size.
        <div className="relative h-[180px] overflow-hidden border-b lg:h-[220px] border-slate-100 bg-gradient-to-b from-slate-50 to-slate-100/70">
          <Image
            src={product.image}
            alt={product.imageAlt}
            fill
            sizes="(min-width: 1024px) 33vw, 85vw"
            className="object-contain p-3 drop-shadow-md transition-transform duration-300 group-hover:scale-105"
          />
        </div>
      )}
      <div className="flex flex-1 flex-col p-5 lg:p-6">
        {/* At least two lines tall, whatever the role's length, so every card's
            name and price start at the same height across the row. Not clamped:
            on the narrowest phones the longest role runs to a third line rather
            than losing its end, and there the carousel shows one card at a time. */}
        <span className="mb-1.5 block min-h-[2lh] text-[11px] font-extrabold tracking-wider text-slate-500 uppercase">
          {product.category}
          {role && <span className="font-medium normal-case text-slate-400"> &middot; {role}</span>}
        </span>
        {/* The brand sits on its own line inside the link, so every card's name
            starts at the same height and the link is a full-height tap target. */}
        <h3 className="mb-4 font-kinetic-heading text-xl font-bold tracking-tight text-slate-950">
          <Link href={`/products/${product.slug}`} className="flex min-h-11 flex-col justify-center hover:underline">
            <span className="text-sm font-semibold tracking-normal text-slate-500">{product.brand}</span>
            {/* A real space, so the link reads "Thorne Theanine" to screen readers and crawlers. */}
            {" "}
            {product.name}
          </Link>
        </h3>

        <div className="mb-4 flex items-baseline gap-2 rounded-xl border border-slate-200/80 bg-slate-50 p-3">
          {price ? (
            <span className="font-kinetic-heading text-2xl font-extrabold text-slate-950">{formatPrice(price.amount, price.currency)}</span>
          ) : product.retailer ? (
            <span className="text-sm font-semibold text-slate-700">Current price on {product.retailer}</span>
          ) : (
            <Pending />
          )}
          {perServing !== null && (
            <span className="text-xs font-semibold text-slate-500">
              {/* Kept this short on purpose: anything longer wraps on a 375px phone and grows the card. */}
              {product.servingsPerContainer} ct &middot; {formatPrice(perServing, price?.currency)}/serving
            </span>
          )}
        </div>

        <p className="mb-4 flex-1 text-sm leading-relaxed text-slate-700 lg:mb-5">{product.summary}</p>

        {/* Below lg the notes fold away behind one tap, so the whole card and
            the carousel's dots fit on a phone screen; from lg they stay open. */}
        <details className="group/notes rounded-xl border border-slate-200/80 bg-slate-50 lg:hidden">
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 px-4 py-2 text-xs font-extrabold tracking-wider text-slate-700 uppercase [&::-webkit-details-marker]:hidden">
            Brian&rsquo;s notes
            <Icon name="chevronDown" size={16} className="transition-transform group-open/notes:rotate-180" />
          </summary>
          <BrianNotes product={product} className="px-4 pb-4" stacked />
        </details>
        <BrianNotes product={product} className="hidden rounded-xl border border-slate-200/80 bg-slate-50 p-4 lg:block" />

        {/* Side by side from 360px; stacked below that, where "View Product" no longer fits half the card. */}
        <div className="mt-5 grid grid-cols-1 gap-3 min-[360px]:grid-cols-2">
          <BuyButton product={product} from="picks" showDisclosure={false} label="Buy Now" compact />
          <Link
            href={`/products/${product.slug}`}
            className="inline-flex min-h-12 items-center justify-center whitespace-nowrap rounded-xl border-2 border-kinetic-primary px-3 py-3 text-sm font-bold text-kinetic-primary transition-colors hover:bg-kinetic-primary hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kinetic-primary-electric"
          >
            View Product
          </Link>
        </div>
        {/* Amazon wants the statement clear and close to its links, and the page banner scrolls out of view. */}
        <p className="mt-3 text-[11px] leading-snug text-slate-500" data-amazon-statement>
          {AMAZON_ASSOCIATE_STATEMENT}
        </p>
        {product.livePrice && (
          <p className="mt-1 text-[11px] leading-snug text-slate-500" data-price-time>
            Price from Amazon, {formatPriceTime(product.livePrice.fetchedAt)}. It can change; Amazon&apos;s page is current.
          </p>
        )}
      </div>
    </article>
  );
}

/** A pick's two card notes: why Brian picked it, and the advantage his check of the research found. */
function BrianNotes({ product, className, stacked = false }: { product: Product; className: string; stacked?: boolean }) {
  // Stacked (label over text) in the narrow folded version; side by side when always open.
  const row = stacked ? "flex flex-col items-start gap-1" : "flex items-start gap-2";
  return (
    <dl className={`space-y-2.5 text-xs ${className}`}>
      {product.pros[0] && (
        <>
          <div className={row}>
            <dt className="shrink-0 rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-extrabold text-emerald-700 uppercase">Why Brian picked it</dt>
            <dd className="font-medium text-slate-700">{product.pros[0]}</dd>
          </div>
          <div className="h-px w-full bg-slate-200" />
        </>
      )}
      <div className={row}>
        <dt className="shrink-0 rounded bg-kinetic-primary-light px-1.5 py-0.5 text-[10px] font-extrabold text-kinetic-primary-electric uppercase">The advantage</dt>
        <dd className="font-medium text-slate-700">{product.advantage}</dd>
      </div>
    </dl>
  );
}

/**
 * Where a supplement's review lives: its product page once a pick exists,
 * nothing yet when there is none. The program keeps one pick per category on
 * purpose (see "How we choose"), so there is no separate comparison route.
 */
export function supplementHref(s: Supplement, region: Region = "US"): string | null {
  const pick = s.category ? pickFor(s.category, region) : undefined;
  return pick ? `/products/${pick.slug}` : null;
}

/*
 * Every goal tile takes the logo teal: the Healthy palette has one accent, and
 * amber is kept for Buy buttons. The per-goal `accent` values in data.ts date
 * from the earlier four-colour brief. They stay, and these maps stay keyed on
 * them, only until the healthy-ux-review branch (which rewrites the goal
 * entries and the tile markup) has landed; then drop both.
 */
const GOAL_ACCENT_CHIP: Record<GoalAccent, string> = {
  amber: "bg-kinetic-teal/90",
  primary: "bg-kinetic-teal/90",
  purple: "bg-kinetic-teal/90",
  cyan: "bg-kinetic-teal/90",
};

const GOAL_ACCENT_TEXT: Record<GoalAccent, string> = {
  amber: "text-kinetic-teal-on-dark group-hover:text-white",
  primary: "text-kinetic-teal-on-dark group-hover:text-white",
  purple: "text-kinetic-teal-on-dark group-hover:text-white",
  cyan: "text-kinetic-teal-on-dark group-hover:text-white",
};

/** "What do you need to boost?" Each tile links straight to that goal's review. */
export function GoalChooser({ region = "US" }: { region?: Region } = {}) {
  return (
    <ul className="grid grid-cols-1 gap-6 md:grid-cols-3">
      {tileGoals.map((baseGoal) => {
        const goal = localizeGoal(baseGoal, region);
        const s = localizeSupplement(getSupplement(goal.supplement), region);
        const review = supplementHref(s, region);
        const href = review ? (goal.section ? `${review}#${goal.section}` : review) : `#${s.id}`;
        return (
          <li key={goal.id}>
            <Link
              href={href}
              className="group relative flex min-h-[280px] flex-col sm:min-h-[420px] justify-end overflow-hidden rounded-xl border border-slate-200 bg-slate-900 p-6 shadow-md transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kinetic-primary-electric"
            >
              <Image
                src={goal.image}
                alt={goal.imageAlt}
                fill
                sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 90vw"
                className="absolute inset-0 object-cover transition-transform duration-700 ease-out group-hover:scale-105"
              />
              {/* Shade only the lower half, where the text sits; the photo stays clear above it. */}
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 from-10% via-slate-950/45 via-40% to-transparent to-70%" />
              <div className="relative z-10">
                <div className={`mb-3 flex h-10 w-10 items-center justify-center rounded-lg text-white shadow-sm backdrop-blur-md ${GOAL_ACCENT_CHIP[goal.accent]}`}>
                  <Icon name={goal.icon} size={20} />
                </div>
                <span className={`mb-1 block text-[11px] font-extrabold tracking-wider uppercase ${GOAL_ACCENT_TEXT[goal.accent]}`}>
                  {s.name} &middot; {goal.eyebrowDetail}
                </span>
                <span className="mb-2 block font-kinetic-heading text-xl font-bold leading-tight text-white">{goal.label}</span>
                {/* Two lines on every tile, so icons, labels and links line up across the row. */}
                <p className="mb-4 min-h-[2lh] text-sm leading-relaxed text-slate-200">{goal.hook}</p>
                <span className={`inline-flex items-center text-xs font-bold uppercase tracking-wider transition-colors ${GOAL_ACCENT_TEXT[goal.accent]}`}>
                  {s.name} Review
                  <Icon name="arrow" size={16} className="ml-1 transition-transform group-hover:translate-x-1.5" />
                </span>
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export function SupplementCard({
  supplement,
  headingLevel = 3,
  currentHref,
  region = "US",
}: {
  supplement: Supplement;
  headingLevel?: 2 | 3;
  /** The page this card sits on. Its link is dropped rather than pointing back at the same page. */
  currentHref?: string;
  region?: Region;
}) {
  const href = supplementHref(supplement, region);
  const isSelf = href !== null && href === currentHref;
  const Heading = headingLevel === 2 ? "h2" : "h3";
  return (
    <article id={supplement.id} className="flex h-full scroll-mt-6 flex-col rounded-2xl border border-border bg-bg p-6">
      <Heading className="font-heading text-2xl font-semibold text-brand-navy">{supplement.name}</Heading>
      <dl className="mt-4 flex-1 space-y-4">
        <div>
          <dt className="text-sm font-semibold uppercase tracking-wider text-kinetic-primary-electric">Primary role</dt>
          <dd className="mt-1 font-medium text-fg">{supplement.role}</dd>
        </div>
        <div>
          <dt className="text-sm font-semibold uppercase tracking-wider text-kinetic-primary-electric">
            Contribution to healthy aging
          </dt>
          <dd className="mt-1 leading-relaxed text-fg-muted">{supplement.contribution}</dd>
          {supplement.caveat && (
            <dd className="mt-2 rounded-lg bg-bg-panel px-3 py-2 text-base leading-relaxed text-fg-muted">
              <strong className="font-semibold text-fg">Honest caveat:</strong> {supplement.caveat}
            </dd>
          )}
        </div>
      </dl>
      {isSelf ? null : href ? (
        <a
          href={href}
          className="mt-6 inline-flex min-h-11 items-center font-semibold text-kinetic-primary-electric underline underline-offset-4"
        >
          Read the {supplement.name.toLowerCase()} review
        </a>
      ) : (
        <p className="mt-6 text-base text-fg-subtle">Brian&apos;s review is in progress.</p>
      )}
    </article>
  );
}
