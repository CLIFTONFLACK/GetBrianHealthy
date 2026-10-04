/**
 * Which country's version of /healthy a visitor sees. Two regions only: the
 * United States (the default, and what search engines see) and the United
 * Kingdom. Everything else, including visitors in other countries, gets the US
 * version, because that is the market the program is written for.
 *
 * Pure helpers only. The request-reading half lives in region-server.ts so
 * these stay importable from tests and client code.
 */

export type Region = "US" | "GB";

export const REGIONS: Region[] = ["US", "GB"];

/** Set only when a visitor picks a region themselves. Never set by detection. */
export const REGION_COOKIE = "hl-region";

export const REGION_LABELS: Record<Region, string> = {
  US: "United States",
  GB: "United Kingdom",
};

/** Exact match only, so a tampered cookie value falls through to detection. */
export function parseRegion(value: string | null | undefined): Region | null {
  return value === "US" || value === "GB" ? value : null;
}

/** ISO 3166-1 alpha-2 codes that Amazon UK serves as home market. Everything else is US. */
const GB_COUNTRIES = new Set(["GB", "IM", "JE", "GG"]);

export function regionFromCountry(country: string | null | undefined): Region {
  return country && GB_COUNTRIES.has(country.toUpperCase()) ? "GB" : "US";
}

/** An explicit choice beats detection. */
export function resolveRegion(preference: string | null | undefined, country: string | null | undefined): Region {
  return parseRegion(preference) ?? regionFromCountry(country);
}
