import type { Metadata } from "next";
import Link from "next/link";
import { healthyOpenGraph } from "../layout";
import { FdaDisclaimer, GradeBadge, PageHeading, Prose } from "../components";
import { getProductFor, gradeLabels, productsFor, type EvidenceGrade } from "../data";
import type { Region } from "../region";
import { getRegion } from "../region-server";
import { references, type ProductReference } from "./references";

const grades: EvidenceGrade[] = ["strong", "moderate", "early"];

const title = "Why these picks";
const description =
  "How each current pick was chosen, what its brand claims about testing and research, and the independent evidence grade Brian assigns each claim.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/why-these-picks" },
  openGraph: { ...healthyOpenGraph, title, description, url: "/why-these-picks" },
};

function BrandCard({ entry: base, region }: { entry: ProductReference; region: Region }) {
  const product = getProductFor(base.slug, region);
  if (!product) return null;
  const r = region === "GB" && base.gb ? { ...base, ...base.gb } : base;
  return (
    <div className="rounded-2xl border border-border p-6">
      <p className="text-sm font-semibold uppercase tracking-wider text-kinetic-primary-electric">{product.category}</p>
      <h3 className="mt-1 font-heading text-xl font-semibold text-brand-navy">
        <Link href={`/products/${product.slug}`} className="underline-offset-4 hover:underline">
          {product.brand} {product.name}
        </Link>
      </h3>
      <p className="mt-2 text-sm text-fg-subtle">
        Also considered: {r.alsoConsidered.join("; ")}.
      </p>

      <h4 className="mt-5 text-sm font-semibold uppercase tracking-wider text-fg-subtle">What the brand claims</h4>
      <ul className="mt-2 space-y-3">
        {r.brandClaims.map((c) => (
          <li key={c.claim} className="text-base leading-relaxed">
            <span className="text-fg">&ldquo;{c.claim.replace(/[“”]/g, "")}&rdquo;</span>
            <span className="block text-sm text-fg-subtle">&mdash; {c.source}</span>
          </li>
        ))}
      </ul>

      <h4 className="mt-5 text-sm font-semibold uppercase tracking-wider text-fg-subtle">Brian&apos;s read</h4>
      <p className="mt-2 leading-relaxed text-fg-muted">{r.ourRead}</p>
    </div>
  );
}

export default async function WhyThesePicksPage() {
  const region = await getRegion();
  // Only the picks sold in this visitor's country, so no reference points at a product they cannot buy.
  const inRegion = new Set(productsFor(region).map((p) => p.slug));
  const shown = references.filter((r) => inRegion.has(r.slug));
  return (
    <div className="px-4 py-12 sm:px-6 sm:py-16">
      <div className="mx-auto max-w-4xl">
        <PageHeading
          eyebrow="Why these picks"
          title="How each pick was chosen, and what its brand claims"
          lead="Brian grades the ingredient first and the label second, and only then picks a product. These are the receipts: what each brand claims, what the evidence actually supports, and the alternatives each pick beat."
        />

        <div className="mt-12">
          <Prose>
            <h2>Why these brands</h2>
            <ul>
              <li>Every pick has a single named ingredient at a fixed dose, so the label matches what the research actually studied instead of a proprietary blend.</li>
              <li>Where a pick carries an independent testing mark, such as NSF Certified for Sport (a mark issued by NSF International, not the brand), we name it. Where we found none, we say that instead.</li>
              <li>Every pick is sold on Amazon in your country, so there is one listing to check. This site shows no price, because Amazon&apos;s own page has the current one.</li>
              <li>The same brand is not sold everywhere. The picks you see follow your country, and you can switch it in the footer.</li>
            </ul>
            <p>
              None of that is a substitute for the ingredient-level evidence review each product page carries. If a better-evidenced or better-priced option appears in a re-check, the pick changes; this page gets updated when it does.
            </p>
          </Prose>
        </div>

        <div className="mt-14 space-y-10">
          <h2 className="font-heading text-2xl font-semibold text-brand-navy">
            Claim by claim: brand copy vs. the evidence grade
          </h2>
          {shown.map((r) => (
            <BrandCard key={r.slug} entry={r} region={region} />
          ))}
        </div>

        <div className="mt-14 max-w-3xl">
          <Prose>
            <h2>How to read the grades</h2>
            <p>
              Every claim above still carries one of three grades, explained in full in{" "}
              <Link href="/method">how we choose</Link>:
            </p>
            <ul>
              {grades.map((g) => (
                <li key={g}>
                  <GradeBadge grade={g} /> &mdash; {gradeLabels[g].meaning}
                </li>
              ))}
            </ul>
            <p>
              A brand&apos;s own marketing claim never raises a grade on its own. It has to be backed by the kind
              of independent citation shown on each product page.
            </p>
          </Prose>
        </div>

        <div className="mt-12 max-w-3xl">
          <FdaDisclaimer region={region} />
        </div>
      </div>
    </div>
  );
}
