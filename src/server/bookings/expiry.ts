import "server-only";
import { and, eq, inArray, lt, sql } from "drizzle-orm";
import { db } from "@/db";
import { bookings, payments, stayBookings } from "@/db/schema";
import { toISODate } from "@/lib/dates";
import { releaseInventory } from "@/server/stays/inventory";
import { getPaymentProvider } from "@/server/payments";
import { fulfilBooking } from "./confirm";
import { transition, type Tx } from "./transitions";

const HOLDING = ["draft", "pending_payment"] as const;

/**
 * Expires one booking whose row the caller has locked, releasing its stay inventory in the same transaction.
 * Returns false when the booking is not holding anything or its hold has not ended.
 */
async function expireLocked(tx: Tx, booking: { id: string; kind: "stay" | "flight"; status: string; expiresAt: Date | null }, now: Date) {
  if (!HOLDING.includes(booking.status as (typeof HOLDING)[number])) return false;
  if (!booking.expiresAt || booking.expiresAt > now) return false;
  await transition(tx, booking.id, booking.status as (typeof HOLDING)[number], "expired");
  if (booking.kind === "stay") {
    const [stay] = await tx.select().from(stayBookings).where(eq(stayBookings.bookingId, booking.id));
    if (stay) await releaseInventory(tx, { unitId: stay.unitId, checkIn: stay.checkIn, checkOut: stay.checkOut, units: stay.units });
  }
  await tx
    .update(payments)
    .set({ status: "failed", failureReason: "Booking hold ended before payment", updatedAt: new Date() })
    .where(and(eq(payments.bookingId, booking.id), eq(payments.status, "created")));
  return true;
}

/**
 * Lazy expiry for one unit, run inside createStayBooking before holding inventory. Vercel Hobby crons
 * run once a day, so holds are released here as soon as someone wants the same unit.
 */
export async function expireHoldsForUnit(tx: Tx, unitId: string, now = new Date()) {
  const stale = await tx
    .select({ id: bookings.id, kind: bookings.kind, status: bookings.status, expiresAt: bookings.expiresAt })
    .from(bookings)
    .innerJoin(stayBookings, eq(stayBookings.bookingId, bookings.id))
    .where(and(eq(stayBookings.unitId, unitId), inArray(bookings.status, [...HOLDING]), lt(bookings.expiresAt, now)))
    .for("update", { of: bookings, skipLocked: true });
  let count = 0;
  for (const b of stale) if (await expireLocked(tx, b, now)) count++;
  return count;
}

/** Expires a single booking if its hold has ended. Used when a checkout page is opened late. */
export async function expireIfStale(bookingId: string, now = new Date()) {
  const expired = await db.transaction(async (tx) => {
    const [b] = await tx
      .select({ id: bookings.id, kind: bookings.kind, status: bookings.status, expiresAt: bookings.expiresAt })
      .from(bookings)
      .where(eq(bookings.id, bookingId))
      .for("update", { skipLocked: true });
    return b ? expireLocked(tx, b, now) : false;
  });
  if (expired) await closeOpenCheckouts([bookingId]);
  return expired;
}

/** Stops hosted checkouts (Stripe) from taking money for bookings that just expired. Best effort. */
async function closeOpenCheckouts(bookingIds: string[]) {
  if (!bookingIds.length) return;
  const rows = await db
    .select({ provider: payments.provider, providerOrderId: payments.providerOrderId })
    .from(payments)
    .where(and(inArray(payments.bookingId, bookingIds), eq(payments.provider, "stripe")));
  for (const row of rows) {
    if (!row.providerOrderId) continue;
    try {
      await getPaymentProvider(row.provider)?.expireCheckout?.(row.providerOrderId);
    } catch (err) {
      console.warn(`[expiry] could not close checkout ${row.providerOrderId}: ${err instanceof Error ? err.message : err}`);
    }
  }
}

/** Expires every booking whose hold has ended. Run by the expire-holds cron and safe to run at any time. */
export async function expireStaleBookings(now = new Date(), limit = 500) {
  const candidates = await db
    .select({ id: bookings.id })
    .from(bookings)
    .where(and(inArray(bookings.status, [...HOLDING]), lt(bookings.expiresAt, now)))
    .limit(limit);
  const expiredIds: string[] = [];
  for (const { id } of candidates) {
    const done = await db.transaction(async (tx) => {
      const [b] = await tx
        .select({ id: bookings.id, kind: bookings.kind, status: bookings.status, expiresAt: bookings.expiresAt })
        .from(bookings)
        .where(eq(bookings.id, id))
        .for("update", { skipLocked: true });
      return b ? expireLocked(tx, b, now) : false;
    });
    if (done) expiredIds.push(id);
  }
  await closeOpenCheckouts(expiredIds);
  return { checked: candidates.length, expired: expiredIds.length };
}

/** Marks confirmed stays completed once check out has passed. */
export async function completeFinishedStays(now = new Date()) {
  const today = toISODate(now);
  const rows = await db
    .select({ id: bookings.id })
    .from(bookings)
    .innerJoin(stayBookings, eq(stayBookings.bookingId, bookings.id))
    .where(and(eq(bookings.status, "confirmed"), lt(stayBookings.checkOut, today)))
    .limit(1000);
  let completed = 0;
  for (const { id } of rows) {
    try {
      await transition(db, id, "confirmed", "completed");
      completed++;
    } catch (err) {
      console.warn(`[complete] ${id}: ${err instanceof Error ? err.message : err}`);
    }
  }
  return { completed };
}

/**
 * Safety net for follow-up work dropped after confirmation (for example a function that timed out):
 * confirmed bookings with no confirmation email and, for flights, no ticketing attempt.
 * Bookings with ticketing "in_progress" are left for an operator because the airline may have the order.
 */
export async function resumeFulfilment(now = new Date()) {
  const cutoff = new Date(now.getTime() - 5 * 60_000);
  const rows = await db
    .select({ id: bookings.id })
    .from(bookings)
    .where(and(eq(bookings.status, "confirmed"), lt(bookings.confirmedAt, cutoff), sql`not (${bookings.meta} ? 'confirmationEmailAt')`, sql`(${bookings.kind} = 'stay' or not (${bookings.meta} ? 'ticketing') or ${bookings.meta}->>'ticketing' = 'done')`))
    .limit(100);
  for (const { id } of rows) await fulfilBooking(id);
  return { resumed: rows.length };
}
