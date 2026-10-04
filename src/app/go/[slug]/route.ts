import { getProduct, outboundUrl, usesRedirect } from "../../data";

/**
 * Buy-button redirect. The destination comes only from data.ts, looked up by
 * slug; nothing in the request can choose where it sends someone, so this
 * cannot be used as an open redirect.
 *
 * 404 when the product's affiliate link is live and its programme forbids
 * redirects, so a stale or hand-typed /go link can never breach those terms.
 */
const FROM_VALUES = new Set(["product", "product-mobile-bar", "picks", "home"]);

export async function GET(request: Request, ctx: RouteContext<"/go/[slug]">) {
  const { slug } = await ctx.params;
  const product = getProduct(slug);

  if (!product || !usesRedirect(product)) {
    return new Response("Not found", {
      status: 404,
      headers: { "X-Robots-Tag": "noindex", "Cache-Control": "no-store" },
    });
  }

  // Only a fixed set of source labels is logged, so arbitrary query text never
  // reaches the logs. No IP, user agent or cookie is recorded.
  const fromParam = new URL(request.url).searchParams.get("from") ?? "";
  const from = FROM_VALUES.has(fromParam) ? fromParam : "unknown";
  console.info(JSON.stringify({ event: "healthy_buy_click", slug: product.slug, from }));

  // 302, not 301: browsers cache a 301, which would keep sending people to the
  // old destination after the brand URL is swapped for an affiliate link.
  return new Response(null, {
    status: 302,
    headers: {
      Location: outboundUrl(product),
      "X-Robots-Tag": "noindex, nofollow",
      "Cache-Control": "no-store",
      "Referrer-Policy": "strict-origin-when-cross-origin",
    },
  });
}
