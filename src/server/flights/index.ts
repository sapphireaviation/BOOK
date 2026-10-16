import "server-only";
import { site } from "@/config/site";
import { flightSearchSchema, type FlightSearch } from "@/lib/search-params";
import { suggestAirports, type AirportSuggestion } from "./airports";
import { DuffelProvider } from "./duffel";
import { applyFilters, computeFacets, sortOffers } from "./filters";
import { FixtureProvider } from "./fixture";
import { logFlightSearch } from "./search-log";
import { FlightsNotConfiguredError, type FlightProvider, type Offer, type SearchResult } from "./types";

export type { AirportSuggestion };

let cached: { key: string; provider: FlightProvider | null } | undefined;

/**
 * CONTRACT (flights workstream). Returns null when no provider is configured.
 *
 * Duffel when DUFFEL_ACCESS_TOKEN is set. Otherwise the fixture provider, but only when
 * FLIGHTS_PROVIDER=fixture and NODE_ENV is not production, so synthetic fares can never reach real users.
 */
export function getFlightProvider(): FlightProvider | null {
  const token = process.env.DUFFEL_ACCESS_TOKEN?.trim();
  const useFixture = process.env.FLIGHTS_PROVIDER === "fixture" && process.env.NODE_ENV !== "production";
  const key = token ? `duffel:${token}` : useFixture ? "fixture" : "none";
  if (cached?.key === key) return cached.provider;
  const provider = token ? new DuffelProvider(token, site.defaultCurrency) : useFixture ? new FixtureProvider() : null;
  cached = { key, provider };
  return provider;
}

/** CONTRACT. Searches, applies result filters and sort from `params`, logs to search_log. */
export async function searchFlights(params: FlightSearch, opts?: { source?: "web" | "api" | "mcp" }): Promise<SearchResult> {
  const search = flightSearchSchema.parse(params);
  const provider = getFlightProvider();
  if (!provider) throw new FlightsNotConfiguredError();

  const result = await provider.search(search);
  await logFlightSearch(search, result.offers, { source: opts?.source ?? "web", provider: provider.name, currency: result.currency });

  const filtered = applyFilters(result.offers, search);
  return {
    ...result,
    provider: result.provider ?? provider.name,
    offers: sortOffers(filtered, search.sort),
    facets: computeFacets(result.offers),
  };
}

/** CONTRACT. Fresh offer from the provider. */
export async function getOffer(offerId: string): Promise<Offer> {
  const provider = getFlightProvider();
  if (!provider) throw new FlightsNotConfiguredError();
  return provider.getOffer(offerId);
}

/** CONTRACT. Airport autocomplete by IATA code, city or name. Backs GET /api/v1/airports?q=. */
export async function searchAirports(q: string, limit = 8): Promise<AirportSuggestion[]> {
  return suggestAirports(q, Math.max(1, Math.min(20, limit)));
}
