import "server-only";
import { sql } from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";
import { db } from "@/db";
import { toMajor, toMinor } from "@/lib/money";
import { listingPath } from "./paths";
import { FREE_CANCELLATION_POLICIES } from "./search";

export type DestinationSummary = {
  slug: string;
  name: string;
  region: string | null;
  countryCode: string;
  countryName: string;
  listingCount: number;
  fromPrice: number | null;
  currency: string | null;
};

/** Every destination with its count of published stays and lowest base price. Backs the /stays landing page. */
export async function listDestinations(): Promise<DestinationSummary[]> {
  "use cache";
  cacheLife("hours");
  cacheTag("destinations", "listings");

  const rows = await db.execute<{
    slug: string;
    name: string;
    region: string | null;
    country_code: string;
    country_name: string;
    listing_count: number;
    from_price: string | null;
    currency: string | null;
  }>(sql`
    select d.slug, d.name, d.region, d.country_code, d.country_name,
           count(l.id)::int as listing_count,
           min(l.from_price)::text as from_price,
           mode() within group (order by l.currency) as currency
    from destinations d
    left join listings l on l.destination_slug = d.slug and l.status = 'published' and l.kind = 'stay'
    group by d.slug
    order by (d.country_code = 'IN') desc, count(l.id) desc, d.featured desc, d.name
  `);
  return rows.map((r) => ({
    slug: r.slug,
    name: r.name,
    region: r.region,
    countryCode: r.country_code,
    countryName: r.country_name,
    listingCount: Number(r.listing_count),
    fromPrice: r.from_price === null ? null : Number(r.from_price),
    currency: r.currency,
  }));
}

export type PlaceListing = {
  id: string;
  slug: string;
  url: string;
  title: string;
  summary: string;
  propertyType: string;
  locality: string | null;
  city: string;
  lat: number;
  lng: number;
  maxGuests: number;
  bedrooms: number;
  currency: string;
  fromPrice: number;
  ratingAvg: number;
  ratingCount: number;
  instantBook: boolean;
  freeCancellation: boolean;
  isDemo: boolean;
  photo: { url: string; alt: string } | null;
};

export type PlaceStats = {
  count: number;
  /** Price figures are for listings in this currency, the most common one in the place. */
  currency: string | null;
  priceMin: number | null;
  priceMax: number | null;
  priceAvg: number | null;
  types: Record<string, number>;
  freeCancellation: number;
  instantBook: number;
  ratedListings: number;
  reviewCount: number;
  ratingAvg: number | null;
};

export type PlacePage = {
  slug: string;
  name: string;
  region: string | null;
  countryCode: string;
  countryName: string | null;
  lat: number;
  lng: number;
  summary: string | null;
  /** False when the place comes from listing cities rather than a curated destination. */
  curated: boolean;
  airports: { code: string; name: string | null }[];
  listings: PlaceListing[];
  stats: PlaceStats;
  /** "2026-10": the month the figures were computed. */
  asOf: string;
  updatedAt: string;
};

type ListingRow = {
  id: string;
  slug: string;
  title: string;
  summary: string;
  property_type: string;
  locality: string | null;
  city: string;
  destination_slug: string | null;
  lat: number;
  lng: number;
  max_guests: number;
  bedrooms: number;
  currency: string;
  from_price: number;
  instant_book: boolean;
  cancellation_policy: string;
  is_demo: boolean;
  country_code: string;
  updated_at: string;
  review_count: number;
  review_avg: number | null;
  photo: { url: string; alt: string } | null;
};

const MAX_LISTINGS = 60;

/** Computes the place facts from its listings. Pure. */
export function computePlaceStats(rows: Pick<PlaceListing, "currency" | "fromPrice" | "propertyType" | "freeCancellation" | "instantBook" | "ratingAvg" | "ratingCount">[]): PlaceStats {
  const byCurrency = new Map<string, number>();
  for (const r of rows) byCurrency.set(r.currency, (byCurrency.get(r.currency) ?? 0) + 1);
  const currency = [...byCurrency.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] ?? null;
  const prices = rows.filter((r) => r.currency === currency && r.fromPrice > 0).map((r) => r.fromPrice);
  const types: Record<string, number> = {};
  for (const r of rows) types[r.propertyType] = (types[r.propertyType] ?? 0) + 1;
  const rated = rows.filter((r) => r.ratingCount > 0);
  const reviewCount = rated.reduce((s, r) => s + r.ratingCount, 0);
  return {
    count: rows.length,
    currency,
    priceMin: prices.length ? Math.min(...prices) : null,
    priceMax: prices.length ? Math.max(...prices) : null,
    // Rounded to a whole major unit so it reads as a price ("₹4,067", not "₹4,066.67").
    priceAvg: prices.length && currency ? toMinor(Math.round(toMajor(prices.reduce((s, p) => s + p, 0) / prices.length, currency)), currency) : null,
    types,
    freeCancellation: rows.filter((r) => r.freeCancellation).length,
    instantBook: rows.filter((r) => r.instantBook).length,
    ratedListings: rated.length,
    reviewCount,
    ratingAvg: reviewCount ? Math.round((rated.reduce((s, r) => s + r.ratingAvg * r.ratingCount, 0) / reviewCount) * 10) / 10 : null,
  };
}

