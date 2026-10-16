import { createHmac } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { createRazorpayProvider, type RazorpayClient } from "./razorpay";
import { safeEqual, verifyRazorpayPaymentSignature, verifyRazorpayWebhookSignature } from "./signature";
import { WebhookSignatureError } from "./types";

const keySecret = "rzp_test_secret_value";
const webhookSecret = "whsec_rzp_value";
const sign = (payload: string, secret: string) => createHmac("sha256", secret).update(payload).digest("hex");

describe("safeEqual", () => {
  it("compares strings of any length", () => {
    expect(safeEqual("abc", "abc")).toBe(true);
    expect(safeEqual("abc", "abd")).toBe(false);
    expect(safeEqual("abc", "abcd")).toBe(false);
    expect(safeEqual("", "")).toBe(true);
  });
});

describe("Razorpay checkout callback signature", () => {
  const orderId = "order_N1";
  const paymentId = "pay_P1";
  const good = sign(`${orderId}|${paymentId}`, keySecret);

  it("accepts the HMAC of order_id|payment_id with the key secret", () => {
    expect(verifyRazorpayPaymentSignature({ orderId, paymentId, signature: good, keySecret })).toBe(true);
  });
  it("rejects a signature for another payment, another order, or another secret", () => {
    expect(verifyRazorpayPaymentSignature({ orderId, paymentId: "pay_P2", signature: good, keySecret })).toBe(false);
    expect(verifyRazorpayPaymentSignature({ orderId: "order_N2", paymentId, signature: good, keySecret })).toBe(false);
    expect(verifyRazorpayPaymentSignature({ orderId, paymentId, signature: sign(`${orderId}|${paymentId}`, "other"), keySecret })).toBe(false);
  });
  it("rejects swapped fields and empty values", () => {
    expect(verifyRazorpayPaymentSignature({ orderId, paymentId, signature: sign(`${paymentId}|${orderId}`, keySecret), keySecret })).toBe(false);
    expect(verifyRazorpayPaymentSignature({ orderId, paymentId, signature: "", keySecret })).toBe(false);
    expect(verifyRazorpayPaymentSignature({ orderId, paymentId, signature: good, keySecret: "" })).toBe(false);
  });
});

describe("Razorpay webhook signature", () => {
  const body = JSON.stringify({ event: "payment.captured", payload: {} });
  it("is checked over the exact raw body", () => {
    expect(verifyRazorpayWebhookSignature(body, sign(body, webhookSecret), webhookSecret)).toBe(true);
    expect(verifyRazorpayWebhookSignature(`${body} `, sign(body, webhookSecret), webhookSecret)).toBe(false);
    expect(verifyRazorpayWebhookSignature(body, null, webhookSecret)).toBe(false);
    expect(verifyRazorpayWebhookSignature(body, sign(body, keySecret), webhookSecret)).toBe(false);
  });
});

function fakeClient(payment: { status: string; amount: number; order_id?: string }) {
  const p = { id: "pay_P1", order_id: payment.order_id ?? "order_N1", amount: payment.amount, currency: "INR", status: payment.status, method: "upi" };
  const client: RazorpayClient = {
    orders: { create: vi.fn(async (b) => ({ id: "order_N1", amount: b.amount, currency: b.currency })) },
    payments: {
      fetch: vi.fn(async () => ({ ...p })),
      capture: vi.fn(async () => ({ ...p, status: "captured" })),
      refund: vi.fn(async () => ({ id: "rfnd_1", status: "processed" })),
    },
  };
  return client;
}

