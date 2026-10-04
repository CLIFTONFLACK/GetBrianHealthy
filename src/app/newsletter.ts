/**
 * "Email me when a pick changes": double opt-in through Resend, with no
 * database of our own.
 *
 * 1. The sign-up form sends a confirmation email carrying a signed token.
 * 2. The reader opens /confirm and presses a button (a POST, so mail
 *    scanners that pre-open links cannot confirm on the reader's behalf).
 * 3. Only then is the address added to a Resend segment. Updates go out as
 *    Resend broadcasts, which carry Resend's own unsubscribe link.
 *
 * The whole feature is off until every variable below is set in the
 * deployment environment; the landing page hides the form while it is off.
 */
import { createHmac, timingSafeEqual } from "node:crypto";

const RESEND_API = "https://api.resend.com";
/** How long a confirmation link stays valid. */
export const TOKEN_TTL_MS = 48 * 60 * 60 * 1000;

type Config = { apiKey: string; segmentId: string; secret: string; from: string };

function config(): Config | null {
  const apiKey = process.env.RESEND_API_KEY;
  const segmentId = process.env.RESEND_SEGMENT_ID;
  const secret = process.env.NEWSLETTER_SECRET;
  const from = process.env.NEWSLETTER_FROM;
  // A short secret would make tokens guessable, so treat it as "not configured".
  if (!apiKey || !segmentId || !secret || secret.length < 32 || !from) return null;
  return { apiKey, segmentId, secret, from };
}

export function signupEnabled(): boolean {
  return config() !== null;
}

/** Lower-cased, trimmed address, or null when it is not a plausible email. */
export function normalizeEmail(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const email = raw.trim().toLowerCase();
  if (email.length > 254) return null;
  return /^[^\s@<>"',;]+@[^\s@<>"',;]+\.[a-z]{2,}$/.test(email) ? email : null;
}

function mac(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

/** `<payload>.<signature>`, where the payload holds the email and an expiry time. */
export function signToken(email: string, now: number, secret: string): string {
  const payload = Buffer.from(JSON.stringify({ e: email, x: now + TOKEN_TTL_MS })).toString("base64url");
  return `${payload}.${mac(payload, secret)}`;
}

/** The email inside a valid, unexpired token, or null. */
export function verifyToken(token: unknown, now: number, secret: string): string | null {
  if (typeof token !== "string" || token.length > 1024) return null;
  const [payload, sig, extra] = token.split(".");
  if (!payload || !sig || extra !== undefined) return null;
  const expected = Buffer.from(mac(payload, secret));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  try {
    const { e, x } = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (typeof x !== "number" || x < now) return null;
    return normalizeEmail(e);
  } catch {
    return null;
  }
}

/** Which Resend call a diagnostic log line is about. */
type Step = "send-email" | "add-contact" | "add-contact/resubscribe" | "add-contact/join-segment";

/**
 * Removes anything that identifies a reader or grants access from text taken
 * from a Resend error: email addresses (also when percent-encoded, as they
 * appear in request paths), Resend API keys, and long token-like runs such as
 * a confirm-link token. Input is cut to 2000 characters first so the patterns
 * stay cheap, and the result is capped at 300.
 */
function scrub(text: string): string {
  let t = text.slice(0, 2000);
  try {
    t = decodeURIComponent(t);
  } catch {
    // Not valid percent-encoding: scrub it as it is.
  }
  return t
    .replace(/[^\s@<>"',;]+@[^\s@<>"',;]+/g, "[email]")
    .replace(/\bre_[A-Za-z0-9_-]+/gi, "[key]")
    .replace(/[A-Za-z0-9_-]{20,}(?:\.[A-Za-z0-9_-]{20,})?/g, "[token]")
    .slice(0, 300);
}

/** Longest we wait for an error body: the user is waiting on the form. */
const ERROR_BODY_TIMEOUT_MS = 2000;

/**
 * One diagnostic line per failed Resend call, so a "something went wrong"
 * on the form can be traced in the deployment logs. It carries only the step,
 * the HTTP status and Resend's error name and message. Never the request
 * body, the API key, the token or the reader's address.
 */
async function logFailure(step: Step, res: Response): Promise<void> {
  let name: string | undefined;
  let message: string | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    // Bounded: a stalled or endless error body must not hold up the form.
    const text = await Promise.race([
      res.text(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error("timeout")), ERROR_BODY_TIMEOUT_MS);
      }),
    ]);
    const parsed: unknown = JSON.parse(text);
    if (parsed && typeof parsed === "object") {
      const { name: n, message: m } = parsed as { name?: unknown; message?: unknown };
      if (typeof n === "string") name = scrub(n);
      if (typeof m === "string") message = scrub(m);
    }
  } catch {
    // Not JSON, empty, or too slow (a proxy error page): the status alone has to do.
  } finally {
    clearTimeout(timer);
  }
  console.error(`[newsletter] ${JSON.stringify({ step, status: res.status, name, message })}`);
}

