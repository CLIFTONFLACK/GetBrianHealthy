import { REGIONS, REGION_LABELS, type Region } from "./region";
import { setRegion } from "./region-actions";

/**
 * "Showing the picks sold in the United States. Change country." Each button
 * posts to a server action, so it works without client JavaScript. The page
 * re-renders in the chosen country, and the choice is remembered in a cookie
 * set only by this click.
 */
export function RegionSwitch({ region }: { region: Region }) {
  return (
    <form action={setRegion} className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-slate-400">
      <span id="region-switch-label">Picks shown for:</span>
      <div role="group" aria-labelledby="region-switch-label" className="flex flex-wrap items-center gap-2">
        {REGIONS.map((r) => (
          <button
            key={r}
            type="submit"
            name="region"
            value={r}
            aria-pressed={r === region}
            className={`min-h-11 rounded-lg border px-3 font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kinetic-teal-on-dark ${
              r === region
                ? "border-kinetic-teal-on-dark bg-slate-900 text-white"
                : "border-slate-700 text-slate-300 hover:border-slate-500 hover:text-white"
            }`}
          >
            {REGION_LABELS[r]}
          </button>
        ))}
      </div>
    </form>
  );
}
