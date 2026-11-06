import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { existsSync } from "node:fs";
import { join } from "node:path";
import {
  GUIDE_PDF_PATH,
  TOKEN_TTL_MS,
  addContact,
  guideSignupEnabled,
  normalizeEmail,
  readConfiguredToken,
  readToken,
  sendConfirmation,
  sendGuide,
  signToken,
  signupEnabled,
  verifyConfiguredToken,
  verifyToken,
} from "../newsletter.ts";

// ---------------------------------------------------------------------------
// Environment helpers
// ---------------------------------------------------------------------------

const ENV_KEYS = [
  "RESEND_API_KEY",
  "RESEND_SEGMENT_ID",
  "RESEND_GUIDE_SEGMENT_ID",
  "NEWSLETTER_SECRET",
  "NEWSLETTER_FROM",
] as const;

const VALID_SECRET = "a".repeat(32);

/** Sets every configured-feature env var to a valid value, minus any overrides/omissions. */
function setFullEnv(overrides: Partial<Record<(typeof ENV_KEYS)[number], string | undefined>> = {}) {
  const values: Record<(typeof ENV_KEYS)[number], string | undefined> = {
    RESEND_API_KEY: "re_test_key",
    RESEND_SEGMENT_ID: "seg_123",
    RESEND_GUIDE_SEGMENT_ID: undefined,
    NEWSLETTER_SECRET: VALID_SECRET,
    NEWSLETTER_FROM: "Brian <brian@getbrian.xyz>",
    ...overrides,
  };
  for (const key of ENV_KEYS) {
    const v = values[key];
    if (v === undefined) delete process.env[key];
    else process.env[key] = v;
  }
}

let savedEnv: Record<string, string | undefined>;

test.beforeEach(() => {
  savedEnv = {};
  for (const key of ENV_KEYS) savedEnv[key] = process.env[key];
});

test.afterEach(() => {
  for (const key of ENV_KEYS) {
    const v = savedEnv[key];
    if (v === undefined) delete process.env[key];
    else process.env[key] = v;
  }
});

// ---------------------------------------------------------------------------
// signupEnabled
// ---------------------------------------------------------------------------

test("signupEnabled is true when every required var is set and the secret is long enough", () => {
  setFullEnv();
  assert.equal(signupEnabled(), true);
});

test("signupEnabled is false when RESEND_API_KEY is missing", () => {
  setFullEnv({ RESEND_API_KEY: undefined });
  assert.equal(signupEnabled(), false);
});

test("signupEnabled is false when RESEND_SEGMENT_ID is missing", () => {
  setFullEnv({ RESEND_SEGMENT_ID: undefined });
  assert.equal(signupEnabled(), false);
});

test("signupEnabled is false when NEWSLETTER_SECRET is missing", () => {
  setFullEnv({ NEWSLETTER_SECRET: undefined });
  assert.equal(signupEnabled(), false);
});

test("signupEnabled is false when NEWSLETTER_FROM is missing", () => {
  setFullEnv({ NEWSLETTER_FROM: undefined });
  assert.equal(signupEnabled(), false);
});

test("signupEnabled is false when the secret is one character short of 32", () => {
  setFullEnv({ NEWSLETTER_SECRET: "a".repeat(31) });
  assert.equal(signupEnabled(), false);
});

test("signupEnabled is true when the secret is exactly 32 characters", () => {
  setFullEnv({ NEWSLETTER_SECRET: "a".repeat(32) });
  assert.equal(signupEnabled(), true);
});

// ---------------------------------------------------------------------------
// normalizeEmail
// ---------------------------------------------------------------------------

test("normalizeEmail accepts a plain, already-lowercase address", () => {
  assert.equal(normalizeEmail("reader@example.com"), "reader@example.com");
});

test("normalizeEmail trims whitespace and lower-cases the address", () => {
  assert.equal(normalizeEmail("  Reader@Example.COM  "), "reader@example.com");
});

test("normalizeEmail rejects an address longer than 254 characters", () => {
  const long = `${"a".repeat(250)}@x.com`; // > 254 chars total
  assert.ok(long.length > 254, "fixture assumption: constructed address exceeds the limit");
  assert.equal(normalizeEmail(long), null);
});

test("normalizeEmail accepts an address at exactly 254 characters", () => {
  const local = "a".repeat(254 - "@x.com".length);
  const email = `${local}@x.com`;
  assert.equal(email.length, 254);
  assert.equal(normalizeEmail(email), email);
});

test("normalizeEmail rejects a value with no @", () => {
  assert.equal(normalizeEmail("not-an-email"), null);
});

test("normalizeEmail rejects a value with no TLD", () => {
  assert.equal(normalizeEmail("reader@localhost"), null);
});

test("normalizeEmail rejects an empty string", () => {
  assert.equal(normalizeEmail(""), null);
});

test("normalizeEmail rejects null", () => {
  assert.equal(normalizeEmail(null), null);
});

test("normalizeEmail rejects undefined", () => {
  assert.equal(normalizeEmail(undefined), null);
});

test("normalizeEmail rejects a number", () => {
  assert.equal(normalizeEmail(12345), null);
});

test("normalizeEmail rejects an address containing a comma (header-injection shaped)", () => {
  assert.equal(normalizeEmail("a@b.com,c@d.com"), null);
});

