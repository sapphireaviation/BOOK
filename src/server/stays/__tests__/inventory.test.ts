import { and, eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { db } from "@/db";
import { unitInventory } from "@/db/schema";
import { holdInventory, quoteStay, releaseInventory } from "../inventory";
import { fixtures } from "./fixtures";

const fx = fixtures();
afterAll(fx.cleanup);

async function nights(unitId: string) {
  const rows = await db
    .select({ date: unitInventory.date, booked: unitInventory.booked })
    .from(unitInventory)
    .where(eq(unitInventory.unitId, unitId))
    .orderBy(unitInventory.date);
  return rows;
}

const stay = { checkIn: "2027-01-10", checkOut: "2027-01-13" };

describe("quoteStay (database)", () => {
  it("prices from the listing, the unit and inventory overrides", async () => {
    const l = await fx.listing({ cleaningFee: 50_000, taxBps: 1200 }, [{ basePrice: 300_000, extraGuestPrice: 40_000, includedGuests: 2, maxGuests: 4 }]);
    await db.insert(unitInventory).values({ unitId: l.unitIds[0], date: "2027-01-11", price: 360_000 });

    const q = await quoteStay({ listingId: l.id, unitId: l.unitIds[0], ...stay, adults: 3, children: 0, units: 1 });
    if (!q.available) throw new Error(q.reason);
    expect(q.nightly.map((n) => n.price)).toEqual([340_000, 400_000, 340_000]);
    expect(q.lines).toEqual([
      { kind: "base", label: "3 nights", amount: 1_080_000 },
      { kind: "other", label: "Cleaning fee", amount: 50_000 },
      { kind: "tax", label: "Taxes (12%)", amount: 129_600 },
      { kind: "fee", label: "Platform fee", amount: 0 },
    ]);
    expect(q.total).toBe(1_259_600);
  });

  it("refuses a unit from another listing, a draft listing and an inactive unit", async () => {
    const a = await fx.listing();
    const b = await fx.listing();
    expect((await quoteStay({ listingId: a.id, unitId: b.unitIds[0], ...stay, adults: 1, children: 0, units: 1 })).available).toBe(false);

    const draft = await fx.listing({ status: "draft" });
    expect((await quoteStay({ listingId: draft.id, unitId: draft.unitIds[0], ...stay, adults: 1, children: 0, units: 1 })).available).toBe(false);

    const inactive = await fx.listing({}, [{ active: false }]);
    expect((await quoteStay({ listingId: inactive.id, unitId: inactive.unitIds[0], ...stay, adults: 1, children: 0, units: 1 })).available).toBe(false);
  });

  it("sees closed nights and full nights", async () => {
    const l = await fx.listing({}, [{ quantity: 1 }]);
    await db.insert(unitInventory).values({ unitId: l.unitIds[0], date: "2027-01-12", closed: true });
    expect((await quoteStay({ listingId: l.id, unitId: l.unitIds[0], ...stay, adults: 1, children: 0, units: 1 })).available).toBe(false);
    expect(
      (await quoteStay({ listingId: l.id, unitId: l.unitIds[0], checkIn: "2027-01-10", checkOut: "2027-01-12", adults: 1, children: 0, units: 1 })).available,
    ).toBe(true);
  });
});

describe("holdInventory and releaseInventory", () => {
  it("creates missing rows, increments booked, and releases without going below zero", async () => {
    const l = await fx.listing({}, [{ quantity: 2 }]);
    const unitId = l.unitIds[0];

    const ok = await db.transaction((tx) => holdInventory(tx, { unitId, ...stay, units: 2 }));
    expect(ok).toBe(true);
    expect(await nights(unitId)).toEqual([
      { date: "2027-01-10", booked: 2 },
      { date: "2027-01-11", booked: 2 },
      { date: "2027-01-12", booked: 2 },
    ]);

    // Full now: a further hold fails and changes nothing.
    expect(await db.transaction((tx) => holdInventory(tx, { unitId, ...stay, units: 1 }))).toBe(false);

    await db.transaction((tx) => releaseInventory(tx, { unitId, ...stay, units: 1 }));
    expect((await nights(unitId)).map((n) => n.booked)).toEqual([1, 1, 1]);

    await db.transaction((tx) => releaseInventory(tx, { unitId, ...stay, units: 5 }));
    expect((await nights(unitId)).map((n) => n.booked)).toEqual([0, 0, 0]);
  });

  it("makes no writes when any night fails", async () => {
    const l = await fx.listing({}, [{ quantity: 1 }]);
    const unitId = l.unitIds[0];
    await db.insert(unitInventory).values({ unitId, date: "2027-01-12", closed: true });

    const ok = await db.transaction((tx) => holdInventory(tx, { unitId, ...stay, units: 1 }));
    expect(ok).toBe(false);
    // Only the pre-existing closed row is there; no rows were created for the other nights.
    expect(await nights(unitId)).toEqual([{ date: "2027-01-12", booked: 0 }]);
  });

  it("leaves the caller's transaction usable after a rejected hold", async () => {
    const l = await fx.listing({}, [{ quantity: 1 }]);
    const unitId = l.unitIds[0];
    await db.insert(unitInventory).values({ unitId, date: "2027-01-11", booked: 1 });

    const result = await db.transaction(async (tx) => {
      const first = await holdInventory(tx, { unitId, ...stay, units: 1 });
      const second = await holdInventory(tx, { unitId, checkIn: "2027-01-12", checkOut: "2027-01-14", units: 1 });
      return { first, second };
    });
    expect(result).toEqual({ first: false, second: true });
    expect(await nights(unitId)).toEqual([
      { date: "2027-01-11", booked: 1 },
      { date: "2027-01-12", booked: 1 },
      { date: "2027-01-13", booked: 1 },
    ]);
  });

  it("respects per-date total overrides", async () => {
    const l = await fx.listing({}, [{ quantity: 1 }]);
    const unitId = l.unitIds[0];
    await db.insert(unitInventory).values({ unitId, date: "2027-01-10", total: 3, booked: 2 });
    expect(await db.transaction((tx) => holdInventory(tx, { unitId, checkIn: "2027-01-10", checkOut: "2027-01-11", units: 1 }))).toBe(true);
    expect(await db.transaction((tx) => holdInventory(tx, { unitId, checkIn: "2027-01-10", checkOut: "2027-01-11", units: 1 }))).toBe(false);
  });

  it("returns false for an unknown unit or bad dates", async () => {
    expect(await db.transaction((tx) => holdInventory(tx, { unitId: "unt_missing", ...stay, units: 1 }))).toBe(false);
    const l = await fx.listing();
    expect(await db.transaction((tx) => holdInventory(tx, { unitId: l.unitIds[0], checkIn: "2027-01-13", checkOut: "2027-01-10", units: 1 }))).toBe(false);
  });

  it("lets exactly one of two parallel holds take the last unit", async () => {
    const l = await fx.listing({}, [{ quantity: 3 }]);
    const unitId = l.unitIds[0];
    await db.insert(unitInventory).values({ unitId, date: "2027-01-11", booked: 2 });

    for (let round = 0; round < 5; round++) {
      // Each round frees the last unit on the contested night, then races two holds for it.
      await db.update(unitInventory).set({ booked: 2 }).where(eq(unitInventory.unitId, unitId));
      const attempt = () =>
        db.transaction(async (tx) => {
          const ok = await holdInventory(tx, { unitId, ...stay, units: 1 });
          // Hold the locks briefly so the two transactions overlap.
          await new Promise((r) => setTimeout(r, 30));
          return ok;
        });
      const results = await Promise.all([attempt(), attempt()]);
      expect(results.filter(Boolean)).toHaveLength(1);
      const contested = await db
        .select({ booked: unitInventory.booked })
        .from(unitInventory)
        .where(and(eq(unitInventory.unitId, unitId), eq(unitInventory.date, "2027-01-11")));
      expect(contested[0].booked).toBe(3);
    }
  });
});
