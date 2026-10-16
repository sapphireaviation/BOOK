import "server-only";
import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { bookings, payments } from "@/db/schema";
import { formatDay } from "@/lib/dates";
import { newId } from "@/lib/id";
import { choosePaymentProvider, getPaymentProvider } from "@/server/payments";
import type { CheckoutSession, ProviderName } from "@/server/payments/types";
import { confirmBooking, type CaptureOutcome, type Schedule } from "./confirm";
import { expireIfStale } from "./expiry";
import { getBookingDetailById, type BookingDetail } from "./queries";

export type StartCheckoutResult =
  | { ok: true; session: CheckoutSession }
  | { ok: false; code: "not_found" | "paid" | "expired" | "closed" | "not_configured" | "provider_error"; message: string };

export function describeBooking(detail: BookingDetail) {
  if (detail.stay) {
    const s = detail.stay;
    return `${s.listing.title}, ${s.listing.city}, ${formatDay(s.checkIn)} to ${formatDay(s.checkOut)}`;
  }
  const f = detail.flight!;
  return `Flight ${f.origin} to ${f.destination}${f.returnAt ? " and back" : ""}, ${formatDay((f.slices as { departAt?: string }[])[0]?.departAt?.slice(0, 10) ?? f.departAt)}`;
}

function sessionFromRow(row: typeof payments.$inferSelect): CheckoutSession | null {
  if (!row.providerOrderId) return null;
  const raw = row.raw as { url?: string; expiresAt?: string; keyId?: string };
  if (row.provider === "razorpay" && raw.keyId) return { provider: "razorpay", providerOrderId: row.providerOrderId, keyId: raw.keyId, amount: row.amount, currency: row.currency };
  if (row.provider === "test") return { provider: "test", providerOrderId: row.providerOrderId };
  if (row.provider === "stripe" && raw.url && raw.expiresAt && new Date(raw.expiresAt).getTime() > Date.now() + 2 * 60_000) {
    return { provider: "stripe", providerOrderId: row.providerOrderId, url: raw.url, expiresAt: new Date(raw.expiresAt) };
  }
  return null;
}

/**
 * Opens (or reuses) a provider checkout for a pending booking. The amount always comes from the booking row.
 * Callers must check that the viewer may pay for this booking.
 */
export async function startCheckout(bookingId: string): Promise<StartCheckoutResult> {
  await expireIfStale(bookingId);
  const detail = await getBookingDetailById(bookingId);
  if (!detail) return { ok: false, code: "not_found", message: "We could not find that booking." };
  const { booking } = detail;
  if (booking.status === "confirmed" || booking.status === "completed") return { ok: false, code: "paid", message: "This booking is already paid." };
  if (booking.status === "expired") return { ok: false, code: "expired", message: "The hold on this booking ended before payment. Start again to see current prices." };
  if (booking.status !== "pending_payment") return { ok: false, code: "closed", message: "This booking can no longer be paid." };

  const providerName = choosePaymentProvider(booking.currency);
  const provider = providerName ? getPaymentProvider(providerName) : null;
  if (!providerName || !provider) return { ok: false, code: "not_configured", message: "Payments are not connected yet." };

  const [existing] = await db
    .select()
    .from(payments)
    .where(and(eq(payments.bookingId, booking.id), eq(payments.provider, providerName), eq(payments.status, "created")))
    .orderBy(desc(payments.createdAt))
    .limit(1);
  const reused = existing && existing.amount === booking.total && existing.currency === booking.currency ? sessionFromRow(existing) : null;
  if (reused) return { ok: true, session: reused };

  let session: CheckoutSession;
  try {
    session = await provider.createCheckout({
      id: booking.id,
      reference: booking.reference,
      total: booking.total,
      currency: booking.currency,
      contactName: booking.contactName,
      contactEmail: booking.contactEmail,
      contactPhone: booking.contactPhone,
      accessToken: booking.accessToken,
      description: describeBooking(detail),
      expiresAt: booking.expiresAt,
    });
  } catch (err) {
    console.error(`[checkout] ${providerName} checkout for ${booking.id} failed: ${err instanceof Error ? err.message : err}`);
    return { ok: false, code: "provider_error", message: "We could not reach the payment provider. Try again in a minute." };
  }

  const raw: Record<string, unknown> =
    session.provider === "stripe" ? { url: session.url, expiresAt: session.expiresAt.toISOString() } : session.provider === "razorpay" ? { keyId: session.keyId } : {};
  await db
    .insert(payments)
    .values({ id: newId("pay"), bookingId: booking.id, provider: providerName, status: "created", amount: booking.total, currency: booking.currency, providerOrderId: session.providerOrderId, raw })
    .onConflictDoNothing();

  if (session.provider === "stripe" && booking.kind === "stay") {
    // A Stripe page stays open at least 30 minutes, longer than our hold. Keep the room held while it can still be paid.
    await db
      .update(bookings)
      .set({ expiresAt: sql`greatest(${bookings.expiresAt}, ${session.expiresAt.toISOString()}::timestamptz)` })
      .where(and(eq(bookings.id, booking.id), eq(bookings.status, "pending_payment")));
  }
  return { ok: true, session };
}

/** Confirms a payment the browser reports, after the provider adapter has verified it. */
export async function confirmClientPayment(input: { bookingId: string; provider: ProviderName; payload: unknown; schedule: Schedule }): Promise<CaptureOutcome | { kind: "rejected"; reason: string }> {
  const provider = getPaymentProvider(input.provider);
  if (!provider) return { kind: "rejected", reason: "This payment method is not available." };
  const verified = await provider.verifyClientCallback(input.payload);
  if (!verified.ok) return { kind: "rejected", reason: verified.reason };

  // The order must belong to the booking the browser says it is paying for.
  const [row] = await db
    .select({ bookingId: payments.bookingId })
    .from(payments)
    .where(and(eq(payments.provider, input.provider), eq(payments.providerOrderId, verified.payment.providerOrderId)));
  if (!row || row.bookingId !== input.bookingId) return { kind: "rejected", reason: "This payment is for a different booking." };
  return confirmBooking(input.provider, verified.payment, { schedule: input.schedule });
}

/** Test provider: opens a test checkout if needed and captures it at once. */
export async function payWithTestProvider(bookingId: string, schedule: Schedule) {
  const started = await startCheckout(bookingId);
  if (!started.ok) return started;
  if (started.session.provider !== "test") return { ok: false as const, code: "closed" as const, message: "This booking is paid through a real payment provider." };
  const [payment] = await db
    .select()
    .from(payments)
    .where(and(eq(payments.provider, "test"), eq(payments.providerOrderId, started.session.providerOrderId)));
  const outcome = await confirmClientPayment({
    bookingId,
    provider: "test",
    // Amount and currency come from our payment row, which was copied from the booking.
    payload: { providerOrderId: payment.providerOrderId, amount: payment.amount, currency: payment.currency },
    schedule,
  });
  return { ok: true as const, outcome };
}