test("normalizeEmail rejects an address containing angle brackets", () => {
  assert.equal(normalizeEmail("<script>@b.com"), null);
});

// ---------------------------------------------------------------------------
// signToken / verifyToken
// ---------------------------------------------------------------------------

test("verifyToken accepts a token signed with the same secret and returns the normalized email", () => {
  const now = 1_000_000;
  const token = signToken("Reader@Example.com", now, VALID_SECRET);
  assert.equal(verifyToken(token, now, VALID_SECRET), "reader@example.com");
});

test("verifyToken accepts a token right up to the TTL boundary (x === now)", () => {
  const now = 1_000_000;
  const token = signToken("reader@example.com", now, VALID_SECRET);
  // signToken set x = now + TTL, so checking at exactly that instant is x < now === false.
  assert.equal(verifyToken(token, now + TOKEN_TTL_MS, VALID_SECRET), "reader@example.com");
});

test("verifyToken rejects a token one millisecond past the TTL boundary", () => {
  const now = 1_000_000;
  const token = signToken("reader@example.com", now, VALID_SECRET);
  assert.equal(verifyToken(token, now + TOKEN_TTL_MS + 1, VALID_SECRET), null);
});

test("verifyToken rejects a token signed with a different secret", () => {
  const now = 1_000_000;
  const token = signToken("reader@example.com", now, VALID_SECRET);
  assert.equal(verifyToken(token, now, "b".repeat(32)), null);
});

test("verifyToken rejects a token whose payload has been tampered with", () => {
  const now = 1_000_000;
  const token = signToken("reader@example.com", now, VALID_SECRET);
  const [payload, sig] = token.split(".");
  // Flip one character inside the base64url payload.
  const tamperedChar = payload[0] === "a" ? "b" : "a";
  const tamperedPayload = tamperedChar + payload.slice(1);
  assert.notEqual(tamperedPayload, payload);
  assert.equal(verifyToken(`${tamperedPayload}.${sig}`, now, VALID_SECRET), null);
});

test("verifyToken rejects a token whose signature has been tampered with", () => {
  const now = 1_000_000;
  const token = signToken("reader@example.com", now, VALID_SECRET);
  const [payload, sig] = token.split(".");
  const tamperedChar = sig[0] === "a" ? "b" : "a";
  const tamperedSig = tamperedChar + sig.slice(1);
  assert.notEqual(tamperedSig, sig);
  assert.equal(verifyToken(`${payload}.${tamperedSig}`, now, VALID_SECRET), null);
});

test("verifyToken rejects a token with an extra dot segment", () => {
  const now = 1_000_000;
  const token = signToken("reader@example.com", now, VALID_SECRET);
  assert.equal(verifyToken(`${token}.extra`, now, VALID_SECRET), null);
});

test("verifyToken rejects a token missing the signature segment", () => {
  const now = 1_000_000;
  const token = signToken("reader@example.com", now, VALID_SECRET);
  const [payload] = token.split(".");
  assert.equal(verifyToken(payload, now, VALID_SECRET), null);
});

test("verifyToken rejects a token longer than 1024 characters", () => {
  const now = 1_000_000;
  const huge = `${"a".repeat(1020)}.${"b".repeat(1020)}`;
  assert.ok(huge.length > 1024);
  assert.equal(verifyToken(huge, now, VALID_SECRET), null);
});

test("verifyToken rejects a non-string token", () => {
  assert.equal(verifyToken(12345, 1_000_000, VALID_SECRET), null);
  assert.equal(verifyToken(null, 1_000_000, VALID_SECRET), null);
  assert.equal(verifyToken(undefined, 1_000_000, VALID_SECRET), null);
});

test("verifyToken rejects a forged token built from a plausible-looking payload without the real secret", () => {
  const now = 1_000_000;
  const forgedPayload = Buffer.from(JSON.stringify({ e: "attacker@example.com", x: now + TOKEN_TTL_MS })).toString(
    "base64url",
  );
  // Signed with an attacker-guessed secret rather than the real one.
  const wrongSig = signToken("attacker@example.com", now, "not-the-real-secret-at-all-000").split(".")[1];
  assert.equal(verifyToken(`${forgedPayload}.${wrongSig}`, now, VALID_SECRET), null);
});

test("a token issued for one address cannot be reused to authenticate a different address", () => {
  const now = 1_000_000;
  const token = signToken("alice@example.com", now, VALID_SECRET);
  const email = verifyToken(token, now, VALID_SECRET);
  assert.equal(email, "alice@example.com");
  assert.notEqual(email, "bob@example.com");
});

// ---------------------------------------------------------------------------
// fetch mocking helpers
// ---------------------------------------------------------------------------

function jsonResponse(status: number): Response {
  return new Response(null, { status });
}

/** Replaces globalThis.fetch for the duration of one test, always restoring it. */
async function withFetch<T>(impl: typeof fetch, fn: () => Promise<T>): Promise<T> {
  const original = globalThis.fetch;
  globalThis.fetch = impl;
  try {
    return await fn();
  } finally {
    globalThis.fetch = original;
  }
}

// ---------------------------------------------------------------------------
// sendConfirmation
// ---------------------------------------------------------------------------

