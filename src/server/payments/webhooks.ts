import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { paymentEvents, payments } from "@/db/schema";
import { confirmBooking, type Schedule } from "@/server/bookings/confirm";
import { markRefundProcessed } from "@/server/bookings/refunds";
import { getPaymentProvider } from "./index";
import type { WebhookEvent } from "./types";
import { WebhookSignatureError } from "./types";

export type WebhookResult = { status: number; body: { ok: boolean; duplicate?: boolean; error?: string; kind?: string } };

/**
 * Verifies, dedupes and applies one provider webhook.
 * Idempotency: the event id is inserted into payment_events first. A repeat delivery finds it and stops.
 * If applying the event throws, the row is removed again so the provider's retry gets another go.
 */
export async function handleWebhook(name: "razorpay" | "stripe", rawBody: string, headers: Headers, schedule: Schedule): Promise<WebhookResult> {
  const provider = getPaymentProvider(name);
  if (!provider) return { status: 404, body: { ok: false, error: "Provider not configured." } };

  let event: WebhookEvent;
  try {
    event = await provider.parseWebhook(rawBody, headers);
  } catch (err) {
    if (err instanceof WebhookSignatureError) return { status: 400, body: { ok: false, error: "Invalid signature." } };
    if (err instanceof SyntaxError) return { status: 400, body: { ok: false, error: "Invalid JSON." } };
    throw err;
  }

  const eventKey = `${name}:${event.id}`;
  const inserted = await db
    .insert(paymentEvents)
    .values({ id: eventKey, provider: name, type: event.type, payload: event.raw })
    .onConflictDoNothing()
    .returning({ id: paymentEvents.id });
  if (inserted.length === 0) return { status: 200, body: { ok: true, duplicate: true } };

  try {
    await applyEvent(name, event, schedule);
  } catch (err) {
    await db.delete(paymentEvents).where(eq(paymentEvents.id, eventKey));
    throw err;
  }
  return { status: 200, body: { ok: true, kind: event.kind } };
}

async function applyEvent(name: "razorpay" | "stripe", event: WebhookEvent, schedule: Schedule) {
  switch (event.kind) {
    case "captured":
      await confirmBooking(name, event.payment, { schedule });
      return;
    case "authorized": {
      // Accounts without auto capture: capture now, using the amount on our payment row.
      const [row] = await db.select().from(payments).where(and(eq(payments.provider, name), eq(payments.providerOrderId, event.providerOrderId)));
      const provider = getPaymentProvider(name);
      if (!row || !provider?.capture || row.status !== "created") return;
      const captured = await provider.capture({ providerOrderId: event.providerOrderId, providerPaymentId: event.providerPaymentId, amount: row.amount, currency: row.currency });
      await confirmBooking(name, captured, { schedule });
      return;
    }
    case "failed":
      await db
        .update(payments)
        .set({ status: "failed", failureReason: event.reason.slice(0, 500), providerPaymentId: event.providerPaymentId ?? undefined, updatedAt: new Date() })
        .where(and(eq(payments.provider, name), eq(payments.providerOrderId, event.providerOrderId), eq(payments.status, "created")));
      return;
    case "refund_processed":
      await markRefundProcessed({ provider: name, providerPaymentId: event.providerPaymentId, providerRefundId: event.providerRefundId, amountRefunded: event.amountRefunded });
      return;
    case "ignored":
      return;
  }
}
