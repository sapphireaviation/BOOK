import "server-only";
import { sql } from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";
import { db } from "@/db";
import { slugify } from "@/lib/slug";

/**
 * Read models for sitemaps and the llms.txt files. Each query tolerates an
 * empty or unreachable database by returning an empty list, so the SEO
 * surface still renders the static pages on a fresh install.
 */

/** Destination pages need at least this many published listings to be indexed (docs/SEO_AND_AI.md: no thin pages). */
export const MIN_LISTINGS_FOR_DESTINATION = 3;

/** Listings per sitemap file. Google allows 50,000; staying lower keeps each file small. */
export const LISTINGS_PER_SITEMAP = 40_000;

export type SeoDestination = { slug: string; name: string; region: string | null; countryName: string; listings: number; fromPrice: number | null; currency: string | null; updatedAt: string };
export type SeoRoute = { slug: string; origin: string; destination: string; originCity: string; destinationCity: string; updatedAt: string };
export type SeoListing = { path: string; updatedAt: string };

async function safely<T>(label: string, fn: () => Promise<T[]>): Promise<T[]> {
  try {
    return await fn();
  } catch (err) {
    console.warn(`[seo] ${label} unavailable:`, err instanceof Error ? err.message : err);
    return [];
  }
}

const iso = (d: unknown) => (d instanceof Date ? d.toISOString() : new Date(String(d)).toISOString());

export async function getIndexableDestinations(limit = 5000): Promise<SeoDestination[]> {
  "use cache";
  cacheLife("hours");
  cacheTag("seo", "destinations");
  return safely("destinations", async () => {
    const rows = await db.execute<{
      slug: string;
      name: string;
      region: string | null;
      country_name: string;
      listings: string;
      from_price: string | null;
      currency: string | null;
      updated_at: Date | string;
    }>(sql`
      select d.slug, d.name, d.region, d.country_name,
             count(l.id) as listings,
             min(nullif(l.from_price, 0)) as from_price,
             min(l.currency) as currency,
             greatest(d.updated_at, coalesce(max(l.updated_at), d.updated_at)) as updated_at
      from destinations d
      join listings l on l.destination_slug = d.slug and l.status = 'published' and l.kind = 'stay'
      group by d.slug
      having count(l.id) >= ${MIN_LISTINGS_FOR_DESTINATION}
      order by count(l.id) desc, d.name
      limit ${limit}`);
    return rows.map((r) => ({
      slug: r.slug,
      name: r.name,
      region: r.region,
      countryName: r.country_name,
      listings: Number(r.listings),
      fromPrice: r.from_price === null ? null : Number(r.from_price),
      currency: r.currency,
      updatedAt: iso(r.updated_at),
    }));
  });
}

export async function getRoutes(limit = 5000): Promise<SeoRoute[]> {
  "use cache";
  cacheLife("hours");
  cacheTag("seo", "routes");
  return safely("routes", async () => {
    const rows = await db.execute<{ slug: string; origin: string; destination: string; origin_city: string; destination_city: string; updated_at: Date | string }>(sql`
      select r.slug, r.origin, r.destination, o.city as origin_city, t.city as destination_city, r.updated_at
      from flight_routes r
      join airports o on o.iata = r.origin
      join airports t on t.iata = r.destination
      order by (o.popularity + t.popularity) desc, r.slug
      limit ${limit}`);
    return rows.map((r) => ({
      slug: r.slug,
      origin: r.origin,
      destination: r.destination,
      originCity: r.origin_city,
      destinationCity: r.destination_city,
      updatedAt: iso(r.updated_at),
    }));
  });
}

export async function countPublishedListings(): Promise<number> {
  "use cache";
  cacheLife("hours");
  cacheTag("seo", "listings");
  const [row] = await safely("listing count", async () =>
    db.execute<{ n: string }>(sql`select count(*) as n from listings where status = 'published' and kind = 'stay'`),
  );
  return row ? Number(row.n) : 0;
}

/** One sitemap chunk of published listings, oldest id first so chunks stay stable. */
export async function getListingPaths(chunk: number): Promise<SeoListing[]> {
  "use cache";
  cacheLife("hours");
  cacheTag("seo", "listings");
  return safely("listings", async () => {
    const rows = await db.execute<{ slug: string; destination_slug: string | null; city: string; updated_at: Date | string }>(sql`
      select slug, destination_slug, city, updated_at from listings
      where status = 'published' and kind = 'stay'
      order by id
      offset ${chunk * LISTINGS_PER_SITEMAP} limit ${LISTINGS_PER_SITEMAP}`);
    return rows.map((r) => ({ path: `/stays/${r.destination_slug ?? slugify(r.city)}/${r.slug}`, updatedAt: iso(r.updated_at) }));
  });
}