const SLUG_OF_CITY = sql`trim(both '-' from lower(regexp_replace(l.city, '[^a-zA-Z0-9]+', '-', 'g')))`;

/**
 * A destination page: the curated destination, or failing that a city that has published listings
 * without a destination. Null when neither exists. Cached and tagged `destination:<slug>` plus each listing.
 */
export async function getPlacePage(slug: string): Promise<PlacePage | null> {
  "use cache";
  cacheLife("hours");
  cacheTag(`destination:${slug}`, "listings");

  if (!/^[a-z0-9-]{1,80}$/.test(slug)) return null;

  const [dest] = await db.execute<{
    slug: string;
    name: string;
    region: string | null;
    country_code: string;
    country_name: string;
    lat: number;
    lng: number;
    summary: string | null;
    nearest_airports: string[];
    updated_at: string;
  }>(sql`select slug, name, region, country_code, country_name, lat, lng, summary, nearest_airports, to_char(updated_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as updated_at from destinations where slug = ${slug}`);

  const where = dest ? sql`l.destination_slug = ${slug}` : sql`l.destination_slug is null and ${SLUG_OF_CITY} = ${slug}`;

  const rows = await db.execute<ListingRow>(sql`
    select l.id, l.slug, l.title, l.summary, l.property_type, l.locality, l.city, l.destination_slug, l.lat, l.lng,
           l.max_guests, l.bedrooms, l.currency, l.instant_book, l.cancellation_policy, l.is_demo, l.country_code, to_char(l.updated_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as updated_at,
           coalesce((select min(u.base_price) from listing_units u where u.listing_id = l.id and u.active), l.from_price) as from_price,
           coalesce(r.n, 0)::int as review_count, r.avg as review_avg,
           (select json_build_object('url', p.url, 'alt', p.alt) from listing_photos p
              where p.listing_id = l.id order by p.position, p.id limit 1) as photo
    from listings l
    left join lateral (select count(*) as n, avg(rating)::float8 as avg from reviews where listing_id = l.id) r on true
    where l.status = 'published' and l.kind = 'stay' and ${where}
    order by l.is_demo asc, coalesce(r.n, 0) desc, l.title
    limit ${MAX_LISTINGS}::int
  `);

  if (!dest && rows.length === 0) return null;
  for (const r of rows.slice(0, 100)) cacheTag(`listing:${r.id}`);

  const listingsOut: PlaceListing[] = rows.map((r) => ({
    id: r.id,
    slug: r.slug,
    url: listingPath(r),
    title: r.title,
    summary: r.summary,
    propertyType: r.property_type,
    locality: r.locality,
    city: r.city,
    lat: Number(r.lat),
    lng: Number(r.lng),
    maxGuests: r.max_guests,
    bedrooms: r.bedrooms,
    currency: r.currency,
    fromPrice: Number(r.from_price),
    ratingAvg: r.review_avg === null ? 0 : Math.round(Number(r.review_avg) * 10) / 10,
    ratingCount: Number(r.review_count),
    instantBook: r.instant_book,
    freeCancellation: (FREE_CANCELLATION_POLICIES as readonly string[]).includes(r.cancellation_policy),
    isDemo: r.is_demo,
    photo: r.photo,
  }));

  let airports: { code: string; name: string | null }[] = [];
  if (dest?.nearest_airports?.length) {
    const named = await db.execute<{ iata: string; name: string }>(
      sql`select iata, name from airports where iata in (${sql.join(
        dest.nearest_airports.map((c) => sql`${c}`),
        sql`, `,
      )})`,
    );
    const names = new Map(named.map((a) => [a.iata, a.name]));
    airports = dest.nearest_airports.map((code) => ({ code, name: names.get(code) ?? null }));
  }

  const first = rows[0];
  const lastUpdate = [dest?.updated_at, ...rows.map((r) => r.updated_at)].filter(Boolean).sort().at(-1)!;

  return {
    slug,
    name: dest?.name ?? first.city,
    region: dest?.region ?? null,
    countryCode: dest?.country_code ?? first.country_code,
    countryName: dest?.country_name ?? null,
    lat: dest ? Number(dest.lat) : listingsOut.reduce((s, l) => s + l.lat, 0) / listingsOut.length,
    lng: dest ? Number(dest.lng) : listingsOut.reduce((s, l) => s + l.lng, 0) / listingsOut.length,
    summary: dest?.summary ?? null,
    curated: Boolean(dest),
    airports,
    listings: listingsOut,
    stats: computePlaceStats(listingsOut),
    asOf: new Date().toISOString().slice(0, 7),
    updatedAt: lastUpdate,
  };
}
