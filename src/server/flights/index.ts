import "server-only";
import type { FlightSearch } from "@/lib/search-params";
import type { FlightProvider, Offer, SearchResult } from "./types";

export type AirportSuggestion = { iata: string; name: string; city: string; countryCode: string; countryName: string };

/** CONTRACT (flights workstream). Returns null when no provider is configured. */
export function getFlightProvider(): FlightProvider | null {
  return null;
}

/** CONTRACT. Searches, applies result filters and sort from `params`, logs to search_log. */
export async function searchFlights(params: FlightSearch, opts?: { source?: "web" | "api" | "mcp" }): Promise<SearchResult> {
  void params;
  void opts;
  throw new Error("searchFlights not implemented");
}

/** CONTRACT. Fresh offer from the provider. */
export async function getOffer(offerId: string): Promise<Offer> {
  void offerId;
  throw new Error("getOffer not implemented");
}

/** CONTRACT. Airport autocomplete by IATA code, city or name. Backs GET /api/v1/airports?q=. */
export async function searchAirports(q: string, limit = 8): Promise<AirportSuggestion[]> {
  void q;
  void limit;
  throw new Error("searchAirports not implemented");
}
