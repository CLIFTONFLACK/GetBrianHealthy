import test from "node:test";
import assert from "node:assert/strict";
import {
  TOKEN_TTL_MS,
  addContact,
  normalizeEmail,
  sendConfirmation,
  signToken,
  signupEnabled,
  verifyConfiguredToken,
  verifyToken,
} from "../newsletter.ts";

// ---------------------------------------------------------------------------
// Environment helpers
// ---------------------------------------------------------------------------

const ENV_KEYS = ["RESEND_API_KEY", "RESEND_SEGMENT_ID", "NEWSLETTER_SECRET", "NEWSLETTER_FROM"] as const;

const VALID_SECRET = "a".repeat(32);

/** Sets every configured-feature env var to a valid value, minus any overrides/omissions. */
function setFullEnv(overrides: Partial<Record<(typeof ENV_KEYS)[number], string | undefined>> = {}) {
  const values: Record<(typeof ENV_KEYS)[number], string | undefined> = {
    RESEND_API_KEY: "re_test_key",
    RESEND_SEGMENT_ID: "seg_123",
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
