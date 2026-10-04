import test, { beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  FAILURE_BACKOFF_MS,
  PRICE_TTL_MS,
  getPrices,
  resetPriceCache,
  withPrices,
} from "../amazon-prices.ts";
import type { Product } from "../../app/data.ts";

const MINUTE = 60 * 1000;
const T0 = Date.UTC(2026, 9, 4, 14, 5, 0);

const ENV_BOTH = {
  AMAZON_CREATORS_ID_US: "id-us",
  AMAZON_CREATORS_SECRET_US: "secret-us",
  AMAZON_CREATORS_ID_GB: "id-gb",
  AMAZON_CREATORS_SECRET_GB: "secret-gb",
};

type Call = { url: string; init: RequestInit; body: Record<string, unknown> };

const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status });

const tokenOk = (expiresIn = 3600) => json({ access_token: "tok-1", expires_in: expiresIn });

function item(asin: string, amount: unknown, currency: unknown = "USD") {
  return { asin, offersV2: { listings: [{ isBuyBoxWinner: true, price: { money: { amount, currency } } }] } };
}

const itemsBody = (...items: unknown[]) => json({ itemsResult: { items } });

/**
 * A fake of the network boundary: records every call and answers the token
 * endpoint and the getItems endpoint from the supplied handlers.
 */
function fakeFetch(handlers: { token?: () => Response; items?: (ids: string[]) => Response }) {
  const calls: Call[] = [];
  const f = (async (url: string, init: RequestInit) => {
    const body = JSON.parse(String(init.body)) as Record<string, unknown>;
    calls.push({ url, init, body });
    if (url.includes("/auth/o2/token")) return (handlers.token ?? tokenOk)();
    const ids = body.itemIds as string[];
    return handlers.items ? handlers.items(ids) : itemsBody(...ids.map((id) => item(id, 10)));
  }) as unknown as typeof fetch;
  return { f, calls };
}

const tokenCalls = (calls: Call[]) => calls.filter((c) => c.url.includes("/auth/o2/token"));
const itemCalls = (calls: Call[]) => calls.filter((c) => c.url.includes("/catalog/v1/getItems"));

function baseProduct(overrides: Partial<Product> = {}): Product {
  return {
    slug: "fixture-product",
    name: "Fixture Product",
    brand: "Fixture Brand",
    category: "Creatine",
    format: "Powder",
    image: null,
    imageAlt: "",
    summary: "A fixture product for tests.",
    verdict: "It is a fixture.",
    bestFor: [],
    notFor: [],
    servingSize: null,
    servingsPerContainer: null,
    ingredients: [],
    priceUsd: null,
    priceCheckedAt: null,
    testing: [],
    evidence: [],
    safety: [],
    pros: [],
    cons: [],
    advantage: "",
    brandUrl: "https://brand.example.com",
    affiliateUrl: null,
    redirectAllowed: false,
    lastReviewed: null,
    verified: false,
    regions: [],
    offers: {},
    ...overrides,
  };
}

beforeEach(() => {
  resetPriceCache();
});

// ---------------------------------------------------------------------------
// Success
// ---------------------------------------------------------------------------

test("getPrices returns a USD price for a US ASIN with the fetch time as an ISO string", async () => {
  const { f } = fakeFetch({ items: () => itemsBody(item("B000000001", 24.5, "USD")) });

  const out = await getPrices("US", ["B000000001"], { fetch: f, now: () => T0, env: ENV_BOTH });

  assert.deepEqual(out.get("B000000001"), { amount: 24.5, currency: "USD", fetchedAt: "2026-10-04T14:05:00.000Z" });
  assert.equal(out.size, 1);
});

test("getPrices returns a GBP price for a GB ASIN", async () => {
  const { f } = fakeFetch({ items: () => itemsBody(item("B000000002", 19.99, "GBP")) });

  const out = await getPrices("GB", ["B000000002"], { fetch: f, now: () => T0, env: ENV_BOTH });

  assert.deepEqual(out.get("B000000002"), { amount: 19.99, currency: "GBP", fetchedAt: "2026-10-04T14:05:00.000Z" });
});

// ---------------------------------------------------------------------------
// Choosing and validating the listing
// ---------------------------------------------------------------------------

test("getPrices prefers the buy-box listing over the first listing", async () => {
  const listings = [
    { isBuyBoxWinner: false, price: { money: { amount: 30, currency: "USD" } } },
    { isBuyBoxWinner: true, price: { money: { amount: 22, currency: "USD" } } },
  ];
  const { f } = fakeFetch({ items: () => itemsBody({ asin: "B000000001", offersV2: { listings } }) });

  const out = await getPrices("US", ["B000000001"], { fetch: f, now: () => T0, env: ENV_BOTH });

  assert.equal(out.get("B000000001")?.amount, 22);
});

test("getPrices gives no price when no listing is the buy-box winner, rather than falling back to the first", async () => {
  const listings = [
    { isBuyBoxWinner: false, price: { money: { amount: 30, currency: "USD" } } },
    { isBuyBoxWinner: false, price: { money: { amount: 22, currency: "USD" } } },
  ];
  const { f } = fakeFetch({ items: () => itemsBody({ asin: "B000000001", offersV2: { listings } }) });

  const out = await getPrices("US", ["B000000001"], { fetch: f, now: () => T0, env: ENV_BOTH });

  assert.equal(out.size, 0);
});