test("sendConfirmation returns false and makes no request when the feature is not configured", async () => {
  setFullEnv({ RESEND_API_KEY: undefined });
  let called = false;
  await withFetch(
    async () => {
      called = true;
      return jsonResponse(200);
    },
    async () => {
      const ok = await sendConfirmation("reader@example.com", "https://site.test", 1_000_000);
      assert.equal(ok, false);
    },
  );
  assert.equal(called, false);
});

test("sendConfirmation POSTs to the Resend emails endpoint with a bearer token and the confirm link", async () => {
  setFullEnv();
  let capturedUrl = "";
  let capturedInit: RequestInit | undefined;
  await withFetch(
    async (input, init) => {
      capturedUrl = String(input);
      capturedInit = init;
      return jsonResponse(200);
    },
    async () => {
      const ok = await sendConfirmation("reader@example.com", "https://site.test", 1_000_000);
      assert.equal(ok, true);
    },
  );
  assert.equal(capturedUrl, "https://api.resend.com/emails");
  assert.equal(capturedInit?.method, "POST");
  const headers = capturedInit?.headers as Record<string, string>;
  assert.equal(headers.Authorization, "Bearer re_test_key");
  const body = JSON.parse(capturedInit?.body as string);
  assert.equal(body.from, "Brian <brian@getbrian.xyz>");
  assert.deepEqual(body.to, ["reader@example.com"]);

  const expectedToken = signToken("reader@example.com", 1_000_000, VALID_SECRET);
  assert.match(body.text, new RegExp(`https://site\\.test/confirm\\?t=${encodeURIComponent(expectedToken)}`));
});

test("the token embedded in the confirmation email verifies back to the same address", async () => {
  setFullEnv();
  let sentText = "";
  await withFetch(
    async (_input, init) => {
      const body = JSON.parse((init as RequestInit).body as string);
      sentText = body.text;
      return jsonResponse(200);
    },
    async () => {
      await sendConfirmation("reader@example.com", "https://site.test", 1_000_000);
    },
  );
  const match = sentText.match(/\?t=([^\s]+)/);
  assert.ok(match, "confirmation text should contain a token");
  const token = decodeURIComponent(match![1]);
  assert.equal(verifyConfiguredToken(token, 1_000_000), "reader@example.com");
});

test("sendConfirmation returns false when Resend responds with a non-2xx status", async () => {
  setFullEnv();
  await withFetch(
    async () => jsonResponse(422),
    async () => {
      const ok = await sendConfirmation("reader@example.com", "https://site.test", 1_000_000);
      assert.equal(ok, false);
    },
  );
});

// ---------------------------------------------------------------------------
// addContact
// ---------------------------------------------------------------------------

test("addContact returns false and makes no request when the feature is not configured", async () => {
  setFullEnv({ NEWSLETTER_FROM: undefined });
  let called = false;
  await withFetch(
    async () => {
      called = true;
      return jsonResponse(200);
    },
    async () => {
      const ok = await addContact("reader@example.com");
      assert.equal(ok, false);
    },
  );
  assert.equal(called, false);
});

test("addContact POSTs to the Resend contacts endpoint with the segment id and returns true on 2xx", async () => {
  setFullEnv();
  let capturedUrl = "";
  let capturedBody: unknown;
  await withFetch(
    async (input, init) => {
      capturedUrl = String(input);
      capturedBody = JSON.parse((init as RequestInit).body as string);
      return jsonResponse(201);
    },
    async () => {
      const ok = await addContact("reader@example.com");
      assert.equal(ok, true);
    },
  );
  assert.equal(capturedUrl, "https://api.resend.com/contacts");
  assert.deepEqual(capturedBody, {
    email: "reader@example.com",
    unsubscribed: false,
    segments: [{ id: "seg_123" }],
  });
});

// A 409 means the contact already exists account-wide (another segment, or
// unsubscribed earlier); the create call then applied neither the segment nor
// unsubscribed:false, so addContact must set both explicitly.
function recordingFetch(statuses: Record<string, number>) {
  const calls: { method: string; url: string; body: unknown }[] = [];
  const impl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const method = init?.method ?? "GET";
    const url = String(input);
    calls.push({ method, url, body: init?.body ? JSON.parse(String(init.body)) : undefined });
    return jsonResponse(statuses[`${method} ${url}`] ?? 500);
  }) as typeof fetch;
  return { calls, impl };
}

const CREATE = "POST https://api.resend.com/contacts";
const UPDATE = "PATCH https://api.resend.com/contacts/reader%40example.com";
const JOIN = "POST https://api.resend.com/contacts/reader%40example.com/segments/seg_123";

test("addContact on 409 re-subscribes the existing contact and adds it to the segment", async () => {
  setFullEnv();
  const { calls, impl } = recordingFetch({ [CREATE]: 409, [UPDATE]: 200, [JOIN]: 200 });
  await withFetch(impl, async () => {
    assert.equal(await addContact("reader@example.com"), true);
  });
  assert.deepEqual(calls.map((c) => `${c.method} ${c.url}`), [CREATE, UPDATE, JOIN]);
  assert.deepEqual(calls[1].body, { unsubscribed: false });
});

