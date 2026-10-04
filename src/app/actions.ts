"use server";

import { redirect } from "next/navigation";
import { siteUrl } from "./site";
import { addContact, normalizeEmail, sendConfirmation, verifyConfiguredToken } from "./newsletter";

export type SignupState = { status: "idle" | "sent" | "invalid" | "error" };

/**
 * Sign-up form action. It always answers "sent" for a well-formed address,
 * whether or not the address exists, so the form cannot be used to probe who
 * is on the list.
 */
export async function subscribe(_prev: SignupState, formData: FormData): Promise<SignupState> {
  // Honeypot: hidden from people, filled in by most form bots. Pretend it worked.
  if (formData.get("website")) return { status: "sent" };
  const email = normalizeEmail(formData.get("email"));
  if (!email) return { status: "invalid" };
  try {
    return (await sendConfirmation(email, siteUrl)) ? { status: "sent" } : { status: "error" };
  } catch {
    return { status: "error" };
  }
}

/** Confirm button on /confirm. Adds the address only when the token checks out. */
export async function confirmSubscription(formData: FormData): Promise<void> {
  const email = verifyConfiguredToken(formData.get("t"));
  let ok = false;
  if (email) {
    try {
      ok = await addContact(email);
    } catch {
      ok = false;
    }
  }
  redirect(ok ? "/confirm?done=1" : "/confirm?error=1");
}