test("getPrices gives no price when the only listing is not the buy-box winner", async () => {
  const listings = [{ isBuyBoxWinner: false, price: { money: { amount: 30, currency: "USD" } } }];
  const { f } = fakeFetch({ items: () => itemsBody({ asin: "B000000001", offersV2: { listings } }) });

  const out = await getPrices("US", ["B000000001"], { fetch: f, now: () => T0, env: ENV_BOTH });

  assert.equal(out.size, 0);
});

test("getPrices gives no price when the only listing has no buy-box flag at all", async () => {
  const listings = [{ price: { money: { amount: 30, currency: "USD" } } }];
  const { f } = fakeFetch({ items: () => itemsBody({ asin: "B000000001", offersV2: { listings } }) });

  const out = await getPrices("US", ["B000000001"], { fetch: f, now: () => T0, env: ENV_BOTH });

  assert.equal(out.size, 0);
});

test("getPrices ignores a cheaper non-buy-box listing listed before the buy-box winner", async () => {
  const listings = [
    { isBuyBoxWinner: false, price: { money: { amount: 5, currency: "USD" } } },
    { isBuyBoxWinner: true, price: { money: { amount: 22, currency: "USD" } } },
  ];
  const { f } = fakeFetch({ items: () => itemsBody({ asin: "B000000001", offersV2: { listings } }) });

  const out = await getPrices("US", ["B000000001"], { fetch: f, now: () => T0, env: ENV_BOTH });

  assert.equal(out.get("B000000001")?.amount, 22);
});

test("getPrices gives no price when the item has no listings", async () => {
  const { f } = fakeFetch({ items: () => itemsBody({ asin: "B000000001", offersV2: { listings: [] } }) });

  const out = await getPrices("US", ["B000000001"], { fetch: f, now: () => T0, env: ENV_BOTH });

  assert.equal(out.size, 0);
});

test("getPrices gives no price when the item has no offersV2 at all", async () => {
  const { f } = fakeFetch({ items: () => itemsBody({ asin: "B000000001" }) });

  const out = await getPrices("US", ["B000000001"], { fetch: f, now: () => T0, env: ENV_BOTH });

  assert.equal(out.size, 0);
});

test("getPrices gives no price when Amazon leaves the ASIN out of the response", async () => {
  const { f } = fakeFetch({ items: () => itemsBody(item("B000000999", 10)) });

  const out = await getPrices("US", ["B000000001"], { fetch: f, now: () => T0, env: ENV_BOTH });

  assert.equal(out.size, 0);
});

test("getPrices drops a USD price answered for the GB store, never showing it under a pound sign", async () => {
  const { f } = fakeFetch({ items: () => itemsBody(item("B000000002", 19.99, "USD")) });

  const out = await getPrices("GB", ["B000000002"], { fetch: f, now: () => T0, env: ENV_BOTH });

  assert.equal(out.size, 0);
});

test("getPrices drops a GBP price answered for the US store", async () => {
  const { f } = fakeFetch({ items: () => itemsBody(item("B000000001", 19.99, "GBP")) });

  const out = await getPrices("US", ["B000000001"], { fetch: f, now: () => T0, env: ENV_BOTH });

  assert.equal(out.size, 0);
});

test("getPrices drops a price with no currency", async () => {
  const { f } = fakeFetch({ items: () => itemsBody(item("B000000001", 10, null)) });

  const out = await getPrices("US", ["B000000001"], { fetch: f, now: () => T0, env: ENV_BOTH });

  assert.equal(out.size, 0);
});

test("getPrices drops an amount sent as a numeric string", async () => {
  const { f } = fakeFetch({ items: () => itemsBody(item("B000000001", "12.99")) });

  const out = await getPrices("US", ["B000000001"], { fetch: f, now: () => T0, env: ENV_BOTH });

  assert.equal(out.size, 0);
});

test("getPrices drops a zero amount", async () => {
  const { f } = fakeFetch({ items: () => itemsBody(item("B000000001", 0)) });

  const out = await getPrices("US", ["B000000001"], { fetch: f, now: () => T0, env: ENV_BOTH });

  assert.equal(out.size, 0);
});

test("getPrices drops a negative amount", async () => {
  const { f } = fakeFetch({ items: () => itemsBody(item("B000000001", -5)) });

  const out = await getPrices("US", ["B000000001"], { fetch: f, now: () => T0, env: ENV_BOTH });

  assert.equal(out.size, 0);
});

test("getPrices accepts the smallest positive amount", async () => {
  const { f } = fakeFetch({ items: () => itemsBody(item("B000000001", 0.01)) });

  const out = await getPrices("US", ["B000000001"], { fetch: f, now: () => T0, env: ENV_BOTH });

  assert.equal(out.get("B000000001")?.amount, 0.01);
});