test("addContact on 409 counts a contact already in the segment as success", async () => {
  setFullEnv();
  const { impl } = recordingFetch({ [CREATE]: 409, [UPDATE]: 200, [JOIN]: 409 });
  await withFetch(impl, async () => {
    assert.equal(await addContact("reader@example.com"), true);
  });
});

test("addContact on 409 fails when the re-subscribe update fails, without joining the segment", async () => {
  setFullEnv();
  const { calls, impl } = recordingFetch({ [CREATE]: 409, [UPDATE]: 500 });
  await withFetch(impl, async () => {
    assert.equal(await addContact("reader@example.com"), false);
  });
  assert.equal(calls.length, 2);
});

test("addContact on 409 fails when adding to the segment fails", async () => {
  setFullEnv();
  const { impl } = recordingFetch({ [CREATE]: 409, [UPDATE]: 200, [JOIN]: 500 });
  await withFetch(impl, async () => {
    assert.equal(await addContact("reader@example.com"), false);
  });
});

test("addContact makes one call when the contact is new", async () => {
  setFullEnv();
  const { calls, impl } = recordingFetch({ [CREATE]: 201 });
  await withFetch(impl, async () => {
    assert.equal(await addContact("reader@example.com"), true);
  });
  assert.equal(calls.length, 1);
});

test("addContact returns false on a 500 from Resend", async () => {
  setFullEnv();
  await withFetch(
    async () => jsonResponse(500),
    async () => {
      const ok = await addContact("reader@example.com");
      assert.equal(ok, false);
    },
  );
});

// ---------------------------------------------------------------------------
// verifyConfiguredToken
// ---------------------------------------------------------------------------

test("verifyConfiguredToken returns null when the feature is not configured", () => {
  setFullEnv({ RESEND_SEGMENT_ID: undefined });
  const token = signToken("reader@example.com", 1_000_000, VALID_SECRET);
  assert.equal(verifyConfiguredToken(token, 1_000_000), null);
});

test("verifyConfiguredToken verifies a token signed with the currently configured secret", () => {
  setFullEnv();
  const token = signToken("reader@example.com", 1_000_000, VALID_SECRET);
  assert.equal(verifyConfiguredToken(token, 1_000_000), "reader@example.com");
});

test("verifyConfiguredToken rejects a token signed under a previously configured (now-changed) secret", () => {
  setFullEnv();
  const token = signToken("reader@example.com", 1_000_000, "c".repeat(32));
  assert.equal(verifyConfiguredToken(token, 1_000_000), null);
});

// ---------------------------------------------------------------------------
// Failure diagnostics: one console.error line per failed Resend call
// ---------------------------------------------------------------------------

const SECRET_KEY = "re_SuperSecretKey_123";
const READER = "reader@example.com";
const PREFIX = "[newsletter] ";

/** Captures console.error output for the duration of one test. */
async function captureErrors<T>(fn: () => Promise<T>): Promise<{ lines: string[]; result: T }> {
  const original = console.error;
  const lines: string[] = [];
  console.error = (...args: unknown[]) => {
    lines.push(args.map(String).join(" "));
  };
  try {
    const result = await fn();
    return { lines, result };
  } finally {
    console.error = original;
  }
}

function resendError(status: number, body: unknown): Response {
  return new Response(typeof body === "string" ? body : JSON.stringify(body), { status });
}

/** Parses one log line, failing if it is not the expected "[newsletter] {json}" shape. */
function parseLine(line: string): Record<string, unknown> {
  assert.ok(line.startsWith(PREFIX), `unexpected log line: ${line}`);
  return JSON.parse(line.slice(PREFIX.length));
}

/** Asserts the log leaks none of the things it must never carry. */
function assertNoLeak(lines: string[], token?: string) {
  const all = lines.join("\n");
  assert.ok(!all.includes(READER), "log must not contain the reader's address");
  assert.ok(!all.includes("reader%40example.com"), "log must not contain the encoded address");
  assert.ok(!all.includes(SECRET_KEY), "log must not contain the API key");
  assert.ok(!all.includes("Bearer"), "log must not contain the Authorization header");
  assert.ok(!all.includes("confirm?t="), "log must not contain the confirmation link");
  if (token) assert.ok(!all.includes(token), "log must not contain the token");
}

test("a refused confirmation email logs step, status and Resend's error name and message, and still returns false", async () => {
  setFullEnv({ RESEND_API_KEY: SECRET_KEY });
  const message = "The getbrian.xyz domain is not verified. Please, add and verify your domain.";
  const { lines, result } = await captureErrors(() =>
    withFetch(
      async () => resendError(403, { statusCode: 403, name: "validation_error", message }),
      () => sendConfirmation(READER, "https://site.test", 1_000_000),
    ),
  );
  assert.equal(result, false);
  assert.equal(lines.length, 1);
  assert.deepEqual(parseLine(lines[0]), { step: "send-email", status: 403, name: "validation_error", message });
  assertNoLeak(lines, signToken(READER, 1_000_000, VALID_SECRET));
});

