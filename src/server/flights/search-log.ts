import "server-only";
import { db } from "@/db";
import { searchLog } from "@/db/schema";
import { newId } from "@/lib/id";
import type { FlightSearch } from "@/lib/search-params";
import type { Offer } from "./types";

/**
 * Shape of search_log.query for kind "flight". Route pages read `carriers` and `cheapest` back,
 * and skip rows from the fixture provider so synthetic data never becomes a published fact.
 */
export type FlightLogQuery = {
  from: string;
  to: string;
  depart: string;
  return: string | null;
  adults: number;
  children: number;
  infants: number;
  cabin: string;
  currency: string;
  provider: string;
  /** Airlines that sold offers in this search: [IATA code, name]. */
  carriers: [string, string][];
};

export function buildLogEntry(search: FlightSearch, offers: Offer[], meta: { provider: string; currency: string }) {
  const carriers = new Map<string, string>();
  for (const o of offers) carriers.set(o.owner.iata, o.owner.name);
  const sameCurrency = offers.filter((o) => o.currency === meta.currency);
  const query: FlightLogQuery = {
    from: search.from,
    to: search.to,
    depart: search.depart,
    return: search.return ?? null,
    adults: search.adults,
    children: search.children,
    infants: search.infants,
    cabin: search.cabin,
    currency: meta.currency,
    provider: meta.provider,
    carriers: [...carriers.entries()].sort((a, b) => a[0].localeCompare(b[0])),
  };
  return {
    query,
    resultCount: offers.length,
    cheapest: sameCurrency.length ? Math.min(...sameCurrency.map((o) => o.total)) : null,
  };
}

/** Records the search. A logging failure is reported and swallowed so the traveler still gets results. */
export async function logFlightSearch(
  search: FlightSearch,
  offers: Offer[],
  meta: { source: "web" | "api" | "mcp"; provider: string; currency: string },
) {
  try {
    const entry = buildLogEntry(search, offers, meta);
    const insert = db.insert(searchLog).values({ id: newId("srch"), kind: "flight", source: meta.source, ...entry });
    // Never hold results back for more than two seconds because the log is slow.
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error("search_log insert timed out")), 2000);
    });
    try {
      await Promise.race([insert, timeout]);
    } finally {
      clearTimeout(timer);
    }
  } catch (err) {
    console.error("search_log insert failed", err);
  }
}
