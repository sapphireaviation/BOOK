import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { StaySearchForm } from "@/components/search/stay-search-form";
import { dayLabel, plural } from "@/components/stays/format";
import { Pagination } from "@/components/stays/pagination";
import { SaveButton } from "@/components/stays/save-button";
import { activeFilterCount, SearchFilters } from "@/components/stays/search-filters";
import { StayMap, type MapPoint } from "@/components/stays/stay-map";
import { StayRow } from "@/components/stays/stay-row";
import { ButtonLink, EmptyState, Notice, Skeleton } from "@/components/ui";
import { formatMoney } from "@/lib/money";
import { staySearchSchema, toQuery, type StaySearch } from "@/lib/search-params";
import { getSession } from "@/server/auth";
import { resolvePlace, searchStays, suggestPlaces } from "@/server/stays/search";
import type { StaySearchResult } from "@/server/stays/types";
import { savedListingIds } from "@/server/stays/wishlist";

type SP = PageProps<"/stays/search">["searchParams"];

/** Next gives repeated keys as arrays. Filters join them; empty values are dropped so defaults apply. */
function normalize(sp: Record<string, string | string[] | undefined>) {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(sp)) {
    if (v === undefined) continue;
    const value = Array.isArray(v) ? (k === "types" || k === "amenities" ? v.join(",") : v[0]) : v;
    if (value.trim() !== "") out[k] = value;
  }
  return out;
}

function parse(sp: Record<string, string | string[] | undefined>) {
  return staySearchSchema.safeParse(normalize(sp));
}