test("a Resend message that echoes the address or the key is scrubbed before logging", async () => {
  setFullEnv({ RESEND_API_KEY: SECRET_KEY });
  const { lines } = await captureErrors(() =>
    withFetch(
      async () =>
        resendError(422, {
          name: "invalid_to_address",
          message: `Invalid to ${READER} using ${SECRET_KEY} for Brian <brian@getbrian.xyz>`,
        }),
      () => sendConfirmation(READER, "https://site.test", 1_000_000),
    ),
  );
  assert.equal(lines.length, 1);
  const logged = parseLine(lines[0]);
  assert.equal(logged.status, 422);
  assert.equal(logged.name, "invalid_to_address");
  assert.match(String(logged.message), /\[email\]/);
  assert.match(String(logged.message), /\[key\]/);
  assertNoLeak(lines);
  assert.ok(!lines[0].includes("brian@getbrian.xyz"), "no address of any kind may be logged");
});

test("scrubbing covers an address with parentheses, a percent-encoded address and a confirm-link token", async () => {
  setFullEnv({ RESEND_API_KEY: SECRET_KEY });
  const token = signToken(READER, 1_000_000, VALID_SECRET);
  const { lines } = await captureErrors(() =>
    withFetch(
      async () =>
        resendError(404, {
          name: "not_found",
          message: `bad a(b)c@example.com at /contacts/reader%40example.com via /confirm?t=${token}`,
        }),
      () => sendConfirmation(READER, "https://site.test", 1_000_000),
    ),
  );
  assert.equal(lines.length, 1);
  assert.ok(!lines[0].includes("a(b)"), "no fragment of a parenthesised address may be logged");
  assert.ok(!lines[0].includes("(b)c"), "no fragment of a parenthesised address may be logged");
  assert.ok(!lines[0].includes("reader%40example.com"), "the encoded address must be scrubbed");
  assert.ok(!lines[0].includes(READER), "the address must be scrubbed");
  assert.ok(!lines[0].includes(token), "the token must be scrubbed");
  assert.ok(!lines[0].includes(token.split(".")[0]), "the token payload must be scrubbed");
  assert.match(String(parseLine(lines[0]).message), /\[email\]/);
  assert.match(String(parseLine(lines[0]).message), /\[token\]/);
});

test("a stray % in the message does not stop an encoded address being scrubbed", async () => {
  setFullEnv({ RESEND_API_KEY: SECRET_KEY });
  const { lines } = await captureErrors(() =>
    withFetch(
      async () =>
        resendError(404, { name: "not_found", message: "100% sure: /contacts/reader%40example.com is unknown %zz" }),
      () => sendConfirmation(READER, "https://site.test", 1_000_000),
    ),
  );
  assert.ok(!lines[0].includes("reader%40example.com"), "the encoded address must be scrubbed");
  assert.ok(!lines[0].includes(READER), "the address must be scrubbed");
  assert.match(String(parseLine(lines[0]).message), /\[email\]/);
});

test("Resend error names that are 20+ characters stay readable, only free text gets the token mask", async () => {
  setFullEnv();
  const { lines } = await captureErrors(() =>
    withFetch(
      async () => resendError(429, { name: "monthly_quota_exceeded", message: "You have hit your monthly sending quota." }),
      () => sendConfirmation(READER, "https://site.test", 1_000_000),
    ),
  );
  assert.equal(parseLine(lines[0]).name, "monthly_quota_exceeded");
  assert.equal(parseLine(lines[0]).message, "You have hit your monthly sending quota.");
});

test("an error body that never finishes does not hold up the form: the status is logged after a short wait", async () => {
  setFullEnv();
  const stalled = {
    ok: false,
    status: 503,
    text: () => new Promise<string>(() => {}),
  } as unknown as Response;
  const started = Date.now();
  const { lines, result } = await captureErrors(() =>
    withFetch(async () => stalled, () => sendConfirmation(READER, "https://site.test", 1_000_000)),
  );
  assert.equal(result, false);
  assert.ok(Date.now() - started < 4000, "the wait for an error body must be bounded");
  assert.deepEqual(parseLine(lines[0]), { step: "send-email", status: 503 });
});

test("a very long Resend message is truncated in the log", async () => {
  setFullEnv();
  const { lines } = await captureErrors(() =>
    withFetch(
      async () => resendError(500, { name: "application_error", message: "x".repeat(5000) }),
      () => sendConfirmation(READER, "https://site.test", 1_000_000),
    ),
  );
  assert.ok(lines[0].length < 500, `log line should be bounded, was ${lines[0].length}`);
});

test("a non-JSON error body (proxy page, empty) still logs the step and status, with no body text", async () => {
  setFullEnv({ RESEND_API_KEY: SECRET_KEY });
  const { lines, result } = await captureErrors(() =>
    withFetch(
      async () => resendError(502, `<html>Bad gateway for ${READER}</html>`),
      () => sendConfirmation(READER, "https://site.test", 1_000_000),
    ),
  );
  assert.equal(result, false);
  assert.equal(lines.length, 1);
  assert.deepEqual(parseLine(lines[0]), { step: "send-email", status: 502 });
  assertNoLeak(lines);
});

