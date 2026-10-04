/**
 * The host that actually serves: the apex 308-redirects to `www`, so pointing
 * canonical/OG at the apex would aim them at a redirect. Lives in its own file
 * (no CSS or font imports) so robots.ts, sitemap.ts, the server actions and the
 * unit tests can all import it. A sitemap listing a URL that disagrees with the
 * page's own canonical is worse than no sitemap.
 */
export const siteUrl = "https://www.getbrianhealthy.xyz";

/** The main GetBrian site, linked from the footer. */
export const parentSiteUrl = "https://www.getbrian.xyz";
