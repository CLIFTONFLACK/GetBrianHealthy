import { RailReveal } from "./rail-reveal";
import { ProductCard } from "./components";
import { Icon } from "./icons";
import { MascotShower } from "./mascot-shower";
import { SwipeControls } from "./swipe-controls";
import { goalsForSupplement, localizeSupplement, supplementFor, type Product } from "./data";
import type { Region } from "./region";

/**
 * Current picks, each card under the goal it serves: the same goals, names
 * and icons as the "What do you need to boost?" tiles above, so the page reads
 * goal -> pick. A teal circuit trace runs along the goals, drawn once when the
 * row scrolls into view (the `.healthy-rail-*` transitions in globals.css, run
 * by RailReveal), and under each goal the mascot showers that goal's icons
 * down onto its card (mascot-shower.tsx).
 *
 * The goals are read from each card's own product via supplementFor(), not
 * from any list's order, so a lineup change can never pair a card with
 * someone else's goal. A supplement with two goals (creatine: strength, and
 * focus) shows only the one that has no caveat.
 */
function leadGoal(product: Product, region: Region) {
  const job = supplementFor(product);
  const jobGoals = job ? goalsForSupplement(job.id, region) : [];
  return jobGoals.find((g) => !g.caveat) ?? jobGoals[0];
}

export function JobRail({ products, region = "US" }: { products: Product[]; region?: Region }) {
  return (
    <RailReveal className="relative">
      <div className="relative">
        {/* The rail: from the first job's centre to the last's, behind the number
            tiles (whose centres sit 1.5rem down). Three columns and gap-8 put the
            outer centres (100% - 4rem) / 6 in from each edge. */}
        <span
          className="healthy-rail-line pointer-events-none absolute top-6 hidden h-[3px] -translate-y-1/2 rounded-full bg-kinetic-teal lg:block"
          style={{ left: "calc((100% - 4rem) / 6)", right: "calc((100% - 4rem) / 6)" }}
          aria-hidden="true"
        />
        {/* Below lg the picks become a swipe carousel: each goal, mascot and
            card slides as one, and the next one peeks in from the right. The
            row bleeds to the screen edge; the vertical padding keeps the
            cards' hover lift and shadow from being clipped by the scroller. */}
        <ul id="healthy-picks-row" aria-label="Brian's picks" className="relative -mx-4 flex scroll-mt-20 snap-x snap-mandatory scroll-px-4 gap-4 overflow-x-auto px-4 pt-2 pb-6 lg:pb-10 [scrollbar-width:none] sm:-mx-6 sm:scroll-px-6 sm:px-6 lg:mx-0 lg:grid lg:grid-cols-3 lg:items-stretch lg:gap-8 lg:overflow-visible lg:p-0 [&::-webkit-scrollbar]:hidden">
          {products.map((product, i) => {
            const baseJob = supplementFor(product);
            const job = baseJob ? localizeSupplement(baseJob, region) : baseJob;
            const lead = leadGoal(product, region);
            const base = 250 + i * 180;
            return (
              <li key={product.slug} className="flex w-[85%] shrink-0 snap-start flex-col sm:w-[55%] lg:w-auto">
                {/* lg:min-h-32 fits a node with a caveat line, so every card
                    starts at the same height whichever goal sits above it. */}
                <div
                  className="healthy-rail-node flex flex-col items-center text-center lg:min-h-32"
                  style={{ transitionDelay: `${base}ms` }}
                >
                  <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-kinetic-primary font-kinetic-heading text-sm font-extrabold text-white shadow-sm ring-4 ring-white">
                    {lead ? <Icon name={lead.icon} size={22} /> : String(i + 1).padStart(2, "0")}
                  </span>
                  {job && (
                    <>
                      <span className="mt-3 font-kinetic-heading text-lg font-bold text-slate-900">
                        {lead ? lead.label : job.tagline}
                      </span>
                      <span className="text-sm font-medium text-slate-500">{job.name}</span>
                      {/* The lead's own caveat, only reached when every goal of a
                          supplement carries one, so it can't be selected out.
                          Secondary goals (creatine's "+ Focus") are not named
                          here; the product card covers them. */}
                      {lead?.caveat && (
                        <span className="mt-1 text-xs font-semibold text-kinetic-primary-electric">{lead.caveat}</span>
                      )}
                    </>
                  )}
                </div>
                {/* Where the drop line was: the mascot showering this pick's goal
                    icons into the top of its card, where each one bursts.
                    Unrolls from the top on reveal; z-10 keeps the icons in
                    front of the card they fall into. */}
                <div className="healthy-rail-drop relative z-10 mt-3" style={{ transitionDelay: `${base + 350}ms` }}>
                  <MascotShower icons={lead ? [lead.icon] : []} />
                </div>
                <div className="flex-1">
                  <ProductCard product={product} region={region} showImage={products.every((p) => p.image)} />
                </div>
              </li>
            );
          })}
        </ul>
        <SwipeControls
          targetId="healthy-picks-row"
          labels={products.map((p) => leadGoal(p, region)?.label ?? p.name)}
        />
      </div>
    </RailReveal>
  );
}