test("getPrices keeps a good price from the same response as a bad one", async () => {
  const { f } = fakeFetch({ items: () => itemsBody(item("B000000001", -1), item("B000000002", 8)) });

  const out = await getPrices("US", ["B000000001", "B000000002"], { fetch: f, now: () => T0, env: ENV_BOTH });

  assert.deepEqual([...out.keys()], ["B000000002"]);
});

test("getPrices treats a null getItems body as no prices and does not throw", async () => {
  const { f } = fakeFetch({ items: () => json(null) });

  const out = await getPrices("US", ["B000000001"], { fetch: f, now: () => T0, env: ENV_BOTH });

  assert.equal(out.size, 0);
});

// ---------------------------------------------------------------------------
// Credentials
// ---------------------------------------------------------------------------

test("getPrices returns an empty map and never calls fetch when no credentials are set", async () => {
  const { f, calls } = fakeFetch({});

  const out = await getPrices("US", ["B000000001"], { fetch: f, now: () => T0, env: {} });

  assert.equal(out.size, 0);
  assert.equal(calls.length, 0);
});

test("getPrices never calls fetch when the secret is missing", async () => {
  const { f, calls } = fakeFetch({});

  await getPrices("US", ["B000000001"], { fetch: f, now: () => T0, env: { AMAZON_CREATORS_ID_US: "id-us" } });

  assert.equal(calls.length, 0);
});

test("getPrices never calls fetch when the credentials are empty strings", async () => {
  const { f, calls } = fakeFetch({});
  const env = { AMAZON_CREATORS_ID_US: "", AMAZON_CREATORS_SECRET_US: "" };

  await getPrices("US", ["B000000001"], { fetch: f, now: () => T0, env });

  assert.equal(calls.length, 0);
});

test("getPrices uses the credentials of the requested region only", async () => {
  const { f, calls } = fakeFetch({});
  const env = { AMAZON_CREATORS_ID_US: "id-us", AMAZON_CREATORS_SECRET_US: "secret-us" };

  const out = await getPrices("GB", ["B000000002"], { fetch: f, now: () => T0, env });

  assert.equal(out.size, 0);
  assert.equal(calls.length, 0);
});

test("getPrices does not call fetch for an empty ASIN list", async () => {
  const { f, calls } = fakeFetch({});

  const out = await getPrices("US", [], { fetch: f, now: () => T0, env: ENV_BOTH });

  assert.equal(out.size, 0);
  assert.equal(calls.length, 0);
});

// ---------------------------------------------------------------------------
// Failure paths
// ---------------------------------------------------------------------------

test("getPrices returns an empty map and does not throw when the token request is not 200", async () => {
  const { f, calls } = fakeFetch({ token: () => json({ error: "invalid_client" }, 400) });

  const out = await getPrices("US", ["B000000001"], { fetch: f, now: () => T0, env: ENV_BOTH });

  assert.equal(out.size, 0);
  assert.equal(itemCalls(calls).length, 0);
});

test("getPrices returns an empty map when the token response has no access_token", async () => {
  const { f, calls } = fakeFetch({ token: () => json({ expires_in: 3600 }) });

  const out = await getPrices("US", ["B000000001"], { fetch: f, now: () => T0, env: ENV_BOTH });

  assert.equal(out.size, 0);
  assert.equal(itemCalls(calls).length, 0);
});

test("getPrices returns an empty map when the token response is not JSON", async () => {
  const { f } = fakeFetch({ token: () => new Response("<html>oops</html>", { status: 200 }) });

  const out = await getPrices("US", ["B000000001"], { fetch: f, now: () => T0, env: ENV_BOTH });

  assert.equal(out.size, 0);
});

test("getPrices returns an empty map when the getItems response is not JSON", async () => {
  const { f } = fakeFetch({ items: () => new Response("not json", { status: 200 }) });

  const out = await getPrices("US", ["B000000001"], { fetch: f, now: () => T0, env: ENV_BOTH });

  assert.equal(out.size, 0);
});

test("getPrices returns an empty map when getItems answers 500", async () => {
  const { f } = fakeFetch({ items: () => json({}, 500) });

  const out = await getPrices("US", ["B000000001"], { fetch: f, now: () => T0, env: ENV_BOTH });

  assert.equal(out.size, 0);
});

test("getPrices returns an empty map when fetch itself rejects", async () => {
  const f = (async () => {
    throw new TypeError("fetch failed");
  }) as unknown as typeof fetch;

  const out = await getPrices("US", ["B000000001"], { fetch: f, now: () => T0, env: ENV_BOTH });

  assert.equal(out.size, 0);
});

test("getPrices keeps the cached token after a 500 from getItems", async () => {
  let t = T0;
  let status = 500;
  const { f, calls } = fakeFetch({ items: (ids) => (status === 500 ? json({}, 500) : itemsBody(item(ids[0], 10))) });
  const deps = { fetch: f, now: () => t, env: ENV_BOTH };
  await getPrices("US", ["B000000001"], deps);

  t = T0 + FAILURE_BACKOFF_MS + 1;
  status = 200;
  const out = await getPrices("US", ["B000000001"], deps);

  assert.equal(out.get("B000000001")?.amount, 10);
  assert.equal(tokenCalls(calls).length, 1);
});

