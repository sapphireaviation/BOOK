import { z } from "zod";
import { amenityKeys } from "../../lib/amenities";
import { cabinClasses } from "../../lib/search-params";

/**
 * The intermediate shape both parsers produce. The rule parser and the model
 * both fill an Intent; `finishIntent` then resolves places, applies dates to
 * the right fields and describes what was understood. Keeping one shape means
 * the two paths cannot drift apart in how they build search URLs.
 *
 * This file has no server-only import so the pure parts stay unit testable.
 */

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const propertyTypes = ["hotel", "guesthouse", "homestay", "apartment", "house", "villa", "hostel", "resort", "cabin"] as const;

export const intentSchema = z.object({
  kind: z.enum(["flight", "stay", "unknown"]),
  /** City, airport name or IATA code the traveler leaves from. */
  origin: z.string().min(1).max(80).optional(),
  /** City, airport, region or area the traveler is going to or staying in. */
  destination: z.string().min(1).max(80).optional(),
  /** First date: departure for flights, check in for stays. */
  start: isoDate.optional(),
  /** Second date: return flight or check out. */
  end: isoDate.optional(),
  nights: z.number().int().min(1).max(60).optional(),
  oneWay: z.boolean().optional(),
  roundTrip: z.boolean().optional(),
  adults: z.number().int().min(1).max(16).optional(),
  children: z.number().int().min(0).max(10).optional(),
  infants: z.number().int().min(0).max(4).optional(),
  cabin: z.enum(cabinClasses).optional(),
  maxStops: z.number().int().min(0).max(2).optional(),
  departWindow: z.enum(["early", "morning", "afternoon", "evening"]).optional(),
  /** Major units (rupees, dollars), converted to minor units when the search is built. */
  minPrice: z.number().positive().max(10_000_000).optional(),
  maxPrice: z.number().positive().max(10_000_000).optional(),
  currency: z.string().length(3).optional(),
  sort: z.enum(["cheap", "luxury", "fast", "rating", "early"]).optional(),
  amenities: z.array(z.enum(amenityKeys as [string, ...string[]])).max(12).optional(),
  types: z.array(z.enum(propertyTypes)).max(5).optional(),
  freeCancellation: z.boolean().optional(),
  instantBook: z.boolean().optional(),
  minRating: z.number().min(0).max(5).optional(),
});

export type Intent = z.infer<typeof intentSchema>;
