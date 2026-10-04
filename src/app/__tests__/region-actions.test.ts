import test from "node:test";
import assert from "node:assert/strict";
import { mock } from "node:test";

// region-actions.ts and region-server.ts read next/headers, whose cookies() and
// headers() throw outside a request. They are replaced here by stand-ins that
// record what the code under test does with them.
type SetCall = { name: string; value: string; options: Record<string, unknown> };
const setCalls: SetCall[] = [];
const cookieJar = new Map<string, string>();
const headerJar = new Map<string, string>();

let setRegion: typeof import("../region-actions.ts")["setRegion"];
let getRegion: typeof import("../region-server.ts")["getRegion"];

test.before(async () => {
  mock.module("next/headers", {
    exports: {
      cookies: async () => ({
        set: (name: string, value: string, options: Record<string, unknown>) => {
          setCalls.push({ name, value, options });
        },
        get: (name: string) => (cookieJar.has(name) ? { name, value: cookieJar.get(name) } : undefined),
      }),
      headers: async () => ({
        get: (name: string) => headerJar.get(name) ?? null,
      }),
    },
  });
  ({ setRegion } = await import("../region-actions.ts"));
  ({ getRegion } = await import("../region-server.ts"));
});

test.beforeEach(() => {
  setCalls.length = 0;
  cookieJar.clear();
  headerJar.clear();
});

function form(region: unknown): FormData {
  const fd = new FormData();
  if (region !== undefined) fd.set("region", region as string);
  return fd;
}

// ---------------------------------------------------------------------------
// setRegion
// ---------------------------------------------------------------------------

test("setRegion stores GB under the hl-region cookie", async () => {
  await setRegion(form("GB"));
  assert.equal(setCalls.length, 1);
  assert.equal(setCalls[0].name, "hl-region");
  assert.equal(setCalls[0].value, "GB");
});

test("setRegion stores US under the hl-region cookie", async () => {
  await setRegion(form("US"));
  assert.equal(setCalls.length, 1);
  assert.equal(setCalls[0].value, "US");
});

test("setRegion scopes the cookie to /", async () => {
  await setRegion(form("GB"));
  assert.equal(setCalls[0].options.path, "/");
});

test("setRegion makes the cookie httpOnly and sameSite lax", async () => {
  await setRegion(form("GB"));
  assert.equal(setCalls[0].options.httpOnly, true);
  assert.equal(setCalls[0].options.sameSite, "lax");
});

test("setRegion keeps the cookie for one year", async () => {
  await setRegion(form("GB"));
  assert.equal(setCalls[0].options.maxAge, 31536000);
});

test("setRegion marks the cookie secure in production", async () => {
  const before = process.env.NODE_ENV;
  (process.env as Record<string, string>).NODE_ENV = "production";
  try {
    await setRegion(form("GB"));
  } finally {
    (process.env as Record<string, string | undefined>).NODE_ENV = before;
  }
  assert.equal(setCalls[0].options.secure, true);
});

test("setRegion does not mark the cookie secure outside production", async () => {
  const before = process.env.NODE_ENV;
  (process.env as Record<string, string>).NODE_ENV = "development";
  try {
    await setRegion(form("GB"));
  } finally {
    (process.env as Record<string, string | undefined>).NODE_ENV = before;
  }
  assert.equal(setCalls[0].options.secure, false);
});

test("setRegion sets nothing for a country that is not a region", async () => {
  await setRegion(form("FR"));
  assert.deepEqual(setCalls, []);
});

test("setRegion sets nothing for lowercase, padded or empty values", async () => {
  await setRegion(form("gb"));
  await setRegion(form("GB "));
  await setRegion(form(""));
  assert.deepEqual(setCalls, []);
});

test("setRegion sets nothing when the region field is missing", async () => {
  await setRegion(form(undefined));
  assert.deepEqual(setCalls, []);
});

test("setRegion sets nothing for a value that merely contains a region", async () => {
  await setRegion(form("US; Path=/"));
  await setRegion(form("GB,US"));
  assert.deepEqual(setCalls, []);
});

test("setRegion sets nothing when the region field is a file, not text", async () => {
  const fd = new FormData();
  fd.set("region", new Blob(["GB"]), "GB");
  await setRegion(fd);
  assert.deepEqual(setCalls, []);
});

test("setRegion resolves to undefined and does not throw on a rejected value", async () => {
  assert.equal(await setRegion(form("nope")), undefined);
});

test("setRegion uses the first value when the field is repeated", async () => {
  const fd = new FormData();
  fd.append("region", "GB");
  fd.append("region", "US");
  await setRegion(fd);
  assert.equal(setCalls[0].value, "GB");
});

// ---------------------------------------------------------------------------
// getRegion: the cookie beats the header, and the default is US
// ---------------------------------------------------------------------------

test("getRegion returns US with no cookie and no country header", async () => {
  assert.equal(await getRegion(), "US");
});

test("getRegion returns GB from the Vercel country header", async () => {
  headerJar.set("x-vercel-ip-country", "GB");
  assert.equal(await getRegion(), "GB");
});

test("getRegion returns US from a US country header", async () => {
  headerJar.set("x-vercel-ip-country", "US");
  assert.equal(await getRegion(), "US");
});

test("getRegion lets a US cookie beat a GB country header", async () => {
  cookieJar.set("hl-region", "US");
  headerJar.set("x-vercel-ip-country", "GB");
  assert.equal(await getRegion(), "US");
});

test("getRegion lets a GB cookie beat a US country header", async () => {
  cookieJar.set("hl-region", "GB");
  headerJar.set("x-vercel-ip-country", "US");
  assert.equal(await getRegion(), "GB");
});

test("getRegion ignores a tampered cookie and uses the country header", async () => {
  cookieJar.set("hl-region", "gb");
  headerJar.set("x-vercel-ip-country", "US");
  assert.equal(await getRegion(), "US");
  headerJar.set("x-vercel-ip-country", "GB");
  cookieJar.set("hl-region", "XX");
  assert.equal(await getRegion(), "GB");
});

test("getRegion treats a country the site does not serve as the US", async () => {
  headerJar.set("x-vercel-ip-country", "DE");
  assert.equal(await getRegion(), "US");
});

test("getRegion treats the Isle of Man as GB", async () => {
  headerJar.set("x-vercel-ip-country", "IM");
  assert.equal(await getRegion(), "GB");
});

test("getRegion ignores a cookie of the wrong name", async () => {
  cookieJar.set("region", "GB");
  assert.equal(await getRegion(), "US");
});