test("a fetch that throws logs the step and error class, never the message, then re-throws", async () => {
  setFullEnv({ RESEND_API_KEY: SECRET_KEY });
  const failure = new TypeError(`fetch failed for ${READER} with ${SECRET_KEY}`, { cause: { code: "ENOTFOUND" } });
  const { lines } = await captureErrors(() =>
    withFetch(
      async () => {
        throw failure;
      },
      async () => {
        await assert.rejects(() => sendConfirmation(READER, "https://site.test", 1_000_000), failure);
      },
    ),
  );
  assert.equal(lines.length, 1);
  assert.deepEqual(parseLine(lines[0]), { step: "send-email", status: null, name: "TypeError", code: "ENOTFOUND" });
  assertNoLeak(lines);
});

test("an unconfigured feature logs which variables are missing by name only", async () => {
  setFullEnv({ RESEND_API_KEY: undefined, NEWSLETTER_SECRET: "short-secret-value", NEWSLETTER_FROM: "Brian <b@x.test>" });
  const { lines, result } = await captureErrors(() => sendConfirmation(READER, "https://site.test", 1_000_000));
  assert.equal(result, false);
  assert.deepEqual(parseLine(lines[0]), {
    step: "send-email",
    status: null,
    name: "not_configured",
    missing: ["RESEND_API_KEY", "NEWSLETTER_SECRET"],
  });
  assert.ok(!lines[0].includes("short-secret-value"));
  assert.ok(!lines[0].includes("b@x.test"));
});

test("a successful send logs nothing", async () => {
  setFullEnv();
  const { lines, result } = await captureErrors(() =>
    withFetch(
      async () => jsonResponse(200),
      () => sendConfirmation(READER, "https://site.test", 1_000_000),
    ),
  );
  assert.equal(result, true);
  assert.deepEqual(lines, []);
});

test("a failed contact create logs the add-contact step with status, name and message", async () => {
  setFullEnv({ RESEND_API_KEY: SECRET_KEY });
  const { lines, result } = await captureErrors(() =>
    withFetch(
      async () => resendError(404, { name: "not_found", message: "Segment not found for seg_123" }),
      () => addContact(READER),
    ),
  );
  assert.equal(result, false);
  assert.equal(lines.length, 1);
  assert.deepEqual(parseLine(lines[0]), {
    step: "add-contact",
    status: 404,
    name: "not_found",
    message: "Segment not found for seg_123",
  });
  assertNoLeak(lines);
});

test("the expected 409 on contact create is not logged, but a failure after it is, under its own step", async () => {
  setFullEnv({ RESEND_API_KEY: SECRET_KEY });
  const impl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const key = `${init?.method} ${String(input)}`;
    if (key === CREATE) return resendError(409, { name: "validation_error", message: "exists" });
    if (key === UPDATE) return resendError(401, { name: "restricted_api_key", message: "This API key is restricted" });
    return jsonResponse(500);
  }) as typeof fetch;
  const { lines, result } = await captureErrors(() => withFetch(impl, () => addContact(READER)));
  assert.equal(result, false);
  assert.equal(lines.length, 1, "only the PATCH failure is logged");
  assert.deepEqual(parseLine(lines[0]), {
    step: "add-contact/resubscribe",
    status: 401,
    name: "restricted_api_key",
    message: "This API key is restricted",
  });
  assertNoLeak(lines);
});

test("a 409 on joining the segment is a normal outcome and is not logged", async () => {
  setFullEnv();
  const { impl } = recordingFetch({ [CREATE]: 409, [UPDATE]: 200, [JOIN]: 409 });
  const { lines, result } = await captureErrors(() => withFetch(impl, () => addContact(READER)));
  assert.equal(result, true);
  assert.deepEqual(lines, []);
});

// ---------------------------------------------------------------------------
// Guide list: tokens
// ---------------------------------------------------------------------------

const NOW = 1_000_000;

/** A token signed the way the app did before the guide list existed: email and expiry only. */
function legacyUpdatesToken(email: string, now: number, secret: string): string {
  const payload = Buffer.from(JSON.stringify({ e: email, x: now + TOKEN_TTL_MS })).toString("base64url");
  return `${payload}.${createHmac("sha256", secret).update(payload).digest("base64url")}`;
}

/** Keeps the signature of `token` and puts a different payload in front of it. */
function withPayload(token: string, body: object): string {
  const [, sig] = token.split(".");
  return `${Buffer.from(JSON.stringify(body)).toString("base64url")}.${sig}`;
}

test("a guide token reads back with its normalized email and the guide list", () => {
  const token = signToken("Reader@Example.com", NOW, VALID_SECRET, "guide");
  assert.deepEqual(readToken(token, NOW, VALID_SECRET), { email: "reader@example.com", list: "guide" });
});

test("an updates token reads back with the updates list", () => {
  const token = signToken("reader@example.com", NOW, VALID_SECRET);
  assert.deepEqual(readToken(token, NOW, VALID_SECRET), { email: "reader@example.com", list: "updates" });
});

test("an updates token keeps the original payload shape, with no list field", () => {
  const token = signToken("reader@example.com", NOW, VALID_SECRET);
  const payload = Buffer.from(token.split(".")[0], "base64url").toString("utf8");
  assert.equal(payload, JSON.stringify({ e: "reader@example.com", x: NOW + TOKEN_TTL_MS }));
});

test("a token signed in the original format, before the list field existed, still reads as the updates list", () => {
  const token = legacyUpdatesToken("reader@example.com", NOW, VALID_SECRET);
  assert.deepEqual(readToken(token, NOW, VALID_SECRET), { email: "reader@example.com", list: "updates" });
});

