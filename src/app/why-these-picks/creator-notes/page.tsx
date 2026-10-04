import type { Metadata } from "next";
import Link from "next/link";
import { healthyOpenGraph } from "../../layout";
import { FdaDisclaimer, PageHeading } from "../../components";
import { getProductFor, productsFor } from "../../data";
import { REGION_LABELS } from "../../region";
import { getRegion } from "../../region-server";
import { references } from "../references";

const title = "Creator notes";
const description =
  "What is safe to say, and what not to say, when writing ad or social copy about Brian's current picks.";

/**
 * Guidance for anyone writing about the picks, not for shoppers: kept out of
 * search results and the sitemap, and not linked from the shopper pages.
 */
export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/why-these-picks/creator-notes" },
  robots: { index: false, follow: false },
  openGraph: { ...healthyOpenGraph, title, description, url: "/why-these-picks/creator-notes" },
};

export default async function CreatorNotesPage() {
  const region = await getRegion();
  // Only the picks sold in this country, so UK copy never inherits US wording and the reverse.
  const inRegion = new Set(productsFor(region).map((p) => p.slug));
  const shown = references.filter((r) => inRegion.has(r.slug));
  return (
    <div className="px-4 py-12 sm:px-6 sm:py-16">
      <div className="mx-auto max-w-4xl">
        <PageHeading
          eyebrow="For writers and creators"
          title="What to say about these picks"
          lead="Wording that matches the evidence grades on each review, and the claims to leave out. Use it for ads, captions and scripts."
        />
        <p className="mt-6 text-base text-fg-muted">
          The evidence behind each line is on{" "}
          <Link href="/why-these-picks" className="text-kinetic-primary-electric underline underline-offset-4">
            Why these picks
          </Link>{" "}
          and each product&apos;s review page. Structure/function wording only: never say a supplement
          treats, cures or prevents anything.
        </p>

        <div className="mt-12 space-y-10">
          <p className="-mb-4 text-sm text-fg-subtle">
            Showing the picks sold in the {REGION_LABELS[region]}. Change country in the footer to see the other set.
          </p>
          {shown.map((r) => {
            const product = getProductFor(r.slug, region);
            if (!product) return null;
            const say = region === "GB" && r.sayGb ? r.sayGb : r.say;
            return (
              <section key={r.slug} className="rounded-2xl border border-border p-6">
                <p className="text-sm font-semibold uppercase tracking-wider text-kinetic-primary-electric">{product.category}</p>
                <h2 className="mt-1 font-heading text-xl font-semibold text-brand-navy">
                  <Link href={`/products/${product.slug}`} className="underline-offset-4 hover:underline">
                    {product.brand} {product.name}
                  </Link>
                </h2>
                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  <div className="rounded-xl bg-bg-tint p-4">
                    <h3 className="text-sm font-semibold uppercase tracking-wider text-kinetic-primary-electric">Safe to say</h3>
                    <ul className="mt-2 list-disc space-y-2 pl-5 text-sm leading-relaxed text-fg-muted">
                      {say.map((s) => <li key={s}>{s}</li>)}
                    </ul>
                  </div>
                  <div className="rounded-xl bg-bg-panel p-4">
                    <h3 className="text-sm font-semibold uppercase tracking-wider text-fg-subtle">Don&apos;t say</h3>
                    <ul className="mt-2 list-disc space-y-2 pl-5 text-sm leading-relaxed text-fg-muted">
                      {r.dontSay.map((s) => <li key={s}>{s}</li>)}
                    </ul>
                  </div>
                </div>
              </section>
            );
          })}
        </div>

        <div className="mt-12 max-w-3xl">
          <FdaDisclaimer region={region} />
        </div>
      </div>
    </div>
  );
}
