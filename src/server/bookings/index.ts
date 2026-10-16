import "server-only";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { bookings, flightBookings, listings, listingUnits, stayBookings, type Passenger, type PriceLine } from "@/db/schema";
import { isISODate, nightsBetween } from "@/lib/dates";
import { newId, newReference, newToken } from "@/lib/id";
import { getFlightProvider, getOffer } from "@/server/flights";
import { OfferExpiredError, type Offer } from "@/server/flights/types";
import { holdInventory, quoteStay } from "@/server/stays/inventory";
import { expireHoldsForUnit } from "./expiry";
import type { Tx } from "./transitions";
import { BookingError, type CreatedBooking, type CreateFlightBookingInput, type CreateStayBookingInput } from "./types";

export { BookingError } from "./types";

/** How long a booking holds inventory (or a fare) while the traveler pays. */
export const HOLD_MINUTES = 20;

const contactSchema = z.object({
  name: z.string().trim().min(1, "Enter the name for the booking.").max(120),
  email: z.string().trim().toLowerCase().email("Enter a valid email address.").max(254),
  phone: z
    .string()
    .trim()
    .max(32)
    .regex(/^[+0-9 ()-]*$/, "Enter a valid phone number.")
    .optional()
    .transform((v) => v || undefined),
});

const isoDate = z.string().refine(isISODate, "Use a date like 2026-10-24.");

const staySchema = z
  .object({
    userId: z.string().min(1).nullable(),
    contact: contactSchema,
    listingId: z.string().min(1).max(64),
    unitId: z.string().min(1).max(64),
    checkIn: isoDate,
    checkOut: isoDate,
    adults: z.number().int().min(1).max(32),
    children: z.number().int().min(0).max(32),
    units: z.number().int().min(1).max(20),
    guestNote: z.string().trim().max(1000).optional(),
  })
  .refine((v) => v.checkOut > v.checkIn, { message: "Check out must be after check in.", path: ["checkOut"] });

const passengerSchema = z.object({
  id: z.string().min(1).max(128),
  type: z.enum(["adult", "child", "infant_without_seat"]),
  title: z.enum(["mr", "ms", "mrs", "miss", "dr"]),
  givenName: z.string().trim().min(1).max(60),
  familyName: z.string().trim().min(1).max(60),
  bornOn: isoDate,
  gender: z.enum(["m", "f"]),
  email: z.string().trim().email().max(254),
  phone: z.string().trim().min(5).max(32).regex(/^\+?[0-9 ()-]+$/),
});

const flightSchema = z.object({
  userId: z.string().min(1).nullable(),
  contact: contactSchema,
  offerId: z.string().min(1).max(128),
  passengers: z.array(passengerSchema).min(1).max(9),
});

function invalid(error: z.ZodError): never {
  throw new BookingError("invalid", error.issues[0]?.message ?? "Check the booking details and try again.");
}

function payUrl(bookingId: string, accessToken: string) {
  return `/checkout/${bookingId}?token=${encodeURIComponent(accessToken)}`;
}

/** Every receipt carries a zero platform fee line. Add it if the quote left it out; never accept a non zero one. */
function withFeeLine(lines: PriceLine[]): PriceLine[] {
  const fee = lines.filter((l) => l.kind === "fee");
  if (fee.some((l) => l.amount !== 0)) throw new BookingError("invalid", "This price includes a fee, which we never charge. Contact support.");
  return fee.length ? lines : [...lines, { label: "Platform fee", amount: 0, kind: "fee" }];
}

function isUniqueViolation(err: unknown, constraint?: string): boolean {
  const e = err as { code?: string; constraint_name?: string; constraint?: string; cause?: unknown };
  if (e?.code === "23505") return !constraint || e.constraint_name === constraint || e.constraint === constraint;
  return e?.cause ? isUniqueViolation(e.cause, constraint) : false;
}

function isRetryableTxError(err: unknown): boolean {
  const e = err as { code?: string; cause?: unknown };
  if (e?.code === "40P01" || e?.code === "40001") return true;
  return e?.cause ? isRetryableTxError(e.cause) : false;
}

/** Inserts the booking header, retrying the reference on the rare unique collision (inside a savepoint). */
async function insertBookingRow(tx: Tx, values: Omit<typeof bookings.$inferInsert, "reference">) {
  for (let attempt = 0; attempt < 6; attempt++) {
    const reference = newReference();
    try {
      await tx.transaction(async (sp) => {
        await sp.insert(bookings).values({ ...values, reference });
      });
      return reference;
    } catch (err) {
      if (isUniqueViolation(err, "bookings_reference_unique")) continue;
      throw err;
    }
  }
  throw new Error("Could not generate a unique booking reference.");
}