test("a guide token's list cannot be changed to updates without breaking the signature", () => {
  const guide = signToken("reader@example.com", NOW, VALID_SECRET, "guide");
  const forged = withPayload(guide, { e: "reader@example.com", x: NOW + TOKEN_TTL_MS });
  assert.equal(readToken(forged, NOW, VALID_SECRET), null);
});

test("an updates token cannot be upgraded to the guide list by adding the list field", () => {
  const updates = signToken("reader@example.com", NOW, VALID_SECRET);
  const forged = withPayload(updates, { e: "reader@example.com", x: NOW + TOKEN_TTL_MS, l: "guide" });
  assert.equal(readToken(forged, NOW, VALID_SECRET), null);
});

test("a guide token past its expiry is rejected", () => {
  const token = signToken("reader@example.com", NOW, VALID_SECRET, "guide");
  assert.equal(readToken(token, NOW + TOKEN_TTL_MS + 1, VALID_SECRET), null);
});

test("verifyToken still returns only the email for a guide token", () => {
  const token = signToken("reader@example.com", NOW, VALID_SECRET, "guide");
  assert.equal(verifyToken(token, NOW, VALID_SECRET), "reader@example.com");
});

test("readConfiguredToken returns the email and list of a guide token signed with the configured secret", () => {
  setFullEnv({ RESEND_GUIDE_SEGMENT_ID: "seg_guide" });
  const token = signToken(READER, NOW, VALID_SECRET, "guide");
  assert.deepEqual(readConfiguredToken(token, NOW), { email: READER, list: "guide" });
});

// ---------------------------------------------------------------------------
// Guide list: configuration
// ---------------------------------------------------------------------------

test("guideSignupEnabled is true when the guide segment is set alongside the updates settings", () => {
  setFullEnv({ RESEND_GUIDE_SEGMENT_ID: "seg_guide" });
  assert.equal(guideSignupEnabled(), true);
});

test("guideSignupEnabled is false when the guide segment is not set, although updates are on", () => {
  setFullEnv();
  assert.equal(signupEnabled(), true, "fixture check: updates sign-up is configured");
  assert.equal(guideSignupEnabled(), false);
});

test("guideSignupEnabled is false when the guide segment is an empty string", () => {
  setFullEnv({ RESEND_GUIDE_SEGMENT_ID: "" });
  assert.equal(guideSignupEnabled(), false);
});

test("guideSignupEnabled is false when the base feature is not configured, even with a guide segment", () => {
  setFullEnv({ RESEND_API_KEY: undefined, RESEND_GUIDE_SEGMENT_ID: "seg_guide" });
  assert.equal(guideSignupEnabled(), false);
});

test("GUIDE_PDF_PATH names a file that exists under public/", () => {
  assert.ok(existsSync(join(import.meta.dirname, "..", "..", "..", "public", GUIDE_PDF_PATH)));
});

// ---------------------------------------------------------------------------
// Guide list: confirmation email
// ---------------------------------------------------------------------------

test("sendConfirmation for the guide list refuses and makes no request when the guide segment is not set", async () => {
  setFullEnv();
  let called = false;
  const { lines, result } = await captureErrors(() =>
    withFetch(
      async () => {
        called = true;
        return jsonResponse(200);
      },
      () => sendConfirmation(READER, "https://site.test", NOW, "guide"),
    ),
  );
  assert.equal(result, false);
  assert.equal(called, false);
  assert.deepEqual(parseLine(lines[0]), {
    step: "send-email",
    status: null,
    name: "not_configured",
    missing: ["RESEND_GUIDE_SEGMENT_ID"],
  });
});

/** Sends a confirmation for `list` and returns the subject and text Resend was given. */
async function capturedConfirmation(list: "updates" | "guide"): Promise<{ subject: string; text: string }> {
  setFullEnv({ RESEND_GUIDE_SEGMENT_ID: "seg_guide" });
  let captured = { subject: "", text: "" };
  await withFetch(
    async (_input, init) => {
      const body = JSON.parse((init as RequestInit).body as string);
      captured = { subject: body.subject, text: body.text };
      return jsonResponse(200);
    },
    () => sendConfirmation(READER, "https://site.test", NOW, list),
  );
  return captured;
}

test("the guide confirmation link carries a token that reads back as the guide list", async () => {
  setFullEnv({ RESEND_GUIDE_SEGMENT_ID: "seg_guide" });
  let sentText = "";
  const ok = await withFetch(
    async (_input, init) => {
      sentText = JSON.parse((init as RequestInit).body as string).text;
      return jsonResponse(200);
    },
    () => sendConfirmation(READER, "https://site.test", NOW, "guide"),
  );
  assert.equal(ok, true);
  const match = sentText.match(/\?t=([^\s]+)/);
  assert.ok(match, "confirmation text should contain a token");
  assert.deepEqual(readConfiguredToken(decodeURIComponent(match![1]), NOW), { email: READER, list: "guide" });
});

test("the guide confirmation email has its own subject", async () => {
  const guide = await capturedConfirmation("guide");
  assert.equal(guide.subject, "Confirm to get your free guide");
});

