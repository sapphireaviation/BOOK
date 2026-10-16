import "server-only";
import { and, asc, eq, sql, type SQL } from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";
import { db } from "@/db";
import { listingPhotos, listings, listingUnits, searchLog } from "@/db/schema";
import { amenityKeys } from "@/lib/amenities";
import { nightsBetween } from "@/lib/dates";
import { newId } from "@/lib/id";
import type { StaySearch } from "@/lib/search-params";
import { slugify } from "@/lib/slug";
import { listingPath } from "./paths";
import type { PlaceSuggestion, StayCard, StaySearchResult } from "./types";

export const PAGE_SIZE = 20;

/** Policies that give a full refund up to some point before check in. */
export const FREE_CANCELLATION_POLICIES = ["flexible", "moderate"] as const;

const PROPERTY_TYPES = ["hotel", "guesthouse", "homestay", "apartment", "house", "villa", "hostel", "resort", "cabin", "other"];

export type ResolvedPlace = {
  slug: string | null;
  name: string;
  lat: number;
  lng: number;
  radiusKm: number;
  /** Set when the place matched listing cities rather than a destination: listings are matched by city. */
  city: string | null;
};

function escapeLike(s: string) {
  return s.replace(/[\\%_]/g, (c) => `\\${c}`);
}

/**
 * Turns the `place` parameter into a point and radius: a destination slug first, then a destination
 * name, then the city of published listings. Returns null when nothing matches.
 */
export async function resolvePlace(place: string): Promise<ResolvedPlace | null> {
  const raw = place.trim();
  if (!raw) return null;
  const term = raw.split(",")[0].trim();
  const slugs = [...new Set([slugify(raw), slugify(term)].filter(Boolean))];

  const rows = await db.execute<{ slug: string; name: string; lat: number; lng: number; radius_km: number; rank: number }>(sql`
    select slug, name, lat, lng, radius_km,
      case
        when slug in (${sql.join(slugs.map((s) => sql`${s}`), sql`, `)}) then 0
        when lower(name) = lower(${term}) then 1
        else 2
      end as rank
    from destinations
    where slug in (${sql.join(slugs.map((s) => sql`${s}`), sql`, `)})
       or lower(name) = lower(${term})
       ${term.length >= 3 ? sql`or name ilike ${`${escapeLike(term)}%`}` : sql``}
    order by rank, length(name), name
    limit 1
  `);
  const d = rows[0];
  if (d) return { slug: d.slug, name: d.name, lat: Number(d.lat), lng: Number(d.lng), radiusKm: Number(d.radius_km), city: null };

  const cities = await db.execute<{ city: string; lat: number; lng: number }>(sql`
    select min(city) as city, avg(lat) as lat, avg(lng) as lng
    from listings
    where status = 'published' and kind = 'stay' and lower(city) = lower(${term})
    group by lower(city)
    limit 1
  `);
  const c = cities[0];
  if (c) return { slug: null, name: c.city, lat: Number(c.lat), lng: Number(c.lng), radiusKm: 30, city: c.city };
  return null;
}

function list(values: string[]) {
  return sql.join(
    values.map((v) => sql`${v}`),
    sql`, `,
  );
}

function splitCsv(s: string | undefined, allowed: readonly string[]) {
  if (!s) return [];
  const ok = new Set(allowed);
  return [...new Set(s.split(",").map((v) => v.trim()).filter((v) => ok.has(v)))];
}

function haversineKm(lat: number, lng: number): SQL {
  return sql`(2 * 6371 * asin(sqrt(
    power(sin(radians(l.lat - ${lat}::float8) / 2), 2) +
    cos(radians(${lat}::float8)) * cos(radians(l.lat)) * power(sin(radians(l.lng - ${lng}::float8) / 2), 2)
  )))`;
}

type Row = {
  id: string;
  slug: string;
  title: string;
  summary: string;
  property_type: string;
  city: string;
  region: string | null;
  country_code: string;
  lat: number;
  lng: number;
  destination_slug: string | null;
  rating_avg: number;
  rating_count: number;
  max_guests: number;
  bedrooms: number;
  amenities: string[];
  instant_book: boolean;
  cancellation_policy: string;
  currency: string;
  is_demo: boolean;
  unit_id: string;
  total: number;
  per_night: number;
  distance_km: number | null;
  photo: { url: string; alt: string } | null;
};