test("getPrices clears the cached token after a 401 so the next call fetches a new one", async () => {
  let t = T0;
  let status = 401;
  const { f, calls } = fakeFetch({ items: (ids) => (status === 401 ? json({}, 401) : itemsBody(item(ids[0], 10))) });
  const deps = { fetch: f, now: () => t, env: ENV_BOTH };
  await getPrices("US", ["B000000001"], deps);

  t = T0 + FAILURE_BACKOFF_MS + 1;
  status = 200;
  const out = await getPrices("US", ["B000000001"], deps);

  assert.equal(out.get("B000000001")?.amount, 10);
  assert.equal(tokenCalls(calls).length, 2);
});

test("getPrices clears the cached token after a 403 so the next call fetches a new one", async () => {
  let t = T0;
  let status = 403;
  const { f, calls } = fakeFetch({ items: (ids) => (status === 403 ? json({}, 403) : itemsBody(item(ids[0], 10))) });
  const deps = { fetch: f, now: () => t, env: ENV_BOTH };
  await getPrices("US", ["B000000001"], deps);

  t = T0 + FAILURE_BACKOFF_MS + 1;
  status = 200;
  await getPrices("US", ["B000000001"], deps);

  assert.equal(tokenCalls(calls).length, 2);
});

// ---------------------------------------------------------------------------
// Backoff
// ---------------------------------------------------------------------------

test("getPrices makes no second call within the 60s backoff after a failure", async () => {
  let t = T0;
  const { f, calls } = fakeFetch({ items: () => json({}, 500) });
  const deps = { fetch: f, now: () => t, env: ENV_BOTH };
  await getPrices("US", ["B000000001"], deps);
  const callsAfterFailure = calls.length;

  t = T0 + FAILURE_BACKOFF_MS - 1;
  const out = await getPrices("US", ["B000000001"], deps);

  assert.equal(out.size, 0);
  assert.equal(calls.length, callsAfterFailure);
});

test("getPrices retries once the 60s backoff has passed", async () => {
  let t = T0;
  let fail = true;
  const { f, calls } = fakeFetch({ items: (ids) => (fail ? json({}, 500) : itemsBody(item(ids[0], 10))) });
  const deps = { fetch: f, now: () => t, env: ENV_BOTH };
  await getPrices("US", ["B000000001"], deps);
  const callsAfterFailure = calls.length;

  t = T0 + FAILURE_BACKOFF_MS;
  fail = false;
  const out = await getPrices("US", ["B000000001"], deps);

  assert.equal(out.get("B000000001")?.amount, 10);
  assert.ok(calls.length > callsAfterFailure);
});

test("getPrices backs off after a failed token request too", async () => {
  let t = T0;
  const { f, calls } = fakeFetch({ token: () => json({}, 500) });
  const deps = { fetch: f, now: () => t, env: ENV_BOTH };
  await getPrices("US", ["B000000001"], deps);

  t = T0 + 30 * 1000;
  await getPrices("US", ["B000000001"], deps);

  assert.equal(tokenCalls(calls).length, 1);
});

test("getPrices backs off per region: a US failure does not stop a GB lookup", async () => {
  const { f } = fakeFetch({
    items: (ids) => (ids.includes("B000000001") ? json({}, 500) : itemsBody(item(ids[0], 12, "GBP"))),
  });
  const deps = { fetch: f, now: () => T0, env: ENV_BOTH };
  await getPrices("US", ["B000000001"], deps);

  const out = await getPrices("GB", ["B000000002"], deps);

  assert.equal(out.get("B000000002")?.amount, 12);
});

test("getPrices still serves a fresh cached price while the region is in backoff", async () => {
  let t = T0;
  let fail = false;
  const { f } = fakeFetch({ items: (ids) => (fail ? json({}, 500) : itemsBody(...ids.map((id) => item(id, 10)))) });
  const deps = { fetch: f, now: () => t, env: ENV_BOTH };
  await getPrices("US", ["B000000001"], deps);

  t = T0 + 2 * MINUTE;
  fail = true;
  await getPrices("US", ["B000000002"], deps); // fails, starts backoff
  t = T0 + 2 * MINUTE + 10 * 1000;
  const out = await getPrices("US", ["B000000001"], deps);

  assert.equal(out.get("B000000001")?.amount, 10);
});

// ---------------------------------------------------------------------------
// Cache TTL
// ---------------------------------------------------------------------------

test("PRICE_TTL_MS is one hour, far under the 24 hours Amazon allows", () => {
  assert.equal(PRICE_TTL_MS, 60 * MINUTE);
});

test("getPrices serves a price from cache at 59 minutes without calling Amazon", async () => {
  let t = T0;
  const { f, calls } = fakeFetch({});
  const deps = { fetch: f, now: () => t, env: ENV_BOTH };
  await getPrices("US", ["B000000001"], deps);
  const callsAfterFirst = calls.length;

  t = T0 + 59 * MINUTE;
  const out = await getPrices("US", ["B000000001"], deps);

  assert.equal(out.get("B000000001")?.amount, 10);
  assert.equal(calls.length, callsAfterFirst);
});

