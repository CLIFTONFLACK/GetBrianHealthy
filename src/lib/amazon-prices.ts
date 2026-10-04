import { AMAZON, type LivePrice, type Product } from "../app/data";
import type { Region } from "../app/region";

/**
 * Live Amazon prices, read from the Creators API (which replaced PA-API v5).
 *
 * Amazon's Associates terms allow a price to be shown only if it came from
 * their API recently, so nothing here is ever written to disk or the repo: an
 * in-memory cache holds each price for `PRICE_TTL_MS`, far under the 24 hours
 * Amazon allows, and every failure path returns no price. The page then shows
 * "Current price on Amazon" exactly as it did before prices existed.
 *
 * Server-side only: it reads credentials from the environment
 * (AMAZON_CREATORS_ID_US / _SECRET_US / _ID_GB / _SECRET_GB).
 */

export const PRICE_TTL_MS = 60 * 60 * 1000;
/** After a failed call, leave Amazon alone this long so a slow outage cannot slow every page. */
export const FAILURE_BACKOFF_MS = 60 * 1000;
/** One budget for a whole refresh (token plus every getItems call), so a hung Amazon delays a page render by this much at most. */
const REFRESH_BUDGET_MS = 3000;
/** Amazon's access tokens last an hour; renew a little early. */
const TOKEN_EARLY_RENEWAL_MS = 5 * 60 * 1000;
const MAX_ITEMS_PER_CALL = 10;

const TOKEN_URL: Record<Region, string> = {
  US: "https://api.amazon.com/auth/o2/token",
  GB: "https://api.amazon.co.uk/auth/o2/token",
};
const GET_ITEMS_URL = "https://creatorsapi.amazon/catalog/v1/getItems";
/** A price in any other currency means the wrong store answered; never show it under the wrong symbol. */
const REGION_CURRENCY: Record<Region, LivePrice["currency"]> = { US: "USD", GB: "GBP" };

export type PriceDeps = {
  fetch?: typeof fetch;
  now?: () => number;
  env?: Record<string, string | undefined>;
};

type Token = { value: string; expiresAt: number };
/** `ttl` is short for a "no price" answer, so one empty or partial response cannot hide a price for an hour. */
type CachedPrice = { price: LivePrice | null; at: number; ttl: number };

const tokens = new Map<Region, Token>();
const prices = new Map<string, CachedPrice>();
const backoffUntil = new Map<Region, number>();
const inFlight = new Map<string, Promise<void>>();

/** Test hook: forget every cached token, price and backoff. */
export function resetPriceCache(): void {
  tokens.clear();
  prices.clear();
  backoffUntil.clear();
  inFlight.clear();
}

function credentials(region: Region, env: Record<string, string | undefined>) {
  const id = env[`AMAZON_CREATORS_ID_${region}`];
  const secret = env[`AMAZON_CREATORS_SECRET_${region}`];
  return id && secret ? { id, secret } : null;
}

async function timedFetch(f: typeof fetch, url: string, init: RequestInit, signal: AbortSignal): Promise<Response> {
  return f(url, { ...init, signal, cache: "no-store" });
}

async function getToken(
  region: Region,
  creds: { id: string; secret: string },
  deps: Required<PriceDeps>,
  signal: AbortSignal,
): Promise<string> {
  const cached = tokens.get(region);
  if (cached && cached.expiresAt > deps.now()) return cached.value;
  const res = await timedFetch(deps.fetch, TOKEN_URL[region], {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "client_credentials",
      client_id: creds.id,
      client_secret: creds.secret,
      scope: "creatorsapi::default",
    }),
  }, signal);
  if (!res.ok) throw new Error(`token request failed (${res.status})`);
  const body: unknown = await res.json();
  const { access_token, expires_in } = (body ?? {}) as { access_token?: unknown; expires_in?: unknown };
  if (typeof access_token !== "string" || !access_token) throw new Error("token response had no access_token");
  const lifetimeMs = (typeof expires_in === "number" && expires_in > 0 ? expires_in : 3600) * 1000;
  tokens.set(region, { value: access_token, expiresAt: deps.now() + lifetimeMs - TOKEN_EARLY_RENEWAL_MS });
  return access_token;
}

