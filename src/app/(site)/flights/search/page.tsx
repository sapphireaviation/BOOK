import type { Metadata } from "next";
import Link from "next/link";
import { io } from "next/cache";
import { Suspense } from "react";
import { FlightRow } from "@/components/flights/flight-row";
import { cabinLabels, passengerCountLabel } from "@/components/flights/format";
import { FlightsNotConnected } from "@/components/flights/not-connected";
import { ResultFilters, SortTabs, searchHref, tripParams } from "@/components/flights/result-filters";
import { TestDataBadge } from "@/components/flights/test-data-badge";
import { FlightSearchForm } from "@/components/search/flight-search-form";
import { Notice, Skeleton } from "@/components/ui";
import { addDays, formatDay } from "@/lib/dates";
import { minorUnitDigits } from "@/lib/money";
import { flightSearchSchema, type FlightSearch } from "@/lib/search-params";
import { getFlightProvider, searchFlights } from "@/server/flights";
import { getAirport } from "@/server/flights/airports";
import { priceSteps } from "@/server/flights/filters";
import type { SearchResult } from "@/server/flights/types";

type SP = Record<string, string | string[] | undefined>;

const MAX_DAYS_AHEAD = 361;

/** Flattens searchParams, joins repeated airline checkboxes and drops empty values ("stops=" means any). */
function readParams(sp: SP) {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(sp)) {
    if (v === undefined) continue;
    const value = Array.isArray(v) ? (k === "airlines" ? v.join(",") : v[0]) : v;
    if (value !== undefined && value.trim() !== "") out[k] = value.trim();
  }
  return out;
}

function cityOf(code: string | undefined) {
  if (!code) return "";
  return getAirport(code)?.city ?? code.toUpperCase();
}

export async function generateMetadata({ searchParams }: PageProps<"/flights/search">): Promise<Metadata> {
  const raw = readParams(await searchParams);
  const parsed = flightSearchSchema.safeParse(raw);
  if (!parsed.success) {
    return { title: "Search flights", robots: { index: false, follow: true }, alternates: { canonical: "/flights" } };
  }
  const s = parsed.data;
  const title = `${cityOf(s.from)} to ${cityOf(s.to)}, ${formatDay(s.depart)}`;
  return {
    title,
    description: `Flights from ${cityOf(s.from)} to ${cityOf(s.to)} on ${formatDay(s.depart)}, compared by price, duration and departure time. You pay the airline's fare with no platform fee.`,
    robots: { index: false, follow: true },
    alternates: { canonical: searchHref(tripParams(s)) },
  };
}

export default function FlightSearchPage({ searchParams }: PageProps<"/flights/search">) {
  return (
    <div className="container-page py-6 md:py-8">
      <Suspense fallback={<SearchSkeleton />}>
        <SearchContent searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

function SearchSkeleton() {
  return (
    <div aria-busy="true" aria-label="Searching airlines">
      <Skeleton className="h-11 w-full" />
      <Skeleton className="mt-8 h-9 w-1/2" />
      <div className="mt-8 grid gap-8 md:grid-cols-[15rem_minmax(0,1fr)]">
        <Skeleton className="hidden h-96 md:block" />
        <div className="space-y-3">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-28 w-full" />
          ))}
        </div>
      </div>
      <p className="sr-only" role="status">
        Searching airlines for fares
      </p>
    </div>
  );
}