/** CONTRACT (stays workstream). Used by /stays/search, /api/v1/search/stays and the MCP tool. */
export async function searchStays(params: StaySearch, opts?: { source?: "web" | "api" | "mcp" }): Promise<StaySearchResult> {
  const page = Math.max(1, Math.min(50, Math.trunc(params.page ?? 1)));
  const empty: StaySearchResult = {
    place: null,
    results: [],
    total: 0,
    page,
    pageSize: PAGE_SIZE,
    facets: { types: {}, priceMin: 0, priceMax: 0, currency: null },
  };

  const nights = nightsBetween(params.checkin, params.checkout);
  if (!(nights >= 1)) return empty;

  const place = await resolvePlace(params.place);
  if (!place) {
    await logSearch(params, opts?.source ?? "web", null, 0, null);
    return empty;
  }

  const rooms = params.rooms ?? 1;
  const guests = (params.adults ?? 1) + (params.children ?? 0);
  const distance = haversineKm(place.lat, place.lng);

  // Place filter: a bounding box first so the (lat, lng) index can help, then the exact distance.
  const latDelta = place.radiusKm / 111;
  const lngDelta = place.radiusKm / (111 * Math.max(0.05, Math.cos((place.lat * Math.PI) / 180)));
  const placeFilter = place.city
    ? sql`lower(l.city) = lower(${place.city})`
    : sql`l.lat between ${place.lat - latDelta}::float8 and ${place.lat + latDelta}::float8
          and l.lng between ${place.lng - lngDelta}::float8 and ${place.lng + lngDelta}::float8
          and ${distance} <= ${place.radiusKm}::float8`;

  const amenities = splitCsv(params.amenities, amenityKeys);
  const types = splitCsv(params.types, PROPERTY_TYPES);

  const listingFilters: SQL[] = [];
  if (amenities.length) listingFilters.push(sql`l.amenities @> array[${list(amenities)}]::text[]`);
  if (params.freeCancellation) listingFilters.push(sql`l.cancellation_policy::text in (${list([...FREE_CANCELLATION_POLICIES])})`);
  if (params.instantBook) listingFilters.push(sql`l.instant_book`);
  if (params.minRating) listingFilters.push(sql`l.rating_count > 0 and l.rating_avg >= ${params.minRating}::float8`);

  const resultFilters: SQL[] = [sql`true`];
  if (params.minPrice !== undefined) resultFilters.push(sql`per_night >= ${params.minPrice}::bigint`);
  if (params.maxPrice !== undefined) resultFilters.push(sql`per_night <= ${params.maxPrice}::bigint`);
  if (types.length) resultFilters.push(sql`property_type::text in (${list(types)})`);

  const order = {
    recommended: sql`is_demo asc, (rating_avg * rating_count + 7) / (rating_count + 2) desc, distance_km asc nulls last, id`,
    price_asc: sql`per_night asc, id`,
    price_desc: sql`per_night desc, id`,
    rating: sql`(rating_count > 0) desc, rating_avg desc, rating_count desc, per_night asc, id`,
  }[params.sort ?? "recommended"];

  const rows = await db.execute<{
    total: number;
    types: Record<string, number>;
    price_min: string | null;
    price_max: string | null;
    currency: string | null;
    cheapest: string | null;
    results: Row[];
  }>(sql`
    with nights as (
      select d::date as night
      from generate_series(${params.checkin}::date, ${params.checkout}::date - 1, interval '1 day') as d
    ),
    cand as (
      select l.id, l.slug, l.title, l.summary, l.property_type, l.city, l.region, l.country_code, l.lat, l.lng,
             l.destination_slug, l.rating_avg, l.rating_count, l.max_guests, l.bedrooms, l.amenities, l.instant_book,
             l.cancellation_policy, l.currency, l.is_demo, l.cleaning_fee, l.tax_bps,
             ${distance} as distance_km
      from listings l
      where l.status = 'published' and l.kind = 'stay'
        and ${placeFilter}
        and l.min_nights <= ${nights}::int and l.max_nights >= ${nights}::int
        ${listingFilters.length ? sql`and ${sql.join(listingFilters, sql` and `)}` : sql``}
    ),
    unit_nights as (
      select u.id as unit_id, u.listing_id,
             coalesce(ui.price, u.base_price) as price,
             coalesce(ui.total, u.quantity) - coalesce(ui.booked, 0) as free,
             coalesce(ui.closed, false) as closed
      from listing_units u
      join cand c on c.id = u.listing_id
      cross join nights n
      left join unit_inventory ui on ui.unit_id = u.id and ui.date = n.night
      where u.active and u.max_guests * ${rooms}::int >= ${guests}::int
    ),
    unit_ok as (
      select unit_id, listing_id, sum(price)::bigint as price_sum
      from unit_nights
      group by unit_id, listing_id
      having bool_and(not closed and free >= ${rooms}::int)
    ),
    priced as (
      select o.listing_id, o.unit_id,
             o.price_sum * ${rooms}::int
               + greatest(0, ${guests}::int - u.included_guests * ${rooms}::int)::bigint * u.extra_guest_price * ${nights}::int
               as room_total
      from unit_ok o
      join listing_units u on u.id = o.unit_id
    ),
    best as (
      select distinct on (listing_id) listing_id, unit_id, room_total
      from priced
      order by listing_id, room_total, unit_id
    ),
    matched as (
      select c.*, b.unit_id,
             b.room_total + c.cleaning_fee + (b.room_total * c.tax_bps + 5000) / 10000 as total,
             round(b.room_total::numeric / ${nights}::int)::bigint as per_night
      from cand c
      join best b on b.listing_id = c.id
    ),
    filtered as (
      select * from matched where ${sql.join(resultFilters, sql` and `)}
    ),
    page as (
      select f.*,
             row_number() over (order by ${order}) as ord,
             (select json_build_object('url', p.url, 'alt', p.alt)
                from listing_photos p where p.listing_id = f.id
                order by p.position, p.id limit 1) as photo
      from filtered f
      order by ${order}
      limit ${PAGE_SIZE}::int offset ${(page - 1) * PAGE_SIZE}::int
    )
    select
      (select count(*)::int from filtered) as total,
      (select coalesce(json_object_agg(t, n), '{}'::json)
         from (select property_type::text as t, count(*)::int as n from matched group by 1) x) as types,
      (select min(per_night)::text from matched) as price_min,
      (select max(per_night)::text from matched) as price_max,
      (select mode() within group (order by currency) from matched) as currency,
      (select min(total)::text from filtered) as cheapest,
      (select coalesce(json_agg(row_to_json(page) order by ord), '[]'::json) from page) as results
  `);

  const agg = rows[0];
  const results: StayCard[] = agg.results.map((r) => ({
    id: r.id,
    slug: r.slug,
    url: listingPath(r),
    title: r.title,
    summary: r.summary,
    propertyType: r.property_type,
    city: r.city,
    region: r.region,
    countryCode: r.country_code,
    lat: Number(r.lat),
    lng: Number(r.lng),
    photo: r.photo,
    ratingAvg: Number(r.rating_avg),
    ratingCount: Number(r.rating_count),
    maxGuests: r.max_guests,
    bedrooms: r.bedrooms,
    amenities: r.amenities ?? [],
    instantBook: r.instant_book,
    freeCancellation: (FREE_CANCELLATION_POLICIES as readonly string[]).includes(r.cancellation_policy),
    currency: r.currency,
    total: Number(r.total),
    perNight: Number(r.per_night),
    nights,
    unitId: r.unit_id,
    distanceKm: r.distance_km === null ? null : Math.round(Number(r.distance_km) * 10) / 10,
    isDemo: r.is_demo,
  }));

  const result: StaySearchResult = {
    place: { slug: place.slug, name: place.name, lat: place.lat, lng: place.lng, radiusKm: place.radiusKm },
    results,
    total: agg.total,
    page,
    pageSize: PAGE_SIZE,
    facets: {
      types: agg.types ?? {},
      priceMin: agg.price_min ? Number(agg.price_min) : 0,
      priceMax: agg.price_max ? Number(agg.price_max) : 0,
      currency: agg.currency,
    },
  };

  await logSearch(params, opts?.source ?? "web", place, agg.total, agg.cheapest ? Number(agg.cheapest) : null, agg.currency);
  return result;
}

