import type { Metadata } from "next";
import { healthyOpenGraph } from "../layout";
import { FdaDisclaimer, PageHeading, Prose } from "../components";
import { AMAZON_ASSOCIATE_STATEMENT, CONTACT_EMAIL, PROGRAM_NAME } from "../data";
import { getRegion } from "../region-server";

const title = "Disclosures";
const description =
  `Affiliate disclosure, medical disclaimer and privacy note for ${PROGRAM_NAME}.`;

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/disclosures" },
  openGraph: { ...healthyOpenGraph, title, description, url: "/disclosures" },
};

const UPDATED = "October 1, 2026";

export default async function DisclosuresPage() {
  const region = await getRegion();
  return (
    <div className="px-4 py-12 sm:px-6 sm:py-16">
      <div className="mx-auto max-w-3xl">
        <PageHeading eyebrow="Disclosures" title="How this site earns money, and what it is not" />
        <p className="mt-4 text-base text-fg-subtle">Last updated {UPDATED}</p>

        <div className="mt-12">
          <Prose>
            <h2>Affiliate links</h2>
            <p>
              <strong>{AMAZON_ASSOCIATE_STATEMENT}</strong> The Buy buttons on these pages are
              affiliate links to Amazon. If you click one and buy, Amazon pays GetBrian a commission.
              You pay the same price. Every such link is labeled where it appears, and the buttons
              go straight to Amazon, with no redirect through this site.
            </p>
            <p>
              GetBrian is a participant in the Amazon Services LLC Associates Program (Amazon.com)
              and in the Amazon EU Associates Programme (Amazon.co.uk), affiliate advertising
              programs designed to let sites earn fees by linking to Amazon. US visitors are sent to
              Amazon.com and UK visitors to Amazon.co.uk, each with that country&apos;s own
              Associates tag.
            </p>
            <p>
              Commissions do not decide which products are listed or how they are graded. A product
              that stops meeting the method is removed, whatever it earns. Brands do not pay to be
              included. If a brand ever sends us a free sample, the review will say so.
            </p>

            <h2>Not medical advice</h2>
            <p>
              Everything on these pages is general information for healthy adults. It is not
              medical advice, diagnosis or treatment, and it does not take your health, medication
              or history into account. Speak to your doctor or pharmacist before starting a
              supplement, and especially if you are pregnant or breastfeeding, have a medical
              condition, or take prescription medication.
            </p>
          </Prose>
          <div className="mt-6">
            <FdaDisclaimer region={region} />
          </div>
          <Prose>
            <h2>How reviews are made</h2>
            <p>
              Reviews are based on published research and product labels, gathered with the help of
              AI tools and checked by a person before publishing. No doctor or patient panel has
              evaluated these products yet. Prices and labels change; the retailer&apos;s own page
              is always the current source, which is why these pages show no prices.
            </p>

            <h2>United Kingdom and United States</h2>
            <p>
              The picks differ by country because each country&apos;s Amazon sells different
              listings, and because the rules on what a supplement may claim differ. In the UK,
              health claims are limited to those on the Great Britain Nutrition and Health Claims
              Register, so pages for UK visitors make fewer claims, and none for L-theanine. Visitors
              outside the UK see the US picks. You can change country at any time in the footer.
            </p>

            <h2>Names and trademarks</h2>
            <p>
              {PROGRAM_NAME} is an independent project of GetBrian. It is not affiliated with,
              endorsed by or connected to Human Longevity, Inc., L-Nutra, Qualia or any other
              company using similar names. Product and brand names belong to their owners.
            </p>

            <h2 id="privacy">Privacy</h2>
            <p>
              To show the right country&apos;s picks, the page reads the country your connection
              appears to come from. It is used only to choose which picks to show, and this site does not store it. If you
              change country in the footer, one cookie remembers your choice for a year. It holds
              only the word US or GB, and it is not used for tracking or advertising. Amazon and its
              affiliate program set their own cookies once you reach their sites, under their own
              privacy policies. This site does not count clicks on the Buy buttons itself.
            </p>
            <p>
              If you accept analytics cookies in the banner, this site uses Google Analytics to
              count which pages are visited, along with your approximate location, device and
              browser. Nothing is sent to Google before you accept, and advertising features and
              Google signals are switched off. Page views are sent without the query string except
              campaign tags (utm_), and the cookies stay on this site. Choose Decline
              or use &ldquo;Cookie settings&rdquo; in the footer and the tag is switched off and its
              cookies are deleted. Your choice is kept on your device. Pages that carry a
              one-time email link are never measured.
            </p>
            <p>
              The only personal information these pages ask for is an email address, and only if you
              sign up to hear when a pick changes. It is used for nothing else: at most two emails a
              year, sent through our email provider, Resend, which stores the address for us. You are
              added only after you confirm from the email we send, every update has an unsubscribe
              link, and you can ask us to delete your address at any time by emailing{" "}
              <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
            </p>

            <h2>Contact</h2>
            <p>
              Questions or corrections: <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
            </p>
          </Prose>
        </div>
      </div>
    </div>
  );
}
