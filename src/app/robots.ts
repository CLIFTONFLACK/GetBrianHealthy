import type { MetadataRoute } from "next";
import { siteUrl } from "./site";

export default function robots(): MetadataRoute.Robots {
  return {
    // /go/ is the Buy-button redirect: nothing to index there. /downloads/ is
    // deliberately NOT disallowed: its PDF carries an X-Robots-Tag noindex
    // header (next.config.ts), and a crawler must fetch the file to read it.
    rules: { userAgent: "*", allow: "/", disallow: "/go/" },
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  };
}