test("getPrices keeps the original fetchedAt on a cache hit", async () => {
  let t = T0;
  const { f } = fakeFetch({});
  const deps = { fetch: f, now: () => t, env: ENV_BOTH };
  await getPrices("US", ["B000000001"], deps);

  t = T0 + 59 * MINUTE;
  const out = await getPrices("US", ["B000000001"], deps);

  assert.equal(out.get("B000000001")?.fetchedAt, "2026-10-04T14:05:00.000Z");
});

test("getPrices refetches a price at 61 minutes and stamps the new time", async () => {
  let t = T0;
  let amount = 10;
  const { f, calls } = fakeFetch({ items: (ids) => itemsBody(item(ids[0], amount)) });
  const deps = { fetch: f, now: () => t, env: ENV_BOTH };
  await getPrices("US", ["B000000001"], deps);

  t = T0 + 61 * MINUTE;
  amount = 11;
  const out = await getPrices("US", ["B000000001"], deps);

  assert.equal(out.get("B000000001")?.amount, 11);
  assert.equal(out.get("B000000001")?.fetchedAt, new Date(T0 + 61 * MINUTE).toISOString());
  assert.equal(itemCalls(calls).length, 2);
});

test("getPrices treats a price exactly one hour old as stale", async () => {
  let t = T0;
  const { f, calls } = fakeFetch({});
  const deps = { fetch: f, now: () => t, env: ENV_BOTH };
  await getPrices("US", ["B000000001"], deps);

  t = T0 + PRICE_TTL_MS;
  await getPrices("US", ["B000000001"], deps);

  assert.equal(itemCalls(calls).length, 2);
});

test("getPrices does not serve a stale price when the refetch fails", async () => {
  let t = T0;
  let fail = false;
  const { f } = fakeFetch({ items: (ids) => (fail ? json({}, 500) : itemsBody(item(ids[0], 10))) });
  const deps = { fetch: f, now: () => t, env: ENV_BOTH };
  await getPrices("US", ["B000000001"], deps);

  t = T0 + 61 * MINUTE;
  fail = true;
  const out = await getPrices("US", ["B000000001"], deps);

  assert.equal(out.size, 0);
});

test("getPrices does not re-ask for an ASIN with no listings at 59 seconds", async () => {
  let t = T0;
  const { f, calls } = fakeFetch({ items: () => itemsBody({ asin: "B000000001", offersV2: { listings: [] } }) });
  const deps = { fetch: f, now: () => t, env: ENV_BOTH };
  await getPrices("US", ["B000000001"], deps);

  t = T0 + 59 * 1000;
  const out = await getPrices("US", ["B000000001"], deps);

  assert.equal(out.size, 0);
  assert.equal(itemCalls(calls).length, 1);
});

test("getPrices re-asks for an ASIN with no listings at 60 seconds, not an hour", async () => {
  let t = T0;
  const { f, calls } = fakeFetch({ items: () => itemsBody({ asin: "B000000001", offersV2: { listings: [] } }) });
  const deps = { fetch: f, now: () => t, env: ENV_BOTH };
  await getPrices("US", ["B000000001"], deps);

  t = T0 + FAILURE_BACKOFF_MS;
  await getPrices("US", ["B000000001"], deps);

  assert.equal(itemCalls(calls).length, 2);
});

test("getPrices does not re-ask for an ASIN that Amazon leaves out of its response at 59 seconds", async () => {
  let t = T0;
  const { f, calls } = fakeFetch({ items: () => itemsBody() });
  const deps = { fetch: f, now: () => t, env: ENV_BOTH };
  await getPrices("US", ["B000000001"], deps);

  t = T0 + 59 * 1000;
  const out = await getPrices("US", ["B000000001"], deps);

  assert.equal(out.size, 0);
  assert.equal(itemCalls(calls).length, 1);
});

test("getPrices re-asks for an ASIN missing from the response at 60 seconds", async () => {
  let t = T0;
  const { f, calls } = fakeFetch({ items: () => itemsBody() });
  const deps = { fetch: f, now: () => t, env: ENV_BOTH };
  await getPrices("US", ["B000000001"], deps);

  t = T0 + FAILURE_BACKOFF_MS;
  await getPrices("US", ["B000000001"], deps);

  assert.equal(itemCalls(calls).length, 2);
});

test("getPrices re-asks at 60 seconds for an ASIN whose listing was not the buy-box winner", async () => {
  let t = T0;
  const listings = [{ isBuyBoxWinner: false, price: { money: { amount: 30, currency: "USD" } } }];
  const { f, calls } = fakeFetch({ items: () => itemsBody({ asin: "B000000001", offersV2: { listings } }) });
  const deps = { fetch: f, now: () => t, env: ENV_BOTH };
  await getPrices("US", ["B000000001"], deps);

  t = T0 + FAILURE_BACKOFF_MS;
  await getPrices("US", ["B000000001"], deps);

  assert.equal(itemCalls(calls).length, 2);
});

test("getPrices re-asks at 60 seconds for an ASIN answered in the wrong currency", async () => {
  let t = T0;
  const { f, calls } = fakeFetch({ items: (ids) => itemsBody(item(ids[0], 10, "USD")) });
  const deps = { fetch: f, now: () => t, env: ENV_BOTH };
  await getPrices("GB", ["B000000002"], deps);

  t = T0 + FAILURE_BACKOFF_MS;
  await getPrices("GB", ["B000000002"], deps);

  assert.equal(itemCalls(calls).length, 2);
});

