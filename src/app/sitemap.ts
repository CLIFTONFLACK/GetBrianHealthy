import type { MetadataRoute } from "next";
import { LAUNCHED, products } from "./data";
import { siteUrl } from "./site";

/**
 * Nothing is listed until LAUNCHED, so draft product figures are never
 * submitted for indexing (the pages are noindex until then as well).
 * confirm, go and creator-notes are deliberately absent: they are noindex or
 * redirects.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  if (!LAUNCHED) return [];

  return [
    "/",
    "/method",
    "/why-these-picks",
    "/about",
    "/disclosures",
    // Crawlers arrive from the US, where a UK-only product page just redirects, so only US picks are listed.
    ...products.filter((p) => p.regions.includes("US")).map((p) => `/products/${p.slug}`),
  ].map((path) => ({
    url: path === "/" ? siteUrl : `${siteUrl}${path}`,
    lastModified: new Date(),
    changeFrequency: "monthly" as const,
    priority: path === "/" ? 1 : 0.6,
  }));
}