/** Records the search for demand insight. Never fails the search. */
async function logSearch(
  params: StaySearch,
  source: string,
  place: ResolvedPlace | null,
  resultCount: number,
  cheapest: number | null,
  currency?: string | null,
) {
  try {
    await db.insert(searchLog).values({
      id: newId("srch"),
      kind: "stay",
      source,
      query: { ...params, placeSlug: place?.slug ?? null, placeName: place?.name ?? null, currency: currency ?? null },
      resultCount,
      cheapest,
    });
  } catch (err) {
    console.error("search_log insert failed", err);
  }
}

/** CONTRACT. Autocomplete for the place field. Backs GET /api/v1/places?q=. */
export async function suggestPlaces(q: string, limit = 8): Promise<PlaceSuggestion[]> {
  const term = q.trim().slice(0, 80);
  const n = Math.max(1, Math.min(20, Math.trunc(limit) || 8));
  const like = `${escapeLike(term)}%`;
  const termSlug = slugify(term);
  const wordLike = `% ${escapeLike(term)}%`;

  const rows = await db.execute<{ slug: string; name: string; region: string | null; country_name: string; listing_count: number }>(sql`
    select d.slug, d.name, d.region, d.country_name, count(l.id)::int as listing_count
    from destinations d
    left join listings l on l.destination_slug = d.slug and l.status = 'published' and l.kind = 'stay'
    ${
      term
        ? sql`where d.name ilike ${like} or d.name ilike ${wordLike} ${termSlug ? sql`or d.slug like ${`${escapeLike(termSlug)}%`}` : sql``}
                or d.region ilike ${like} or d.country_name ilike ${like}`
        : sql``
    }
    group by d.slug
    order by
      ${term ? sql`(lower(d.name) = lower(${term})) desc, (d.name ilike ${like}) desc,` : sql``}
      count(l.id) desc, d.featured desc, d.name
    limit ${n}::int
  `);

  return rows.map((r) => ({
    slug: r.slug,
    name: r.name,
    region: r.region,
    countryName: r.country_name,
    listingCount: Number(r.listing_count),
  }));
}

