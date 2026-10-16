import "server-only";
import { createHash } from "node:crypto";
import Razorpay from "razorpay";
import { z } from "zod";
import { verifyRazorpayPaymentSignature, verifyRazorpayWebhookSignature } from "./signature";
import type { CapturedPayment, CheckoutBooking, PaymentProvider, WebhookEvent } from "./types";
import { WebhookSignatureError } from "./types";

export type RazorpayConfig = { keyId: string; keySecret: string; webhookSecret?: string };

type RzpPayment = { id: string; order_id: string; amount: number | string; currency: string; status: string; method?: string; error_description?: string | null };

/** The slice of the Razorpay SDK we use. Lets tests pass a fake. */
export type RazorpayClient = {
  orders: { create(body: { amount: number; currency: string; receipt: string; notes: Record<string, string> }): Promise<{ id: string; amount: number | string; currency: string }> };
  payments: {
    fetch(id: string): Promise<RzpPayment>;
    capture(id: string, amount: number, currency: string): Promise<RzpPayment>;
    refund(id: string, body: { amount: number; speed: "normal"; receipt: string; notes: Record<string, string> }): Promise<{ id: string; status: string }>;
  };
};

function sdkClient(config: RazorpayConfig): RazorpayClient {
  return new Razorpay({ key_id: config.keyId, key_secret: config.keySecret }) as unknown as RazorpayClient;
}

const callbackSchema = z.object({
  razorpay_order_id: z.string().min(1).max(64),
  razorpay_payment_id: z.string().min(1).max(64),
  razorpay_signature: z.string().min(1).max(256),
});

function toCaptured(p: RzpPayment): CapturedPayment {
  return {
    providerOrderId: p.order_id,
    providerPaymentId: p.id,
    amount: Number(p.amount),
    currency: p.currency.toUpperCase(),
    method: p.method ?? null,
    raw: { id: p.id, status: p.status, method: p.method ?? null },
  };
}

export function createRazorpayProvider(config: RazorpayConfig, client: RazorpayClient = sdkClient(config)): PaymentProvider {
  /** Fetches the payment and captures it if the account does not auto capture. Never trusts the browser's amount. */
  async function ensureCaptured(paymentId: string, orderId: string): Promise<CapturedPayment | { error: string }> {
    let payment = await client.payments.fetch(paymentId);
    if (payment.order_id !== orderId) return { error: "Payment does not belong to this order." };
    if (payment.status === "authorized") payment = await client.payments.capture(payment.id, Number(payment.amount), payment.currency);
    if (payment.status !== "captured") return { error: `Payment is ${payment.status}.` };
    return toCaptured(payment);
  }

  return {
    name: "razorpay",

    async createCheckout(booking: CheckoutBooking) {
      if (booking.currency.toUpperCase() !== "INR") throw new Error("Razorpay checkout is set up for INR only.");
      const order = await client.orders.create({
        amount: booking.total,
        currency: "INR",
        receipt: booking.reference,
        notes: { bookingId: booking.id, reference: booking.reference },
      });
      if (Number(order.amount) !== booking.total) throw new Error("Razorpay created an order for a different amount.");
      return { provider: "razorpay", providerOrderId: order.id, keyId: config.keyId, amount: booking.total, currency: "INR" };
    },

    async verifyClientCallback(payload: unknown) {
      const parsed = callbackSchema.safeParse(payload);
      if (!parsed.success) return { ok: false, reason: "Missing payment details." };
      const { razorpay_order_id: orderId, razorpay_payment_id: paymentId, razorpay_signature: signature } = parsed.data;
      if (!verifyRazorpayPaymentSignature({ orderId, paymentId, signature, keySecret: config.keySecret })) {
        return { ok: false, reason: "Payment signature did not match." };
      }
      const result = await ensureCaptured(paymentId, orderId);
      if ("error" in result) return { ok: false, reason: result.error };
      return { ok: true, payment: result };
    },

    async parseWebhook(rawBody: string, headers: Headers): Promise<WebhookEvent> {
      if (!config.webhookSecret) throw new WebhookSignatureError("Razorpay webhook secret is not set.");
      if (!verifyRazorpayWebhookSignature(rawBody, headers.get("x-razorpay-signature"), config.webhookSecret)) throw new WebhookSignatureError();
      const body = JSON.parse(rawBody) as {
        event: string;
        payload?: { payment?: { entity: RzpPayment }; refund?: { entity: { id: string; payment_id: string; amount: number; status: string } } };
      };
      // Razorpay sends a unique id per event in this header. Fall back to a body hash so retries still dedupe.
      const id = headers.get("x-razorpay-event-id") ?? createHash("sha256").update(rawBody).digest("hex");
      const base = { id, type: body.event, raw: body as unknown as Record<string, unknown> };
      const payment = body.payload?.payment?.entity;

      switch (body.event) {
        case "payment.captured":
          if (!payment) break;
          return { ...base, kind: "captured", payment: toCaptured(payment) };
        case "payment.authorized":
          if (!payment) break;
          return { ...base, kind: "authorized", providerOrderId: payment.order_id, providerPaymentId: payment.id, amount: Number(payment.amount), currency: payment.currency.toUpperCase() };
        case "payment.failed":
          if (!payment) break;
          return { ...base, kind: "failed", providerOrderId: payment.order_id, providerPaymentId: payment.id, reason: payment.error_description ?? "Payment failed." };
        case "refund.processed": {
          const refund = body.payload?.refund?.entity;
          if (!refund) break;
          return { ...base, kind: "refund_processed", providerPaymentId: refund.payment_id, providerRefundId: refund.id, amountRefunded: null };
        }
      }
      return { ...base, kind: "ignored" };
    },

    async refund(input) {
      const refund = await client.payments.refund(input.providerPaymentId, {
        amount: input.amount,
        speed: "normal",
        receipt: input.refundId,
        notes: { refundId: input.refundId, reason: input.reason.slice(0, 250) },
      });
      return { providerRefundId: refund.id, status: refund.status === "processed" ? "processed" : refund.status === "failed" ? "failed" : "pending" };
    },

    async capture(input) {
      const result = await ensureCaptured(input.providerPaymentId, input.providerOrderId);
      if ("error" in result) throw new Error(result.error);
      return result;
    },
  };
}
