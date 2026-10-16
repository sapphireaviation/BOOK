import "server-only";
import { z } from "zod";
import { features } from "@/config/env";
import { newId } from "@/lib/id";
import type { PaymentProvider } from "./types";
import { WebhookSignatureError } from "./types";

/** Test payments run outside production, or in production only with ALLOW_TEST_PAYMENTS=true. */
export function testPaymentsAllowed() {
  return features.testPayments();
}

const callbackSchema = z.object({
  providerOrderId: z.string().min(1),
  /** Filled in by our own server from the payment row, never from the browser. */
  amount: z.number().int().positive(),
  currency: z.string().length(3),
});

/**
 * Simulated provider: checkout and capture happen instantly with no money moving.
 * Every method re-checks that test payments are allowed, so a misconfigured production build cannot use it.
 */
export function createTestProvider(): PaymentProvider {
  function guard() {
    if (!testPaymentsAllowed()) throw new Error("Test payments are turned off.");
  }
  return {
    name: "test",

    async createCheckout() {
      guard();
      return { provider: "test", providerOrderId: newId("testord") };
    },

    async verifyClientCallback(payload: unknown) {
      guard();
      const parsed = callbackSchema.safeParse(payload);
      if (!parsed.success) return { ok: false, reason: "Missing test payment details." };
      return {
        ok: true,
        payment: {
          providerOrderId: parsed.data.providerOrderId,
          providerPaymentId: newId("testpay"),
          amount: parsed.data.amount,
          currency: parsed.data.currency,
          method: "test_card",
          raw: { simulated: true },
        },
      };
    },

    async parseWebhook() {
      throw new WebhookSignatureError("The test provider does not send webhooks.");
    },

    async refund() {
      guard();
      return { providerRefundId: newId("testrfnd"), status: "processed" };
    },
  };
}
