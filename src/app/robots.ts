import type { MetadataRoute } from "next";
import { siteUrl } from "./site";

export default function robots(): MetadataRoute.Robots {
  return {
    // /go/ is the Buy-button redirect: nothing to index there.
    rules: { userAgent: "*", allow: "/", disallow: "/go/" },
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  };
}