export async function generateMetadata({ searchParams }: { searchParams: SP }): Promise<Metadata> {
  const parsed = parse(await searchParams);
  const resolved = parsed.success ? await resolvePlace(parsed.data.place).catch(() => null) : null;
  const where = resolved?.name ?? (parsed.success ? parsed.data.place : null);
  const title = where ? `Stays in ${where}` : "Search stays";
  const description = parsed.success
    ? `Places to stay in ${where} from ${dayLabel(parsed.data.checkin)} to ${dayLabel(parsed.data.checkout)}, with the full price for your dates and no platform fee.`
    : "Search places to stay by destination, dates and guests. See the full price for your dates, including taxes, with no platform fee.";
  return {
    title,
    description,
    // Result pages change by the hour and depend on dates, so they are not indexed. Destination pages are.
    robots: { index: false, follow: true },
    alternates: { canonical: parsed.success ? `/stays/search?${toQuery(normalize(await searchParams))}` : "/stays/search" },
    openGraph: { title, description, type: "website" },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default function StaySearchPage({ searchParams }: { searchParams: SP }) {
  return (
    <div className="container-page py-6">
      <h1 className="sr-only">Search stays</h1>
      <div className="border-b border-line pb-5">
        <Suspense fallback={<StaySearchForm layout="bar" />}>
          <SearchBar searchParams={searchParams} />
        </Suspense>
      </div>
      <Suspense fallback={<ResultsSkeleton />}>
        <Results searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function SearchBar({ searchParams }: { searchParams: SP }) {
  const raw = normalize(await searchParams);
  const parsed = parse(await searchParams);
  const initial: Partial<StaySearch> = parsed.success
    ? parsed.data
    : {
        place: raw.place,
        checkin: raw.checkin,
        checkout: raw.checkout,
        adults: Number(raw.adults) || undefined,
        children: Number(raw.children) || undefined,
        rooms: Number(raw.rooms) || undefined,
      };
  return <StaySearchForm layout="bar" initial={initial} />;
}

function ResultsSkeleton() {
  return (
    <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1fr)_26rem]" aria-busy="true" aria-label="Loading stays">
      <ul>
        {Array.from({ length: 4 }, (_, i) => (
          <li key={i} className="grid gap-4 border-b border-line py-6 sm:grid-cols-[18rem_1fr]">
            <Skeleton className="aspect-[3/2]" />
            <div className="space-y-3">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-6 w-2/3" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          </li>
        ))}
      </ul>
      <Skeleton className="hidden h-[32rem] lg:block" />
    </div>
  );
}

async function Results({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const raw = normalize(sp);
  const parsed = parse(sp);

  if (!parsed.success) {
    return <MissingInput raw={raw} issues={parsed.error.issues.map((i) => i.message)} />;
  }
  const params = parsed.data;

  let result: StaySearchResult;
  try {
    result = await searchStays(params, { source: "web" });
  } catch (err) {
    console.error("searchStays failed", err);
    return (
      <Notice tone="bad" title="We could not load stays just now" className="mt-6">
        <p>This is on our side. Try again in a minute.</p>
        <p className="mt-2">
          <a className="link" href={`/stays/search?${toQuery(raw)}`}>
            Try again
          </a>
        </p>
      </Notice>
    );
  }

  if (!result.place) return <UnknownPlace place={params.place} />;

  const session = await getSession().catch(() => null);
  const saved = session ? await savedListingIds(session.user.id, result.results.map((r) => r.id)) : new Set<string>();
  const pageCount = Math.ceil(result.total / result.pageSize);
  const baseQuery = { ...raw, page: undefined };
  const hrefFor = (p: number) => `/stays/search?${toQuery({ ...baseQuery, page: p > 1 ? p : undefined })}`;
  const returnTo = `/stays/search?${toQuery(raw)}`;
  const nights = result.results[0]?.nights ?? 0;
  const guests = params.adults + params.children;

  const points: MapPoint[] = result.results.map((r) => ({
    id: r.id,
    lat: r.lat,
    lng: r.lng,
    label: formatMoney({ amount: r.perNight, currency: r.currency }),
    title: r.title,
    href: r.url,
  }));

  const detailQuery = toQuery({ checkin: params.checkin, checkout: params.checkout, adults: params.adults, children: params.children || undefined, rooms: params.rooms > 1 ? params.rooms : undefined });

  return (
    <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1fr)_26rem]">
      <div className="min-w-0">
        <h2 className="text-2xl">
          Stays in {result.place.name}
          <span className="mt-1 block text-base font-semibold tracking-normal text-slate">
            {dayLabel(params.checkin)} to {dayLabel(params.checkout)}, {plural(guests, "guest")}
            {params.rooms > 1 ? `, ${params.rooms} rooms` : ""}
          </span>
        </h2>
        <div className="mt-4">
          <SearchFilters params={params} facets={result.facets} total={result.total} />
        </div>

        {result.total === 0 ? (
          <NoResults params={params} placeName={result.place.name} placeSlug={result.place.slug} raw={raw} />
        ) : (
          <>
            <details className="mt-4 lg:hidden">
              <summary className="inline-flex h-10 cursor-pointer list-none items-center rounded-md border border-line-strong bg-surface px-3 text-sm font-semibold hover:border-ink [&::-webkit-details-marker]:hidden">
                Show map
              </summary>
              <StayMap points={points} center={result.place} label={`Map of stays in ${result.place.name}`} className="mt-3 h-80" rowIdPrefix="stay-" />
            </details>
            <ol className="mt-6" aria-label={`Stays in ${result.place.name}, page ${result.page} of ${pageCount}`}>
              {result.results.map((r, i) => (
                <StayRow
                  key={r.id}
                  rowId={`stay-${r.id}`}
                  priority={i === 0}
                  href={`${r.url}?${detailQuery}&unit=${encodeURIComponent(r.unitId)}`}
                  action={<SaveButton listingId={r.id} title={r.title} initialSaved={saved.has(r.id)} returnTo={returnTo} />}
                  data={{
                    id: r.id,
                    url: r.url,
                    title: r.title,
                    summary: r.summary,
                    propertyType: r.propertyType,
                    // Distance reads well for a town; for a whole state or island it would mislead.
                    where: r.distanceKm !== null && result.place?.slug && (result.place.radiusKm ?? 99) <= 30 && r.city !== result.place.name ? `${r.city}, ${r.distanceKm} km from ${result.place.name}` : r.city,
                    photo: r.photo,
                    ratingAvg: r.ratingAvg,
                    ratingCount: r.ratingCount,
                    isDemo: r.isDemo,
                    freeCancellation: r.freeCancellation,
                    instantBook: r.instantBook,
                    facts: [`Sleeps ${r.maxGuests}`, plural(r.bedrooms, "bedroom")],
                    currency: r.currency,
                    price: r.perNight,
                    priceNote: "a night",
                    priceDetail: `${formatMoney({ amount: r.total, currency: r.currency })} for ${plural(nights, "night")}, with taxes and fees`,
                  }}
                />
              ))}
            </ol>
            <Pagination page={result.page} pageCount={pageCount} hrefFor={hrefFor} />
          </>
        )}
      </div>

      {result.total > 0 && (
        <aside className="hidden lg:block" aria-label="Map">
          <div className="sticky top-20 h-[calc(100dvh-6rem)]">
            <StayMap points={points} center={result.place} label={`Map of stays in ${result.place.name}`} className="h-full" rowIdPrefix="stay-" />
          </div>
        </aside>
      )}
    </div>
  );
}

async function NoResults({ params, placeName, placeSlug, raw }: { params: StaySearch; placeName: string; placeSlug: string | null; raw: Record<string, string> }) {
  const filters = activeFilterCount(params);
  if (filters > 0) {
    const unfiltered = await searchStays(
      { ...params, minPrice: undefined, maxPrice: undefined, types: undefined, amenities: undefined, freeCancellation: undefined, instantBook: undefined, minRating: undefined, page: 1 },
      { source: "web" },
    ).catch(() => null);
    const clear = `/stays/search?${toQuery({ place: raw.place, checkin: raw.checkin, checkout: raw.checkout, adults: raw.adults, children: raw.children, rooms: raw.rooms })}`;
    return (
      <EmptyState
        title="No stays match these filters"
        action={
          unfiltered && unfiltered.total > 0 ? (
            <ButtonLink href={clear} variant="secondary">
              Clear filters to see {plural(unfiltered.total, "stay")}
            </ButtonLink>
          ) : undefined
        }
      >
        {unfiltered && unfiltered.total > 0
          ? `Without filters, ${plural(unfiltered.total, "stay")} in ${placeName} ${unfiltered.total === 1 ? "is" : "are"} free for these dates.`
          : `No stays in ${placeName} are free for these dates, even without filters. Try other dates.`}
      </EmptyState>
    );
  }
  return (
    <EmptyState
      title={`No stays in ${placeName} are free for these dates`}
      action={
        placeSlug ? (
          <ButtonLink href={`/stays/${placeSlug}`} variant="secondary">
            See all stays in {placeName}
          </ButtonLink>
        ) : undefined
      }
    >
      Try moving your dates by a day or two, or fewer guests per room. Places that are fully booked or closed by the owner on any of your nights are left out.
    </EmptyState>
  );
}

async function UnknownPlace({ place }: { place: string }) {
  const suggestions = await suggestPlaces(place.split(",")[0], 6).catch(() => []);
  const fallback = suggestions.length ? suggestions : await suggestPlaces("", 8).catch(() => []);
  return (
    <EmptyState
      className="border-t-0 pt-8"
      title={`We could not find "${place}"`}
      action={
        fallback.length > 0 ? (
          <ul className="flex flex-wrap gap-2">
            {fallback.map((s) => (
              <li key={s.slug}>
                <Link href={`/stays/${s.slug}`} className="inline-flex h-10 items-center rounded-full border border-line-strong bg-surface px-4 text-sm font-semibold hover:border-ink">
                  {s.name}
                </Link>
              </li>
            ))}
          </ul>
        ) : undefined
      }
    >
      Check the spelling, or pick one of these places.
    </EmptyState>
  );
}

async function MissingInput({ raw, issues }: { raw: Record<string, string>; issues: string[] }) {
  const place = raw.place ? await resolvePlace(raw.place).catch(() => null) : null;
  return (
    <div className="mt-6">
      <EmptyState
        className="border-t-0 pt-2"
        title={raw.place ? "Add your dates to see prices" : "Where are you going?"}
        action={
          place?.slug ? (
            <ButtonLink href={`/stays/${place.slug}`} variant="secondary">
              See stays in {place.name}
            </ButtonLink>
          ) : undefined
        }
      >
        <p>Prices and availability depend on your dates, so pick check in and check out above.</p>
        {issues.length > 0 && raw.checkin && raw.checkout && <p className="mt-2 text-signal">{issues[0]}</p>}
      </EmptyState>
    </div>
  );
}
