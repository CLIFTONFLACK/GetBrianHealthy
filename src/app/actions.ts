"use server";

import { redirect } from "next/navigation";
import { getRegion } from "./region-server";
import { siteUrl } from "./site";
import { addContact, normalizeEmail, readConfiguredToken, sendConfirmation, sendGuide, type List } from "./newsletter";

export type SignupState = { status: "idle" | "sent" | "invalid" | "error" };

/**
 * Shared by both sign-up forms. It always answers "sent" for a well-formed
 * address, whether or not the address exists, so the form cannot be used to
 * probe who is on the list.
 */
async function requestConfirmation(formData: FormData, list: List): Promise<SignupState> {
  // Honeypot: hidden from people, filled in by most form bots. Pretend it worked.
  if (formData.get("website")) return { status: "sent" };
  const email = normalizeEmail(formData.get("email"));
  if (!email) return { status: "invalid" };
  try {
    const sent =
      list === "guide" ? await sendConfirmation(email, siteUrl, undefined, "guide") : await sendConfirmation(email, siteUrl);
    return sent ? { status: "sent" } : { status: "error" };
  } catch {
    return { status: "error" };
  }
}

/** "Hear when a pick changes" form on the home page. */
export async function subscribe(_prev: SignupState, formData: FormData): Promise<SignupState> {
  return requestConfirmation(formData, "updates");
}

/**
 * The free-guide form on /guide. The list is fixed here, never read from the
 * form. The guide makes claims not authorised in Great Britain, so a UK
 * visitor is refused here too, not only by the page hiding the form.
 */
export async function requestGuide(_prev: SignupState, formData: FormData): Promise<SignupState> {
  if ((await getRegion()) === "GB") return { status: "error" };
  return requestConfirmation(formData, "guide");
}

/**
 * Confirm button on /confirm. Adds the address only when the token checks out,
 * to the list the token was signed for. A guide reader is also emailed the
 * download link; if that email fails they still get the link on the page.
 */
export async function confirmSubscription(formData: FormData): Promise<void> {
  const token = readConfiguredToken(formData.get("t"));
  let ok = false;
  if (token) {
    try {
      ok = await addContact(token.email, token.list);
    } catch {
      ok = false;
    }
    if (ok && token.list === "guide") {
      try {
        await sendGuide(token.email, siteUrl);
      } catch {
        // The confirm page shows the download link anyway.
      }
    }
  }
  if (!ok) redirect("/confirm?error=1");
  redirect(token?.list === "guide" ? "/confirm?done=guide" : "/confirm?done=1");
}