async function withRetry<T>(fn: () => Promise<T>) {
  try {
    return await fn();
  } catch (err) {
    // Two travelers racing for the last room can deadlock on inventory rows; Postgres aborts one. Try once more.
    if (isRetryableTxError(err)) return fn();
    throw err;
  }
}

/**
 * CONTRACT (owned by the bookings and payments workstream).
 *
 * createStayBooking: re-quotes on the server, holds inventory and inserts bookings + stay_bookings
 * in one transaction with status "pending_payment" and a 20 minute expiry. Returns the pay URL
 * (/checkout/<bookingId>?token=<accessToken>). Throws BookingError.
 */
export async function createStayBooking(input: CreateStayBookingInput): Promise<CreatedBooking> {
  const parsed = staySchema.safeParse(input);
  if (!parsed.success) invalid(parsed.error);
  const v = parsed.data;
  const nights = nightsBetween(v.checkIn, v.checkOut);

  return withRetry(() =>
    db.transaction(async (tx) => {
      const [row] = await tx
        .select({ listing: listings, unit: listingUnits })
        .from(listingUnits)
        .innerJoin(listings, eq(listings.id, listingUnits.listingId))
        .where(and(eq(listingUnits.id, v.unitId), eq(listings.id, v.listingId)))
        .limit(1);
      if (!row) throw new BookingError("not_found", "We could not find that place to stay.");
      const { listing, unit } = row;
      if (listing.status !== "published" || listing.kind !== "stay" || !unit.active) {
        throw new BookingError("unavailable", "This place is not taking bookings right now.");
      }
      if (v.adults + v.children > unit.maxGuests * v.units) {
        throw new BookingError("invalid", `This room sleeps up to ${unit.maxGuests} ${unit.maxGuests === 1 ? "guest" : "guests"}. Add a room or reduce the number of guests.`);
      }
      if (nights < listing.minNights) throw new BookingError("invalid", `This place needs a stay of at least ${listing.minNights} ${listing.minNights === 1 ? "night" : "nights"}.`);
      if (nights > listing.maxNights) throw new BookingError("invalid", `This place takes stays of up to ${listing.maxNights} nights.`);

      // Release holds on this unit whose payment window has passed, so they do not block this booking.
      await expireHoldsForUnit(tx, v.unitId);

      const quote = await quoteStay(
        { listingId: v.listingId, unitId: v.unitId, checkIn: v.checkIn, checkOut: v.checkOut, adults: v.adults, children: v.children, units: v.units },
        tx,
      );
      if (!quote.available) throw new BookingError("unavailable", quote.reason);
      if (!Number.isInteger(quote.total) || quote.total <= 0) throw new BookingError("invalid", "This stay could not be priced. Try other dates.");

      const held = await holdInventory(tx, { unitId: v.unitId, checkIn: v.checkIn, checkOut: v.checkOut, units: v.units });
      if (!held) throw new BookingError("unavailable", "Those dates were just booked. Try other dates or another room.");

      const id = newId("bkg");
      const accessToken = newToken();
      const reference = await insertBookingRow(tx, {
        id,
        kind: "stay",
        status: "pending_payment",
        userId: v.userId,
        contactName: v.contact.name,
        contactEmail: v.contact.email,
        contactPhone: v.contact.phone ?? null,
        currency: quote.currency,
        total: quote.total,
        priceLines: withFeeLine(quote.lines),
        expiresAt: new Date(Date.now() + HOLD_MINUTES * 60_000),
        accessToken,
        meta: { nightly: quote.nightly },
      });
      await tx.insert(stayBookings).values({
        bookingId: id,
        listingId: listing.id,
        unitId: unit.id,
        hostId: listing.hostId,
        checkIn: v.checkIn,
        checkOut: v.checkOut,
        nights: quote.nights,
        units: v.units,
        adults: v.adults,
        children: v.children,
        guestNote: v.guestNote || null,
        cancellationPolicy: listing.cancellationPolicy,
      });
      return { bookingId: id, reference, accessToken, payUrl: payUrl(id, accessToken) };
    }),
  );
}

/** Age in whole years on a date, from "YYYY-MM-DD" strings. */
export function ageOn(bornOn: string, on: string) {
  const [by, bm, bd] = bornOn.split("-").map(Number);
  const [y, m, d] = on.split("-").map(Number);
  return y - by - (m < bm || (m === bm && d < bd) ? 1 : 0);
}