async function SearchContent({ searchParams }: { searchParams: Promise<SP> }) {
  const raw = readParams(await searchParams);
  await io();
  const today = new Date().toISOString().slice(0, 10);
  const initial = {
    from: raw.from?.toUpperCase(),
    to: raw.to?.toUpperCase(),
    depart: raw.depart,
    return: raw.return,
    adults: Number(raw.adults) || undefined,
  } as Partial<FlightSearch>;

  if (!raw.from && !raw.to && !raw.depart) {
    return (
      <>
        <h1 className="text-3xl">Search flights</h1>
        <p className="mt-2 text-slate">Choose where you are flying from and to, and the date.</p>
        <div className="mt-6">
          <FlightSearchForm layout="bar" initial={initial} />
        </div>
      </>
    );
  }

  const parsed = flightSearchSchema.safeParse(raw);
  const problems: string[] = [];
  if (!parsed.success) problems.push(...new Set(parsed.error.issues.map((i) => i.message)));
  else {
    if (parsed.data.depart < today) problems.push("Pick a departure date from today onwards");
    else if (parsed.data.depart > addDays(today, MAX_DAYS_AHEAD)) problems.push("Airlines sell seats up to about a year ahead. Pick an earlier date.");
    if (!getAirport(parsed.data.from)) problems.push(`We do not know an airport with the code ${parsed.data.from}. Pick one from the list.`);
    if (!getAirport(parsed.data.to)) problems.push(`We do not know an airport with the code ${parsed.data.to}. Pick one from the list.`);
  }

  if (problems.length || !parsed.success) {
    return (
      <>
        <h1 className="text-3xl">Check your search</h1>
        <Notice tone="bad" className="mt-4 max-w-2xl" title={problems.length === 1 ? "One thing to fix" : "A few things to fix"}>
          <ul className="list-disc pl-5">
            {problems.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </Notice>
        <div className="mt-6">
          <FlightSearchForm layout="bar" initial={initial} />
        </div>
      </>
    );
  }

  const search = parsed.data;
  const heading = (
    <div className="mt-8 flex flex-wrap items-center gap-3">
      <h1 className="text-3xl">
        {cityOf(search.from)} to {cityOf(search.to)}
      </h1>
    </div>
  );
  const summary = `${search.return ? `${formatDay(search.depart)} to ${formatDay(search.return)}, return` : `${formatDay(search.depart)}, one way`}, ${passengerCountLabel(search)}, ${cabinLabels[search.cabin].toLowerCase()}`;
  const bar = <FlightSearchForm layout="bar" initial={tripParams(search)} />;

  if (!getFlightProvider()) {
    return (
      <>
        {bar}
        {heading}
        <div className="mt-6">
          <FlightsNotConnected />
        </div>
      </>
    );
  }

  let result: SearchResult;
  try {
    result = await searchFlights(search, { source: "web" });
  } catch (err) {
    console.error("searchFlights failed", err);
    return (
      <>
        {bar}
        {heading}
        <p className="mt-1 text-slate">{summary}</p>
        <Notice tone="bad" className="mt-6 max-w-2xl" title="We could not reach the airlines just now">
          <p>Nothing was booked or charged. Search again in a minute.</p>
          <Link href={searchHref({ ...tripParams(search) })} className="link mt-2 inline-block font-semibold">
            Search again
          </Link>
        </Notice>
      </>
    );
  }

  const facets = result.facets ?? { airlines: [], stops: [], minPrice: null, maxPrice: null, total: result.offers.length };
  const travelers = search.adults + search.children + search.infants;
  const steps = priceSteps(facets.minPrice, facets.maxPrice, 10 ** minorUnitDigits(result.currency));
  const filtered = facets.total !== result.offers.length;

  return (
    <>
      {bar}
      <div className="mt-8 flex flex-wrap items-center gap-3">
        <h1 className="text-3xl">
          {cityOf(search.from)} to {cityOf(search.to)}
        </h1>
        <TestDataBadge provider={result.provider} />
      </div>
      <p className="mt-1 text-slate">{summary}</p>

      {facets.total === 0 ? (
        <NoFlights search={search} today={today} />
      ) : (
        <div className="mt-6 grid gap-8 md:grid-cols-[15rem_minmax(0,1fr)]">
          <aside className="hidden md:block" aria-label="Filters">
            <h2 className="mb-4 text-lg">Filter</h2>
            <ResultFilters search={search} facets={facets} currency={result.currency} priceSteps={steps} idPrefix="side" />
          </aside>

          <section aria-labelledby="results-heading" className="min-w-0">
            <h2 id="results-heading" className="sr-only">
              Results
            </h2>
            <details className="mb-4 rounded-md border border-line bg-surface md:hidden">
              <summary className="cursor-pointer px-4 py-3 text-sm font-semibold">Filters</summary>
              <div className="border-t border-line p-4">
                <ResultFilters search={search} facets={facets} currency={result.currency} priceSteps={steps} idPrefix="sheet" />
              </div>
            </details>

            <SortTabs search={search} />
            <p className="mt-3 text-sm text-slate" role="status">
              {filtered ? `${result.offers.length} of ${facets.total} flights match your filters` : `${facets.total} ${facets.total === 1 ? "flight" : "flights"}`}
              . Prices are for {travelers === 1 ? "1 traveler" : `all ${travelers} travelers`}, with taxes and airline fees. No platform fee.
            </p>

            {result.offers.length === 0 ? (
              <div className="border-b border-line py-10">
                <h3 className="text-xl">No flights match these filters</h3>
                <p className="mt-2 text-slate">
                  <Link href={searchHref({ ...tripParams(search), sort: search.sort === "price" ? undefined : search.sort })} className="link">
                    Clear filters to see {facets.total} {facets.total === 1 ? "flight" : "flights"}
                  </Link>
                </p>
              </div>
            ) : (
              <ol className="mt-2">
                {result.offers.map((o) => (
                  <FlightRow key={o.id} offer={o} travelers={travelers} />
                ))}
              </ol>
            )}
          </section>
        </div>
      )}
    </>
  );
}

function NoFlights({ search, today }: { search: FlightSearch; today: string }) {
  const nights = search.return ? Math.round((Date.parse(search.return) - Date.parse(search.depart)) / 86_400_000) : null;
  const dates = [-2, -1, 1, 2]
    .map((d) => addDays(search.depart, d))
    .filter((d) => d >= today)
    .map((depart) => ({ depart, return: nights !== null ? addDays(depart, nights) : undefined }));
  return (
    <div className="mt-6 border-y border-line py-10">
      <h2 className="text-xl">No flights found for {formatDay(search.depart)}</h2>
      <p className="mt-2 max-w-prose text-slate">
        The airlines we search have no seats on this route for these dates and travelers. Nearby dates often have more choice.
      </p>
      {dates.length > 0 && (
        <ul className="mt-5 flex flex-wrap gap-2">
          {dates.map((d) => (
            <li key={d.depart}>
              <Link
                href={searchHref({ ...tripParams(search), depart: d.depart, return: d.return })}
                className="inline-flex h-10 items-center rounded-md border border-line-strong bg-surface px-3 text-sm font-semibold hover:border-ink"
              >
                {formatDay(d.depart)}
                {d.return ? ` to ${formatDay(d.return)}` : ""}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
