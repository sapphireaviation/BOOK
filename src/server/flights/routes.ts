import "server-only";
import { and, asc, eq, gte, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { cacheLife, cacheTag } from "next/cache";
import { db } from "@/db";
import { airports, routes, searchLog } from "@/db/schema";
import type { FlightLogQuery } from "./search-log";

/** Popular routes with SEO pages (`flight_routes`, seeded by scripts/seed/routes.ts). */

export type RouteAirport = {
  iata: string;
  name: string;
  city: string;
  countryCode: string;
  countryName: string;
  lat: number;
  lng: number;
  timeZone: string | null;
};

export type FlightRoute = {
  slug: string;
  group: string | null;
  origin: RouteAirport;
  destination: RouteAirport;
  updatedAt: string;
};

const o = alias(airports, "origin_airport");
const d = alias(airports, "destination_airport");

const airportCols = (t: typeof o | typeof d) => ({
  iata: t.iata,
  name: t.name,
  city: t.city,
  countryCode: t.countryCode,
  countryName: t.countryName,
  lat: t.lat,
  lng: t.lng,
  timeZone: t.timeZone,
});

function baseQuery() {
  return db
    .select({ slug: routes.slug, facts: routes.facts, updatedAt: routes.updatedAt, origin: airportCols(o), destination: airportCols(d) })
    .from(routes)
    .innerJoin(o, eq(routes.origin, o.iata))
    .innerJoin(d, eq(routes.destination, d.iata));
}

function toRoute(r: Awaited<ReturnType<typeof baseQuery>>[number]): FlightRoute {
  const group = typeof r.facts?.group === "string" ? r.facts.group : null;
  return { slug: r.slug, group, origin: r.origin, destination: r.destination, updatedAt: r.updatedAt.toISOString() };
}

export async function listRoutes(): Promise<FlightRoute[]> {
  "use cache";
  cacheLife("hours");
  cacheTag("flight-routes");
  const rows = await baseQuery().orderBy(asc(routes.slug));
  return rows.map(toRoute);
}

export async function getRoute(slug: string): Promise<FlightRoute | null> {
  "use cache";
  cacheLife("hours");
  cacheTag("flight-routes", `route:${slug}`);
  const [row] = await baseQuery().where(eq(routes.slug, slug)).limit(1);
  return row ? toRoute(row) : null;
}

export async function findRouteSlugByCodes(origin: string, destination: string): Promise<string | null> {
  "use cache";
  cacheLife("hours");
  cacheTag("flight-routes");
  const [row] = await db
    .select({ slug: routes.slug })
    .from(routes)
    .where(and(eq(routes.origin, origin.toUpperCase()), eq(routes.destination, destination.toUpperCase())))
    .limit(1);
  return row?.slug ?? null;
}

export type RouteSearchFacts = {
  /** Airlines that sold offers on this route in searches over the window, most often seen first. */
  carriers: { iata: string; name: string; searches: number }[];
  cheapest: { amount: number; currency: string; depart: string; searchedAt: string } | null;
  searches: number;
  windowDays: number;
};

const FACT_WINDOW_DAYS = 90;

/**
 * Facts from real searches only: rows logged by the fixture provider are skipped, so test data
 * can never show up on a public page. Returns empty facts when nothing has been searched.
 */
export async function getRouteSearchFacts(origin: string, destination: string): Promise<RouteSearchFacts> {
  "use cache";
  cacheLife("hours");
  cacheTag(`route-facts:${origin}-${destination}`);
  const since = sql`now() - make_interval(days => ${FACT_WINDOW_DAYS})`;
  const rows = await db
    .select({ query: searchLog.query, cheapest: searchLog.cheapest, createdAt: searchLog.createdAt })
    .from(searchLog)
    .where(
      and(
        eq(searchLog.kind, "flight"),
        gte(searchLog.createdAt, since),
        sql`${searchLog.query}->>'from' = ${origin}`,
        sql`${searchLog.query}->>'to' = ${destination}`,
        sql`coalesce(${searchLog.query}->>'provider', '') not in ('', 'fixture')`,
        sql`${searchLog.resultCount} > 0`,
      ),
    )
    .limit(5000);

  const carriers = new Map<string, { iata: string; name: string; searches: number }>();
  let cheapest: RouteSearchFacts["cheapest"] = null;
  const today = new Date().toISOString().slice(0, 10);
  for (const r of rows) {
    const q = r.query as Partial<FlightLogQuery>;
    for (const [iata, name] of q.carriers ?? []) {
      const c = carriers.get(iata);
      if (c) c.searches++;
      else carriers.set(iata, { iata, name, searches: 1 });
    }
    // Lowest fare for one adult in economy, one way, for a date that has not passed yet.
    const comparable = q.adults === 1 && !q.children && !q.infants && q.cabin === "economy" && !q.return;
    if (comparable && r.cheapest !== null && q.currency && q.depart && q.depart >= today) {
      if (!cheapest || (q.currency === cheapest.currency && r.cheapest < cheapest.amount)) {
        cheapest = { amount: r.cheapest, currency: q.currency, depart: q.depart, searchedAt: r.createdAt.toISOString() };
      }
    }
  }
  return {
    carriers: [...carriers.values()].sort((a, b) => b.searches - a.searches || a.name.localeCompare(b.name)),
    cheapest,
    searches: rows.length,
    windowDays: FACT_WINDOW_DAYS,
  };
}
