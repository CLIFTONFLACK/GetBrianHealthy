import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import {
  GA_MEASUREMENT_ID,
  cleanAddress,
  clearGaCookies,
  disableFlag,
  gaInitScript,
  isExcludedPath,
  isGaCookieName,
  isTrackedHost,
  isTrackedPath,
  parseConsent,
  showsBanner,
} from "../consent.ts";

test("tracks www.getbrianhealthy.xyz and nothing else, including lookalikes and sibling sites", () => {
  assert.equal(isTrackedHost("www.getbrianhealthy.xyz"), true);
  assert.equal(isTrackedHost("WWW.GETBRIANHEALTHY.XYZ"), true);
  assert.equal(isTrackedHost("getbrianhealthy.xyz"), true);
  for (const h of [
    "staging.getbrianhealthy.xyz",
    "x.www.getbrianhealthy.xyz",
    "notgetbrianhealthy.xyz",
    "www.getbrianhealthy.xyz.evil.com",
    "getbrianhealthy.xyzz",
    "getbrianhealthy.xyx",
    "getbrian.xyz",
    "getbrianhealthy.vercel.app",
    "localhost",
    "",
  ]) {
    assert.equal(isTrackedHost(h), false, h);
  }
});

test("the banner shows on the tracked host and localhost only", () => {
  assert.equal(showsBanner("www.getbrianhealthy.xyz"), true);
  assert.equal(showsBanner("localhost"), true);
  assert.equal(showsBanner("127.0.0.1"), true);
  assert.equal(showsBanner("getbrian.xyz"), false);
  assert.equal(showsBanner("www-git-x.vercel.app"), false);
});

test("only the public marketing page is measured", () => {
  for (const p of ["/", "/about", "/method", "/disclosures", "/products/some-product", "/why-these-picks", "/why-these-picks/creator-notes"]) {
    assert.equal(isTrackedPath(p), true, p);
    assert.equal(isExcludedPath(p), false, p);
  }
  for (const p of [
    "/confirm",
    "/confirm/x",
    "/go",
    "/go/some-product",
    "/api/x",
    "//evil",
    "",
    "relative",
  ]) {
    assert.equal(isTrackedPath(p), false, p);
    assert.equal(isExcludedPath(p), true, p);
  }
});

test("only an exact stored choice counts; anything else means 'not asked'", () => {
  assert.equal(parseConsent("granted"), "granted");
  assert.equal(parseConsent("denied"), "denied");
  for (const v of [null, undefined, "", "true", "GRANTED", "granted ", "1"]) {
    assert.equal(parseConsent(v as string | null | undefined), null, String(v));
  }
});

test("the init script sets consent v2 signals before config and denies the ad signals", () => {
  const s = gaInitScript();
  assert.ok(s.indexOf("'consent','default'") < s.indexOf("'config'"));
  assert.match(s, /analytics_storage:'granted'/);
  for (const sig of ["ad_storage", "ad_user_data", "ad_personalization"]) {
    assert.match(s, new RegExp(`${sig}:'denied'`));
  }
  assert.ok(s.includes(`gtag('config','${GA_MEASUREMENT_ID}',{send_page_view:false,`));
  assert.match(s, /allow_google_signals:false/);
  assert.equal(GA_MEASUREMENT_ID, "G-JMY0LLX9FE");
  assert.ok(!s.includes("= true"), "must not leave the disable flag on");
});

test("recognises gtag cookie names and no others", () => {
  for (const n of ["_ga", "_ga_JMY0LLX9FE", "_gid", "_gat", "_gat_gtag_G_JMY0LLX9FE"]) {
    assert.equal(isGaCookieName(n), true, n);
  }
  for (const n of ["gb_consent", "session", "_gaps", "ga", "x_ga", "hl-region"]) {
    assert.equal(isGaCookieName(n), false, n);
  }
});

test("clearGaCookies expires GA cookies and leaves the sign-in session and other cookies alone", () => {
  const writes: string[] = [];
  const doc = {
    get cookie() {
      return "_ga=GA1.1.1; _ga_JMY0LLX9FE=GS1; hl-region=secret; gb_consent=granted";
    },
    set cookie(v: string) {
      writes.push(v);
    },
  } as unknown as Document;
  clearGaCookies(doc, "www.getbrianhealthy.xyz");
  const names = new Set(writes.map((w) => w.split("=")[0]));
  assert.deepEqual([...names].sort(), ["_ga", "_ga_JMY0LLX9FE"]);
  assert.ok(writes.every((w) => w.includes("expires=Thu, 01 Jan 1970")));
  assert.ok(writes.some((w) => w.includes("domain=.www.getbrianhealthy.xyz")), "the host is covered");
  assert.ok(writes.every((w) => !w.includes("domain=.getbrian.xyz") && !w.includes("domain=getbrian.xyz")), "sibling sites' cookies on the parent domain are left alone");
});

