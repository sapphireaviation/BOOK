import "server-only";
import { and, asc, desc, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { db } from "@/db";
import { bookings, listings, listingUnits, payouts, stayBookings } from "@/db/schema";
import { AccessError } from "./access";
import { canSeeHostBooking, HOST_VISIBLE_STATUSES, hostCanSeeGuestContact, type Actor } from "./rules";

const visible = inArray(bookings.status, [...HOST_VISIBLE_STATUSES]);

const rowFields = {
  id: bookings.id,
  reference: bookings.reference,
  status: bookings.status,
  guestName: bookings.contactName,
  currency: bookings.currency,
  total: bookings.total,
  createdAt: bookings.createdAt,
  checkIn: stayBookings.checkIn,
  checkOut: stayBookings.checkOut,
  nights: stayBookings.nights,
  units: stayBookings.units,
  adults: stayBookings.adults,
  children: stayBookings.children,
  listingId: listings.id,
  listingTitle: listings.title,
  unitName: listingUnits.name,
  payoutAmount: payouts.amount,
  payoutStatus: payouts.status,
};

function baseQuery() {
  return db
    .select(rowFields)
    .from(stayBookings)
    .innerJoin(bookings, eq(bookings.id, stayBookings.bookingId))
    .innerJoin(listings, eq(listings.id, stayBookings.listingId))
    .innerJoin(listingUnits, eq(listingUnits.id, stayBookings.unitId))
    .leftJoin(payouts, eq(payouts.bookingId, bookings.id))
    .$dynamic();
}

export type HostBookingRow = Awaited<ReturnType<typeof listHostBookings>>[number];

/** What the host is owed for a booking: the payout row when it exists, otherwise the full booking total (we keep nothing). */
export function amountOwed(row: { total: number; payoutAmount: number | null; payoutStatus?: string | null; status: string }) {
  // A cancelled payout keeps its original amount in the table, but nothing is owed on it.
  if (row.payoutStatus === "cancelled") return 0;
  if (row.status === "cancelled" || row.status === "refunded") return row.payoutAmount ?? 0;
  return row.payoutAmount ?? row.total;
}

export async function listHostBookings(actor: Actor, filter: { when?: "upcoming" | "past" | "all"; today: string; limit?: number }) {
  const conds = [eq(stayBookings.hostId, actor.userId), visible];
  if (filter.when === "upcoming") conds.push(gte(stayBookings.checkOut, filter.today));
  if (filter.when === "past") conds.push(sql`${stayBookings.checkOut} < ${filter.today}`);
  return baseQuery()
    .where(and(...conds))
    .orderBy(filter.when === "past" ? desc(stayBookings.checkIn) : asc(stayBookings.checkIn))
    .limit(filter.limit ?? 200);
}

export async function listArrivals(actor: Actor, from: string, to: string) {
  return baseQuery()
    .where(and(eq(stayBookings.hostId, actor.userId), eq(bookings.status, "confirmed"), gte(stayBookings.checkIn, from), lte(stayBookings.checkIn, to)))
    .orderBy(asc(stayBookings.checkIn));
}

export async function listRecentBookings(actor: Actor, limit = 8) {
  return baseQuery()
    .where(and(eq(stayBookings.hostId, actor.userId), visible))
    .orderBy(desc(bookings.createdAt))
    .limit(limit);
}

/** One booking for the host, with guest contact only while it is confirmed. */
export async function getHostBooking(actor: Actor, bookingId: string) {
  const [row] = await db
    .select({
      ...rowFields,
      hostId: stayBookings.hostId,
      contactEmail: bookings.contactEmail,
      contactPhone: bookings.contactPhone,
      guestNote: stayBookings.guestNote,
      cancellationPolicy: stayBookings.cancellationPolicy,
      cancelledAt: bookings.cancelledAt,
      confirmedAt: bookings.confirmedAt,
      priceLines: bookings.priceLines,
      payoutReleaseOn: payouts.releaseOn,
      payoutPaidAt: payouts.paidAt,
      checkInFrom: listings.checkInFrom,
      checkOutUntil: listings.checkOutUntil,
    })
    .from(stayBookings)
    .innerJoin(bookings, eq(bookings.id, stayBookings.bookingId))
    .innerJoin(listings, eq(listings.id, stayBookings.listingId))
    .innerJoin(listingUnits, eq(listingUnits.id, stayBookings.unitId))
    .leftJoin(payouts, eq(payouts.bookingId, bookings.id))
    .where(and(eq(bookings.id, bookingId), visible))
    .limit(1);
  if (!row || !canSeeHostBooking(actor, row)) throw new AccessError("not_found", "That booking does not exist or is not for your listing.");
  const showContact = hostCanSeeGuestContact(row.status);
  return {
    ...row,
    contactEmail: showContact ? row.contactEmail : null,
    contactPhone: showContact ? row.contactPhone : null,
    showContact,
  };
}
