import "server-only";
import { features } from "@/config/env";
import { createRazorpayProvider } from "./razorpay";
import { createStripeProvider } from "./stripe";
import { createTestProvider, testPaymentsAllowed } from "./test";
import type { PaymentProvider, ProviderName } from "./types";

export type { PaymentProvider, ProviderName } from "./types";

/**
 * Which provider takes a payment in this currency:
 * INR goes to Razorpay when configured, other currencies to Stripe when configured,
 * then the test provider when allowed. Null means payments are not connected.
 */
export function choosePaymentProvider(currency: string): ProviderName | null {
  const code = currency.toUpperCase();
  if (code === "INR" && features.razorpay()) return "razorpay";
  if (code !== "INR" && features.stripe()) return "stripe";
  if (testPaymentsAllowed()) return "test";
  return null;
}

/** Builds the adapter for a provider from env, or null when it is not configured (or not allowed, for test). */
export function getPaymentProvider(name: ProviderName | "manual"): PaymentProvider | null {
  switch (name) {
    case "razorpay":
      if (!features.razorpay()) return null;
      return createRazorpayProvider({
        keyId: process.env.RAZORPAY_KEY_ID!,
        keySecret: process.env.RAZORPAY_KEY_SECRET!,
        webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET,
      });
    case "stripe":
      if (!features.stripe()) return null;
      return createStripeProvider({ secretKey: process.env.STRIPE_SECRET_KEY!, webhookSecret: process.env.STRIPE_WEBHOOK_SECRET });
    case "test":
      return testPaymentsAllowed() ? createTestProvider() : null;
    default:
      return null;
  }
}