test("the updates confirmation email keeps its own subject", async () => {
  const updates = await capturedConfirmation("updates");
  assert.equal(updates.subject, "Confirm your GetBrian Healthy updates");
});

test("the guide confirmation email promises a weekly tip and does not say two emails a year", async () => {
  const guide = await capturedConfirmation("guide");
  assert.match(guide.text, /one short, evidence-checked tip a week/);
  assert.doesNotMatch(guide.text, /two emails a year/);
});

test("the updates confirmation email says two emails a year and mentions no guide", async () => {
  const updates = await capturedConfirmation("updates");
  assert.match(updates.text, /at most two emails a year/);
  assert.doesNotMatch(updates.text, /guide/i);
});

test("the updates confirmation still sends when the guide segment is not set", async () => {
  setFullEnv();
  const ok = await withFetch(
    async () => jsonResponse(200),
    () => sendConfirmation(READER, "https://site.test", NOW),
  );
  assert.equal(ok, true);
});

// ---------------------------------------------------------------------------
// Guide list: contacts
// ---------------------------------------------------------------------------

test("addContact for the guide list adds the contact to the guide segment, not the updates one", async () => {
  setFullEnv({ RESEND_GUIDE_SEGMENT_ID: "seg_guide" });
  let capturedBody: unknown;
  await withFetch(
    async (_input, init) => {
      capturedBody = JSON.parse((init as RequestInit).body as string);
      return jsonResponse(201);
    },
    async () => {
      assert.equal(await addContact(READER, "guide"), true);
    },
  );
  assert.deepEqual(capturedBody, { email: READER, unsubscribed: false, segments: [{ id: "seg_guide" }] });
});

test("addContact for the guide list refuses and makes no request when the guide segment is not set", async () => {
  setFullEnv();
  let called = false;
  const { lines, result } = await captureErrors(() =>
    withFetch(
      async () => {
        called = true;
        return jsonResponse(201);
      },
      () => addContact(READER, "guide"),
    ),
  );
  assert.equal(result, false);
  assert.equal(called, false);
  assert.deepEqual(parseLine(lines[0]), {
    step: "add-contact",
    status: null,
    name: "not_configured",
    missing: ["RESEND_GUIDE_SEGMENT_ID"],
  });
});

test("addContact for the guide list on a 409 joins the guide segment, never the updates one", async () => {
  setFullEnv({ RESEND_GUIDE_SEGMENT_ID: "seg_guide" });
  const JOIN_GUIDE = "POST https://api.resend.com/contacts/reader%40example.com/segments/seg_guide";
  const { calls, impl } = recordingFetch({ [CREATE]: 409, [UPDATE]: 200, [JOIN_GUIDE]: 200 });
  await withFetch(impl, async () => {
    assert.equal(await addContact(READER, "guide"), true);
  });
  assert.deepEqual(calls.map((c) => `${c.method} ${c.url}`), [CREATE, UPDATE, JOIN_GUIDE]);
});

// ---------------------------------------------------------------------------
// Guide list: the download email
// ---------------------------------------------------------------------------

test("sendGuide refuses and makes no request when the guide segment is not set", async () => {
  setFullEnv();
  let called = false;
  const { lines, result } = await captureErrors(() =>
    withFetch(
      async () => {
        called = true;
        return jsonResponse(200);
      },
      () => sendGuide(READER, "https://site.test"),
    ),
  );
  assert.equal(result, false);
  assert.equal(called, false);
  assert.deepEqual(parseLine(lines[0]), {
    step: "send-guide",
    status: null,
    name: "not_configured",
    missing: ["RESEND_GUIDE_SEGMENT_ID"],
  });
});

test("sendGuide emails the reader the guide PDF link on the site", async () => {
  setFullEnv({ RESEND_GUIDE_SEGMENT_ID: "seg_guide" });
  let sent = { to: [] as string[], subject: "", text: "" };
  await withFetch(
    async (_input, init) => {
      const body = JSON.parse((init as RequestInit).body as string);
      sent = { to: body.to, subject: body.subject, text: body.text };
      return jsonResponse(200);
    },
    () => sendGuide(READER, "https://site.test"),
  );
  assert.deepEqual(sent.to, [READER]);
  assert.equal(sent.subject, "Your guide: Energy. Strength. Calm.");
  assert.ok(sent.text.includes(`https://site.test${GUIDE_PDF_PATH}`), "the email must carry the PDF link");
});

test("sendGuide returns true when Resend accepts the email", async () => {
  setFullEnv({ RESEND_GUIDE_SEGMENT_ID: "seg_guide" });
  const ok = await withFetch(
    async () => jsonResponse(200),
    () => sendGuide(READER, "https://site.test"),
  );
  assert.equal(ok, true);
});

test("sendGuide returns false and logs the send-guide step when Resend refuses", async () => {
  setFullEnv({ RESEND_GUIDE_SEGMENT_ID: "seg_guide" });
  const { lines, result } = await captureErrors(() =>
    withFetch(
      async () => resendError(500, { name: "application_error", message: "try again" }),
      () => sendGuide(READER, "https://site.test"),
    ),
  );
  assert.equal(result, false);
  assert.deepEqual(parseLine(lines[0]), { step: "send-guide", status: 500, name: "application_error", message: "try again" });
  assertNoLeak(lines);
});