describe("Razorpay adapter", () => {
  const config = { keyId: "rzp_test_key", keySecret, webhookSecret };

  it("creates an order in paise with the booking reference as receipt", async () => {
    const client = fakeClient({ status: "created", amount: 482_000 });
    const provider = createRazorpayProvider(config, client);
    const session = await provider.createCheckout({
      id: "bkg_1",
      reference: "K7Q-4MZ2",
      total: 482_000,
      currency: "INR",
      contactName: "Asha",
      contactEmail: "asha@example.com",
      contactPhone: null,
      accessToken: "t",
      description: "Stay",
      expiresAt: null,
    });
    expect(client.orders.create).toHaveBeenCalledWith({ amount: 482_000, currency: "INR", receipt: "K7Q-4MZ2", notes: { bookingId: "bkg_1", reference: "K7Q-4MZ2" } });
    expect(session).toEqual({ provider: "razorpay", providerOrderId: "order_N1", keyId: "rzp_test_key", amount: 482_000, currency: "INR" });
  });

  it("verifies the callback, then reads the amount from Razorpay, not the browser", async () => {
    const client = fakeClient({ status: "captured", amount: 482_000 });
    const provider = createRazorpayProvider(config, client);
    const result = await provider.verifyClientCallback({
      razorpay_order_id: "order_N1",
      razorpay_payment_id: "pay_P1",
      razorpay_signature: sign("order_N1|pay_P1", keySecret),
      amount: 1,
    });
    expect(result).toMatchObject({ ok: true, payment: { providerOrderId: "order_N1", providerPaymentId: "pay_P1", amount: 482_000, currency: "INR" } });
  });

  it("captures an authorized payment during the callback", async () => {
    const client = fakeClient({ status: "authorized", amount: 482_000 });
    const provider = createRazorpayProvider(config, client);
    const result = await provider.verifyClientCallback({ razorpay_order_id: "order_N1", razorpay_payment_id: "pay_P1", razorpay_signature: sign("order_N1|pay_P1", keySecret) });
    expect(client.payments.capture).toHaveBeenCalledWith("pay_P1", 482_000, "INR");
    expect(result.ok).toBe(true);
  });

  it("rejects a forged callback without calling Razorpay", async () => {
    const client = fakeClient({ status: "captured", amount: 482_000 });
    const provider = createRazorpayProvider(config, client);
    const result = await provider.verifyClientCallback({ razorpay_order_id: "order_N1", razorpay_payment_id: "pay_P1", razorpay_signature: "deadbeef" });
    expect(result.ok).toBe(false);
    expect(client.payments.fetch).not.toHaveBeenCalled();
  });

  it("rejects a payment that belongs to another order", async () => {
    const client = fakeClient({ status: "captured", amount: 482_000, order_id: "order_OTHER" });
    const provider = createRazorpayProvider(config, client);
    const result = await provider.verifyClientCallback({ razorpay_order_id: "order_N1", razorpay_payment_id: "pay_P1", razorpay_signature: sign("order_N1|pay_P1", keySecret) });
    expect(result.ok).toBe(false);
  });

  it("parses signed webhooks and refuses unsigned ones", async () => {
    const provider = createRazorpayProvider(config, fakeClient({ status: "captured", amount: 1 }));
    const body = JSON.stringify({
      event: "payment.captured",
      payload: { payment: { entity: { id: "pay_P1", order_id: "order_N1", amount: 482_000, currency: "INR", status: "captured", method: "card" } } },
    });
    const headers = new Headers({ "x-razorpay-signature": sign(body, webhookSecret), "x-razorpay-event-id": "evt_1" });
    const event = await provider.parseWebhook(body, headers);
    expect(event).toMatchObject({ id: "evt_1", kind: "captured", payment: { providerOrderId: "order_N1", amount: 482_000, currency: "INR" } });

    await expect(provider.parseWebhook(body, new Headers({ "x-razorpay-signature": "bad" }))).rejects.toBeInstanceOf(WebhookSignatureError);
  });

  it("maps failed and refund events", async () => {
    const provider = createRazorpayProvider(config, fakeClient({ status: "captured", amount: 1 }));
    const failed = JSON.stringify({ event: "payment.failed", payload: { payment: { entity: { id: "pay_P1", order_id: "order_N1", amount: 1, currency: "INR", status: "failed", error_description: "Card declined" } } } });
    expect(await provider.parseWebhook(failed, new Headers({ "x-razorpay-signature": sign(failed, webhookSecret) }))).toMatchObject({ kind: "failed", reason: "Card declined" });
    const refund = JSON.stringify({ event: "refund.processed", payload: { refund: { entity: { id: "rfnd_1", payment_id: "pay_P1", amount: 100, status: "processed" } } } });
    expect(await provider.parseWebhook(refund, new Headers({ "x-razorpay-signature": sign(refund, webhookSecret) }))).toMatchObject({ kind: "refund_processed", providerPaymentId: "pay_P1", providerRefundId: "rfnd_1" });
  });
});
