import test from "node:test";
import assert from "node:assert/strict";
import { mock } from "node:test";

// actions.ts imports `siteUrl` from ../layout, which (like sitemap.ts) pulls
// in next/font/google and a global .css import that can't run outside
// Next's own build pipeline — same problem/solution as sitemap.test.ts.
// It also imports `redirect` from next/navigation (which throws in a real
// Next runtime) and the Resend-calling functions from ./newsletter, both of
// which are replaced here so confirmSubscription/subscribe never touch the
// network. normalizeEmail is kept real (spread from the actual module) since
// its behavior is exactly what several tests below are checking.
const FAKE_SITE_URL = "https://example.test";

type RedirectCall = { target: string };
const redirectCalls: RedirectCall[] = [];
/** Mirrors next/navigation's real redirect(): it never returns, it throws. */
function mockRedirect(target: string): never {
  redirectCalls.push({ target });
  throw new Error(`NEXT_REDIRECT:${target}`);
}

let sendConfirmationImpl: (email: string, siteUrl: string, now?: number, list?: "updates" | "guide") => Promise<boolean>;
let addContactImpl: (email: string) => Promise<boolean>;
let verifyConfiguredTokenImpl: (token: unknown, now?: number) => string | null;

let sendGuideImpl: (email: string, siteUrl: string) => Promise<boolean>;
let tokenList: "updates" | "guide" = "updates";

const sendConfirmationCalls: unknown[][] = [];
const addContactCalls: unknown[][] = [];
const sendGuideCalls: unknown[][] = [];

let subscribe: typeof import("../actions.ts")["subscribe"];
let requestGuide: typeof import("../actions.ts")["requestGuide"];
let confirmSubscription: typeof import("../actions.ts")["confirmSubscription"];

test.before(async () => {
  const realNewsletter = await import("../newsletter.ts");

  mock.module(new URL("../site.ts", import.meta.url), {
    exports: { siteUrl: FAKE_SITE_URL },
  });

  mock.module("next/navigation", {
    exports: { redirect: mockRedirect },
  });

  mock.module(new URL("../newsletter.ts", import.meta.url), {
    exports: {
      ...realNewsletter,
      sendConfirmation: async (...args: [string, string, number?, ("updates" | "guide")?]) => {
        sendConfirmationCalls.push(args);
        return sendConfirmationImpl(...args);
      },
      addContact: async (...args: [string, ("updates" | "guide")?]) => {
        addContactCalls.push(args);
        return addContactImpl(args[0]);
      },
      sendGuide: async (...args: [string, string]) => {
        sendGuideCalls.push(args);
        return sendGuideImpl(...args);
      },
      verifyConfiguredToken: (...args: [unknown, number?]) => verifyConfiguredTokenImpl(...args),
      // The action reads email and list together; the list comes from `tokenList`.
      readConfiguredToken: (...args: [unknown, number?]) => {
        const email = verifyConfiguredTokenImpl(...args);
        return email ? { email, list: tokenList } : null;
      },
    },
  });

  // getRegion reads request cookies and headers, which do not exist under node:test.
  mock.module(new URL("../region-server.ts", import.meta.url), {
    exports: { getRegion: async () => region },
  });

  ({ subscribe, requestGuide, confirmSubscription } = await import("../actions.ts"));
});

let region: "US" | "GB" = "US";

test("requestGuide accepts a UK visitor: the guide is global", async () => {
  region = "GB";
  sendConfirmationImpl = async () => true;
  try {
    assert.deepEqual(await requestGuide({ status: "idle" }, formData({ email: "reader@example.com" })), { status: "sent" });
    assert.equal(sendConfirmationCalls.length, 1);
  } finally {
    region = "US";
  }
});

test("subscribe (the updates list) still works for a UK visitor", async () => {
  region = "GB";
  sendConfirmationImpl = async () => true;
  try {
    assert.deepEqual(await subscribe({ status: "idle" }, formData({ email: "reader@example.com" })), { status: "sent" });
    assert.equal(sendConfirmationCalls.length, 1);
  } finally {
    region = "US";
  }
});

