import test from "node:test";
import assert from "node:assert/strict";
import { mock } from "node:test";

// Runs the real subscribe action on top of the real newsletter module, with only
// fetch faked, to prove the diagnostic log added in newsletter.ts leaves the
// user-facing state alone. (actions.test.ts stubs newsletter out, so it cannot.)
const SECRET_KEY = "re_SuperSecretKey_123";
const READER = "reader@example.com";
const PREFIX = "[newsletter] ";

let subscribe: (typeof import("../actions.ts"))["subscribe"];

test.before(async () => {
  mock.module(new URL("../site.ts", import.meta.url), { exports: { siteUrl: "https://example.test" } });
  mock.module("next/navigation", { exports: { redirect: () => undefined } });
  ({ subscribe } = await import("../actions.ts"));
});

const ENV = {
  RESEND_API_KEY: SECRET_KEY,
  RESEND_SEGMENT_ID: "seg_123",
  NEWSLETTER_SECRET: "a".repeat(32),
  NEWSLETTER_FROM: "Brian <brian@getbrian.xyz>",
};

async function run(impl: typeof fetch) {
  const saved: Record<string, string | undefined> = {};
  for (const k of Object.keys(ENV)) saved[k] = process.env[k];
  Object.assign(process.env, ENV);
  const originalFetch = globalThis.fetch;
  const originalError = console.error;
  const lines: string[] = [];
  globalThis.fetch = impl;
  console.error = (...args: unknown[]) => {
    lines.push(args.map(String).join(" "));
  };
  try {
    const fd = new FormData();
    fd.set("email", READER);
    return { state: await subscribe({ status: "idle" }, fd), lines };
  } finally {
    globalThis.fetch = originalFetch;
    console.error = originalError;
    for (const k of Object.keys(ENV)) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  }
}

test("subscribe still answers 'error' when Resend refuses, and the refusal is logged without the address or key", async () => {
  const { state, lines } = await run(
    async () =>
      new Response(JSON.stringify({ name: "validation_error", message: "domain is not verified" }), { status: 403 }),
  );
  assert.deepEqual(state, { status: "error" });
  assert.equal(lines.length, 1);
  assert.deepEqual(JSON.parse(lines[0].slice(PREFIX.length)), {
    step: "send-email",
    status: 403,
    name: "validation_error",
    message: "domain is not verified",
  });
  assert.ok(!lines[0].includes(READER));
  assert.ok(!lines[0].includes(SECRET_KEY));
});

test("subscribe still answers 'error' when fetch throws, and the failure is logged", async () => {
  const { state, lines } = await run(async () => {
    throw new TypeError("fetch failed");
  });
  assert.deepEqual(state, { status: "error" });
  assert.equal(lines.length, 1);
  assert.deepEqual(JSON.parse(lines[0].slice(PREFIX.length)), {
    step: "send-email",
    status: null,
    name: "TypeError",
  });
});

test("subscribe still answers 'sent' on success and logs nothing", async () => {
  const { state, lines } = await run(async () => new Response("{}", { status: 200 }));
  assert.deepEqual(state, { status: "sent" });
  assert.deepEqual(lines, []);
});