test("getPrices picks up a price that appears 60 seconds after a no-price answer", async () => {
  let t = T0;
  let hasPrice = false;
  const { f } = fakeFetch({ items: (ids) => (hasPrice ? itemsBody(item(ids[0], 14)) : itemsBody()) });
  const deps = { fetch: f, now: () => t, env: ENV_BOTH };
  await getPrices("US", ["B000000001"], deps);

  t = T0 + FAILURE_BACKOFF_MS;
  hasPrice = true;
  const out = await getPrices("US", ["B000000001"], deps);

  assert.equal(out.get("B000000001")?.amount, 14);
});

test("getPrices keeps a real price for the full hour while a no-price answer lasts 60 seconds", async () => {
  let t = T0;
  const { f, calls } = fakeFetch({ items: () => itemsBody(item("B000000001", 10)) });
  const deps = { fetch: f, now: () => t, env: ENV_BOTH };
  await getPrices("US", ["B000000001", "B000000002"], deps); // 2 has no price

  t = T0 + FAILURE_BACKOFF_MS;
  const out = await getPrices("US", ["B000000001", "B000000002"], deps);

  assert.equal(out.get("B000000001")?.amount, 10);
  assert.deepEqual(itemCalls(calls)[1].body.itemIds, ["B000000002"]);
});

test("getPrices asks Amazon again for a no-price ASIN once the hour is up", async () => {
  let t = T0;
  const { f, calls } = fakeFetch({ items: () => itemsBody({ asin: "B000000001", offersV2: { listings: [] } }) });
  const deps = { fetch: f, now: () => t, env: ENV_BOTH };
  await getPrices("US", ["B000000001"], deps);

  t = T0 + 61 * MINUTE;
  await getPrices("US", ["B000000001"], deps);

  assert.equal(itemCalls(calls).length, 2);
});

test("getPrices caches US and GB separately for the same ASIN string", async () => {
  const { f, calls } = fakeFetch({ items: (ids) => itemsBody(item(ids[0], 10, "USD")) });
  const deps = { fetch: f, now: () => T0, env: ENV_BOTH };
  await getPrices("US", ["B000000001"], deps);

  const gb = await getPrices("GB", ["B000000001"], deps);

  assert.equal(gb.size, 0); // the USD answer is wrong for GB
  assert.equal(itemCalls(calls).length, 2);
});

test("getPrices only asks for the ASINs that are not already fresh", async () => {
  const { f, calls } = fakeFetch({});
  const deps = { fetch: f, now: () => T0, env: ENV_BOTH };
  await getPrices("US", ["B000000001"], deps);

  const out = await getPrices("US", ["B000000001", "B000000002"], deps);

  assert.deepEqual(itemCalls(calls)[1].body.itemIds, ["B000000002"]);
  assert.deepEqual([...out.keys()], ["B000000001", "B000000002"]);
});

test("getPrices reuses the token for a second lookup before it nears expiry", async () => {
  let t = T0;
  const { f, calls } = fakeFetch({});
  const deps = { fetch: f, now: () => t, env: ENV_BOTH };
  await getPrices("US", ["B000000001"], deps);

  t = T0 + 54 * MINUTE;
  await getPrices("US", ["B000000002"], deps);

  assert.equal(tokenCalls(calls).length, 1);
});

test("getPrices renews the token 5 minutes before its hour is up", async () => {
  let t = T0;
  const { f, calls } = fakeFetch({});
  const deps = { fetch: f, now: () => t, env: ENV_BOTH };
  await getPrices("US", ["B000000001"], deps);

  t = T0 + 56 * MINUTE;
  await getPrices("US", ["B000000002"], deps);

  assert.equal(tokenCalls(calls).length, 2);
});

test("getPrices assumes an hour of token life when expires_in is missing", async () => {
  let t = T0;
  const { f, calls } = fakeFetch({ token: () => json({ access_token: "tok-1" }) });
  const deps = { fetch: f, now: () => t, env: ENV_BOTH };
  await getPrices("US", ["B000000001"], deps);

  t = T0 + 54 * MINUTE;
  await getPrices("US", ["B000000002"], deps);

  assert.equal(tokenCalls(calls).length, 1);
});

test("getPrices makes concurrent lookups for the same ASINs share one request", async () => {
  const { f, calls } = fakeFetch({});
  const deps = { fetch: f, now: () => T0, env: ENV_BOTH };

  const [a, b] = await Promise.all([
    getPrices("US", ["B000000001"], deps),
    getPrices("US", ["B000000001"], deps),
  ]);

  assert.equal(itemCalls(calls).length, 1);
  assert.equal(a.get("B000000001")?.amount, 10);
  assert.equal(b.get("B000000001")?.amount, 10);
});

// ---------------------------------------------------------------------------
// Request shape
// ---------------------------------------------------------------------------

