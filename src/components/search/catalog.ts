import "server-only";
import { asc, desc, eq } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { cacheLife, cacheTag } from "next/cache";
import { db, schema } from "@/db";

/**
 * Read models for the home, /destinations and /routes pages. Cached for hours and tagged so the
 * seed scripts and the admin console can refresh them with revalidateTag("destinations") or
 * revalidateTag("routes"). A failed read is cached briefly and renders as an empty section.
 */

export type DestinationSummary = {
  slug: string;
  name: string;
  region: string | null;
  countryCode: string;
  countryName: string;
  featured: boolean;
};

export type RouteSummary = {
  slug: string;
  origin: { iata: string; city: string };
  destination: { iata: string; city: string };
};

export async function getDestinations(): Promise<DestinationSummary[]> {
  "use cache";
  cacheTag("destinations");
  try {
    const rows = await db
      .select({
        slug: schema.destinations.slug,
        name: schema.destinations.name,
        region: schema.destinations.region,
        countryCode: schema.destinations.countryCode,
        countryName: schema.destinations.countryName,
        featured: schema.destinations.featured,
      })
      .from(schema.destinations)
      .orderBy(desc(schema.destinations.featured), asc(schema.destinations.name));
    cacheLife("hours");
    return rows;
  } catch (err) {
    console.error("getDestinations failed", err);
    cacheLife("minutes");
    return [];
  }
}

export async function getRoutes(): Promise<RouteSummary[]> {
  "use cache";
  cacheTag("routes");
  const origin = alias(schema.airports, "origin_airport");
  const destination = alias(schema.airports, "destination_airport");
  try {
    const rows = await db
      .select({
        slug: schema.routes.slug,
        originIata: origin.iata,
        originCity: origin.city,
        destinationIata: destination.iata,
        destinationCity: destination.city,
      })
      .from(schema.routes)
      .innerJoin(origin, eq(schema.routes.origin, origin.iata))
      .innerJoin(destination, eq(schema.routes.destination, destination.iata))
      .orderBy(desc(origin.popularity), asc(origin.city), desc(destination.popularity), asc(destination.city));
    cacheLife("hours");
    return rows.map((r) => ({
      slug: r.slug,
      origin: { iata: r.originIata, city: r.originCity },
      destination: { iata: r.destinationIata, city: r.destinationCity },
    }));
  } catch (err) {
    console.error("getRoutes failed", err);
    cacheLife("minutes");
    return [];
  }
}

/** Groups rows by a key, keeping first-seen order. */
export function groupBy<T>(rows: T[], key: (row: T) => string): [string, T[]][] {
  const map = new Map<string, T[]>();
  for (const row of rows) {
    const k = key(row);
    const list = map.get(k);
    if (list) list.push(row);
    else map.set(k, [row]);
  }
  return [...map.entries()];
}
