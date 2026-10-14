import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { siteUrl } from "../../site";
import { healthyOpenGraph } from "../../layout";
import {
  AFFILIATE_DISCLOSURE,
  BuyButton,
  DraftBanner,
  FdaDisclaimer,
  GradeBadge,
  Pending,
  PriceLine,
  SupplementCard,
  supplementHref,
} from "../../components";
import {
  AMAZON_ASSOCIATE_STATEMENT,
  buyHref,
  costPerServing,
  getProduct,
  getProductFor,
  goalsForSupplement,
  localizeSupplement,
  pickFor,
  products,
  supplementFor,
  supplements,
  topGrade,
} from "../../data";
import { getRegion } from "../../region-server";

export const dynamicParams = false;

export function generateStaticParams() {
  return products.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata(props: PageProps<"/products/[slug]">): Promise<Metadata> {
  const { slug } = await props.params;
  const region = await getRegion();
  // Not sold in this region: the page redirects, so there is nothing of the other region's to describe.
  const product = getProductFor(slug, region);
  if (!product) return {};
  const title = `${product.brand} ${product.name} review`;
  return {
    title,
    description: product.summary,
    alternates: { canonical: `/products/${product.slug}` },
    openGraph: {
      ...healthyOpenGraph,
      title,
      description: product.summary,
      url: `/products/${product.slug}`,
    },
  };
}

function usd(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function Section({ id, title, children }: { id?: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24 border-t border-border pt-10">
      <h2 className="font-heading text-2xl font-semibold text-brand-navy">{title}</h2>
      <div className="mt-5">{children}</div>
    </section>
  );
}

export default async function ProductPage(props: PageProps<"/products/[slug]">) {
  const { slug } = await props.params;
  const base = getProduct(slug);
  if (!base) notFound();

  const region = await getRegion();
  const product = getProductFor(slug, region);
  if (!product) {
    // Sold only in the other country: send the visitor to their own country's pick for this ingredient.
    const own = pickFor(base.category, region);
    if (own) redirect(`/products/${own.slug}`);
    notFound();
  }

  const perServing = costPerServing(product);
  const baseSupplement = supplementFor(product);
  const supplement = baseSupplement ? localizeSupplement(baseSupplement, region) : undefined;
  const jobs = supplement ? goalsForSupplement(supplement.id, region) : [];
  const others = supplements.filter((s) => s.id !== supplement?.id).map((s) => localizeSupplement(s, region));

  // No rating or review markup: we have no real ratings, and Google treats
  // invented ones as spam.
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    brand: { "@type": "Brand", name: product.brand },
    description: product.summary,
    url: `${siteUrl}/products/${product.slug}`,
  };

  // The hero's photo is the goal this pick serves (the same photo as its home-page tile).
  // It is a CSS background, not an <Image>: it is decoration, and the packshot stays the page's one image.
  const heroGoal = jobs[0];
  const grade = topGrade(product);
  const facts = [
    product.format,
    product.servingSize && `Serving: ${product.servingSize}`,
    product.servingsPerContainer && `${product.servingsPerContainer} servings`,
  ].filter((f): f is string => Boolean(f));

  return (
    <article>
      <script
        type="application/ld+json"
        // Built from our own data file only, and "<" is escaped so no value can close the tag.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />

      {/* HERO: name, brand and packshot up top, so the reader knows what they are reading about
          before the Buy button sends them to the retailer. Dark band over the goal photo; below
          1544px it pulls up under the floating Menu (<main>'s pt-16) and pads that back itself.
          From 1544px the frosted side menu (layout.tsx) is on screen instead, and it only reads
          on a light page, so the band becomes a card inside the content column, clear of it. */}
      <header className="relative isolate overflow-hidden bg-slate-950 text-white -mt-16 min-[1544px]:mx-auto min-[1544px]:mt-8 min-[1544px]:max-w-6xl min-[1544px]:rounded-3xl">
        {heroGoal && (
          <div
            className="animate-kinetic-hero-zoom absolute inset-0 -z-20 bg-cover bg-center opacity-55"
            style={{ backgroundImage: `url(${heroGoal.image})` }}
            aria-hidden="true"
          />
        )}
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-slate-950 via-slate-950/80 to-kinetic-primary/50" aria-hidden="true" />
        <div className="blob blob-kinetic-cyan pointer-events-none absolute -right-24 -bottom-32 -z-10 h-96 w-96" aria-hidden="true" />

        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 pt-20 pb-14 sm:px-6 sm:pt-24 sm:pb-16 lg:grid-cols-[1fr_20rem] lg:pt-28 min-[1544px]:pt-14">
          <div className="animate-fade-in-up min-w-0">
            <nav aria-label="Breadcrumb" className="text-base">
              <Link href="/#picks" className="text-kinetic-teal-on-dark underline underline-offset-4 hover:text-white">
                All picks
              </Link>
            </nav>
            <p className="mt-6 text-sm font-extrabold tracking-widest text-kinetic-teal-on-dark uppercase">
              {product.category}
              {heroGoal && <> &middot; {heroGoal.label}</>}
            </p>
            <h1 className="mt-3 font-kinetic-heading text-4xl leading-[1.05] font-extrabold tracking-tight text-balance sm:text-6xl">
              {product.name}
            </h1>
            <p className="mt-2 text-lg font-medium text-slate-300">by {product.brand}</p>
            <p className="mt-5 max-w-2xl text-lg leading-relaxed text-slate-200 text-pretty">{product.summary}</p>

            <ul className="mt-6 flex flex-wrap gap-2" aria-label="At a glance">
              {facts.map((f) => (
                <li key={f} className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-sm font-semibold text-white backdrop-blur-sm">
                  {f}
                </li>
              ))}
              {grade && (
                <li>
                  <GradeBadge grade={grade} />
                </li>
              )}
            </ul>

            {/* The disclosure sits directly under the Buy button it covers (FTC guidance), restyled for the
                dark band; the two page links come after it, so a wrapping row never pushes it away. */}
            <div className="mt-8 flex flex-col items-start">
              <BuyButton product={product} from="product-hero" showDisclosure={false} />
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-300" data-affiliate-disclosure>
                {AFFILIATE_DISCLOSURE}
              </p>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-1">
              <Link href="#research" className="inline-flex min-h-11 items-center font-bold text-white underline underline-offset-4 hover:text-kinetic-teal-on-dark">
                What the research says
              </Link>
              <Link href="/routine" className="inline-flex min-h-11 items-center font-bold text-white underline underline-offset-4 hover:text-kinetic-teal-on-dark">
                Fit it into your day
              </Link>
            </div>
          </div>

          {product.image && (
            <div className="order-first mx-auto w-44 sm:w-56 lg:order-none lg:w-full">
              <div className="animate-healthy-float relative aspect-square rounded-[2rem] bg-white shadow-[0_0_0_6px_rgba(78,177,182,0.25),0_30px_60px_rgba(2,6,23,0.55)]">
                <Image
                  src={product.image}
                  alt={product.imageAlt}
                  fill
                  sizes="(min-width: 1024px) 320px, 224px"
                  className="object-contain p-6"
                  priority
                />
              </div>
              {product.imageNote && (
                <p className="mt-4 text-center text-sm text-slate-200 [text-shadow:0_1px_8px_rgba(2,6,23,0.9)]" data-image-note>
                  {product.imageNote}
                </p>
              )}
            </div>
          )}
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
        <div className="grid gap-10 lg:grid-cols-[1fr_22rem]">
          <div className="min-w-0 space-y-10">
            {!product.verified && <DraftBanner />}

            <section aria-labelledby="verdict-heading" className="rounded-2xl border-l-4 border-kinetic-teal bg-bg-tint p-6">
              <h2 id="verdict-heading" className="text-sm font-extrabold tracking-widest text-kinetic-primary-electric uppercase">
                Brian&apos;s verdict
              </h2>
              <p className="mt-2 text-xl leading-relaxed text-fg text-pretty">{product.verdict}</p>
            </section>

            <div className="grid gap-6 sm:grid-cols-2">
              <div className="rounded-2xl bg-bg-tint p-6">
                <h2 className="font-heading text-xl font-semibold text-brand-navy">Best for</h2>
                <ul className="mt-3 list-disc space-y-2 pl-5 text-fg-muted">
                  {product.bestFor.map((x) => <li key={x}>{x}</li>)}
                </ul>
              </div>
              <div className="rounded-2xl bg-bg-panel p-6">
                <h2 className="font-heading text-xl font-semibold text-brand-navy">Not for</h2>
                <ul className="mt-3 list-disc space-y-2 pl-5 text-fg-muted">
                  {product.notFor.map((x) => <li key={x}>{x}</li>)}
                </ul>
              </div>
            </div>

            {supplement && (
              <Section title="Where it fits in the program">
                <SupplementCard supplement={supplement} currentHref={`/products/${product.slug}`} region={region} />
                <div className="mt-6 rounded-2xl bg-bg-tint p-6">
                  <h3 className="font-heading text-lg font-semibold text-brand-navy">The rest of the program</h3>
                  <p className="mt-2 leading-relaxed text-fg-muted">
                    Each supplement covers a different job. You only need the ones that match your goals.
                  </p>
                  <ul className="mt-4 space-y-3">
                    {others.map((o) => {
                      const href = supplementHref(o, region);
                      const hook = goalsForSupplement(o.id, region)[0];
                      return (
                        <li key={o.id} className="leading-relaxed">
                          <strong className="font-semibold text-fg">{hook?.label ?? o.name}:</strong>{" "}
                          <span className="text-fg-muted">{hook?.hook ?? o.contribution}</span>{" "}
                          {href ? (
                            <Link href={href} className="font-semibold text-kinetic-primary-electric underline underline-offset-4">
                              {o.name}
                            </Link>
                          ) : (
                            <span className="text-fg-subtle">({o.name} review in progress)</span>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </Section>
            )}

            <Section title="What is in it">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[28rem] text-left">
                  <thead>
                    <tr className="border-b border-border-strong text-base text-fg">
                      <th scope="col" className="py-3 pr-4 font-semibold">Ingredient</th>
                      <th scope="col" className="py-3 pr-4 font-semibold">Per serving</th>
                      <th scope="col" className="py-3 font-semibold">Dose used in research</th>
                    </tr>
                  </thead>
                  <tbody className="text-fg-muted">
                    {product.ingredients.map((ing) => (
                      <tr key={ing.name} className="border-b border-border">
                        <th scope="row" className="py-3 pr-4 font-medium text-fg">{ing.name}</th>
                        <td className="py-3 pr-4">{ing.amount ?? <Pending />}</td>
                        <td className="py-3">{ing.studiedDose ?? "Not established"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-4 text-fg-muted">
                Serving size: {product.servingSize ?? <Pending />}
              </p>
            </Section>

            <Section id="research" title="What the research says">
              {/* UK wording only where it is true: a US page with no evidence yet says it is being verified. */}
              {product.evidence.length === 0 &&
                (region === "GB" ? (
                  <p className="text-fg-muted">
                    No health claim is authorised for this ingredient in the UK, so this page makes none.
                    It lists what is on the label and nothing about what it does.
                  </p>
                ) : (
                  <p className="text-fg-muted">
                    <Pending /> (evidence)
                  </p>
                ))}
              <ul className="space-y-6">
                {product.evidence.map((ev) => (
                  <li key={ev.claim} className="rounded-2xl border border-border p-6">
                    <div className="flex flex-wrap items-center gap-3">
                      <h3 className="font-heading text-xl font-semibold text-fg">{ev.claim}</h3>
                      <GradeBadge grade={ev.grade} />
                    </div>
                    <p className="mt-3 leading-relaxed text-fg-muted">{ev.summary}</p>
                    {ev.citations.length > 0 ? (
                      <ul className="mt-3 space-y-1 text-base">
                        {ev.citations.map((c) => (
                          <li key={c.url}>
                            <a href={c.url} className="text-kinetic-primary-electric underline underline-offset-4" rel="noopener">
                              {c.label}
                            </a>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-3 text-base"><Pending /> (citations)</p>
                    )}
                  </li>
                ))}
              </ul>
              <p className="mt-4 text-base text-fg-subtle">
                What the grades mean is explained in{" "}
                <Link href="/method" className="text-kinetic-primary-electric underline">how we choose</Link>.
              </p>
            </Section>

            <Section title="Quality and testing">
              {product.testing.length > 0 ? (
                <ul className="list-disc space-y-2 pl-5 text-fg-muted">
                  {product.testing.map((t) => <li key={t}>{t}</li>)}
                </ul>
              ) : (
                <p className="text-fg-muted"><Pending /></p>
              )}
              <p className="mt-4 text-base">
                <Link href="/why-these-picks" className="text-kinetic-primary-electric underline underline-offset-4">
                  See what the brand itself claims about this ingredient, and how Brian grades each claim
                </Link>
              </p>
            </Section>

            <Section title="Safety">
              <ul className="list-disc space-y-2 pl-5 text-fg-muted">
                {product.safety.map((s) => <li key={s}>{s}</li>)}
              </ul>
            </Section>

            <Section title="Pros and cons">
              <div className="grid gap-6 sm:grid-cols-2">
                <div>
                  <h3 className="font-heading text-lg font-semibold text-fg">Pros</h3>
                  <ul className="mt-2 list-disc space-y-2 pl-5 text-fg-muted">
                    {product.pros.map((x) => <li key={x}>{x}</li>)}
                  </ul>
                </div>
                <div>
                  <h3 className="font-heading text-lg font-semibold text-fg">Cons</h3>
                  <ul className="mt-2 list-disc space-y-2 pl-5 text-fg-muted">
                    {product.cons.map((x) => <li key={x}>{x}</li>)}
                  </ul>
                </div>
              </div>
            </Section>

            <FdaDisclaimer region={region} />
          </div>

          <aside className="lg:sticky lg:top-6 lg:self-start">
            <div className="rounded-2xl border border-border bg-bg p-6 shadow-[0_4px_28px_rgba(20,23,43,0.06)]">
              {jobs.length > 0 && (
                <p className="mb-5 border-b border-border pb-5 text-base text-fg-muted">
                  <span className="block text-sm font-semibold uppercase tracking-wider text-kinetic-primary-electric">
                    Its job in the program
                  </span>
                  {jobs.map((j) => (
                    <span key={j.id} className="mt-1 block font-heading text-lg font-semibold text-brand-navy">
                      {j.label}
                      {/* Focus never appears without its caveat, even here, far from the card on phones. */}
                      {supplement?.caveat && j.id === "focus" && (
                        <span className="block font-body text-sm font-normal text-fg-muted">
                          Promising, but not yet established
                        </span>
                      )}
                    </span>
                  ))}
                </p>
              )}
              <h2 className="font-heading text-xl font-semibold text-brand-navy">Cost</h2>
              <dl className="mt-4 space-y-3 text-base">
                <div className="flex justify-between gap-4">
                  <dt className="text-fg-muted">Price</dt>
                  <dd className="text-right font-semibold text-fg">
                    <PriceLine product={product} />
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-fg-muted">Servings</dt>
                  <dd className="text-right font-semibold text-fg">
                    {product.servingsPerContainer ?? <Pending />}
                  </dd>
                </div>
                {perServing !== null && (
                  <div className="flex justify-between gap-4">
                    <dt className="text-fg-muted">Per serving</dt>
                    <dd className="text-right font-semibold text-fg">{usd(perServing)}</dd>
                  </div>
                )}
              </dl>
              {product.priceCheckedAt ? (
                <p className="mt-3 text-sm text-fg-subtle">
                  Price checked {product.priceCheckedAt}. Prices change; the retailer&apos;s page is current.
                </p>
              ) : product.retailer ? (
                <p className="mt-3 text-sm text-fg-subtle">
                  Prices change, so this page does not show one. {product.retailer}&apos;s page has the current price.
                </p>
              ) : null}
              <div className="mt-6">
                <BuyButton product={product} from="product" />
              </div>
              <p className="mt-4 text-sm text-fg-subtle">
                Last reviewed: {product.lastReviewed ?? "not yet"}
              </p>
            </div>
          </aside>
        </div>
      </div>

      {/* Compact purchase bar: same buyHref as the sidebar BuyButton, just reachable without
          scrolling back up on a phone. The sidebar keeps the full disclosure sentence; this bar
          links to it rather than repeating it in a strip this narrow. */}
      <div data-buy-bar className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-bg/95 px-4 py-3 backdrop-blur lg:hidden">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-fg">
              {product.brand} {product.name}
            </p>
            {product.priceUsd !== null && (
              <p className="text-sm text-fg-muted">
                {usd(product.priceUsd)}
                {perServing !== null && <span> &middot; {usd(perServing)}/serving</span>}
              </p>
            )}
          </div>
          <a
            href={buyHref(product, "product-mobile-bar")}
            target="_blank"
            rel="sponsored nofollow noopener"
            className="inline-flex min-h-11 shrink-0 items-center rounded-xl bg-kinetic-amber px-4 font-semibold text-fg transition-colors duration-200 hover:bg-kinetic-amber-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kinetic-primary-electric"
          >
            Check price
          </a>
        </div>
        <p className="mt-1 text-xs text-fg-subtle">
          {AMAZON_ASSOCIATE_STATEMENT}{" "}
          <Link href="/disclosures" className="underline underline-offset-2">
            How that works
          </Link>
        </p>
      </div>
      {/* Keeps the fixed bar from covering the FDA disclaimer / footer on small screens. */}
      <div className="h-20 lg:hidden" aria-hidden="true" />
    </article>
  );
}