test.beforeEach(() => {
  redirectCalls.length = 0;
  sendConfirmationCalls.length = 0;
  addContactCalls.length = 0;
  sendConfirmationImpl = async () => {
    throw new Error("sendConfirmation not stubbed for this test");
  };
  addContactImpl = async () => {
    throw new Error("addContact not stubbed for this test");
  };
  verifyConfiguredTokenImpl = () => {
    throw new Error("verifyConfiguredToken not stubbed for this test");
  };
  sendGuideCalls.length = 0;
  sendGuideImpl = async () => true;
  tokenList = "updates";
});

function formData(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

// ---------------------------------------------------------------------------
// subscribe — honeypot
// ---------------------------------------------------------------------------

test("subscribe returns 'sent' without calling Resend when the honeypot field is filled", async () => {
  const result = await subscribe(
    { status: "idle" },
    formData({ website: "https://spam.example.com", email: "reader@example.com" }),
  );
  assert.deepEqual(result, { status: "sent" });
  assert.equal(sendConfirmationCalls.length, 0);
});

// ---------------------------------------------------------------------------
// subscribe — invalid email
// ---------------------------------------------------------------------------

test("subscribe returns 'invalid' for a malformed address and calls Resend for nothing", async () => {
  const result = await subscribe({ status: "idle" }, formData({ email: "not-an-email" }));
  assert.deepEqual(result, { status: "invalid" });
  assert.equal(sendConfirmationCalls.length, 0);
});

test("subscribe returns 'invalid' when the email field is missing entirely", async () => {
  const result = await subscribe({ status: "idle" }, new FormData());
  assert.deepEqual(result, { status: "invalid" });
  assert.equal(sendConfirmationCalls.length, 0);
});

// ---------------------------------------------------------------------------
// subscribe — success / failure, and the "don't reveal who's on the list" contract
// ---------------------------------------------------------------------------

test("subscribe returns 'sent' when Resend accepts the confirmation email", async () => {
  sendConfirmationImpl = async () => true;
  const result = await subscribe({ status: "idle" }, formData({ email: "reader@example.com" }));
  assert.deepEqual(result, { status: "sent" });
  assert.equal(sendConfirmationCalls.length, 1);
  assert.deepEqual(sendConfirmationCalls[0].slice(0, 2), ["reader@example.com", FAKE_SITE_URL]);
});

test("subscribe returns 'error' when Resend refuses the confirmation email", async () => {
  sendConfirmationImpl = async () => false;
  const result = await subscribe({ status: "idle" }, formData({ email: "reader@example.com" }));
  assert.deepEqual(result, { status: "error" });
});

test("subscribe returns 'error' when sendConfirmation throws", async () => {
  sendConfirmationImpl = async () => {
    throw new Error("network exploded");
  };
  const result = await subscribe({ status: "idle" }, formData({ email: "reader@example.com" }));
  assert.deepEqual(result, { status: "error" });
});

test("subscribe answers identically ('sent') whether or not the address already exists on the list", async () => {
  // The action has no way to know if an address already exists (Resend's
  // /emails endpoint doesn't reveal that), so both paths through
  // sendConfirmation succeeding must produce the same outward answer.
  sendConfirmationImpl = async () => true;
  const first = await subscribe({ status: "idle" }, formData({ email: "new-reader@example.com" }));
  const second = await subscribe({ status: "idle" }, formData({ email: "existing-reader@example.com" }));
  assert.deepEqual(first, { status: "sent" });
  assert.deepEqual(second, { status: "sent" });
});

// ---------------------------------------------------------------------------
// confirmSubscription — invalid token
// ---------------------------------------------------------------------------

test("confirmSubscription makes no addContact call and redirects to the error page for an invalid token", async () => {
  verifyConfiguredTokenImpl = () => null;
  await assert.rejects(() => confirmSubscription(formData({ t: "garbage" })), /NEXT_REDIRECT/);
  assert.equal(addContactCalls.length, 0);
  assert.deepEqual(redirectCalls, [{ target: "/confirm?error=1" }]);
});

test("confirmSubscription redirects to the error page when the 't' field is missing", async () => {
  verifyConfiguredTokenImpl = () => null;
  await assert.rejects(() => confirmSubscription(new FormData()), /NEXT_REDIRECT/);
  assert.equal(addContactCalls.length, 0);
  assert.deepEqual(redirectCalls, [{ target: "/confirm?error=1" }]);
});

// ---------------------------------------------------------------------------
// confirmSubscription — valid token
// ---------------------------------------------------------------------------

test("confirmSubscription adds the contact and redirects to the done page on success", async () => {
  verifyConfiguredTokenImpl = () => "reader@example.com";
  addContactImpl = async () => true;
  await assert.rejects(() => confirmSubscription(formData({ t: "valid-token" })), /NEXT_REDIRECT/);
  assert.equal(addContactCalls.length, 1);
  assert.deepEqual(addContactCalls[0], ["reader@example.com", "updates"]);
  assert.deepEqual(redirectCalls, [{ target: "/confirm?done=1" }]);
  assert.equal(sendGuideCalls.length, 0, "an updates sign-up is never sent the guide");
});

test("confirmSubscription redirects to the error page when addContact reports failure", async () => {
  verifyConfiguredTokenImpl = () => "reader@example.com";
  addContactImpl = async () => false;
  await assert.rejects(() => confirmSubscription(formData({ t: "valid-token" })), /NEXT_REDIRECT/);
  assert.deepEqual(redirectCalls, [{ target: "/confirm?error=1" }]);
});

test("confirmSubscription redirects to the error page when addContact throws", async () => {
  verifyConfiguredTokenImpl = () => "reader@example.com";
  addContactImpl = async () => {
    throw new Error("resend down");
  };
  await assert.rejects(() => confirmSubscription(formData({ t: "valid-token" })), /NEXT_REDIRECT/);
  assert.deepEqual(redirectCalls, [{ target: "/confirm?error=1" }]);
});

// ---------------------------------------------------------------------------
// subscribe — updates list is never the guide list
// ---------------------------------------------------------------------------

test("subscribe asks for the updates list, never the guide list", async () => {
  sendConfirmationImpl = async () => true;
  await subscribe({ status: "idle" }, formData({ email: "reader@example.com" }));
  assert.notEqual(sendConfirmationCalls[0][3], "guide");
});

// ---------------------------------------------------------------------------
// requestGuide — the free-guide form
// ---------------------------------------------------------------------------

test("requestGuide sends the confirmation for the guide list", async () => {
  sendConfirmationImpl = async () => true;
  const result = await requestGuide({ status: "idle" }, formData({ email: "reader@example.com" }));
  assert.deepEqual(result, { status: "sent" });
  assert.equal(sendConfirmationCalls.length, 1);
  assert.equal(sendConfirmationCalls[0][3], "guide");
});

test("requestGuide never reads the list from the form: a posted list field is ignored", async () => {
  sendConfirmationImpl = async () => true;
  await requestGuide({ status: "idle" }, formData({ email: "reader@example.com", list: "updates" }));
  assert.equal(sendConfirmationCalls[0][3], "guide");
});

test("requestGuide returns 'error' when the guide confirmation is refused", async () => {
  sendConfirmationImpl = async () => false;
  const result = await requestGuide({ status: "idle" }, formData({ email: "reader@example.com" }));
  assert.deepEqual(result, { status: "error" });
});

test("requestGuide returns 'error' when sendConfirmation throws", async () => {
  sendConfirmationImpl = async () => {
    throw new Error("network exploded");
  };
  const result = await requestGuide({ status: "idle" }, formData({ email: "reader@example.com" }));
  assert.deepEqual(result, { status: "error" });
});

test("requestGuide returns 'sent' without sending when the honeypot field is filled", async () => {
  const result = await requestGuide(
    { status: "idle" },
    formData({ website: "https://spam.example.com", email: "reader@example.com" }),
  );
  assert.deepEqual(result, { status: "sent" });
  assert.equal(sendConfirmationCalls.length, 0);
});

test("requestGuide returns 'invalid' for a malformed address and sends nothing", async () => {
  const result = await requestGuide({ status: "idle" }, formData({ email: "not-an-email" }));
  assert.deepEqual(result, { status: "invalid" });
  assert.equal(sendConfirmationCalls.length, 0);
});

// ---------------------------------------------------------------------------
// confirmSubscription — guide list
// ---------------------------------------------------------------------------

test("confirmSubscription adds a guide reader to the guide list and redirects to the guide done page", async () => {
  tokenList = "guide";
  verifyConfiguredTokenImpl = () => "reader@example.com";
  addContactImpl = async () => true;
  await assert.rejects(() => confirmSubscription(formData({ t: "valid-token" })), /NEXT_REDIRECT/);
  assert.deepEqual(addContactCalls, [["reader@example.com", "guide"]]);
  assert.deepEqual(redirectCalls, [{ target: "/confirm?done=guide" }]);
});

test("confirmSubscription emails a guide reader the download link exactly once", async () => {
  tokenList = "guide";
  verifyConfiguredTokenImpl = () => "reader@example.com";
  addContactImpl = async () => true;
  await assert.rejects(() => confirmSubscription(formData({ t: "valid-token" })), /NEXT_REDIRECT/);
  assert.deepEqual(sendGuideCalls, [["reader@example.com", FAKE_SITE_URL]]);
});

test("confirmSubscription still redirects a guide reader to the guide done page when the guide email is refused", async () => {
  tokenList = "guide";
  verifyConfiguredTokenImpl = () => "reader@example.com";
  addContactImpl = async () => true;
  sendGuideImpl = async () => false;
  await assert.rejects(() => confirmSubscription(formData({ t: "valid-token" })), /NEXT_REDIRECT/);
  assert.deepEqual(redirectCalls, [{ target: "/confirm?done=guide" }]);
});

test("confirmSubscription still redirects a guide reader to the guide done page when the guide email throws", async () => {
  tokenList = "guide";
  verifyConfiguredTokenImpl = () => "reader@example.com";
  addContactImpl = async () => true;
  sendGuideImpl = async () => {
    throw new Error("resend down for guide");
  };
  await assert.rejects(() => confirmSubscription(formData({ t: "valid-token" })), /NEXT_REDIRECT/);
  assert.deepEqual(redirectCalls, [{ target: "/confirm?done=guide" }]);
});

test("confirmSubscription sends no guide email when adding the guide reader fails", async () => {
  tokenList = "guide";
  verifyConfiguredTokenImpl = () => "reader@example.com";
  addContactImpl = async () => false;
  await assert.rejects(() => confirmSubscription(formData({ t: "valid-token" })), /NEXT_REDIRECT/);
  assert.equal(sendGuideCalls.length, 0);
  assert.deepEqual(redirectCalls, [{ target: "/confirm?error=1" }]);
});

test("confirmSubscription sends no guide email for an invalid token", async () => {
  tokenList = "guide";
  verifyConfiguredTokenImpl = () => null;
  await assert.rejects(() => confirmSubscription(formData({ t: "forged" })), /NEXT_REDIRECT/);
  assert.equal(addContactCalls.length, 0);
  assert.equal(sendGuideCalls.length, 0);
  assert.deepEqual(redirectCalls, [{ target: "/confirm?error=1" }]);
});

test("confirmSubscription never emails the guide to an updates reader, even when that email would succeed", async () => {
  tokenList = "updates";
  verifyConfiguredTokenImpl = () => "reader@example.com";
  addContactImpl = async () => true;
  sendGuideImpl = async () => true;
  await assert.rejects(() => confirmSubscription(formData({ t: "valid-token" })), /NEXT_REDIRECT/);
  assert.equal(sendGuideCalls.length, 0);
  assert.deepEqual(redirectCalls, [{ target: "/confirm?done=1" }]);
});
