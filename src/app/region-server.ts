import { cookies, headers } from "next/headers";
import { REGION_COOKIE, resolveRegion, type Region } from "./region";

/**
 * The visitor's region for this request: their saved choice if they made one,
 * else the country Vercel detected from their IP (`x-vercel-ip-country`), else
 * the US. Reading request data makes every page that calls it dynamic.
 *
 * Do not give any /healthy route `force-static`, `revalidate` or `use cache`:
 * the same URL shows different content by region, and a shared cache would
 * serve one country's page to the other.
 */
export async function getRegion(): Promise<Region> {
  const [cookieStore, headerStore] = await Promise.all([cookies(), headers()]);
  return resolveRegion(cookieStore.get(REGION_COOKIE)?.value, headerStore.get("x-vercel-ip-country"));
}
