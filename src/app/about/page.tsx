import type { Metadata } from "next";
import { healthyOpenGraph } from "../layout";
import Link from "next/link";
import { PageHeading, Prose } from "../components";
import { CONTACT_EMAIL, PROGRAM_NAME } from "../data";

const title = "About and contact";
const description =
  `Who runs ${PROGRAM_NAME}, how the reviews are made, and how to get in touch.`;

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/about" },
  openGraph: { ...healthyOpenGraph, title, description, url: "/about" },
};

export default function AboutPage() {
  return (
    <div className="px-4 py-12 sm:px-6 sm:py-16">
      <div className="mx-auto max-w-3xl">
        <PageHeading
          eyebrow="About"
          title="Who is behind this"
          lead="GetBrian Healthy is an independent project that turns supplement research into plain buying advice for adults over 40."
        />

        <div className="mt-12">
          <Prose>
            <h2>Brian</h2>
            <p>
              Brian is the voice of GetBrian. The research behind each review is gathered and
              summarized with the help of AI tools, then checked and signed off by Clifton Flack,
              who founded GetBrian. Brian is not a doctor, and nothing here replaces advice from
              yours.
            </p>

            <h2>Independence</h2>
            <p>
              This is a personal, independent project. It is not connected to any employer, and it
              does not feature products from any company we work for. Brands cannot pay to be
              included. Where we earn a commission, we say so next to the link.
            </p>

            <h2>Corrections</h2>
            <p>
              If you spot an error in a dose, a price or a study, tell us and we will check it and
              update the page.
            </p>

            <h2 id="contact" className="scroll-mt-20">Contact</h2>
            <p>
              Email <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>. We cannot give personal
              medical advice by email.
            </p>
            <p>
              <Link href="/disclosures">Disclosures and disclaimers</Link>
            </p>
          </Prose>
        </div>
      </div>
    </div>
  );
}
