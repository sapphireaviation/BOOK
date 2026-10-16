import "server-only";
import { and, eq, inArray, isNotNull, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import { bookings, payments, refunds } from "@/db/schema";
import { newId } from "@/lib/id";
import { getPaymentProvider } from "@/server/payments";
import { transition, TransitionError, type Executor } from "./transitions";

export type RefundOutcome = { refundId: string; status: "pending" | "processed" | "failed" };

/** Records an owed refund. Call inside the transaction that decides the refund, then run `executeRefund` after commit. */
export async function recordRefund(exec: Executor, input: { bookingId: string; paymentId: string; amount: number; currency: string; reason: string }) {
  const id = newId("rfd");
  await exec.insert(refunds).values({ id, paymentId: input.paymentId, bookingId: input.bookingId, amount: input.amount, currency: input.currency, reason: input.reason, status: "pending" });
  await syncPaymentRefundStatus(exec, input.paymentId);
  return id;
}

/** payments.status follows the sum of refunds that have not failed. */
export async function syncPaymentRefundStatus(exec: Executor, paymentId: string) {
  const [payment] = await exec.select({ amount: payments.amount, status: payments.status }).from(payments).where(eq(payments.id, paymentId));
  if (!payment || !["captured", "partially_refunded", "refunded"].includes(payment.status)) return;
  const [{ refunded }] = await exec
    .select({ refunded: sql<number>`coalesce(sum(${refunds.amount}), 0)::int` })
    .from(refunds)
    .where(and(eq(refunds.paymentId, paymentId), ne(refunds.status, "failed")));
  const status = refunded <= 0 ? "captured" : refunded >= payment.amount ? "refunded" : "partially_refunded";
  await exec.update(payments).set({ status, updatedAt: new Date() }).where(eq(payments.id, paymentId));
}

/**
 * Sends a recorded refund to the provider. Never throws: a provider error marks the refund failed so an
 * operator can retry it from the admin console with `retryRefund`.
 */
export async function executeRefund(refundId: string): Promise<RefundOutcome> {
  const [row] = await db
    .select({ refund: refunds, payment: payments })
    .from(refunds)
    .innerJoin(payments, eq(payments.id, refunds.paymentId))
    .where(eq(refunds.id, refundId));
  if (!row) throw new Error(`Refund ${refundId} not found.`);
  const { refund, payment } = row;
  if (refund.providerRefundId) return { refundId, status: refund.status === "processed" ? "processed" : refund.status === "failed" ? "failed" : "pending" };
  if (refund.amount <= 0) {
    await db.update(refunds).set({ status: "processed" }).where(eq(refunds.id, refundId));
    return { refundId, status: "processed" };
  }

  const provider = getPaymentProvider(payment.provider);
  try {
    if (!provider) throw new Error(`Payment provider ${payment.provider} is not configured.`);
    if (!payment.providerPaymentId) throw new Error("The payment has no provider payment id.");
    const result = await provider.refund({
      providerPaymentId: payment.providerPaymentId,
      amount: refund.amount,
      currency: refund.currency,
      refundId,
      reason: refund.reason ?? "Refund",
    });
    await db.update(refunds).set({ providerRefundId: result.providerRefundId, status: result.status }).where(eq(refunds.id, refundId));
    if (result.status === "failed") await syncPaymentRefundStatus(db, payment.id);
    if (result.status === "processed") await settleRefundedBooking(refund.bookingId);
    return { refundId, status: result.status };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[refund] ${refundId} for booking ${refund.bookingId} failed: ${message}`);
    await db
      .update(refunds)
      .set({ status: "failed", reason: `${refund.reason ?? "Refund"} (provider error: ${message.slice(0, 300)})` })
      .where(eq(refunds.id, refundId));
    await syncPaymentRefundStatus(db, payment.id);
    return { refundId, status: "failed" };
  }
}

/** Admin action: try a failed refund again. Only refunds the provider never accepted can be retried. */
export async function retryRefund(refundId: string): Promise<RefundOutcome> {
  const [refund] = await db.select().from(refunds).where(eq(refunds.id, refundId));
  if (!refund) throw new Error(`Refund ${refundId} not found.`);
  if (refund.status !== "failed" || refund.providerRefundId) throw new Error("Only a refund the provider never accepted can be retried.");
  await db.update(refunds).set({ status: "pending", reason: refund.reason?.replace(/ \(provider error: .*\)$/, "") ?? null }).where(eq(refunds.id, refundId));
  await syncPaymentRefundStatus(db, refund.paymentId);
  return executeRefund(refundId);
}

/** A cancelled booking becomes refunded once every refund on it has been processed. */
export async function settleRefundedBooking(bookingId: string) {
  const [booking] = await db.select({ status: bookings.status }).from(bookings).where(eq(bookings.id, bookingId));
  if (booking?.status !== "cancelled") return;
  const rows = await db.select({ status: refunds.status, amount: refunds.amount }).from(refunds).where(eq(refunds.bookingId, bookingId));
  const live = rows.filter((r) => r.status !== "failed");
  if (!live.length || live.some((r) => r.status !== "processed") || !live.some((r) => r.amount > 0)) return;
  try {
    await transition(db, bookingId, "cancelled", "refunded");
  } catch (err) {
    if (!(err instanceof TransitionError && err.code === "conflict")) throw err;
  }
}

/**
 * Provider confirmed a refund. Razorpay names the refund; Stripe gives the charge's refunded total, so we
 * mark this payment's accepted refunds processed oldest first up to that total.
 */
export async function markRefundProcessed(input: { provider: "razorpay" | "stripe" | "test"; providerPaymentId: string; providerRefundId: string | null; amountRefunded: number | null }) {
  const [payment] = await db
    .select()
    .from(payments)
    .where(and(eq(payments.provider, input.provider), eq(payments.providerPaymentId, input.providerPaymentId)));
  if (!payment) return { matched: 0 };

  let ids: string[] = [];
  if (input.providerRefundId) {
    const rows = await db
      .select({ id: refunds.id })
      .from(refunds)
      .where(and(eq(refunds.paymentId, payment.id), eq(refunds.providerRefundId, input.providerRefundId)));
    ids = rows.map((r) => r.id);
  } else if (input.amountRefunded != null) {
    const rows = await db
      .select()
      .from(refunds)
      .where(and(eq(refunds.paymentId, payment.id), isNotNull(refunds.providerRefundId), ne(refunds.status, "failed")))
      .orderBy(refunds.createdAt);
    let budget = input.amountRefunded;
    for (const r of rows) {
      if (r.amount > budget) break;
      budget -= r.amount;
      if (r.status !== "processed") ids.push(r.id);
    }
  }
  if (ids.length) await db.update(refunds).set({ status: "processed" }).where(inArray(refunds.id, ids));
  await settleRefundedBooking(payment.bookingId);
  return { matched: ids.length };
}
