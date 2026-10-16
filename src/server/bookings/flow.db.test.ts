/**
 * End to end stay booking against a real Postgres: create, hold, lazy expiry, test payment, duplicate
 * and late captures, cancellation with refund. Opt in with RUN_DB_TESTS=1 (reads DATABASE_URL from
 * .env.local). The stays contracts are replaced by a minimal local implementation that lives only here.
 */
import { existsSync } from "node:fs";
import { and, eq, inArray, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const RUN = process.env.RUN_DB_TESTS === "1";
if (RUN && !process.env.DATABASE_URL && existsSync(".env.local")) process.loadEnvFile(".env.local");

const sent: { to: string; template: string; subject: string }[] = [];
vi.mock("@/server/email/send", () => ({
  sendEmail: async (e: { to: string; template: string; subject: string }) => {
    sent.push({ to: e.to, template: e.template, subject: e.subject });
    return { ok: true };
  },
}));

vi.mock("@/server/stays/inventory", async () => {
  const { db } = await import("@/db");
  const { listingUnits, listings, unitInventory } = await import("@/db/schema");
  const { eachNight } = await import("@/lib/dates");
  type Tx = Parameters<Parameters<(typeof db)["transaction"]>[0]>[0];
  return {
    async quoteStay(input: { unitId: string; checkIn: string; checkOut: string; units: number }, tx?: Tx) {
      const exec = tx ?? db;
      const [row] = await exec.select({ unit: listingUnits, listing: listings }).from(listingUnits).innerJoin(listings, eq(listings.id, listingUnits.listingId)).where(eq(listingUnits.id, input.unitId));
      const nights = eachNight(input.checkIn, input.checkOut);
      const nightly = nights.map((date) => ({ date, price: row.unit.basePrice }));
      const room = nightly.reduce((s, n) => s + n.price, 0) * input.units;
      return {
        available: true as const,
        currency: row.listing.currency,
        nights: nights.length,
        nightly,
        lines: [
          { label: `${nights.length} nights`, amount: room, kind: "base" as const },
          { label: "Platform fee", amount: 0, kind: "fee" as const },
        ],
        total: room,
      };
    },
    async holdInventory(tx: Tx, input: { unitId: string; checkIn: string; checkOut: string; units: number }) {
      const [unit] = await tx.select().from(listingUnits).where(eq(listingUnits.id, input.unitId));
      for (const date of eachNight(input.checkIn, input.checkOut)) {
        await tx.insert(unitInventory).values({ unitId: input.unitId, date, booked: 0 }).onConflictDoNothing();
        const [inv] = await tx.select().from(unitInventory).where(and(eq(unitInventory.unitId, input.unitId), eq(unitInventory.date, date))).for("update");
        if (inv.closed || inv.booked + input.units > (inv.total ?? unit.quantity)) return false;
        await tx.update(unitInventory).set({ booked: inv.booked + input.units }).where(and(eq(unitInventory.unitId, input.unitId), eq(unitInventory.date, date)));
      }
      return true;
    },
    async releaseInventory(tx: Tx, input: { unitId: string; checkIn: string; checkOut: string; units: number }) {
      for (const date of eachNight(input.checkIn, input.checkOut)) {
        await tx
          .update(unitInventory)
          .set({ booked: sql`greatest(${unitInventory.booked} - ${input.units}, 0)` })
          .where(and(eq(unitInventory.unitId, input.unitId), eq(unitInventory.date, date)));
      }
    },
  };
});

/** Fake airline: `airline.fail` makes the next order fail. */
const airline = { fail: false, orders: 0, cancels: 0 };
const fakeOffer = (id: string) => ({
  id,
  provider: "fake",
  total: 612_300,
  currency: "INR",
  baseAmount: 520_000,
  taxAmount: 92_300,
  owner: { iata: "6E", name: "IndiGo" },
  conditions: { refundable: true, refundPenalty: { amount: 100_000, currency: "INR" }, changeable: false },
  expiresAt: new Date(Date.now() + 10 * 60_000).toISOString(),
  passengerIds: ["pas_1"],
  requiresPassport: false,
  slices: [
    {
      id: "sl_1",
      origin: { iata: "DEL", name: "Indira Gandhi International", city: "Delhi", timeZone: "Asia/Kolkata" },
      destination: { iata: "GOI", name: "Dabolim", city: "Goa", timeZone: "Asia/Kolkata" },
      departAt: "2026-12-20T06:15:00",
      arriveAt: "2026-12-20T08:50:00",
      durationMinutes: 155,
      stops: 0,
      segments: [],
    },
  ],
});
vi.mock("@/server/flights", () => ({
  getOffer: async (id: string) => fakeOffer(id),
  getFlightProvider: () => ({
    name: "fake",
    async createOrder(input: { amount: number; currency: string }) {
      if (input.amount !== 612_300 || input.currency !== "INR") throw new Error("wrong amount");
      if (airline.fail) throw new Error("Airline rejected the order");
      airline.orders++;
      return { orderId: `ord_${airline.orders}`, airlineReference: "PNR7QX", raw: {} };
    },
    async cancelOrder() {
      airline.cancels++;
      return { refundAmount: 512_300, currency: "INR" };
    },
  }),
}));

const dbDescribe = RUN ? describe : describe.skip;

dbDescribe("flight booking flow (database)", async () => {
  if (!RUN) return;
  const { db } = await import("@/db");
  const schema = await import("@/db/schema");
  const { createFlightBooking } = await import("./index");
  const { payWithTestProvider } = await import("./checkout");
  const { fulfilBooking } = await import("./confirm");
  const { cancelBooking } = await import("./cancel");
  const ids: string[] = [];
  const tasks: Promise<void>[] = [];
  const schedule = (task: () => Promise<void>) => void tasks.push(task());
  const flush = async () => {
    await Promise.all(tasks.splice(0));
  };
  const passenger = { id: "pas_1", type: "adult" as const, title: "ms" as const, givenName: "Asha", familyName: "Rao", bornOn: "1990-02-03", gender: "f" as const, email: "asha@example.com", phone: "+919800000000" };
  const book = async () => {
    const b = await createFlightBooking({ userId: null, contact: { name: "Asha Rao", email: "asha@example.com" }, offerId: "off_1", passengers: [passenger] });
    ids.push(b.bookingId);
    return b;
  };
  const row = async (id: string) => (await db.select().from(schema.bookings).where(eq(schema.bookings.id, id)))[0];

  afterAll(async () => {
    await flush();
    if (ids.length) await db.delete(schema.bookings).where(inArray(schema.bookings.id, ids));
  });

  it("books at the airline's total with a zero fee line and an expiry no later than the offer", async () => {
    const b = await book();
    const r = await row(b.bookingId);
    expect(r).toMatchObject({ status: "pending_payment", total: 612_300, currency: "INR" });
    expect(r.priceLines.map((l) => l.amount)).toEqual([520_000, 92_300, 0]);
    expect(r.expiresAt!.getTime()).toBeLessThanOrEqual(Date.now() + 10 * 60_000);
  });

  it("tickets once after payment and stores the airline reference", async () => {
    const b = await book();
    await payWithTestProvider(b.bookingId, schedule);
    await flush();
    await fulfilBooking(b.bookingId);
    const [f] = await db.select().from(schema.flightBookings).where(eq(schema.flightBookings.bookingId, b.bookingId));
    expect(f).toMatchObject({ providerOrderId: "ord_1", airlineReference: "PNR7QX" });
    expect(airline.orders).toBe(1);
    expect((await row(b.bookingId)).status).toBe("confirmed");

    const res = await cancelBooking({ bookingId: b.bookingId, actor: { kind: "traveler", userId: null, accessToken: b.accessToken }, reason: "Change of plan" });
    expect(res).toEqual({ status: "refunded", refundAmount: 512_300, currency: "INR" });
    expect(airline.cancels).toBe(1);
  });

  it("refunds in full and fails the booking when the airline refuses the order", async () => {
    airline.fail = true;
    const b = await book();
    await payWithTestProvider(b.bookingId, schedule);
    await flush();
    airline.fail = false;
    expect((await row(b.bookingId)).status).toBe("failed");
    const [refund] = await db.select().from(schema.refunds).where(eq(schema.refunds.bookingId, b.bookingId));
    expect(refund).toMatchObject({ amount: 612_300, status: "processed" });
    expect(sent.some((e) => e.template === "flight-ticketing-failed")).toBe(true);
    await fulfilBooking(b.bookingId);
    expect(airline.orders).toBe(1);
  });
});

dbDescribe("stay booking flow (database)", async () => {
  if (!RUN) return;
  const { db } = await import("@/db");
  const schema = await import("@/db/schema");
  const { newId } = await import("@/lib/id");
  const { addDays, toISODate } = await import("@/lib/dates");
  const { createStayBooking } = await import("./index");
  const { payWithTestProvider } = await import("./checkout");
  const { recordCapture } = await import("./confirm");
  const { cancelBooking, previewCancellation } = await import("./cancel");
  const { BookingError } = await import("./types");

  const hostId = newId("usr");
  const listingId = newId("lst");
  const unitId = newId("unt");
  const checkIn = addDays(toISODate(new Date()), 30);
  const checkOut = addDays(checkIn, 3);
  const bookingIds: string[] = [];
  const tasks: Promise<void>[] = [];
  const schedule = (task: () => Promise<void>) => void tasks.push(task());
  const flush = async () => {
    await Promise.all(tasks.splice(0));
  };
  const input = {
    userId: null,
    contact: { name: "Asha Rao", email: "asha@example.com", phone: "+91 98000 00000" },
    listingId,
    unitId,
    checkIn,
    checkOut,
    adults: 2,
    children: 0,
    units: 1,
  };

  beforeAll(async () => {
    await db.insert(schema.user).values({ id: hostId, name: "Host Test", email: `${hostId}@example.com`, role: "host" });
    await db.insert(schema.listings).values({
      id: listingId,
      hostId,
      status: "published",
      slug: listingId,
      title: "Test cottage",
      city: "Goa",
      countryCode: "IN",
      lat: 15.5,
      lng: 73.8,
      currency: "INR",
      cancellationPolicy: "moderate",
      checkInFrom: "14:00",
      checkOutUntil: "11:00",
    });
    await db.insert(schema.listingUnits).values({ id: unitId, listingId, name: "Whole cottage", basePrice: 300_000, maxGuests: 4, quantity: 1 });
  });

  afterAll(async () => {
    await flush();
    if (bookingIds.length) await db.delete(schema.bookings).where(inArray(schema.bookings.id, bookingIds));
    await db.delete(schema.unitInventory).where(eq(schema.unitInventory.unitId, unitId));
    await db.delete(schema.listings).where(eq(schema.listings.id, listingId));
    await db.delete(schema.user).where(eq(schema.user.id, hostId));
  });

  const booking = async (id: string) => (await db.select().from(schema.bookings).where(eq(schema.bookings.id, id)))[0];
  const booked = async () => (await db.select().from(schema.unitInventory).where(eq(schema.unitInventory.unitId, unitId)).orderBy(schema.unitInventory.date)).map((r) => r.booked);

  let first: Awaited<ReturnType<typeof createStayBooking>>;
  let second: Awaited<ReturnType<typeof createStayBooking>>;

  it("holds inventory and prices from the server", async () => {
    first = await createStayBooking(input);
    bookingIds.push(first.bookingId);
    expect(first.payUrl).toBe(`/checkout/${first.bookingId}?token=${encodeURIComponent(first.accessToken)}`);
    const b = await booking(first.bookingId);
    expect(b.status).toBe("pending_payment");
    expect(b.total).toBe(900_000);
    expect(b.priceLines.find((l) => l.kind === "fee")?.amount).toBe(0);
    expect(b.expiresAt!.getTime() - Date.now()).toBeGreaterThan(19 * 60_000);
    expect(await booked()).toEqual([1, 1, 1]);
  });

  it("refuses the same dates while the hold is live", async () => {
    const err = await createStayBooking(input).catch((e) => e);
    expect(err).toBeInstanceOf(BookingError);
    expect(err.code).toBe("unavailable");
  });

  it("releases an expired hold lazily when someone else books the unit", async () => {
    await db.update(schema.bookings).set({ expiresAt: new Date(Date.now() - 1000) }).where(eq(schema.bookings.id, first.bookingId));
    second = await createStayBooking({ ...input, contact: { ...input.contact, email: "bo@example.com" } });
    bookingIds.push(second.bookingId);
    expect((await booking(first.bookingId)).status).toBe("expired");
    expect(await booked()).toEqual([1, 1, 1]);
  });

  it("confirms with the test provider and owes the host 100%", async () => {
    sent.length = 0;
    const res = await payWithTestProvider(second.bookingId, schedule);
    await flush();
    expect(res.ok && res.outcome.kind).toBe("confirmed");
    const b = await booking(second.bookingId);
    expect(b.status).toBe("confirmed");
    const [payout] = await db.select().from(schema.payouts).where(eq(schema.payouts.bookingId, second.bookingId));
    expect(payout).toMatchObject({ amount: 900_000, currency: "INR", status: "owed", hostId, releaseOn: addDays(checkIn, 1) });
    expect(sent.map((e) => e.template).sort()).toEqual(["booking-confirmed", "host-new-booking"]);
  });

  it("treats a repeated capture as a no-op", async () => {
    const [payment] = await db.select().from(schema.payments).where(eq(schema.payments.bookingId, second.bookingId));
    const again = await recordCapture("test", { providerOrderId: payment.providerOrderId!, providerPaymentId: "testpay_again", amount: 900_000, currency: "INR" });
    expect(again.kind).toBe("already_captured");
    expect((await db.select().from(schema.payouts).where(eq(schema.payouts.bookingId, second.bookingId))).length).toBe(1);
  });

  it("refunds a payment that arrives after the hold ended", async () => {
    await db.insert(schema.payments).values({ id: newId("pay"), bookingId: first.bookingId, provider: "test", status: "failed", amount: 900_000, currency: "INR", providerOrderId: "testord_late" });
    const late = await recordCapture("test", { providerOrderId: "testord_late", providerPaymentId: "testpay_late", amount: 900_000, currency: "INR" });
    expect(late.kind).toBe("refunding");
    expect((await booking(first.bookingId)).status).toBe("expired");
  });

  it("rejects a capture for the wrong amount", async () => {
    const third = await createStayBooking({ ...input, checkIn: addDays(checkIn, 10), checkOut: addDays(checkIn, 11) });
    bookingIds.push(third.bookingId);
    await db.insert(schema.payments).values({ id: newId("pay"), bookingId: third.bookingId, provider: "test", status: "created", amount: 300_000, currency: "INR", providerOrderId: "testord_short" });
    const res = await recordCapture("test", { providerOrderId: "testord_short", providerPaymentId: "testpay_short", amount: 1_000, currency: "INR" });
    expect(res).toMatchObject({ kind: "refunding", reason: "mismatch" });
    expect((await booking(third.bookingId)).status).toBe("pending_payment");
  });

  it("only lets the owner or a token holder cancel", async () => {
    const err = await cancelBooking({ bookingId: second.bookingId, actor: { kind: "traveler", userId: null, accessToken: "wrong" }, reason: "x" }).catch((e) => e);
    expect(err.code).toBe("forbidden");
    const override = await cancelBooking({ bookingId: second.bookingId, actor: { kind: "traveler", userId: null, accessToken: second.accessToken }, reason: "x", refundAmount: 1 }).catch((e) => e);
    expect(override.code).toBe("forbidden");
  });

  it("cancels under the policy, refunds through the provider and frees the dates", async () => {
    const preview = await previewCancellation(second.bookingId);
    expect(preview).toMatchObject({ refundAmount: 900_000, currency: "INR", policy: "Moderate" });
    const res = await cancelBooking({ bookingId: second.bookingId, actor: { kind: "traveler", userId: null, accessToken: second.accessToken }, reason: "Plans changed" });
    expect(res).toEqual({ status: "refunded", refundAmount: 900_000, currency: "INR" });
    expect((await booking(second.bookingId)).status).toBe("refunded");
    const [payout] = await db.select().from(schema.payouts).where(eq(schema.payouts.bookingId, second.bookingId));
    expect(payout.status).toBe("cancelled");
    const [refund] = await db.select().from(schema.refunds).where(and(eq(schema.refunds.bookingId, second.bookingId)));
    expect(refund).toMatchObject({ amount: 900_000, status: "processed" });
    const [payment] = await db.select().from(schema.payments).where(eq(schema.payments.bookingId, second.bookingId));
    expect(payment.status).toBe("refunded");
    expect(await booked()).toEqual([0, 0, 0, 1]);
    const again = await cancelBooking({ bookingId: second.bookingId, actor: { kind: "system" }, reason: "x" }).catch((e) => e);
    expect(again.code).toBe("invalid");
  });

  it("refunds half inside the moderate window and keeps the rest owed to the host", async () => {
    const soon = addDays(toISODate(new Date()), 2);
    const late = await createStayBooking({ ...input, checkIn: soon, checkOut: addDays(soon, 1) });
    bookingIds.push(late.bookingId);
    await payWithTestProvider(late.bookingId, schedule);
    await flush();
    const res = await cancelBooking({ bookingId: late.bookingId, actor: { kind: "traveler", userId: null, accessToken: late.accessToken }, reason: "Sick" });
    expect(res).toEqual({ status: "refunded", refundAmount: 150_000, currency: "INR" });
    const [payout] = await db.select().from(schema.payouts).where(eq(schema.payouts.bookingId, late.bookingId));
    expect(payout).toMatchObject({ status: "owed", amount: 150_000 });
    const [payment] = await db.select().from(schema.payments).where(eq(schema.payments.bookingId, late.bookingId));
    expect(payment.status).toBe("partially_refunded");
  });

  it("lets an admin override the refund, capped at what was paid", async () => {
    const day = addDays(toISODate(new Date()), 50);
    const b = await createStayBooking({ ...input, checkIn: day, checkOut: addDays(day, 1) });
    bookingIds.push(b.bookingId);
    await payWithTestProvider(b.bookingId, schedule);
    await flush();
    const res = await cancelBooking({ bookingId: b.bookingId, actor: { kind: "admin", userId: hostId }, reason: "Goodwill", refundAmount: 10_000_000 });
    expect(res.refundAmount).toBe(300_000);
  });
});
