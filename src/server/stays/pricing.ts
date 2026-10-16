import type { PriceLine } from "@/db/schema/bookings";
import { eachNight, isISODate, nightsBetween } from "@/lib/dates";
import { bps } from "@/lib/money";
import type { InventoryNight, PricingListing, PricingUnit, StayQuote } from "./types";

/** Largest stay we price in one go. Listings set their own lower `maxNights`. */
export const MAX_STAY_NIGHTS = 90;

export type GuestCounts = { adults: number; children: number; units: number };

type Unavailable = Extract<StayQuote, { available: false }>;

function no(reason: string): Unavailable {
  return { available: false, reason };
}

/** Checks the date pair itself, before any listing data is involved. Returns an error message or null. */
export function validateStayDates(checkIn: string, checkOut: string): string | null {
  if (!isISODate(checkIn) || !isISODate(checkOut)) return "Pick check in and check out dates.";
  const nights = nightsBetween(checkIn, checkOut);
  if (nights < 1) return "Check out must be after check in.";
  if (nights > MAX_STAY_NIGHTS) return `Stays are limited to ${MAX_STAY_NIGHTS} nights.`;
  return null;
}

/** Checks guest and room counts. Returns an error message or null. */
export function validateGuests({ adults, children, units }: GuestCounts): string | null {
  if (!Number.isInteger(adults) || adults < 1) return "Add at least one adult.";
  if (!Number.isInteger(children) || children < 0) return "The number of children cannot be negative.";
  if (!Number.isInteger(units) || units < 1) return "Book at least one room.";
  if (units > adults) return "Each room needs at least one adult.";
  return null;
}

/**
 * Guests above what the units include, for the whole party. Guests spread across the booked units,
 * so 5 guests in 2 rooms that each include 2 pay for 1 extra guest.
 */
export function extraGuests(guests: number, includedGuests: number, units: number) {
  return Math.max(0, guests - includedGuests * units);
}

/** "3 nights", "1 night, 2 rooms". */
export function roomLineLabel(nights: number, units: number) {
  const n = `${nights} ${nights === 1 ? "night" : "nights"}`;
  return units > 1 ? `${n}, ${units} rooms` : n;
}

/** "Taxes (12%)", "Taxes (12.5%)". */
export function taxLabel(taxBps: number) {
  const pct = taxBps / 100;
  return `Taxes (${Number.isInteger(pct) ? pct : pct.toFixed(2).replace(/0+$/, "")}%)`;
}

/**
 * Prices a stay from already loaded rows. Pure, so the rules can be tested without a database.
 * Every amount is an integer in minor units of `listing.currency`.
 */
export function priceStay(args: {
  listing: PricingListing;
  unit: PricingUnit;
  checkIn: string;
  checkOut: string;
  adults: number;
  children: number;
  units: number;
  inventory: InventoryNight[];
}): StayQuote {
  const { listing, unit, checkIn, checkOut, adults, children, units } = args;

  const dateError = validateStayDates(checkIn, checkOut);
  if (dateError) return no(dateError);
  const guestError = validateGuests({ adults, children, units });
  if (guestError) return no(guestError);

  if (listing.kind !== "stay" || listing.status !== "published") return no("This place is not taking bookings right now.");
  if (!unit.active) return no("This room is not taking bookings right now.");

  const nights = eachNight(checkIn, checkOut);
  if (nights.length < listing.minNights) {
    return no(`This place has a minimum stay of ${listing.minNights} ${listing.minNights === 1 ? "night" : "nights"}.`);
  }
  if (nights.length > listing.maxNights) {
    return no(`This place takes stays of up to ${listing.maxNights} ${listing.maxNights === 1 ? "night" : "nights"}.`);
  }

  const guests = adults + children;
  const capacity = unit.maxGuests * units;
  if (guests > capacity) {
    return no(
      units === 1
        ? `This room sleeps up to ${unit.maxGuests}. Add a room or pick a larger one.`
        : `${units} of these rooms sleep up to ${capacity}. Add a room or pick a larger one.`,
    );
  }

  const byDate = new Map(args.inventory.map((r) => [r.date, r]));
  const extra = extraGuests(guests, unit.includedGuests, units) * unit.extraGuestPrice;
  const nightly: { date: string; price: number }[] = [];

  for (const date of nights) {
    const row = byDate.get(date);
    if (row?.closed) return no("The host has closed some of these nights. Try other dates.");
    const total = row?.total ?? unit.quantity;
    const free = total - (row?.booked ?? 0);
    if (free < units) {
      return no(units === 1 || free <= 0 ? "This room is booked on some of these nights. Try other dates." : `Only ${free} of these rooms ${free === 1 ? "is" : "are"} free on some of these nights.`);
    }
    const price = (row?.price ?? unit.basePrice) * units + extra;
    nightly.push({ date, price });
  }

  const roomTotal = nightly.reduce((s, n) => s + n.price, 0);
  const lines: PriceLine[] = [{ kind: "base", label: roomLineLabel(nights.length, units), amount: roomTotal }];
  if (listing.cleaningFee > 0) lines.push({ kind: "other", label: "Cleaning fee", amount: listing.cleaningFee });
  if (listing.taxBps > 0) lines.push({ kind: "tax", label: taxLabel(listing.taxBps), amount: bps(roomTotal, listing.taxBps) });
  lines.push({ kind: "fee", label: "Platform fee", amount: 0 });

  return {
    available: true,
    currency: listing.currency,
    nights: nights.length,
    nightly,
    lines,
    total: lines.reduce((s, l) => s + l.amount, 0),
  };
}