export type PublicListing = {
  id: string;
  slug: string;
  url: string;
  title: string;
  summary: string;
  description: string;
  propertyType: string;
  city: string;
  region: string | null;
  countryCode: string;
  lat: number;
  lng: number;
  photos: { url: string; alt: string }[];
  amenities: string[];
  maxGuests: number;
  bedrooms: number;
  beds: number;
  bathrooms: number;
  checkInFrom: string;
  checkOutUntil: string;
  cancellationPolicy: string;
  instantBook: boolean;
  currency: string;
  fromPrice: number;
  ratingAvg: number;
  ratingCount: number;
  units: { id: string; name: string; maxGuests: number; basePrice: number; beds: string }[];
  updatedAt: string;
};

/** CONTRACT. Published listing by slug, or null. Cached with tag `listing:<id>`. Used by API and MCP. */
export async function getListingPublic(slug: string): Promise<PublicListing | null> {
  "use cache";
  cacheLife("hours");
  cacheTag(`listing-slug:${slug}`);

  const [l] = await db
    .select()
    .from(listings)
    .where(and(eq(listings.slug, slug), eq(listings.status, "published"), eq(listings.kind, "stay")))
    .limit(1);
  if (!l) return null;
  cacheTag(`listing:${l.id}`);

  const [photos, units] = await Promise.all([
    db
      .select({ url: listingPhotos.url, alt: listingPhotos.alt })
      .from(listingPhotos)
      .where(eq(listingPhotos.listingId, l.id))
      .orderBy(asc(listingPhotos.position), asc(listingPhotos.id)),
    db
      .select({
        id: listingUnits.id,
        name: listingUnits.name,
        maxGuests: listingUnits.maxGuests,
        basePrice: listingUnits.basePrice,
        beds: listingUnits.beds,
      })
      .from(listingUnits)
      .where(and(eq(listingUnits.listingId, l.id), eq(listingUnits.active, true)))
      .orderBy(asc(listingUnits.position), asc(listingUnits.basePrice)),
  ]);

  return {
    id: l.id,
    slug: l.slug,
    url: listingPath({ slug: l.slug, destination_slug: l.destinationSlug, city: l.city }),
    title: l.title,
    summary: l.summary,
    description: l.description,
    propertyType: l.propertyType,
    city: l.city,
    region: l.region,
    countryCode: l.countryCode,
    lat: l.lat,
    lng: l.lng,
    photos,
    amenities: l.amenities,
    maxGuests: l.maxGuests,
    bedrooms: l.bedrooms,
    beds: l.beds,
    bathrooms: l.bathrooms,
    checkInFrom: l.checkInFrom.slice(0, 5),
    checkOutUntil: l.checkOutUntil.slice(0, 5),
    cancellationPolicy: l.cancellationPolicy,
    instantBook: l.instantBook,
    currency: l.currency,
    fromPrice: units.length ? Math.min(...units.map((u) => u.basePrice)) : l.fromPrice,
    ratingAvg: l.ratingAvg,
    ratingCount: l.ratingCount,
    units,
    updatedAt: l.updatedAt.toISOString(),
  };
}