test("getPrices asks the US store with the getbrian-20 tag and a Bearer token", async () => {
  const { f, calls } = fakeFetch({});

  await getPrices("US", ["B000000001"], { fetch: f, now: () => T0, env: ENV_BOTH });

  const req = itemCalls(calls)[0];
  const headers = req.init.headers as Record<string, string>;
  assert.equal(req.url, "https://creatorsapi.amazon/catalog/v1/getItems");
  assert.equal(req.init.method, "POST");
  assert.equal(req.body.marketplace, "www.amazon.com");
  assert.equal(req.body.partnerTag, "getbrian-20");
  assert.equal(req.body.itemIdType, "ASIN");
  assert.deepEqual(req.body.itemIds, ["B000000001"]);
  assert.equal(headers.Authorization, "Bearer tok-1");
  assert.equal(headers["x-marketplace"], "www.amazon.com");
});

test("getPrices asks the UK store with the getbrian-21 tag", async () => {
  const { f, calls } = fakeFetch({ items: (ids) => itemsBody(item(ids[0], 9, "GBP")) });

  await getPrices("GB", ["B000000002"], { fetch: f, now: () => T0, env: ENV_BOTH });

  const req = itemCalls(calls)[0];
  const headers = req.init.headers as Record<string, string>;
  assert.equal(req.body.marketplace, "www.amazon.co.uk");
  assert.equal(req.body.partnerTag, "getbrian-21");
  assert.equal(headers["x-marketplace"], "www.amazon.co.uk");
});

test("getPrices requests the price and buy-box resources", async () => {
  const { f, calls } = fakeFetch({});

  await getPrices("US", ["B000000001"], { fetch: f, now: () => T0, env: ENV_BOTH });

  assert.deepEqual(itemCalls(calls)[0].body.resources, [
    "offersV2.listings.price",
    "offersV2.listings.isBuyBoxWinner",
  ]);
});

test("getPrices sends the US credentials to the US token endpoint", async () => {
  const { f, calls } = fakeFetch({});

  await getPrices("US", ["B000000001"], { fetch: f, now: () => T0, env: ENV_BOTH });

  const req = tokenCalls(calls)[0];
  assert.equal(req.url, "https://api.amazon.com/auth/o2/token");
  assert.equal(req.body.grant_type, "client_credentials");
  assert.equal(req.body.client_id, "id-us");
  assert.equal(req.body.client_secret, "secret-us");
  assert.equal(req.body.scope, "creatorsapi::default");
});

test("getPrices sends the GB credentials to the UK token endpoint", async () => {
  const { f, calls } = fakeFetch({ items: (ids) => itemsBody(item(ids[0], 9, "GBP")) });

  await getPrices("GB", ["B000000002"], { fetch: f, now: () => T0, env: ENV_BOTH });

  const req = tokenCalls(calls)[0];
  assert.equal(req.url, "https://api.amazon.co.uk/auth/o2/token");
  assert.equal(req.body.client_id, "id-gb");
  assert.equal(req.body.client_secret, "secret-gb");
});

test("getPrices sends no-store on every call", async () => {
  const { f, calls } = fakeFetch({});

  await getPrices("US", ["B000000001"], { fetch: f, now: () => T0, env: ENV_BOTH });

  assert.equal(calls.length, 2);
  assert.equal(calls[0].init.cache, "no-store");
  assert.equal(calls[1].init.cache, "no-store");
});

test("getPrices gives the token call and the getItems call one shared AbortSignal", async () => {
  const { f, calls } = fakeFetch({});

  await getPrices("US", ["B000000001"], { fetch: f, now: () => T0, env: ENV_BOTH });

  const signal = tokenCalls(calls)[0].init.signal;
  assert.ok(signal instanceof AbortSignal);
  assert.equal(itemCalls(calls)[0].init.signal, signal);
});

test("getPrices gives the token call and every getItems chunk of one refresh the same AbortSignal", async () => {
  const asins = ["A01", "A02", "A03", "A04", "A05", "A06", "A07", "A08", "A09", "A10", "A11"];
  const { f, calls } = fakeFetch({});

  await getPrices("US", asins, { fetch: f, now: () => T0, env: ENV_BOTH });

  assert.equal(calls.length, 3);
  assert.equal(calls[1].init.signal, calls[0].init.signal);
  assert.equal(calls[2].init.signal, calls[0].init.signal);
});

test("getPrices gives a separate refresh its own AbortSignal", async () => {
  let t = T0;
  const { f, calls } = fakeFetch({});
  const deps = { fetch: f, now: () => t, env: ENV_BOTH };
  await getPrices("US", ["B000000001"], deps);

  t = T0 + 61 * MINUTE;
  await getPrices("US", ["B000000001"], deps);

  const first = itemCalls(calls)[0].init.signal;
  const second = itemCalls(calls)[1].init.signal;
  assert.notEqual(first, second);
});

test("getPrices sends 10 ASINs in one call", async () => {
  const asins = ["A01", "A02", "A03", "A04", "A05", "A06", "A07", "A08", "A09", "A10"];
  const { f, calls } = fakeFetch({});

  await getPrices("US", asins, { fetch: f, now: () => T0, env: ENV_BOTH });

  assert.equal(itemCalls(calls).length, 1);
  assert.deepEqual(itemCalls(calls)[0].body.itemIds, asins);
});

