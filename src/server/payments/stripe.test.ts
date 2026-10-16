import Stripe from "stripe";
import { describe, expect, it } from "vitest";
import { createStripeProvider } from "./stripe";
import { WebhookSignatureError } from "./types";

const webhookSecret = "whsec_test_secret";
const stripe = new Stripe("sk_test_dummy");
const provider = createStripeProvider({ secretKey: "sk_test_dummy", webhookSecret }, stripe);

function signed(event: Record<string, unknown>) {
  const payload = JSON.stringify(event);
  const header = stripe.webhooks.generateTestHeaderString({ payload, secret: webhookSecret });
  return { payload, headers: new Headers({ "stripe-signature": header }) };
}

const session = (over: Record<string, unknown> = {}) => ({
  id: "cs_test_1",
  object: "checkout.session",
  payment_status: "paid",
  payment_intent: "pi_1",
  amount_total: 12_550,
  currency: "eur",
  payment_method_types: ["card"],
  ...over,
});

describe("Stripe webhooks", () => {
  it("turns a paid checkout.session.completed into a capture keyed by session id", async () => {
    const { payload, headers } = signed({ id: "evt_1", object: "event", type: "checkout.session.completed", data: { object: session() } });
    const event = await provider.parseWebhook(payload, headers);
    expect(event).toMatchObject({ id: "evt_1", kind: "captured", payment: { providerOrderId: "cs_test_1", providerPaymentId: "pi_1", amount: 12_550, currency: "EUR" } });
  });

  it("ignores a completed session whose payment is still processing", async () => {
    const { payload, headers } = signed({ id: "evt_2", object: "event", type: "checkout.session.completed", data: { object: session({ payment_status: "unpaid" }) } });
    expect((await provider.parseWebhook(payload, headers)).kind).toBe("ignored");
  });

  it("maps expired sessions and refunds", async () => {
    const expired = signed({ id: "evt_3", object: "event", type: "checkout.session.expired", data: { object: session({ payment_status: "unpaid", payment_intent: null }) } });
    expect(await provider.parseWebhook(expired.payload, expired.headers)).toMatchObject({ kind: "failed", providerOrderId: "cs_test_1" });
    const refunded = signed({ id: "evt_4", object: "event", type: "charge.refunded", data: { object: { id: "ch_1", object: "charge", payment_intent: "pi_1", amount_refunded: 6_000 } } });
    expect(await provider.parseWebhook(refunded.payload, refunded.headers)).toMatchObject({ kind: "refund_processed", providerPaymentId: "pi_1", amountRefunded: 6_000 });
  });

  it("rejects a tampered body or a missing signature", async () => {
    const { payload, headers } = signed({ id: "evt_5", object: "event", type: "checkout.session.completed", data: { object: session() } });
    await expect(provider.parseWebhook(payload.replace("12550", "1"), headers)).rejects.toBeInstanceOf(WebhookSignatureError);
    await expect(provider.parseWebhook(payload, new Headers())).rejects.toBeInstanceOf(WebhookSignatureError);
  });
});