test("with storage blocked, a choice still holds for the page view and nothing is assumed before it", async () => {
  const { readConsent, writeConsent, resetMemoryChoiceForTests } = await import("../consent.ts");
  const events: string[] = [];
  const blocked = {
    getItem() {
      throw new Error("blocked");
    },
    setItem() {
      throw new Error("blocked");
    },
  };
  (globalThis as unknown as { window: unknown }).window = {
    localStorage: blocked,
    dispatchEvent: (e: Event) => events.push(e.type),
  };
  try {
    resetMemoryChoiceForTests();
    assert.equal(readConsent(), null, "no choice yet means not asked");
    writeConsent("denied");
    assert.equal(readConsent(), "denied");
    writeConsent("granted");
    assert.equal(readConsent(), "granted");
    assert.equal(events.length, 2);
  } finally {
    resetMemoryChoiceForTests();
    delete (globalThis as unknown as { window?: unknown }).window;
  }
});

function runInit(href: string, referrer: string) {
  const ctx: Record<string, unknown> = {
    location: { href, origin: new URL(href).origin, hostname: new URL(href).hostname, pathname: new URL(href).pathname },
    document: { referrer },
    URL,
    Array,
    Date,
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(gaInitScript(), ctx);
  const layer = (ctx.dataLayer as ArrayLike<unknown>[]).map((a) => Array.from(a));
  const out = JSON.parse(JSON.stringify(layer));
  return {
    config: out.find((a: unknown[]) => a[0] === "config"),
    view: out.find((a: unknown[]) => a[0] === "event" && a[1] === "page_view"),
    lastPath: ctx.__gbLastPath,
  };
}

test("the init script sends one manual page view with a clean address: no query (except utm_*), no fragment", () => {
  const r = runInit("https://www.getbrianhealthy.xyz/products/x?token=SECRET&utm_source=mail#frag", "");
  assert.equal(r.config[1], "G-JMY0LLX9FE");
  assert.equal(r.config[2].send_page_view, false, "automatic page views are off, so history changes cannot leak addresses");
  assert.equal(r.config[2].cookie_domain, "www.getbrianhealthy.xyz", "cookies stay on this host");
  assert.equal(r.config[2].allow_google_signals, false);
  assert.equal(r.config[2].allow_ad_personalization_signals, false);
  assert.equal(r.view[2].page_location, "https://www.getbrianhealthy.xyz/products/x?utm_source=mail");
  assert.equal(r.lastPath, "/products/x");
});

test("the init script blanks same-site referrers and reduces external ones to their origin", () => {
  const same = runInit("https://www.getbrianhealthy.xyz/", "https://www.getbrianhealthy.xyz/deals/12?x=1");
  assert.equal(same.view[2].page_referrer, "");
  const ext = runInit("https://www.getbrianhealthy.xyz/", "https://news.example.org/story/private-id?token=abc#x");
  assert.equal(ext.view[2].page_referrer, "https://news.example.org");
  const none = runInit("https://www.getbrianhealthy.xyz/", "");
  assert.equal(none.view[2].page_referrer, "");
});

test("cleanAddress is what the component sends on later page views: same rules as the init script", () => {
  assert.equal(
    cleanAddress("https://www.getbrianhealthy.xyz/products/x?token=SECRET&utm_source=mail&UTM_Campaign=x#frag"),
    "https://www.getbrianhealthy.xyz/products/x?utm_source=mail&UTM_Campaign=x",
  );
  assert.equal(cleanAddress("https://www.getbrianhealthy.xyz/?a=1"), "https://www.getbrianhealthy.xyz/");
  assert.equal(disableFlag(), "ga-disable-G-JMY0LLX9FE");
});

test("the cookie cleanup matches the real GA names only, not lookalikes", () => {
  for (const n of ["_gatekeeper", "_gatx", "_gaps"]) assert.equal(isGaCookieName(n), false, n);
  assert.equal(isGaCookieName("_gat"), true);
  assert.equal(isGaCookieName("_gat_gtag_G_JMY0LLX9FE"), true);
});
