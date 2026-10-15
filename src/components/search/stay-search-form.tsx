import type { StaySearch } from "@/lib/search-params";

/** CONTRACT (owned by the search and home workstream). Submits GET to /stays/search. */
export function StaySearchForm({ initial, layout = "bar" }: { initial?: Partial<StaySearch>; layout?: "hero" | "bar" }) {
  return (
    <form action="/stays/search" method="get" data-layout={layout} className="flex flex-wrap gap-2">
      <input name="place" defaultValue={initial?.place} placeholder="Where to" aria-label="Where to" className="h-11 rounded-md border border-line-strong px-3" />
      <input type="date" name="checkin" defaultValue={initial?.checkin} aria-label="Check in" className="h-11 rounded-md border border-line-strong px-3" />
      <input type="date" name="checkout" defaultValue={initial?.checkout} aria-label="Check out" className="h-11 rounded-md border border-line-strong px-3" />
      <input type="number" name="adults" min={1} max={16} defaultValue={initial?.adults ?? 2} aria-label="Adults" className="h-11 w-20 rounded-md border border-line-strong px-3" />
      <button className="h-11 rounded-md bg-sapphire px-5 font-semibold text-paper">Search stays</button>
    </form>
  );
}
