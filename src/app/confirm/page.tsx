import type { Metadata } from "next";
import Link from "next/link";
import { confirmSubscription } from "../actions";
import { PageHeading } from "../components";

export const metadata: Metadata = {
  title: "Confirm your email",
  alternates: { canonical: "/confirm" },
  robots: { index: false, follow: false },
};

/**
 * Second step of the double opt-in. The email link only opens this page;
 * the address is added when the reader presses the button, so a mail scanner
 * that opens links automatically cannot subscribe anyone.
 */
export default async function ConfirmPage(props: PageProps<"/confirm">) {
  const params = await props.searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const token = one(params.t);

  let title = "Confirm your email";
  let lead = "Press the button to start getting an email when one of Brian's picks changes.";
  if (one(params.done)) {
    title = "You're on the list";
    lead = "You'll hear from Brian when a pick changes, at most twice a year. Every email has an unsubscribe link.";
  } else if (one(params.error) || !token) {
    title = "That link didn't work";
    lead = "It may have expired (links last 48 hours) or been copied incompletely. Sign up again from the home page.";
  }

  return (
    <div className="px-4 py-12 sm:px-6 sm:py-16">
      <div className="mx-auto max-w-3xl">
        <PageHeading eyebrow="Email updates" title={title} lead={lead} />
        {token && !one(params.done) && !one(params.error) ? (
          <form action={confirmSubscription} className="mt-8">
            <input type="hidden" name="t" value={token} />
            <button
              type="submit"
              className="min-h-12 rounded-xl bg-kinetic-primary px-6 font-bold text-white transition-colors hover:bg-kinetic-primary-hover"
            >
              Confirm my email
            </button>
          </form>
        ) : (
          <Link href="/" className="mt-8 inline-flex min-h-11 items-center font-semibold text-kinetic-primary-electric underline underline-offset-4">
            Back to Brian&apos;s picks
          </Link>
        )}
      </div>
    </div>
  );
}
