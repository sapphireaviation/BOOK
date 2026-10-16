import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { bookings, flightBookings, payments, payouts, stayBookings } from "@/db/schema";
import { addDays } from "@/lib/dates";
import { newId } from "@/lib/id";
import { getFlightProvider } from "@/server/flights";
import type { OrderResult } from "@/server/flights/types";
import type { CapturedPayment, ProviderName } from "@/server/payments/types";
import { claimMetaFlag, mergeMeta } from "./meta";
import { sendConfirmationEmails, sendPaymentRefundedEmail, sendTicketingFailedEmail } from "./notify";
import { executeRefund, recordRefund } from "./refunds";
import { transition, TransitionError } from "./transitions";

/** Runs work after the response is sent. Routes pass `after` from next/server; tests run it inline. */
export type Schedule = (task: () => Promise<void>) => void;

export type CaptureOutcome =
  | { kind: "confirmed"; bookingId: string; bookingKind: "stay" | "flight" }
  | { kind: "already_captured"; bookingId: string }
  | { kind: "refunding"; bookingId: string; refundId: string; reason: "late" | "duplicate" | "mismatch" }
  | { kind: "unknown_order" };

/**
 * Records a captured payment and confirms its booking. Idempotent: a second capture for the same payment
 * is a no-op. A capture we cannot use (booking expired, already paid by another payment, wrong amount) is
 * refunded in full.
 *
 * The amount checked is the one on our payment row, which was copied from the booking row when checkout
 * started. Nothing the browser sends is used.
 */
export async function recordCapture(provider: ProviderName, capture: CapturedPayment): Promise<CaptureOutcome> {
  return db.transaction(async (tx) => {
    const [payment] = await tx
      .select()
      .from(payments)
      .where(and(eq(payments.provider, provider), eq(payments.providerOrderId, capture.providerOrderId)))
      .for("update");
    if (!payment) return { kind: "unknown_order" };
    if (payment.status === "captured" || payment.status === "refunded" || payment.status === "partially_refunded") {
      return { kind: "already_captured", bookingId: payment.bookingId };
    }

    const [booking] = await tx.select().from(bookings).where(eq(bookings.id, payment.bookingId)).for("update");
    const amountMatches =
      capture.amount === payment.amount &&
      capture.currency.toUpperCase() === payment.currency.toUpperCase() &&
      payment.amount === booking.total &&
      payment.currency.toUpperCase() === booking.currency.toUpperCase();

    await tx
      .update(payments)
      .set({
        status: "captured",
        providerPaymentId: capture.providerPaymentId,
        method: capture.method ?? payment.method,
        failureReason: null,
        raw: { ...payment.raw, capture: capture.raw ?? {}, capturedAmount: capture.amount, capturedCurrency: capture.currency },
        updatedAt: new Date(),
      })
      .where(eq(payments.id, payment.id));

    const refund = async (reason: "late" | "duplicate" | "mismatch") => {
      const refundId = await recordRefund(tx, {
        bookingId: booking.id,
        paymentId: payment.id,
        // Refund what was actually taken.
        amount: capture.amount,
        currency: capture.currency.toUpperCase(),
        reason: { late: "Payment arrived after the booking hold ended", duplicate: "Booking was already paid", mismatch: "Payment amount did not match the booking" }[reason],
      });
      return { kind: "refunding" as const, bookingId: booking.id, refundId, reason };
    };

    if (!amountMatches) return refund("mismatch");
    if (booking.status !== "pending_payment") return refund(booking.status === "confirmed" || booking.status === "completed" ? "duplicate" : "late");

    await transition(tx, booking.id, "pending_payment", "confirmed", { confirmedAt: new Date(), expiresAt: null });

    if (booking.kind === "stay") {
      const [stay] = await tx.select().from(stayBookings).where(eq(stayBookings.bookingId, booking.id));
      // The host gets 100% of what the traveler paid. We keep nothing.
      await tx
        .insert(payouts)
        .values({ id: newId("pyo"), bookingId: booking.id, hostId: stay.hostId, amount: booking.total, currency: booking.currency, status: "owed", releaseOn: addDays(stay.checkIn, 1) })
        .onConflictDoNothing();
    }
    return { kind: "confirmed", bookingId: booking.id, bookingKind: booking.kind };
  });
}

