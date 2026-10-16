import "server-only";
import Stripe from "stripe";
import { z } from "zod";
import { absoluteUrl } from "@/config/site";
import type { CapturedPayment, CheckoutBooking, PaymentProvider, WebhookEvent } from "./types";
import { WebhookSignatureError } from "./types";

export type StripeConfig = { secretKey: string; webhookSecret?: string };

/** Stripe requires a hosted session to stay open at least 30 minutes. */
export const STRIPE_MIN_SESSION_SECONDS = 30 * 60;

function id(value: string | { id: string } | null | undefined) {
  if (!value) return null;
  return typeof value === "string" ? value : value.id;
}

function sessionCapture(session: Stripe.Checkout.Session): CapturedPayment | null {
  const paymentIntent = id(session.payment_intent);
  if (session.payment_status !== "paid" || !paymentIntent || session.amount_total == null || !session.currency) return null;
  return {
    providerOrderId: session.id,
    providerPaymentId: paymentIntent,
    amount: session.amount_total,
    currency: session.currency.toUpperCase(),
    method: session.payment_method_types?.[0] ?? null,
    raw: { sessionId: session.id, paymentIntent },
  };
}

const callbackSchema = z.object({ sessionId: z.string().min(1).max(255) });

export function createStripeProvider(config: StripeConfig, client: Stripe = new Stripe(config.secretKey)): PaymentProvider {
  return {
    name: "stripe",

    async createCheckout(booking: CheckoutBooking) {
      const token = encodeURIComponent(booking.accessToken);
      // Derive everything from the current minute so a repeated request is byte for byte identical,
      // which is what Stripe's idempotency key requires.
      const minute = Math.floor(Date.now() / 60_000);
      const expiresAt = new Date((minute + 1) * 60_000 + STRIPE_MIN_SESSION_SECONDS * 1000);
      const session = await client.checkout.sessions.create(
        {
          mode: "payment",
          client_reference_id: booking.id,
          customer_email: booking.contactEmail,
          line_items: [
            {
              quantity: 1,
              price_data: {
                currency: booking.currency.toLowerCase(),
                unit_amount: booking.total,
                product_data: { name: `Booking ${booking.reference}`, description: booking.description.slice(0, 500) },
              },
            },
          ],
          metadata: { bookingId: booking.id, reference: booking.reference },
          payment_intent_data: { metadata: { bookingId: booking.id, reference: booking.reference } },
          success_url: absoluteUrl(`/bookings/${booking.reference}?token=${token}&session_id={CHECKOUT_SESSION_ID}`),
          cancel_url: absoluteUrl(`/checkout/${booking.id}?token=${token}`),
          expires_at: Math.floor(expiresAt.getTime() / 1000),
        },
        // One session per booking per minute at most, even if the pay button is pressed twice.
        { idempotencyKey: `checkout:${booking.id}:${minute}` },
      );
      if (!session.url) throw new Error("Stripe did not return a checkout URL.");
      if (session.amount_total != null && session.amount_total !== booking.total) throw new Error("Stripe created a session for a different amount.");
      return { provider: "stripe", providerOrderId: session.id, url: session.url, expiresAt: new Date((session.expires_at ?? 0) * 1000 || expiresAt.getTime()) };
    },

    async verifyClientCallback(payload: unknown) {
      const parsed = callbackSchema.safeParse(payload);
      if (!parsed.success) return { ok: false, reason: "Missing checkout session." };
      const session = await client.checkout.sessions.retrieve(parsed.data.sessionId);
      const payment = sessionCapture(session);
      if (!payment) return { ok: false, reason: `Checkout is ${session.payment_status}.` };
      return { ok: true, payment };
    },

    async parseWebhook(rawBody: string, headers: Headers): Promise<WebhookEvent> {
      if (!config.webhookSecret) throw new WebhookSignatureError("Stripe webhook secret is not set.");
      const signature = headers.get("stripe-signature");
      if (!signature) throw new WebhookSignatureError();
      let event: Stripe.Event;
      try {
        event = client.webhooks.constructEvent(rawBody, signature, config.webhookSecret);
      } catch {
        throw new WebhookSignatureError();
      }
      const base = { id: event.id, type: event.type, raw: JSON.parse(rawBody) as Record<string, unknown> };

      switch (event.type) {
        case "checkout.session.completed":
        case "checkout.session.async_payment_succeeded": {
          const payment = sessionCapture(event.data.object);
          // "completed" with payment still processing (bank debits) is confirmed later by async_payment_succeeded.
          return payment ? { ...base, kind: "captured", payment } : { ...base, kind: "ignored" };
        }
        case "checkout.session.expired":
        case "checkout.session.async_payment_failed": {
          const session = event.data.object;
          return {
            ...base,
            kind: "failed",
            providerOrderId: session.id,
            providerPaymentId: id(session.payment_intent),
            reason: event.type === "checkout.session.expired" ? "Checkout session expired." : "Payment failed.",
          };
        }
        case "charge.refunded": {
          const charge = event.data.object;
          const paymentIntent = id(charge.payment_intent);
          if (!paymentIntent) return { ...base, kind: "ignored" };
          return { ...base, kind: "refund_processed", providerPaymentId: paymentIntent, providerRefundId: null, amountRefunded: charge.amount_refunded };
        }
      }
      return { ...base, kind: "ignored" };
    },

    async refund(input) {
      const refund = await client.refunds.create(
        {
          payment_intent: input.providerPaymentId,
          amount: input.amount,
          reason: "requested_by_customer",
          metadata: { refundId: input.refundId, reason: input.reason.slice(0, 450) },
        },
        { idempotencyKey: `refund:${input.refundId}` },
      );
      const status = refund.status === "succeeded" ? "processed" : refund.status === "failed" || refund.status === "canceled" ? "failed" : "pending";
      return { providerRefundId: refund.id, status };
    },

    async expireCheckout(providerOrderId: string) {
      const session = await client.checkout.sessions.retrieve(providerOrderId);
      if (session.status === "open") await client.checkout.sessions.expire(providerOrderId);
    },
  };
}
