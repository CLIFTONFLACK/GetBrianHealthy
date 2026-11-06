import type { Metadata } from "next";
import Link from "next/link";
import { confirmSubscription } from "../actions";
import { PageHeading } from "../components";
import { GUIDE_PDF_PATH, readConfiguredToken } from "../newsletter";

export const metadata: Metadata = {
  title: "Confirm your email",
  alternates: { canonical: "/confirm" },
  robots: { index: false, follow: false },
};

const linkClass =
  "inline-flex min-h-11 items-center font-semibold text-kinetic-primary-electric underline underline-offset-4";
const buttonClass =
  "inline-flex min-h-12 items-center rounded-xl bg-kinetic-primary px-6 font-bold text-white transition-colors hover:bg-kinetic-primary-hover";

/**
 * Second step of the double opt-in. The email link only opens this page;
 * the address is added when the reader presses the button, so a mail scanner
 * that opens links automatically cannot subscribe anyone.
 */
export default async function ConfirmPage(props: PageProps<"/confirm">) {
  const params = await props.searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const token = one(params.t);
  const done = one(params.done);
  // Only picks the wording before the button is pressed; the action checks the token again.
  const guide = done === "guide" || readConfiguredToken(token)?.list === "guide";

  let eyebrow = "Email updates";
  let title = "Confirm your email";
  let lead = "Press the button to start getting an email when one of Brian's picks changes.";
  if (guide) {
    eyebrow = "Free guide";
    lead = "Press the button to confirm your email and get Brian's guide, Energy. Strength. Calm.";
  }
  if (done === "guide") {
    title = "Your guide is ready";
    lead =
      "Download it below. We've also emailed you the link. Look out for one short, evidence-checked tip a week; every email has an unsubscribe link.";
  } else if (done) {
    title = "You're on the list";
    lead = "You'll hear from Brian when a pick changes, at most twice a year. Every email has an unsubscribe link.";
  } else if (one(params.error) || !token) {
    title = "That link didn't work";
    lead = "It may have expired (links last 48 hours) or been copied incompletely. Sign up again from the page you started on.";
  }

  return (
    <div className="px-4 py-12 sm:px-6 sm:py-16">
      <div className="mx-auto max-w-3xl">
        <PageHeading eyebrow={eyebrow} title={title} lead={lead} />
        {done === "guide" ? (
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <a href={GUIDE_PDF_PATH} download className={buttonClass}>
              Download the guide (PDF)
            </a>
            <Link href="/" className={linkClass}>
              See Brian&apos;s current picks
            </Link>
          </div>
        ) : token && !done && !one(params.error) ? (
          <form action={confirmSubscription} className="mt-8">
            <input type="hidden" name="t" value={token} />
            <button type="submit" className={buttonClass}>
              {guide ? "Confirm and get my guide" : "Confirm my email"}
            </button>
          </form>
        ) : (
          <Link href="/" className={`mt-8 ${linkClass}`}>
            Back to Brian&apos;s picks
          </Link>
        )}
      </div>
    </div>
  );
}
