import { Checkbox, Select } from "@/components/ui";
import { amenityLabel, propertyTypeLabels } from "@/lib/amenities";
import { formatMoney } from "@/lib/money";
import type { StaySearch } from "@/lib/search-params";
import { AutoSubmit } from "./auto-submit";
import { priceSteps } from "./price-steps";

export const FILTER_AMENITIES = ["wifi", "ac", "kitchen", "pool", "parking", "breakfast", "workspace", "washer", "pets", "step_free", "beach_access", "mountain_view"];

const RATINGS = [
  { value: "", label: "Any rating" },
  { value: "3.5", label: "3.5 and up" },
  { value: "4", label: "4 and up" },
  { value: "4.5", label: "4.5 and up" },
];

export const SORTS = [
  { value: "recommended", label: "Recommended" },
  { value: "price_asc", label: "Price, lowest first" },
  { value: "price_desc", label: "Price, highest first" },
  { value: "rating", label: "Guest rating" },
] as const;

export function activeFilterCount(p: StaySearch) {
  return [p.minPrice, p.maxPrice, p.types, p.amenities, p.freeCancellation, p.instantBook, p.minRating].filter((v) => v !== undefined && v !== "" && v !== false).length;
}

function Hidden({ params }: { params: StaySearch }) {
  return (
    <>
      <input type="hidden" name="place" value={params.place} />
      <input type="hidden" name="checkin" value={params.checkin} />
      <input type="hidden" name="checkout" value={params.checkout} />
      <input type="hidden" name="adults" value={params.adults} />
      {params.children > 0 && <input type="hidden" name="children" value={params.children} />}
      {params.rooms > 1 && <input type="hidden" name="rooms" value={params.rooms} />}
    </>
  );
}

/**
 * Filters and sort as one GET form. Each change reloads the results with the new query string, so every
 * filtered view has a shareable URL. The "Show stays" button covers browsers without JavaScript.
 */
export function SearchFilters({
  params,
  facets,
  total,
}: {
  params: StaySearch;
  facets: { types: Record<string, number>; priceMin: number; priceMax: number; currency: string | null };
  total: number;
}) {
  const types = new Set((params.types ?? "").split(",").filter(Boolean));
  const amenities = new Set((params.amenities ?? "").split(",").filter(Boolean));
  const currency = facets.currency ?? "INR";
  const steps = priceSteps(facets.priceMin, facets.priceMax, currency);
  const withCurrent = (list: number[], v?: number) => (v !== undefined && !list.includes(v) ? [...list, v].sort((a, b) => a - b) : list);
  const minOptions = withCurrent(steps, params.minPrice);
  const maxOptions = withCurrent(steps, params.maxPrice);
  const typeEntries = Object.entries(facets.types).sort((a, b) => b[1] - a[1]);
  const active = activeFilterCount(params);

  return (
    <form action="/stays/search" method="get" className="border-b border-line pb-4">
      <Hidden params={params} />
      <AutoSubmit className="flex flex-wrap items-end justify-between gap-3">
        <p className="text-sm text-slate" role="status">
          {total === 0 ? "No stays" : total === 1 ? "1 stay" : `${total.toLocaleString("en-IN")} stays`} available for your dates
        </p>
        <label className="flex items-center gap-2 text-sm font-semibold">
          Sort
          <Select name="sort" defaultValue={params.sort} className="h-10 w-auto py-0 text-sm">
            {SORTS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </Select>
        </label>
      </AutoSubmit>

      <details className="group mt-3">
        <summary className="inline-flex h-10 cursor-pointer list-none items-center gap-2 rounded-full border border-line-strong bg-surface px-4 text-sm font-semibold hover:border-ink [&::-webkit-details-marker]:hidden">
          {active ? `Filters (${active})` : "Filters"}
          <svg viewBox="0 0 16 16" className="size-3.5 transition-transform duration-150 group-open:rotate-180" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M4 6l4 4 4-4" />
          </svg>
        </summary>

        <AutoSubmit className="mt-4 grid gap-6 sm:grid-cols-2">
          <fieldset>
            <legend className="text-sm font-semibold">Price per night</legend>
            {steps.length ? (
              <div className="mt-2 flex items-center gap-2">
                <Select name="minPrice" defaultValue={params.minPrice ?? ""} aria-label="Lowest price per night" className="h-10 text-sm">
                  <option value="">No minimum</option>
                  {minOptions.map((v) => (
                    <option key={v} value={v}>
                      {formatMoney({ amount: v, currency })}
                    </option>
                  ))}
                </Select>
                <span className="text-sm text-slate">to</span>
                <Select name="maxPrice" defaultValue={params.maxPrice ?? ""} aria-label="Highest price per night" className="h-10 text-sm">
                  <option value="">No maximum</option>
                  {maxOptions.map((v) => (
                    <option key={v} value={v}>
                      {formatMoney({ amount: v, currency })}
                    </option>
                  ))}
                </Select>
              </div>
            ) : (
              <p className="mt-2 text-sm text-slate">All stays here cost about the same.</p>
            )}
          </fieldset>

          <fieldset>
            <legend className="text-sm font-semibold">Booking</legend>
            <div className="mt-2 space-y-2">
              <Checkbox name="freeCancellation" value="1" defaultChecked={Boolean(params.freeCancellation)} label="Free cancellation" />
              <Checkbox name="instantBook" value="1" defaultChecked={Boolean(params.instantBook)} label="Instant book, no wait for the owner" />
            </div>
          </fieldset>

          {typeEntries.length > 0 && (
            <fieldset>
              <legend className="text-sm font-semibold">Type of place</legend>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {typeEntries.map(([t, n]) => (
                  <Checkbox
                    key={t}
                    name="types"
                    value={t}
                    defaultChecked={types.has(t)}
                    label={
                      <>
                        {propertyTypeLabels[t] ?? t} <span className="tnum text-slate">{n}</span>
                      </>
                    }
                  />
                ))}
              </div>
            </fieldset>
          )}

          <fieldset>
            <legend className="text-sm font-semibold">Guest rating</legend>
            <Select name="minRating" defaultValue={params.minRating !== undefined ? String(params.minRating) : ""} aria-label="Guest rating" className="mt-2 h-10 text-sm">
              {RATINGS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </Select>
          </fieldset>

          <fieldset className="sm:col-span-2">
            <legend className="text-sm font-semibold">Amenities</legend>
            <div className="mt-2 grid grid-cols-2 gap-2 md:grid-cols-3">
              {FILTER_AMENITIES.map((a) => (
                <Checkbox key={a} name="amenities" value={a} defaultChecked={amenities.has(a)} label={amenityLabel(a)} />
              ))}
            </div>
          </fieldset>
        </AutoSubmit>

        <div className="mt-5 flex flex-wrap items-center gap-4">
          <button type="submit" className="h-10 rounded-md bg-ink px-4 text-sm font-semibold text-paper hover:bg-sapphire-deep">
            Show stays
          </button>
          {active > 0 && (
            <a className="link text-sm" href={`/stays/search?${new URLSearchParams({ place: params.place, checkin: params.checkin, checkout: params.checkout, adults: String(params.adults), ...(params.children ? { children: String(params.children) } : {}), ...(params.rooms > 1 ? { rooms: String(params.rooms) } : {}) })}`}>
              Clear filters
            </a>
          )}
        </div>
      </details>
    </form>
  );
}
