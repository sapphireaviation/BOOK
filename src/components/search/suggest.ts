/**
 * Client fetchers for the autocomplete endpoints built by the flights and stays workstreams.
 * Responses are validated before use. In development only, NEXT_PUBLIC_SEARCH_MOCKS=1 falls back
 * to a small local list when an endpoint is missing or down; production builds drop that code.
 */
import { z } from "zod";

const airportSchema = z.object({
  iata: z.string(),
  name: z.string(),
  city: z.string(),
  countryCode: z.string(),
  countryName: z.string(),
});

const placeSchema = z.object({
  slug: z.string(),
  name: z.string(),
  region: z.string().nullish(),
  countryName: z.string(),
  listingCount: z.number().optional(),
});

export type AirportSuggestion = z.infer<typeof airportSchema>;
export type PlaceSuggestion = z.infer<typeof placeSchema>;

const useMocks = process.env.NODE_ENV !== "production" && process.env.NEXT_PUBLIC_SEARCH_MOCKS === "1";

async function getList<T>(url: string, schema: z.ZodType<T>, signal?: AbortSignal): Promise<T[]> {
  const res = await fetch(url, { signal, headers: { accept: "application/json" } });
  if (!res.ok) throw new Error(`Request failed with ${res.status}`);
  const body: unknown = await res.json();
  // Accept a bare array or { data: [...] }.
  const list = Array.isArray(body) ? body : (body as { data?: unknown })?.data;
  return z.array(schema).parse(list);
}

function isAbort(err: unknown) {
  return err instanceof DOMException && err.name === "AbortError";
}

export async function suggestAirports(q: string, signal?: AbortSignal): Promise<AirportSuggestion[]> {
  try {
    return await getList(`/api/v1/airports?q=${encodeURIComponent(q)}`, airportSchema, signal);
  } catch (err) {
    if (useMocks && !isAbort(err)) return (await import("./dev-mocks")).mockAirports(q);
    throw err;
  }
}

export async function suggestPlaces(q: string, signal?: AbortSignal): Promise<PlaceSuggestion[]> {
  try {
    return await getList(`/api/v1/places?q=${encodeURIComponent(q)}`, placeSchema, signal);
  } catch (err) {
    if (useMocks && !isAbort(err)) return (await import("./dev-mocks")).mockPlaces(q);
    throw err;
  }
}

/** Looks up one airport by code, to show "Delhi" for a search that arrived as from=DEL. */
export async function findAirport(iata: string, signal?: AbortSignal) {
  const list = await suggestAirports(iata, signal);
  return list.find((a) => a.iata.toUpperCase() === iata.toUpperCase()) ?? null;
}

export async function findPlace(slug: string, signal?: AbortSignal) {
  const list = await suggestPlaces(slug.replace(/-/g, " "), signal);
  return list.find((p) => p.slug === slug) ?? null;
}
