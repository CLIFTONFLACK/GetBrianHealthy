"use client";

import { useActionState } from "react";
import Link from "next/link";
import { subscribe, type SignupState } from "./actions";

const messages: Record<Exclude<SignupState["status"], "idle">, string> = {
  sent: "Check your inbox and press the confirm button in the email. Nothing is sent until you do.",
  invalid: "That doesn't look like an email address. Try again?",
  error: "Something went wrong on our side. Please try again in a minute.",
};

/** "Email me when a pick changes". Double opt-in: see newsletter.ts. */
export function Signup() {
  const [state, action, pending] = useActionState<SignupState, FormData>(subscribe, { status: "idle" });
  const done = state.status === "sent";
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
      <h2 id="updates-heading" className="font-kinetic-heading text-2xl font-extrabold tracking-tight text-slate-950">
        Hear when a pick changes
      </h2>
      <p className="mt-2 max-w-2xl text-base leading-relaxed text-slate-600">
        Brian re-checks every pick at least every six months. Leave your email and you&apos;ll hear only
        when a pick changes: two emails a year at most, nothing else. Unsubscribe any time.
      </p>
      {!done && (
        <form action={action} className="mt-5 flex flex-col gap-3 sm:flex-row">
          <label htmlFor="signup-email" className="sr-only">
            Email address
          </label>
          <input
            id="signup-email"
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder="you@example.com"
            className="min-h-12 flex-1 rounded-xl border border-slate-300 px-4 text-base text-slate-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kinetic-primary-electric"
          />
          {/* Honeypot for form bots; hidden from people and from assistive tech. */}
          <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" className="hidden" />
          <button
            type="submit"
            disabled={pending}
            className="min-h-12 rounded-xl bg-kinetic-primary px-6 font-bold text-white transition-colors hover:bg-kinetic-primary-hover disabled:opacity-60"
          >
            {pending ? "Sending…" : "Email me"}
          </button>
        </form>
      )}
      <p role="status" aria-live="polite" className={`mt-3 text-sm ${state.status === "sent" ? "text-emerald-700" : "text-red-700"}`}>
        {state.status !== "idle" && messages[state.status]}
      </p>
      <p className="mt-2 text-xs text-slate-500">
        Your email is kept by our email provider, Resend, only for these updates.{" "}
        <Link href="/disclosures#privacy" className="underline">
          Privacy
        </Link>
      </p>
    </div>
  );
}
