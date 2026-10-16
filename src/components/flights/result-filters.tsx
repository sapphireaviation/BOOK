import Link from "next/link";
import { buttonClass, cn, Select } from "@/components/ui";
import { departWindows } from "@/lib/flight-time";
import { formatMoney } from "@/lib/money";
import { toQuery, type FlightSearch } from "@/lib/search-params";
import type { SearchFacets } from "@/server/flights/types";

/** Search fields that define the trip. Filters and sort ride on top of these. */
export function tripParams(s: FlightSearch) {
  return { from: s.from, to: s.to, depart: s.depart, return: s.return, adults: s.adults, children: s.children, infants: s.infants, cabin: s.cabin };
}

export function searchHref(params: Record<string, unknown>) {
  return `/flights/search?${toQuery(params)}`;
}

function Hidden({ params }: { params: Record<string, unknown> }) {
  return (
    <>
      {Object.entries(params).map(([k, v]) =>
        v === undefined || v === null || v === "" ? null : <input key={k} type="hidden" name={k} value={String(v)} />,
      )}
    </>
  );
}

const legend = "mb-2 text-sm font-semibold";
const option = "flex cursor-pointer items-center gap-2.5 py-1 text-sm";

/**
 * Result filters as a plain GET form, so they work without JavaScript and every filtered view
 * has a shareable URL. Counts and "from" prices come from the unfiltered results.
 */
export function ResultFilters({
  search,
  facets,
  currency,
  priceSteps,
  idPrefix,
}: {
  search: FlightSearch;
  facets: SearchFacets;
  currency: string;
  priceSteps: number[];
  idPrefix: string;
}) {
  const selectedAirlines = new Set((search.airlines ?? "").split(",").filter(Boolean));
  const hasFilters = search.stops !== undefined || selectedAirlines.size > 0 || search.maxPrice !== undefined || search.departWindow !== undefined;
  const money = (amount: number) => formatMoney({ amount, currency });
  const stopOptions = [
    { value: "", label: "Any number of stops", cheapest: facets.minPrice },
    ...facets.stops
      .filter((s) => s.stops < 2)
      .map((s) => ({
        value: String(s.stops),
        label: s.stops === 0 ? "Nonstop only" : "Up to 1 stop",
        cheapest: Math.min(...facets.stops.filter((x) => x.stops <= s.stops).map((x) => x.cheapest)),
      })),
  ];

  return (
    <form action="/flights/search" method="get" className="space-y-6" aria-label="Filter results">
      <Hidden params={{ ...tripParams(search), sort: search.sort === "price" ? undefined : search.sort }} />

      <fieldset>
        <legend className={legend}>Stops</legend>
        {stopOptions.map((o) => (
          <label key={o.value || "any"} className={option}>
            <input
              type="radio"
              name="stops"
              value={o.value}
              defaultChecked={(search.stops === undefined ? "" : String(search.stops)) === o.value}
              className="size-4 accent-sapphire"
            />
            <span className="flex-1">{o.label}</span>
            {o.cheapest !== null && <span className="tnum text-xs text-slate">{money(o.cheapest)}</span>}
          </label>
        ))}
      </fieldset>

      {facets.airlines.length > 0 && (
        <fieldset>
          <legend className={legend}>Airlines</legend>
          {facets.airlines.map((a) => (
            <label key={a.iata} className={option}>
              <input type="checkbox" name="airlines" value={a.iata} defaultChecked={selectedAirlines.has(a.iata)} className="size-4 accent-sapphire" />
              <span className="flex-1">
                {a.name} <span className="text-slate">({a.count})</span>
              </span>
              <span className="tnum text-xs text-slate">{money(a.cheapest)}</span>
            </label>
          ))}
        </fieldset>
      )}

      <fieldset>
        <legend className={legend}>Departure time</legend>
        <label className={option}>
          <input type="radio" name="departWindow" value="" defaultChecked={!search.departWindow} className="size-4 accent-sapphire" />
          <span>Any time</span>
        </label>
        {departWindows.map((w) => (
          <label key={w.key} className={option}>
            <input type="radio" name="departWindow" value={w.key} defaultChecked={search.departWindow === w.key} className="size-4 accent-sapphire" />
            <span className="tnum">{w.label}</span>
          </label>
        ))}
      </fieldset>

      {priceSteps.length > 0 && (
        <div>
          <label htmlFor={`${idPrefix}-max-price`} className={legend + " block"}>
            Maximum price
          </label>
          <Select id={`${idPrefix}-max-price`} name="maxPrice" defaultValue={search.maxPrice ? String(search.maxPrice) : ""}>
            <option value="">Any price</option>
            {search.maxPrice && !priceSteps.includes(search.maxPrice) && <option value={search.maxPrice}>Up to {money(search.maxPrice)}</option>}
            {priceSteps.map((p) => (
              <option key={p} value={p}>
                Up to {money(p)}
              </option>
            ))}
          </Select>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" className={buttonClass({ size: "sm" })}>
          Apply filters
        </button>
        {hasFilters && (
          <Link href={searchHref({ ...tripParams(search), sort: search.sort === "price" ? undefined : search.sort })} className="link text-sm">
            Clear filters
          </Link>
        )}
      </div>
    </form>
  );
}

const sorts: { key: FlightSearch["sort"]; label: string }[] = [
  { key: "price", label: "Cheapest" },
  { key: "duration", label: "Fastest" },
  { key: "depart", label: "Earliest" },
];

/** Sort as links so the choice is in the URL. */
export function SortTabs({ search }: { search: FlightSearch }) {
  const keep = {
    ...tripParams(search),
    stops: search.stops,
    airlines: search.airlines,
    maxPrice: search.maxPrice,
    departWindow: search.departWindow,
  };
  return (
    <nav aria-label="Sort results" className="flex gap-1 border-b border-line">
      {sorts.map((s) => {
        const active = search.sort === s.key;
        return (
          <Link
            key={s.key}
            href={searchHref({ ...keep, sort: s.key === "price" ? undefined : s.key })}
            aria-current={active ? "page" : undefined}
            className={cn(
              "-mb-px whitespace-nowrap border-b-[3px] px-3 py-2.5 text-sm font-semibold",
              active ? "border-sapphire text-ink" : "border-transparent text-slate hover:text-ink",
            )}
          >
            {s.label}
          </Link>
        );
      })}
    </nav>
  );
}
