import type { FlightSearch } from "@/lib/search-params";

/**
 * CONTRACT (owned by the search and home workstream). Renders the flight search form.
 * Submits GET to /flights/search using the params in src/lib/search-params.ts.
 * `layout="hero"` is the large sentence form on the home and /flights pages; `layout="bar"` is the compact
 * bar above results.
 */
export function FlightSearchForm({ initial, layout = "bar" }: { initial?: Partial<FlightSearch>; layout?: "hero" | "bar" }) {
  return (
    <form action="/flights/search" method="get" data-layout={layout} className="flex flex-wrap gap-2">
      <input name="from" defaultValue={initial?.from} placeholder="From (IATA)" aria-label="From" className="h-11 rounded-md border border-line-strong px-3" />
      <input name="to" defaultValue={initial?.to} placeholder="To (IATA)" aria-label="To" className="h-11 rounded-md border border-line-strong px-3" />
      <input type="date" name="depart" defaultValue={initial?.depart} aria-label="Depart" className="h-11 rounded-md border border-line-strong px-3" />
      <input type="date" name="return" defaultValue={initial?.return} aria-label="Return" className="h-11 rounded-md border border-line-strong px-3" />
      <input type="number" name="adults" min={1} max={9} defaultValue={initial?.adults ?? 1} aria-label="Adults" className="h-11 w-20 rounded-md border border-line-strong px-3" />
      <button className="h-11 rounded-md bg-sapphire px-5 font-semibold text-paper">Search flights</button>
    </form>
  );
}