/** Checks passengers against the offer: same ids, each once, and a type that fits their age on the last flight. */
export function validatePassengers(offer: Pick<Offer, "passengerIds" | "slices">, passengers: z.infer<typeof passengerSchema>[]) {
  const expected = new Set(offer.passengerIds);
  const seen = new Set<string>();
  for (const p of passengers) {
    if (!expected.has(p.id)) throw new BookingError("invalid", "The passenger list does not match this fare. Search again and reselect the flight.");
    if (seen.has(p.id)) throw new BookingError("invalid", "A passenger appears twice.");
    seen.add(p.id);
  }
  if (seen.size !== expected.size) throw new BookingError("invalid", `This fare is for ${expected.size} ${expected.size === 1 ? "passenger" : "passengers"}. Add details for everyone.`);

  const first = (offer.slices[0]?.departAt ?? "").slice(0, 10);
  const last = (offer.slices[offer.slices.length - 1]?.departAt ?? first).slice(0, 10);
  for (const p of passengers) {
    const name = `${p.givenName} ${p.familyName}`;
    if (first && p.bornOn > first) throw new BookingError("invalid", `Check the date of birth for ${name}.`);
    const age = last ? ageOn(p.bornOn, last) : null;
    if (age == null) continue;
    if (p.type === "adult" && ageOn(p.bornOn, first) < 12) throw new BookingError("invalid", `${name} is under 12, so book them as a child.`);
    if (p.type === "child" && (age < 2 || ageOn(p.bornOn, first) >= 12)) throw new BookingError("invalid", `${name} does not fit the child fare (ages 2 to 11). Check their date of birth.`);
    if (p.type === "infant_without_seat" && age >= 2) throw new BookingError("invalid", `${name} turns 2 before the last flight, so they need their own seat.`);
  }
  const adults = passengers.filter((p) => p.type === "adult").length;
  const infants = passengers.filter((p) => p.type === "infant_without_seat").length;
  if (adults === 0) throw new BookingError("invalid", "At least one adult must travel.");
  if (infants > adults) throw new BookingError("invalid", "Each infant on a lap needs an adult.");
}

/** Airline times come without an offset. Store them as if UTC; the slices snapshot keeps the local wall clock. */
function airlineTime(local: string) {
  return new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(local) ? local : `${local}Z`);
}

/**
 * CONTRACT. Re-fetches the offer from the provider for a fresh price, inserts bookings + flight_bookings
 * with status "pending_payment". The airline order is created only after payment is captured.
 */
export async function createFlightBooking(input: CreateFlightBookingInput): Promise<CreatedBooking> {
  const parsed = flightSchema.safeParse(input);
  if (!parsed.success) invalid(parsed.error);
  const v = parsed.data;

  if (!getFlightProvider()) throw new BookingError("not_configured", "Flight booking is not connected yet.");

  let offer: Offer;
  try {
    offer = await getOffer(v.offerId);
  } catch (err) {
    if (err instanceof OfferExpiredError) throw new BookingError("offer_expired", err.message);
    throw err;
  }
  const offerExpires = new Date(offer.expiresAt);
  if (!(offerExpires.getTime() > Date.now())) throw new BookingError("offer_expired", "This fare is no longer available. Search again to see current fares.");
  if (!Number.isInteger(offer.total) || offer.total <= 0 || !offer.slices.length) throw new BookingError("invalid", "This fare could not be priced. Search again.");

  validatePassengers(offer, v.passengers);

  const holdEnds = new Date(Math.min(Date.now() + HOLD_MINUTES * 60_000, offerExpires.getTime()));
  const priceLines: PriceLine[] = [
    { label: "Airline fare", amount: offer.baseAmount, kind: "base" },
    { label: "Taxes and airline charges", amount: offer.taxAmount, kind: "tax" },
  ];
  const linesSum = offer.baseAmount + offer.taxAmount;
  if (linesSum !== offer.total) priceLines.push({ label: "Other airline charges", amount: offer.total - linesSum, kind: "other" });
  priceLines.push({ label: "Platform fee", amount: 0, kind: "fee" });

  const passengers: Passenger[] = v.passengers.map((p) => ({ ...p }));
  const first = offer.slices[0];
  const last = offer.slices[offer.slices.length - 1];

  const id = newId("bkg");
  const accessToken = newToken();
  const reference = await db.transaction(async (tx) => {
    const ref = await insertBookingRow(tx, {
      id,
      kind: "flight",
      status: "pending_payment",
      userId: v.userId,
      contactName: v.contact.name,
      contactEmail: v.contact.email,
      contactPhone: v.contact.phone ?? null,
      currency: offer.currency,
      total: offer.total,
      priceLines,
      expiresAt: holdEnds,
      accessToken,
      meta: { offerExpiresAt: offer.expiresAt, owner: offer.owner },
    });
    await tx.insert(flightBookings).values({
      bookingId: id,
      provider: offer.provider,
      offerId: offer.id,
      origin: first.origin.iata,
      destination: first.destination.iata,
      departAt: airlineTime(first.departAt),
      returnAt: offer.slices.length > 1 ? airlineTime(last.departAt) : null,
      slices: offer.slices,
      passengers,
      conditions: offer.conditions,
      providerTotal: offer.total,
      providerCurrency: offer.currency,
    });
    return ref;
  });
  return { bookingId: id, reference, accessToken, payUrl: payUrl(id, accessToken) };
}
