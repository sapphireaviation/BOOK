import "server-only";
import { z } from "zod";
import { amenityKeys } from "@/lib/amenities";

/** Form inputs arrive as strings. These schemas trim, coerce and give errors people can act on. */

const text = (max: number, label: string) => z.string().trim().max(max, `${label} can be up to ${max} characters.`);
const optionalText = (max: number, label: string) =>
  text(max, label)
    .optional()
    .transform((v) => (v ? v : null));
const int = (label: string, min: number, max: number) =>
  z.coerce
    .number({ error: `Enter a number for ${label.toLowerCase()}.` })
    .int(`${label} must be a whole number.`)
    .min(min, `${label} must be at least ${min}.`)
    .max(max, `${label} can be at most ${max}.`);
const checkbox = z
  .union([z.literal("on"), z.literal("true"), z.literal("false"), z.literal("")])
  .optional()
  .transform((v) => v === "on" || v === "true");

export const propertyTypes = ["hotel", "guesthouse", "homestay", "apartment", "house", "villa", "hostel", "resort", "cabin", "other"] as const;
export const cancellationPolicies = ["flexible", "moderate", "strict", "non_refundable"] as const;

/** Currencies a host can price in. Kept short so every option formats well. */
export const supportedCurrencies = ["INR", "USD", "EUR", "GBP", "AED", "SGD", "THB", "LKR", "NPR", "IDR", "JPY", "AUD"] as const;

export const newListingSchema = z.object({
  title: text(120, "Title").min(3, "Give the place a name of at least 3 characters."),
  propertyType: z.enum(propertyTypes, { error: "Choose a property type." }),
});

export const basicsSchema = z.object({
  title: text(120, "Title").min(3, "Give the place a name of at least 3 characters."),
  propertyType: z.enum(propertyTypes, { error: "Choose a property type." }),
  summary: text(280, "Summary"),
  description: text(8000, "Description"),
  maxGuests: int("Guests", 1, 500),
  bedrooms: int("Bedrooms", 0, 500),
  beds: int("Beds", 0, 1000),
  bathrooms: z.coerce
    .number({ error: "Enter a number for bathrooms." })
    .min(0, "Bathrooms cannot be negative.")
    .max(500, "Bathrooms can be at most 500.")
    .refine((n) => Number.isInteger(n * 2), "Use whole or half numbers, like 1 or 1.5."),
});

export const locationSchema = z.object({
  addressLine: optionalText(200, "Address"),
  locality: optionalText(120, "Area"),
  city: text(120, "City").min(1, "Enter the town or city."),
  region: optionalText(120, "State or region"),
  postalCode: optionalText(20, "Postal code"),
  countryCode: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{2}$/, "Choose a country."),
  lat: z
    .string()
    .trim()
    .min(1, "Place the pin on the map.")
    .pipe(z.coerce.number<string>({ error: "Enter the latitude as a number." }).min(-90, "Latitude must be between -90 and 90.").max(90, "Latitude must be between -90 and 90.")),
  lng: z
    .string()
    .trim()
    .min(1, "Place the pin on the map.")
    .pipe(z.coerce.number<string>({ error: "Enter the longitude as a number." }).min(-180, "Longitude must be between -180 and 180.").max(180, "Longitude must be between -180 and 180.")),
  destinationSlug: optionalText(120, "Destination"),
});

export const amenitiesSchema = z.object({
  amenities: z.array(z.string()).transform((list) => [...new Set(list)].filter((k) => amenityKeys.includes(k))),
});

const time = (label: string) => z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, `Enter ${label} as a 24 hour time, like 14:00.`);

export const policiesSchema = z
  .object({
    cancellationPolicy: z.enum(cancellationPolicies, { error: "Choose a cancellation policy." }),
    checkInFrom: time("check in"),
    checkOutUntil: time("check out"),
    houseRules: text(4000, "House rules"),
    minNights: int("Minimum nights", 1, 365),
    maxNights: int("Maximum nights", 1, 365),
    instantBook: checkbox,
    cleaningFee: z.string().default(""),
    taxPercent: z.string().default(""),
    contactPhone: optionalText(40, "Phone"),
    contactEmail: z
      .string()
      .trim()
      .max(200)
      .optional()
      .transform((v) => (v ? v : null))
      .pipe(z.email("Enter a valid email address.").nullable()),
  })
  .refine((v) => v.maxNights >= v.minNights, { path: ["maxNights"], message: "Maximum nights must be at least the minimum." });

export const currencySchema = z.object({
  currency: z.enum(supportedCurrencies, { error: "Choose a currency from the list." }),
});

export const unitSchema = z
  .object({
    name: text(120, "Room name").min(2, "Name the room, for example Garden room or Whole house."),
    description: text(2000, "Description"),
    maxGuests: int("Guests", 1, 100),
    beds: text(120, "Beds"),
    basePrice: z.string(),
    extraGuestPrice: z.string().default(""),
    includedGuests: int("Guests included in the price", 1, 100),
    quantity: int("Number of identical rooms", 1, 1000),
    active: checkbox,
  })
  .refine((v) => v.includedGuests <= v.maxGuests, { path: ["includedGuests"], message: "Guests included cannot be more than the room sleeps." });

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose dates on the calendar.");

export const calendarSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("price"), from: isoDate, to: isoDate, price: z.string() }),
  z.object({ kind: z.literal("reset_price"), from: isoDate, to: isoDate }),
  z.object({ kind: z.literal("close"), from: isoDate, to: isoDate }),
  z.object({ kind: z.literal("open"), from: isoDate, to: isoDate }),
  z.object({ kind: z.literal("total"), from: isoDate, to: isoDate, total: z.string() }),
]);

export const photoAltSchema = z.object({ alt: text(200, "Description") });

export const profileSchema = z.object({
  displayName: text(80, "Display name").min(2, "Enter the name guests will see."),
  about: text(2000, "About"),
  languages: text(300, "Languages"),
  payoutMethod: optionalText(60, "Payout method"),
  payoutReference: optionalText(200, "Payout details"),
  taxId: optionalText(40, "Tax ID"),
});

/** Flattens zod issues into one message per field, first issue wins. */
export function fieldErrors(error: z.ZodError) {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}
