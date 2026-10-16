import "server-only";
import { and, eq, inArray, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import { bookings, payments, payouts, refunds, stayBookings } from "@/db/schema";
import { getFlightProvider } from "@/server/flights";
import type { Conditions } from "@/server/flights/types";
import { releaseInventory } from "@/server/stays/inventory";
import { safeEqual } from "@/server/payments/signature";
import { mergeMeta } from "./meta";
import { sendCancellationEmails } from "./notify";
import { computeStayRefund, estimateFlightRefund, policyLabel } from "./policy";
import { getBookingDetailById } from "./queries";
import { executeRefund, recordRefund } from "./refunds";
import { transition, TransitionError } from "./transitions";
import { BookingError } from "./types";

export type CancelInput = {
  bookingId: string;
  actor: { kind: "traveler"; userId: string | null; accessToken?: string } | { kind: "admin"; userId: string } | { kind: "system" };
  reason: string;
  /** Admin only: override the policy refund amount (minor units). */
  refundAmount?: number;
};

export type CancelResult = { status: "cancelled" | "refunded"; refundAmount: number; currency: string };

type Preview = { refundAmount: number; currency: string; policy: string; explanation: string; travelerCanCancel: boolean };

/**
 * The payment that paid for the booking and how much of it can still be refunded.
 * Duplicate or late payments are refunded separately and have status "refunded", so they are skipped.
 */
async function refundablePayment(bookingId: string) {
  const [payment] = await db
    .select()
    .from(payments)
    .where(and(eq(payments.bookingId, bookingId), inArray(payments.status, ["captured", "partially_refunded"])))
    .orderBy(payments.createdAt)
    .limit(1);
  if (!payment) return null;
  const [row] = await db
    .select({ refunded: sql<number>`coalesce(sum(${refunds.amount}), 0)::int` })
    .from(refunds)
    .where(and(eq(refunds.paymentId, payment.id), ne(refunds.status, "failed")));
  return { payment, remaining: Math.max(0, payment.amount - (row?.refunded ?? 0)) };
}

async function computePreview(bookingId: string, now: Date): Promise<Preview & { kind: "stay" | "flight" }> {
  const detail = await getBookingDetailById(bookingId);
  if (!detail) throw new BookingError("not_found", "We could not find that booking.");
  const { booking } = detail;

  if (detail.stay) {
    const r = computeStayRefund({
      policy: detail.stay.cancellationPolicy,
      total: booking.total,
      checkIn: detail.stay.checkIn,
      checkInTime: detail.stay.listing.checkInFrom,
      now,
    });
    return { kind: "stay", refundAmount: r.refundAmount, currency: booking.currency, policy: policyLabel(detail.stay.cancellationPolicy), explanation: r.explanation, travelerCanCancel: r.travelerCanCancel };
  }

  const flight = detail.flight!;
  const provider = getFlightProvider();
  const departed = flight.departAt.getTime() <= now.getTime();
  const estimate = estimateFlightRefund({
    total: booking.total,
    conditions: flight.conditions as Partial<Conditions>,
    canCancelWithAirline: Boolean(provider?.cancelOrder && flight.providerOrderId),
  });
  const conditions = flight.conditions as Partial<Conditions>;
  return {
    kind: "flight",
    refundAmount: departed ? 0 : estimate.refundAmount,
    currency: booking.currency,
    policy: conditions.refundable ? "Refundable fare" : "Non refundable fare",
    explanation: departed ? "The first flight has already left, so this booking can no longer be cancelled online." : estimate.explanation,
    travelerCanCancel: !departed,
  };
}

/** CONTRACT. What the traveler would get back if they cancelled now. Callers check access to the booking first. */
export async function previewCancellation(bookingId: string): Promise<{ refundAmount: number; currency: string; policy: string; explanation: string }> {
  const p = await computePreview(bookingId, new Date());
  return { refundAmount: p.refundAmount, currency: p.currency, policy: p.policy, explanation: p.explanation };
}

/** Same as previewCancellation plus whether a traveler may cancel at all. Used by the booking page. */
export async function cancellationOptions(bookingId: string) {
  return computePreview(bookingId, new Date());
}

/** CONTRACT (bookings workstream). Computes the refund from the cancellation policy, refunds, releases inventory. */
export async function cancelBooking(input: CancelInput): Promise<CancelResult> {
  const reason = input.reason.trim().slice(0, 500) || "Cancelled";
  const [booking] = await db.select().from(bookings).where(eq(bookings.id, input.bookingId));
  if (!booking) throw new BookingError("not_found", "We could not find that booking.");

  // Who may cancel.
  const actor = input.actor;
  if (actor.kind === "traveler") {
    const owner = actor.userId != null && booking.userId === actor.userId;
    const tokenOk = actor.accessToken ? safeEqual(actor.accessToken, booking.accessToken) : false;
    if (!owner && !tokenOk) throw new BookingError("forbidden", "You do not have access to this booking.");
  }
  if (input.refundAmount != null && actor.kind !== "admin") throw new BookingError("forbidden", "Only an operator can change the refund amount.");
  if (booking.status !== "confirmed") {
    const why: Record<string, string> = {
      pending_payment: "This booking is not paid yet. If you leave it, the hold is released automatically.",
      cancelled: "This booking is already cancelled.",
      refunded: "This booking is already cancelled and refunded.",
      completed: "This trip has already happened.",
      expired: "This booking expired before it was paid.",
      failed: "This booking did not go through.",
    };
    throw new BookingError("invalid", why[booking.status] ?? "This booking cannot be cancelled.");
  }

  const now = new Date();
  const preview = await computePreview(booking.id, now);
  if (actor.kind === "traveler" && !preview.travelerCanCancel) throw new BookingError("invalid", preview.explanation);

  const paid = await refundablePayment(booking.id);
  const refundable = Math.min(booking.total, paid?.remaining ?? 0);

  let refundAmount = preview.refundAmount;
  let explanation = preview.explanation;

  // Flights: the airline decides. Cancel the order with them first; if that fails nothing changes here.
  if (preview.kind === "flight") {
    const detail = (await getBookingDetailById(booking.id))!;
    const flight = detail.flight!;
    const provider = getFlightProvider();
    if (provider?.cancelOrder && flight.providerOrderId) {
      try {
        const result = await provider.cancelOrder(flight.providerOrderId);
        refundAmount = result.currency.toUpperCase() === booking.currency.toUpperCase() ? result.refundAmount : 0;
        explanation = refundAmount > 0 ? "The airline cancelled the ticket and confirmed this refund." : "The airline cancelled the ticket without a refund.";
        await mergeMeta(db, booking.id, { airlineCancelledAt: now.toISOString(), airlineRefund: result });
      } catch (err) {
        console.error(`[cancel] airline cancellation failed for ${booking.id}: ${err instanceof Error ? err.message : err}`);
        throw new BookingError("unavailable", "The airline did not accept the cancellation. Try again in a few minutes or contact support.");
      }
    } else {
      refundAmount = 0;
    }
  }

  if (actor.kind === "admin" && input.refundAmount != null) {
    if (!Number.isInteger(input.refundAmount) || input.refundAmount < 0) throw new BookingError("invalid", "Refund amount must be a whole number of minor units, zero or more.");
    refundAmount = input.refundAmount;
    explanation = "An operator set this refund amount.";
  }
  refundAmount = Math.max(0, Math.min(refundAmount, refundable));

  const outcome = await db.transaction(async (tx) => {
    const [locked] = await tx.select().from(bookings).where(eq(bookings.id, booking.id)).for("update");
    try {
      await transition(tx, booking.id, "confirmed", "cancelled", { cancelledAt: now, cancelReason: reason });
    } catch (err) {
      if (err instanceof TransitionError) throw new BookingError("invalid", "This booking changed while you were cancelling it. Reload the page to see its current state.");
      throw err;
    }
    await mergeMeta(tx, booking.id, { cancelledBy: actor.kind, cancelledByUserId: "userId" in actor ? actor.userId : null, refundExplanation: explanation });

    let hostPayout: number | null = null;
    if (locked.kind === "stay") {
      const [stay] = await tx.select().from(stayBookings).where(eq(stayBookings.bookingId, booking.id));
      await releaseInventory(tx, { unitId: stay.unitId, checkIn: stay.checkIn, checkOut: stay.checkOut, units: stay.units });
      // The host keeps whatever the traveler does not get back. Nothing owed means the payout is cancelled.
      hostPayout = Math.max(0, locked.total - refundAmount);
      await tx
        .update(payouts)
        .set(hostPayout > 0 ? { amount: hostPayout } : { status: "cancelled" })
        .where(and(eq(payouts.bookingId, booking.id), inArray(payouts.status, ["owed", "scheduled"])));
    }

    let refundId: string | null = null;
    if (refundAmount > 0) {
      if (!paid) throw new BookingError("invalid", "We could not find the payment for this booking. Contact support.");
      refundId = await recordRefund(tx, { bookingId: booking.id, paymentId: paid.payment.id, amount: refundAmount, currency: paid.payment.currency, reason: `Cancellation: ${reason}`.slice(0, 500) });
    }
    return { refundId, hostPayout };
  });

  let status: CancelResult["status"] = "cancelled";
  if (outcome.refundId) {
    // Runs after commit; executeRefund never throws and moves the booking to refunded once processed.
    const result = await executeRefund(outcome.refundId);
    if (result.status === "processed") status = "refunded";
  }

  try {
    await sendCancellationEmails(booking.id, { amount: refundAmount, explanation }, outcome.hostPayout);
  } catch (err) {
    console.error(`[cancel] emails for ${booking.id} failed: ${err instanceof Error ? err.message : err}`);
  }
  return { status, refundAmount, currency: booking.currency };
}
