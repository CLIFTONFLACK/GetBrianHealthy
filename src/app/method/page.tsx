import type { Metadata } from "next";
import Image from "next/image";
import { healthyOpenGraph } from "../layout";
import Link from "next/link";
import { PageHeading, Prose } from "../components";
import { gradeLabels, type EvidenceGrade } from "../data";

const title = "How we choose";
const description =
  "How Brian's Human Longevity Program picks supplements: clinical research first, then a label-by-label evaluation, then a short list that is re-checked every six months.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/method" },
  openGraph: { ...healthyOpenGraph, title, description, url: "/method" },
};

const grades: EvidenceGrade[] = ["strong", "moderate", "early"];

export default function MethodPage() {
  return (
    <div className="px-4 py-12 sm:px-6 sm:py-16">
      <div className="mx-auto max-w-3xl">
        <PageHeading
          eyebrow="How we choose"
          title="Research, evaluation, selection"
          lead="Most supplement advice starts with the product. Brian starts with the research, and only then looks for a product that matches it."
        />

        <div className="relative mt-10 aspect-[21/9] overflow-hidden rounded-2xl">
          <Image
            src="/healthy/research-desk.jpg"
            alt="A desk with research papers, handwritten notes and reading glasses under warm lamp light"
            fill
            sizes="(min-width: 768px) 48rem, 100vw"
            className="object-cover"
          />
        </div>

        <div className="mt-12">
          <Prose>
            <h2>1. Research</h2>
            <p>
              For each ingredient, Brian looks first for systematic reviews and meta-analyses, then
              for randomized controlled trials. Priority goes to studies in adults over 40. Brand
              websites, testimonials and social media trends are not used as evidence.
            </p>
            <p>Every claim on a review page carries one of three grades:</p>
            <ul>
              {grades.map((g) => (
                <li key={g}>
                  <strong className="text-fg">{gradeLabels[g].label}:</strong> {gradeLabels[g].meaning}
                </li>
              ))}
            </ul>
            <p>
              We only describe what a supplement may support in the body. We never say one treats,
              cures or prevents a disease, because no supplement is approved to do that.
            </p>

            <h2>2. Evaluation</h2>
            <p>Each product is then checked against that research:</p>
            <ul>
              <li>
                <strong className="text-fg">Dose.</strong> The amount per serving on the label, set
                against the amount that was actually studied.
              </li>
              <li>
                <strong className="text-fg">Form.</strong> Whether the product uses the form of the
                ingredient the research used.
              </li>
              <li>
                <strong className="text-fg">Independent testing.</strong> Third-party certification or
                published lab results where they exist, and a plain note where they do not.
              </li>
              <li>
                <strong className="text-fg">Cost.</strong> Price per effective serving, not price per
                bottle.
              </li>
              <li>
                <strong className="text-fg">Safety.</strong> Known side effects, medication
                interactions, and who should talk to a doctor first.
              </li>
            </ul>
            <p>
              <strong className="text-fg">What we do not do yet.</strong> Reviews are desk research
              from published evidence and product labels. No product on this site has been assessed
              by a doctor or tested by patients for this program. If that changes, each review will
              name who took part.
            </p>

            <h2>3. Selection</h2>
            <p>
              Products that pass make the list. The list is short on purpose: one clear answer for
              each need is more useful than twenty options. Every pick is re-checked at least every
              six months, and removed if the evidence, the label or the price stops holding up.
            </p>

            <h2>How Brian earns money</h2>
            <p>
              Some links on these pages pay GetBrian a commission. Commission rates are not part of
              the method, and a brand cannot pay to be listed. Full details are on the{" "}
              <Link href="/disclosures">disclosures page</Link>.
            </p>
          </Prose>
        </div>
      </div>
    </div>
  );
}
