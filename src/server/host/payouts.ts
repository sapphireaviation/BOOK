import "server-only";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { bookings, listings, payouts, stayBookings } from "@/db/schema";
import type { Actor } from "./rules";

export type PayoutStatus = (typeof payouts.$inferSelect)["status"];

/** Totals per status and currency, e.g. { owed: { INR: 482000 } }. */
export async function payoutTotals(hostId: string) {
  const rows = await db
    .select({ status: payouts.status, currency: payouts.currency, amount: sql<string>`sum(${payouts.amount})`, n: sql<string>`count(*)` })
    .from(payouts)
    .where(eq(payouts.hostId, hostId))
    .groupBy(payouts.status, payouts.currency);
  const out: Partial<Record<PayoutStatus, { currency: string; amount: number; count: number }[]>> = {};
  for (const r of rows) (out[r.status] ??= []).push({ currency: r.currency, amount: Number(r.amount), count: Number(r.n) });
  return out;
}

export async function listHostPayouts(actor: Actor, statuses: PayoutStatus[] = ["owed", "scheduled", "paid"]) {
  return db
    .select({
      id: payouts.id,
      amount: payouts.amount,
      currency: payouts.currency,
      status: payouts.status,
      releaseOn: payouts.releaseOn,
      paidAt: payouts.paidAt,
      transferReference: payouts.providerTransferId,
      bookingId: bookings.id,
      reference: bookings.reference,
      guestName: bookings.contactName,
      checkIn: stayBookings.checkIn,
      listingTitle: listings.title,
    })
    .from(payouts)
    .innerJoin(bookings, eq(bookings.id, payouts.bookingId))
    .leftJoin(stayBookings, eq(stayBookings.bookingId, payouts.bookingId))
    .leftJoin(listings, eq(listings.id, stayBookings.listingId))
    .where(and(eq(payouts.hostId, actor.userId), inArray(payouts.status, statuses)))
    .orderBy(desc(payouts.releaseOn))
    .limit(500);
}
