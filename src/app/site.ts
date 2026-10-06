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

/**
 * Brian's social accounts, shown in the footer and on the About page. Add YouTube
 * here once the channel exists. Only https links to the account pages themselves.
 */
export const socialLinks = [
  { name: "Instagram", handle: "@getbrianhealthy", href: "https://www.instagram.com/getbrianhealthy/" },
  { name: "TikTok", handle: "@getbrianhealthy", href: "https://www.tiktok.com/@getbrianhealthy" },
] as const;