test("getPrices splits 12 ASINs into two getItems calls of 10 and 2", async () => {
  const asins = ["A01", "A02", "A03", "A04", "A05", "A06", "A07", "A08", "A09", "A10", "A11", "A12"];
  const { f, calls } = fakeFetch({});

  const out = await getPrices("US", asins, { fetch: f, now: () => T0, env: ENV_BOTH });

  assert.equal(itemCalls(calls).length, 2);
  assert.equal((itemCalls(calls)[0].body.itemIds as string[]).length, 10);
  assert.deepEqual(itemCalls(calls)[1].body.itemIds, ["A11", "A12"]);
  assert.equal(tokenCalls(calls).length, 1);
  assert.equal(out.size, 12);
});

test("getPrices keeps the prices from a chunk that succeeded when a later chunk fails", async () => {
  const asins = ["A01", "A02", "A03", "A04", "A05", "A06", "A07", "A08", "A09", "A10", "A11", "A12"];
  const { f } = fakeFetch({ items: (ids) => (ids.includes("A11") ? json({}, 500) : itemsBody(...ids.map((id) => item(id, 10)))) });

  const out = await getPrices("US", asins, { fetch: f, now: () => T0, env: ENV_BOTH });

  assert.equal(out.size, 10);
  assert.equal(out.has("A11"), false);
});

test("getPrices sends a repeated ASIN only once", async () => {
  const { f, calls } = fakeFetch({});

  await getPrices("US", ["B000000001", "B000000001"], { fetch: f, now: () => T0, env: ENV_BOTH });

  assert.deepEqual(itemCalls(calls)[0].body.itemIds, ["B000000001"]);
});

// ---------------------------------------------------------------------------
// withPrices
// ---------------------------------------------------------------------------

test("withPrices sets livePrice only on the product whose ASIN Amazon priced", async () => {
  const priced = baseProduct({ slug: "priced", offers: { US: { asin: "B000000001" } } });
  const unpriced = baseProduct({ slug: "unpriced", offers: { US: { asin: "B000000002" } } });
  const { f } = fakeFetch({ items: () => itemsBody(item("B000000001", 24.5)) });

  const [a, b] = await withPrices([priced, unpriced], "US", { fetch: f, now: () => T0, env: ENV_BOTH });

  assert.deepEqual(a.livePrice, { amount: 24.5, currency: "USD", fetchedAt: "2026-10-04T14:05:00.000Z" });
  assert.equal(b, unpriced);
  assert.equal(b.livePrice, undefined);
});

test("withPrices returns the very same product object when it has no offer in the region", async () => {
  const gbOnly = baseProduct({ offers: { GB: { asin: "B000000002" } } });
  const { f, calls } = fakeFetch({});

  const [out] = await withPrices([gbOnly], "US", { fetch: f, now: () => T0, env: ENV_BOTH });

  assert.equal(out, gbOnly);
  assert.equal(calls.length, 0);
});

test("withPrices does not mutate the product it was given", async () => {
  const product = baseProduct({ offers: { US: { asin: "B000000001" } } });
  const { f } = fakeFetch({});

  const [out] = await withPrices([product], "US", { fetch: f, now: () => T0, env: ENV_BOTH });

  assert.notEqual(out, product);
  assert.equal(product.livePrice, undefined);
  assert.equal(out.slug, product.slug);
});

test("withPrices looks up the ASIN of the requested region, not another region's", async () => {
  const product = baseProduct({ offers: { US: { asin: "B000000001" }, GB: { asin: "B000000002" } } });
  const { f, calls } = fakeFetch({ items: (ids) => itemsBody(item(ids[0], 9, "GBP")) });

  const [out] = await withPrices([product], "GB", { fetch: f, now: () => T0, env: ENV_BOTH });

  assert.deepEqual(itemCalls(calls)[0].body.itemIds, ["B000000002"]);
  assert.equal(out.livePrice?.currency, "GBP");
});

test("withPrices returns every product untouched and in order when there are no credentials", async () => {
  const one = baseProduct({ slug: "one", offers: { US: { asin: "B000000001" } } });
  const two = baseProduct({ slug: "two", offers: { US: { asin: "B000000002" } } });
  const { f, calls } = fakeFetch({});

  const out = await withPrices([one, two], "US", { fetch: f, now: () => T0, env: {} });

  assert.deepEqual(out, [one, two]);
  assert.equal(out[0], one);
  assert.equal(calls.length, 0);
});

test("withPrices returns an empty list for an empty list", async () => {
  const { f, calls } = fakeFetch({});

  const out = await withPrices([], "US", { fetch: f, now: () => T0, env: ENV_BOTH });

  assert.deepEqual(out, []);
  assert.equal(calls.length, 0);
});

test("withPrices leaves products untouched when Amazon is down", async () => {
  const product = baseProduct({ offers: { US: { asin: "B000000001" } } });
  const { f } = fakeFetch({ items: () => json({}, 503) });

  const [out] = await withPrices([product], "US", { fetch: f, now: () => T0, env: ENV_BOTH });

  assert.equal(out, product);
});