/** The buy-box price of one item as a LivePrice, or null if Amazon gave no usable price. */
function parsePrice(item: unknown, region: Region, fetchedAt: string): LivePrice | null {
  const listings = (item as { offersV2?: { listings?: unknown } } | null)?.offersV2?.listings;
  if (!Array.isArray(listings)) return null;
  type Listing = { isBuyBoxWinner?: boolean; price?: { money?: { amount?: unknown; currency?: unknown } } };
  // Only the buy-box winner: it is the offer the Buy button's page leads with. Any other listing
  // could be a used or third-party price the reader cannot get at that link.
  const chosen = (listings as Listing[]).find((l) => l?.isBuyBoxWinner === true);
  const money = chosen?.price?.money;
  if (!money || typeof money.amount !== "number" || !Number.isFinite(money.amount) || money.amount <= 0) return null;
  if (money.currency !== REGION_CURRENCY[region]) return null;
  return { amount: money.amount, currency: REGION_CURRENCY[region], fetchedAt };
}

async function refresh(region: Region, asins: string[], creds: { id: string; secret: string }, deps: Required<PriceDeps>) {
  try {
    const signal = AbortSignal.timeout(REFRESH_BUDGET_MS);
    const token = await getToken(region, creds, deps, signal);
    const { host, tag } = AMAZON[region];
    for (let i = 0; i < asins.length; i += MAX_ITEMS_PER_CALL) {
      const chunk = asins.slice(i, i + MAX_ITEMS_PER_CALL);
      const res = await timedFetch(deps.fetch, GET_ITEMS_URL, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", "x-marketplace": host },
        body: JSON.stringify({
          itemIds: chunk,
          itemIdType: "ASIN",
          marketplace: host,
          partnerTag: tag,
          resources: ["offersV2.listings.price", "offersV2.listings.isBuyBoxWinner"],
        }),
      }, signal);
      if (!res.ok) {
        // A rejected token must not be reused for the rest of its nominal hour.
        if (res.status === 401 || res.status === 403) tokens.delete(region);
        throw new Error(`getItems failed (${res.status})`);
      }
      const body = (await res.json()) as { itemsResult?: { items?: unknown } } | null;
      const items = body?.itemsResult?.items;
      const at = deps.now();
      const fetchedAt = new Date(at).toISOString();
      const byAsin = new Map<string, unknown>();
      if (Array.isArray(items)) {
        for (const item of items) {
          const asin = (item as { asin?: unknown } | null)?.asin;
          if (typeof asin === "string") byAsin.set(asin, item);
        }
      }
      for (const asin of chunk) {
        const price = parsePrice(byAsin.get(asin), region, fetchedAt);
        prices.set(`${region}:${asin}`, { price, at, ttl: price ? PRICE_TTL_MS : FAILURE_BACKOFF_MS });
      }
    }
  } catch {
    // Not logged with its message: nothing from a failed auth exchange should reach the logs.
    backoffUntil.set(region, deps.now() + FAILURE_BACKOFF_MS);
  }
}

/**
 * Fresh prices for a region's ASINs, keyed by ASIN. An ASIN with no fresh price
 * is simply absent. Never throws.
 */
export async function getPrices(region: Region, asins: string[], deps: PriceDeps = {}): Promise<Map<string, LivePrice>> {
  const d: Required<PriceDeps> = {
    fetch: deps.fetch ?? fetch,
    now: deps.now ?? Date.now,
    env: deps.env ?? process.env,
  };
  const out = new Map<string, LivePrice>();
  const creds = credentials(region, d.env);
  if (!creds || asins.length === 0) return out;

  const fresh = (asin: string) => {
    const hit = prices.get(`${region}:${asin}`);
    return hit && d.now() - hit.at < hit.ttl ? hit : undefined;
  };
  const stale = [...new Set(asins)].filter((a) => !fresh(a));

  if (stale.length > 0 && d.now() >= (backoffUntil.get(region) ?? 0)) {
    const key = `${region}:${stale.join(",")}`;
    let pending = inFlight.get(key);
    if (!pending) {
      pending = refresh(region, stale, creds, d).finally(() => inFlight.delete(key));
      inFlight.set(key, pending);
    }
    await pending;
  }

  for (const asin of asins) {
    const hit = fresh(asin);
    if (hit?.price) out.set(asin, hit.price);
  }
  return out;
}

/** The products with `livePrice` set wherever Amazon returned a fresh price for the region's listing. */
export async function withPrices(list: Product[], region: Region, deps?: PriceDeps): Promise<Product[]> {
  const asins = list.flatMap((p) => p.offers?.[region]?.asin ?? []);
  const found = await getPrices(region, asins, deps);
  return list.map((p) => {
    const asin = p.offers?.[region]?.asin;
    const livePrice = asin ? found.get(asin) : undefined;
    return livePrice ? { ...p, livePrice } : p;
  });
}
