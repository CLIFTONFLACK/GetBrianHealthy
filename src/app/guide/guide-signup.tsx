"use client";

import { useActionState } from "react";
import Link from "next/link";
import { requestGuide, type SignupState } from "../actions";

const messages: Record<Exclude<SignupState["status"], "idle">, string> = {
  sent: "Nearly there. Check your inbox and press the confirm button in the email, and the guide is yours.",
  invalid: "That doesn't look like an email address. Try again?",
  error: "Something went wrong on our side. Please try again in a minute.",
};

/** Email form for the free guide. Double opt-in: see newsletter.ts. */
export function GuideSignup() {
  const [state, action, pending] = useActionState<SignupState, FormData>(requestGuide, { status: "idle" });
  const done = state.status === "sent";
  return (
    <div id="get-the-guide" className="scroll-mt-24 rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_18px_40px_rgba(10,29,59,0.12)] sm:p-6">
      {!done && (
        <form action={action} className="flex flex-col gap-3">
          <label htmlFor="guide-email" className="text-sm font-bold text-slate-900">
            Where should Brian send it?
          </label>
          <input
            id="guide-email"
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder="you@example.com"
            className="min-h-12 rounded-xl border border-slate-300 px-4 text-base text-slate-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kinetic-primary-electric"
          />
          {/* Honeypot for form bots; hidden from people and from assistive tech. */}
          <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" className="hidden" />
          <button
            type="submit"
            disabled={pending}
            className="min-h-12 rounded-xl bg-kinetic-primary px-6 font-bold text-white shadow-[0_8px_20px_rgba(10,29,59,0.25)] transition-colors hover:bg-kinetic-primary-hover disabled:opacity-60"
          >
            {pending ? "Sending…" : "Send me the free guide"}
          </button>
        </form>
      )}
      <p
        role="status"
        aria-live="polite"
        className={`text-sm ${done ? "font-semibold text-emerald-700" : "mt-3 text-red-700"}`}
      >
        {state.status !== "idle" && messages[state.status]}
      </p>
      <p className="mt-3 text-xs leading-relaxed text-slate-500">
        We&apos;ll email you a link to confirm. Then you get the guide, plus one short, evidence-checked tip a week.
        Unsubscribe any time. Your email is kept by our email provider, Resend.{" "}
        <Link href="/disclosures#privacy" className="underline">
          Privacy
        </Link>
      </p>
    </div>
  );
}
