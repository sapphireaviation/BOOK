"use server";

import { after } from "next/server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { authorizeBookingById, bookingPath } from "@/server/bookings/access";
import { cancelBooking } from "@/server/bookings/cancel";
import { payWithTestProvider, startCheckout } from "@/server/bookings/checkout";
import { BookingError } from "@/server/bookings/types";

const idSchema = z.string().min(1).max(64);
const tokenSchema = z.string().max(128).optional();

export type ClientCheckout =
  | { provider: "razorpay"; orderId: string; keyId: string; amount: number; currency: string }
  | { provider: "stripe"; url: string }
  | { provider: "test" };

export type ActionResult<T = undefined> = { ok: true; data: T } | { ok: false; message: string; code?: string };

async function access(bookingId: unknown, token: unknown) {
  const id = idSchema.safeParse(bookingId);
  const tok = tokenSchema.safeParse(token ?? undefined);
  if (!id.success || !tok.success) return null;
  return authorizeBookingById(id.data, tok.data);
}

/** Opens a checkout with the provider chosen for the booking's currency. Returns only what the browser needs. */
export async function startPaymentAction(bookingId: string, token: string | undefined): Promise<ActionResult<ClientCheckout>> {
  const allowed = await access(bookingId, token);
  if (!allowed) return { ok: false, message: "We could not find that booking.", code: "not_found" };
  const result = await startCheckout(allowed.booking.id);
  if (!result.ok) return { ok: false, message: result.message, code: result.code };
  const s = result.session;
  if (s.provider === "razorpay") return { ok: true, data: { provider: "razorpay", orderId: s.providerOrderId, keyId: s.keyId, amount: s.amount, currency: s.currency } };
  if (s.provider === "stripe") return { ok: true, data: { provider: "stripe", url: s.url } };
  return { ok: true, data: { provider: "test" } };
}

/** Simulated payment. Only works where the test provider is allowed and chosen for this booking. */
export async function payWithTestCardAction(bookingId: string, token: string | undefined): Promise<ActionResult> {
  const allowed = await access(bookingId, token);
  if (!allowed) return { ok: false, message: "We could not find that booking." };
  const result = await payWithTestProvider(allowed.booking.id, (task) => after(task));
  if (!result.ok) return { ok: false, message: result.message, code: result.code };
  if (result.outcome.kind === "rejected") return { ok: false, message: result.outcome.reason };
  redirect(bookingPath(allowed.booking.reference, allowed.booking.accessToken));
}

const cancelSchema = z.object({ bookingId: idSchema, token: tokenSchema, reason: z.string().trim().max(500).optional() });

export async function cancelBookingAction(input: { bookingId: string; token?: string; reason?: string }): Promise<ActionResult<{ status: string; refundAmount: number; currency: string }>> {
  const parsed = cancelSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Check the details and try again." };
  const allowed = await access(parsed.data.bookingId, parsed.data.token);
  if (!allowed) return { ok: false, message: "We could not find that booking." };
  try {
    const actor =
      allowed.viewer.via === "admin"
        ? { kind: "admin" as const, userId: allowed.viewer.userId! }
        : { kind: "traveler" as const, userId: allowed.viewer.userId, accessToken: parsed.data.token };
    const result = await cancelBooking({ bookingId: allowed.booking.id, actor, reason: parsed.data.reason || "Cancelled by traveler" });
    return { ok: true, data: result };
  } catch (err) {
    if (err instanceof BookingError) return { ok: false, message: err.message, code: err.code };
    console.error(`[cancel] ${err instanceof Error ? err.stack : err}`);
    return { ok: false, message: "We could not cancel this booking. Try again, or contact support if it keeps happening." };
  }
}
