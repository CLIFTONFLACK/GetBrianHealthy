import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    // The three picks were all Thorne until 2026-10-01, and those product
    // pages were live and indexed. Each old address goes to its ingredient's
    // new page; the product page then sends UK visitors on to their own
    // country's pick when this one is not sold there.
    return [
      {
        source: "/products/thorne-magnesium-glycinate",
        destination: "/products/pure-encapsulations-magnesium-glycinate",
        permanent: true,
      },
      {
        source: "/products/thorne-creatine-stick-packs",
        destination: "/products/pure-encapsulations-creatine",
        permanent: true,
      },
      {
        source: "/products/thorne-theanine",
        destination: "/products/pure-encapsulations-l-theanine",
        permanent: true,
      },
    ];
  },
  async rewrites() {
    // Browsers ask for /favicon.ico regardless of the <link> tags in <head>.
    return [{ source: "/favicon.ico", destination: "/healthy/brand/favicon-32.png" }];
  },
};

export default nextConfig;
