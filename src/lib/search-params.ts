import { z } from "zod";
import { isISODate } from "./dates";

/**
 * URL contracts for search pages. Both the site and the public API use these,
 * so a link an assistant builds is the same link a person would share.
 *
 * Flights: /flights/search?from=DEL&to=GOI&depart=2026-10-24&return=2026-10-27&adults=1&children=0&infants=0&cabin=economy
 * Stays:   /stays/search?place=goa&checkin=2026-10-24&checkout=2026-10-27&adults=2&children=0&rooms=1
 */

const isoDate = z.string().refine(isISODate, "Use a date like 2026-10-24");
const count = (min: number, max: number, dflt: number) => z.coerce.number().int().min(min).max(max).default(dflt);

export const cabinClasses = ["economy", "premium_economy", "business", "first"] as const;
export type CabinClass = (typeof cabinClasses)[number];

export const flightSearchSchema = z
  .object({
    from: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/, "Pick a departure airport"),
    to: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/, "Pick an arrival airport"),
    depart: isoDate,
    return: isoDate.optional(),
    adults: count(1, 9, 1),
    children: count(0, 8, 0),
    infants: count(0, 4, 0),
    cabin: z.enum(cabinClasses).default("economy"),
    // Result filters, applied after search
    stops: z.coerce.number().int().min(0).max(2).optional(), // max stops
    airlines: z.string().optional(), // comma separated IATA codes
    maxPrice: z.coerce.number().int().positive().optional(), // minor units
    departWindow: z.enum(["early", "morning", "afternoon", "evening"]).optional(),
    sort: z.enum(["price", "duration", "depart"]).default("price"),
  })
  .refine((v) => v.from !== v.to, { message: "Departure and arrival must be different", path: ["to"] })
  .refine((v) => !v.return || v.return >= v.depart, { message: "Return must be on or after departure", path: ["return"] })
  .refine((v) => v.infants <= v.adults, { message: "Each infant needs an adult", path: ["infants"] });

export type FlightSearch = z.infer<typeof flightSearchSchema>;

export const staySearchSchema = z
  .object({
    /** Destination slug, or free text that the server resolves to a destination or coordinates. */
    place: z.string().trim().min(1, "Where are you going?").max(120),
    checkin: isoDate,
    checkout: isoDate,
    adults: count(1, 16, 2),
    children: count(0, 10, 0),
    rooms: count(1, 8, 1),
    // Filters
    minPrice: z.coerce.number().int().nonnegative().optional(), // per night, minor units
    maxPrice: z.coerce.number().int().positive().optional(),
    types: z.string().optional(), // comma separated property types
    amenities: z.string().optional(), // comma separated amenity keys
    freeCancellation: z.coerce.boolean().optional(),
    instantBook: z.coerce.boolean().optional(),
    minRating: z.coerce.number().min(0).max(5).optional(),
    sort: z.enum(["recommended", "price_asc", "price_desc", "rating"]).default("recommended"),
    page: z.coerce.number().int().min(1).max(50).default(1),
  })
  .refine((v) => v.checkout > v.checkin, { message: "Check out must be after check in", path: ["checkout"] });

export type StaySearch = z.infer<typeof staySearchSchema>;

/** Turns a search object back into a query string, dropping empty and default values. */
export function toQuery(params: Record<string, unknown>) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === "" || v === false) continue;
    qs.set(k, String(v));
  }
  return qs.toString();
}

/** Reads Next.js searchParams (string | string[]) into a flat record. */
export function flatten(sp: Record<string, string | string[] | undefined>) {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(sp)) if (v !== undefined) out[k] = Array.isArray(v) ? v[0] : v;
  return out;
}
