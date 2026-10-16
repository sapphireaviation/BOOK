import "server-only";
import type { FlightSearch } from "@/lib/search-params";
import { departWindowOf, localDate, localMinutes } from "@/lib/flight-time";
import type { AirlineFacet, Offer, SearchFacets } from "./types";

export type ResultFilters = Pick<FlightSearch, "stops" | "airlines" | "maxPrice" | "departWindow">;
export type SortKey = FlightSearch["sort"];

/** The most stops on any slice of the offer. */
export function maxStops(offer: Offer) {
  return offer.slices.reduce((m, s) => Math.max(m, s.stops), 0);
}

export function totalDuration(offer: Offer) {
  return offer.slices.reduce((m, s) => m + s.durationMinutes, 0);
}

export function parseAirlines(value: string | undefined) {
  return (value ?? "")
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter((s) => /^[A-Z0-9]{2}$/.test(s));
}

/** Filters apply to the outbound slice for time of day, and to every slice for stops. */
export function applyFilters(offers: Offer[], f: ResultFilters) {
  const airlines = new Set(parseAirlines(f.airlines));
  return offers.filter((o) => {
    if (f.stops !== undefined && maxStops(o) > f.stops) return false;
    if (airlines.size && !airlines.has(o.owner.iata)) return false;
    if (f.maxPrice !== undefined && o.total > f.maxPrice) return false;
    if (f.departWindow && o.slices[0] && departWindowOf(o.slices[0].departAt) !== f.departWindow) return false;
    return true;
  });
}

function departKey(o: Offer) {
  const s = o.slices[0];
  return s ? `${localDate(s.departAt)}T${String(localMinutes(s.departAt)).padStart(4, "0")}` : "";
}

/** Stable sort with sensible tie breakers: price, then duration, then departure time. */
export function sortOffers(offers: Offer[], sort: SortKey) {
  const byPrice = (a: Offer, b: Offer) => a.total - b.total;
  const byDuration = (a: Offer, b: Offer) => totalDuration(a) - totalDuration(b);
  const byDepart = (a: Offer, b: Offer) => departKey(a).localeCompare(departKey(b));
  const chain =
    sort === "duration" ? [byDuration, byPrice, byDepart] : sort === "depart" ? [byDepart, byPrice, byDuration] : [byPrice, byDuration, byDepart];
  return offers
    .map((o, i) => ({ o, i }))
    .sort((a, b) => {
      for (const cmp of chain) {
        const d = cmp(a.o, b.o);
        if (d) return d;
      }
      return a.i - b.i;
    })
    .map((x) => x.o);
}

export function computeFacets(offers: Offer[]): SearchFacets {
  const airlines = new Map<string, AirlineFacet>();
  const stops = new Map<number, { stops: number; count: number; cheapest: number }>();
  let minPrice: number | null = null;
  let maxPrice: number | null = null;
  for (const o of offers) {
    const a = airlines.get(o.owner.iata);
    if (a) {
      a.count++;
      a.cheapest = Math.min(a.cheapest, o.total);
    } else airlines.set(o.owner.iata, { iata: o.owner.iata, name: o.owner.name, logoUrl: o.owner.logoUrl ?? null, count: 1, cheapest: o.total });
    const n = Math.min(2, maxStops(o));
    const s = stops.get(n);
    if (s) {
      s.count++;
      s.cheapest = Math.min(s.cheapest, o.total);
    } else stops.set(n, { stops: n, count: 1, cheapest: o.total });
    minPrice = minPrice === null ? o.total : Math.min(minPrice, o.total);
    maxPrice = maxPrice === null ? o.total : Math.max(maxPrice, o.total);
  }
  return {
    airlines: [...airlines.values()].sort((a, b) => b.count - a.count || a.cheapest - b.cheapest || a.name.localeCompare(b.name)),
    stops: [...stops.values()].sort((a, b) => a.stops - b.stops),
    minPrice,
    maxPrice,
    total: offers.length,
  };
}

/**
 * Price caps for the max price control: four steps between the cheapest and dearest result,
 * rounded up to a tidy amount (multiples of 500 in the major unit for two decimal currencies).
 */
export function priceSteps(min: number | null, max: number | null, minorPerMajor = 100) {
  if (min === null || max === null || max <= min) return [];
  const unit = 500 * minorPerMajor;
  const steps = new Set<number>();
  for (const f of [0.15, 0.35, 0.6, 0.85]) {
    const v = Math.ceil((min + (max - min) * f) / unit) * unit;
    if (v > min && v < max) steps.add(v);
  }
  return [...steps].sort((a, b) => a - b);
}