/** Captured payment in, confirmed booking out. Slow follow-up work (airline order, emails) goes to `schedule`. */
export async function confirmBooking(provider: ProviderName, capture: CapturedPayment, opts: { schedule: Schedule }): Promise<CaptureOutcome> {
  const outcome = await recordCapture(provider, capture);
  if (outcome.kind === "confirmed") {
    opts.schedule(() => fulfilBooking(outcome.bookingId));
  } else if (outcome.kind === "refunding") {
    // The refund is sent now, not deferred, so money we cannot use goes back even if the follow-up is dropped.
    const result = await executeRefund(outcome.refundId);
    if (result.status !== "failed") opts.schedule(() => sendPaymentRefundedEmail(outcome.bookingId, capture.amount, outcome.reason));
  }
  return outcome;
}

/**
 * After confirmation: create the airline order for flights, then send emails.
 * Safe to call more than once; each step claims a flag on the booking first.
 */
export async function fulfilBooking(bookingId: string) {
  const [booking] = await db.select().from(bookings).where(eq(bookings.id, bookingId));
  if (!booking || booking.status !== "confirmed") return;
  if (booking.kind === "flight") {
    const ticketed = await ticketFlight(bookingId);
    if (!ticketed) return;
  }
  await sendConfirmationEmails(bookingId);
}

/**
 * Creates the airline order exactly once. The claim on meta.ticketing means a crash part way leaves the
 * booking marked "in_progress" for an operator to check, instead of risking a second paid order.
 * Returns true when the booking has an airline order.
 */
export async function ticketFlight(bookingId: string): Promise<boolean> {
  const [flight] = await db.select().from(flightBookings).where(eq(flightBookings.bookingId, bookingId));
  if (!flight) return false;
  if (flight.providerOrderId) return true;

  const claimed = await claimMetaFlag(db, bookingId, "ticketing", "in_progress", sql`${bookings.status} = 'confirmed'`);
  if (!claimed) return false;

  let order: OrderResult;
  try {
    const provider = getFlightProvider();
    if (!provider) throw new Error("Flight provider is not configured.");
    order = await provider.createOrder({
      offerId: flight.offerId,
      passengers: flight.passengers.map((p) => ({ ...p, id: p.id ?? "" })),
      amount: flight.providerTotal,
      currency: flight.providerCurrency,
    });
  } catch (err) {
    // Only an order the airline refused is refunded. Anything after this point keeps the order.
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[ticketing] booking ${bookingId} failed: ${message}`);
    await failFlightAndRefund(bookingId, message);
    return false;
  }

  // Log first so the order can be found even if the write below fails.
  console.info(`[ticketing] booking ${bookingId} ticketed: order ${order.orderId}, airline reference ${order.airlineReference}`);
  await db.transaction(async (tx) => {
    await tx.update(flightBookings).set({ providerOrderId: order.orderId, airlineReference: order.airlineReference }).where(eq(flightBookings.bookingId, bookingId));
    await mergeMeta(tx, bookingId, { ticketing: "done", ticketedAt: new Date().toISOString() });
  });
  return true;
}

async function failFlightAndRefund(bookingId: string, error: string) {
  const refund = await db.transaction(async (tx) => {
    const [booking] = await tx.select().from(bookings).where(eq(bookings.id, bookingId)).for("update");
    try {
      await transition(tx, bookingId, "confirmed", "failed");
    } catch (err) {
      if (err instanceof TransitionError) return null;
      throw err;
    }
    await mergeMeta(tx, bookingId, { ticketing: "failed", ticketingError: error.slice(0, 500) });
    const [payment] = await tx
      .select()
      .from(payments)
      .where(and(eq(payments.bookingId, bookingId), eq(payments.status, "captured")))
      .limit(1);
    if (!payment) return null;
    const refundId = await recordRefund(tx, {
      bookingId,
      paymentId: payment.id,
      amount: booking.total,
      currency: booking.currency,
      reason: "Airline did not confirm the booking",
    });
    return { refundId, amount: booking.total };
  });
  if (!refund) return;
  await executeRefund(refund.refundId);
  await sendTicketingFailedEmail(bookingId, refund.amount);
}