/** Same, for a call that never got a response (DNS, TLS, timeout, bad request setup). */
function logThrown(step: Step, err: unknown): void {
  const name = err instanceof Error ? err.name : typeof err;
  const cause = err instanceof Error ? (err.cause as { code?: unknown } | undefined)?.code : undefined;
  console.error(
    `[newsletter] ${JSON.stringify({ step, status: null, name, code: typeof cause === "string" ? cause : undefined })}`,
  );
}

/** Names of the missing or unusable variables (never their values). */
function logNotConfigured(step: Step): void {
  const missing = [
    ["RESEND_API_KEY", !process.env.RESEND_API_KEY],
    ["RESEND_SEGMENT_ID", !process.env.RESEND_SEGMENT_ID],
    ["NEWSLETTER_SECRET", !process.env.NEWSLETTER_SECRET || process.env.NEWSLETTER_SECRET.length < 32],
    ["NEWSLETTER_FROM", !process.env.NEWSLETTER_FROM],
  ]
    .filter(([, bad]) => bad)
    .map(([key]) => key);
  console.error(`[newsletter] ${JSON.stringify({ step, status: null, name: "not_configured", missing })}`);
}

/**
 * Calls Resend and logs a diagnostic line when it fails. A status listed in
 * `expected` is a normal outcome (a 409 on contact create) and is not logged.
 * Failures are still reported to the caller exactly as before: a refusal
 * through the returned Response, a network error by re-throwing.
 */
async function resend(
  step: Step,
  path: string,
  apiKey: string,
  body?: unknown,
  method = "POST",
  expected: number[] = [],
): Promise<Response> {
  let res: Response;
  try {
    res = await fetch(`${RESEND_API}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "User-Agent": "getbrian-healthy/1.0",
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (err) {
    logThrown(step, err);
    throw err;
  }
  if (!res.ok && !expected.includes(res.status)) await logFailure(step, res);
  return res;
}

/** Sends the confirmation email. Returns false if Resend refused it or the feature is off. */
export async function sendConfirmation(email: string, siteUrl: string, now = Date.now()): Promise<boolean> {
  const c = config();
  if (!c) {
    logNotConfigured("send-email");
    return false;
  }
  const link = `${siteUrl}/confirm?t=${encodeURIComponent(signToken(email, now, c.secret))}`;
  const text = [
    "Hi,",
    "",
    "Someone (hopefully you) asked to hear from GetBrian Healthy when one of Brian's supplement picks changes.",
    "",
    `Confirm here: ${link}`,
    "",
    "That's at most two emails a year, nothing else. If this wasn't you, ignore this email and nothing will be sent.",
    "",
    "Brian",
  ].join("\n");
  const res = await resend("send-email", "/emails", c.apiKey, {
    from: c.from,
    to: [email],
    subject: "Confirm your GetBrian Healthy updates",
    text,
  });
  return res.ok;
}

/**
 * Adds a confirmed address to the segment. Resend contacts are account-wide,
 * so a 409 means the contact already exists (from another segment, or after
 * unsubscribing), and the create call applied neither the segment nor
 * `unsubscribed: false`. In that case both are set explicitly.
 */
export async function addContact(email: string): Promise<boolean> {
  const c = config();
  if (!c) {
    logNotConfigured("add-contact");
    return false;
  }
  const res = await resend(
    "add-contact",
    "/contacts",
    c.apiKey,
    { email, unsubscribed: false, segments: [{ id: c.segmentId }] },
    "POST",
    [409],
  );
  if (res.ok) return true;
  if (res.status !== 409) return false;
  const contact = `/contacts/${encodeURIComponent(email)}`;
  const resubscribed = await resend("add-contact/resubscribe", contact, c.apiKey, { unsubscribed: false }, "PATCH");
  if (!resubscribed.ok) return false;
  const joined = await resend(
    "add-contact/join-segment",
    `${contact}/segments/${encodeURIComponent(c.segmentId)}`,
    c.apiKey,
    undefined,
    "POST",
    [409],
  );
  // Already in the segment is fine too.
  return joined.ok || joined.status === 409;
}

/** Exposed so the confirm action can verify with the configured secret. */
export function verifyConfiguredToken(token: unknown, now = Date.now()): string | null {
  const c = config();
  return c ? verifyToken(token, now, c.secret) : null;
}
