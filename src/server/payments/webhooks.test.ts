import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Webhook idempotency without a database: payment_events is an in-memory set with the same
 * "insert ... on conflict do nothing returning" behaviour, and confirmBooking is a spy.
 */
const events = new Set<string>();
const deleted: string[] = [];

vi.mock("@/db", () => {
  const db = {
    insert: () => ({
      values: (v: { id: string }) => ({
        onConflictDoNothing: () => ({
          returning: async () => {
            if (events.has(v.id)) return [];
            events.add(v.id);
            return [{ id: v.id }];
          },
        }),
      }),
    }),
    delete: () => ({
      where: async () => {
        // Only ever called with the event that just failed.
        const last = [...events].pop()!;
        events.delete(last);
        deleted.push(last);
      },
    }),
    update: () => ({ set: () => ({ where: async () => [] }) }),
    select: () => ({ from: () => ({ where: async () => [] }) }),
  };
  return { db };
});

const confirmBooking = vi.fn(async () => ({ kind: "confirmed", bookingId: "bkg_1", bookingKind: "stay" }));
const markRefundProcessed = vi.fn(async () => ({ matched: 1 }));
vi.mock("@/server/bookings/confirm", () => ({ confirmBooking: (...args: unknown[]) => (confirmBooking as (...a: unknown[]) => unknown)(...args) }));
vi.mock("@/server/bookings/refunds", () => ({ markRefundProcessed: (...args: unknown[]) => (markRefundProcessed as (...a: unknown[]) => unknown)(...args) }));

const { handleWebhook } = await import("./webhooks");

const secret = "whsec_rzp";
function razorpayDelivery(eventId: string) {
  const body = JSON.stringify({
    event: "payment.captured",
    payload: { payment: { entity: { id: "pay_1", order_id: "order_1", amount: 5_000, currency: "INR", status: "captured" } } },
  });
  return { body, headers: new Headers({ "x-razorpay-signature": createHmac("sha256", secret).update(body).digest("hex"), "x-razorpay-event-id": eventId }) };
}

const schedule = () => {};

describe("webhook idempotency", () => {
  beforeEach(() => {
    events.clear();
    deleted.length = 0;
    confirmBooking.mockClear();
    vi.stubEnv("RAZORPAY_KEY_ID", "rzp_key");
    vi.stubEnv("RAZORPAY_KEY_SECRET", "rzp_secret");
    vi.stubEnv("RAZORPAY_WEBHOOK_SECRET", secret);
  });
  afterEach(() => vi.unstubAllEnvs());

  it("processes an event once, however many times it is delivered", async () => {
    const d = razorpayDelivery("evt_A");
    const first = await handleWebhook("razorpay", d.body, d.headers, schedule);
    const second = await handleWebhook("razorpay", d.body, d.headers, schedule);
    const third = await handleWebhook("razorpay", d.body, d.headers, schedule);
    expect(first).toEqual({ status: 200, body: { ok: true, kind: "captured" } });
    expect(second.body.duplicate).toBe(true);
    expect(third.body.duplicate).toBe(true);
    expect(confirmBooking).toHaveBeenCalledTimes(1);
    expect(confirmBooking).toHaveBeenCalledWith("razorpay", expect.objectContaining({ providerOrderId: "order_1", amount: 5_000 }), { schedule });
  });

  it("keys events per provider and event id", async () => {
    await handleWebhook("razorpay", razorpayDelivery("evt_A").body, razorpayDelivery("evt_A").headers, schedule);
    await handleWebhook("razorpay", razorpayDelivery("evt_B").body, razorpayDelivery("evt_B").headers, schedule);
    expect([...events]).toEqual(["razorpay:evt_A", "razorpay:evt_B"]);
    expect(confirmBooking).toHaveBeenCalledTimes(2);
  });

  it("forgets the event when processing fails so the provider's retry is applied", async () => {
    const d = razorpayDelivery("evt_C");
    confirmBooking.mockRejectedValueOnce(new Error("database down"));
    await expect(handleWebhook("razorpay", d.body, d.headers, schedule)).rejects.toThrow("database down");
    expect(deleted).toEqual(["razorpay:evt_C"]);
    const retry = await handleWebhook("razorpay", d.body, d.headers, schedule);
    expect(retry.body).toEqual({ ok: true, kind: "captured" });
    expect(confirmBooking).toHaveBeenCalledTimes(2);
  });

  it("records nothing for a bad signature", async () => {
    const d = razorpayDelivery("evt_D");
    const res = await handleWebhook("razorpay", d.body, new Headers({ "x-razorpay-signature": "0".repeat(64), "x-razorpay-event-id": "evt_D" }), schedule);
    expect(res.status).toBe(400);
    expect(events.size).toBe(0);
    expect(confirmBooking).not.toHaveBeenCalled();
  });

  it("answers 404 when the provider is not configured", async () => {
    vi.stubEnv("RAZORPAY_KEY_SECRET", "");
    const d = razorpayDelivery("evt_E");
    expect((await handleWebhook("razorpay", d.body, d.headers, schedule)).status).toBe(404);
  });
});
