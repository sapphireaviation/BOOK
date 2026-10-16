import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { choosePaymentProvider, getPaymentProvider } from "./index";
import { testPaymentsAllowed } from "./test";

const KEYS = ["RAZORPAY_KEY_ID", "RAZORPAY_KEY_SECRET", "STRIPE_SECRET_KEY", "ALLOW_TEST_PAYMENTS", "NODE_ENV"] as const;

function setEnv(env: Partial<Record<(typeof KEYS)[number], string>>) {
  for (const k of KEYS) vi.stubEnv(k, env[k] ?? "");
}

describe("payment provider selection", () => {
  beforeEach(() => setEnv({}));
  afterEach(() => vi.unstubAllEnvs());

  it("uses Razorpay for INR when configured", () => {
    setEnv({ NODE_ENV: "production", RAZORPAY_KEY_ID: "rzp", RAZORPAY_KEY_SECRET: "s", STRIPE_SECRET_KEY: "sk" });
    expect(choosePaymentProvider("INR")).toBe("razorpay");
    expect(choosePaymentProvider("inr")).toBe("razorpay");
  });

  it("uses Stripe for other currencies when configured", () => {
    setEnv({ NODE_ENV: "production", RAZORPAY_KEY_ID: "rzp", RAZORPAY_KEY_SECRET: "s", STRIPE_SECRET_KEY: "sk" });
    expect(choosePaymentProvider("EUR")).toBe("stripe");
    expect(choosePaymentProvider("USD")).toBe("stripe");
  });

  it("does not send INR to Stripe or other currencies to Razorpay", () => {
    setEnv({ NODE_ENV: "production", STRIPE_SECRET_KEY: "sk" });
    expect(choosePaymentProvider("INR")).toBeNull();
    setEnv({ NODE_ENV: "production", RAZORPAY_KEY_ID: "rzp", RAZORPAY_KEY_SECRET: "s" });
    expect(choosePaymentProvider("USD")).toBeNull();
  });

  it("needs both Razorpay keys", () => {
    setEnv({ NODE_ENV: "production", RAZORPAY_KEY_ID: "rzp" });
    expect(choosePaymentProvider("INR")).toBeNull();
  });

  it("falls back to the test provider outside production", () => {
    setEnv({ NODE_ENV: "development" });
    expect(choosePaymentProvider("INR")).toBe("test");
    setEnv({ NODE_ENV: "test", STRIPE_SECRET_KEY: "sk" });
    expect(choosePaymentProvider("INR")).toBe("test");
    expect(choosePaymentProvider("EUR")).toBe("stripe");
  });

  it("never allows test payments in production unless ALLOW_TEST_PAYMENTS is exactly true", () => {
    setEnv({ NODE_ENV: "production" });
    expect(testPaymentsAllowed()).toBe(false);
    expect(choosePaymentProvider("INR")).toBeNull();
    expect(getPaymentProvider("test")).toBeNull();

    for (const v of ["1", "yes", "TRUE", "false"]) {
      setEnv({ NODE_ENV: "production", ALLOW_TEST_PAYMENTS: v });
      expect(testPaymentsAllowed()).toBe(false);
    }

    setEnv({ NODE_ENV: "production", ALLOW_TEST_PAYMENTS: "true" });
    expect(testPaymentsAllowed()).toBe(true);
    expect(choosePaymentProvider("INR")).toBe("test");
    expect(getPaymentProvider("test")?.name).toBe("test");
  });

  it("prefers a real provider over the test one when both are available", () => {
    setEnv({ NODE_ENV: "development", RAZORPAY_KEY_ID: "rzp", RAZORPAY_KEY_SECRET: "s" });
    expect(choosePaymentProvider("INR")).toBe("razorpay");
  });

  it("does not build adapters that are not configured", () => {
    setEnv({ NODE_ENV: "production" });
    expect(getPaymentProvider("razorpay")).toBeNull();
    expect(getPaymentProvider("stripe")).toBeNull();
    expect(getPaymentProvider("manual")).toBeNull();
  });

  it("refuses test captures once test payments are switched off", async () => {
    setEnv({ NODE_ENV: "development" });
    const provider = getPaymentProvider("test")!;
    setEnv({ NODE_ENV: "production" });
    await expect(provider.createCheckout({} as never)).rejects.toThrow(/turned off/);
    await expect(provider.verifyClientCallback({ providerOrderId: "x", amount: 1, currency: "INR" })).rejects.toThrow(/turned off/);
  });
});
