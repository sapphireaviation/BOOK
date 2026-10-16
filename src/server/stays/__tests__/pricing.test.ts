import { describe, expect, it } from "vitest";
import { extraGuests, priceStay, roomLineLabel, taxLabel } from "../pricing";
import type { InventoryNight, PricingListing, PricingUnit } from "../types";

const listing: PricingListing = {
  status: "published",
  kind: "stay",
  currency: "INR",
  cleaningFee: 0,
  taxBps: 0,
  minNights: 1,
  maxNights: 30,
};

const unit: PricingUnit = {
  active: true,
  maxGuests: 3,
  basePrice: 250_000, // ₹2,500
  extraGuestPrice: 50_000,
  includedGuests: 2,
  quantity: 2,
};

function quote(over: Partial<Parameters<typeof priceStay>[0]> = {}) {
  return priceStay({
    listing,
    unit,
    checkIn: "2026-11-10",
    checkOut: "2026-11-13",
    adults: 2,
    children: 0,
    units: 1,
    inventory: [],
    ...over,
  });
}

describe("priceStay", () => {
  it("multiplies the base price by nights and adds the zero fee line", () => {
    const q = quote();
    expect(q.available).toBe(true);
    if (!q.available) return;
    expect(q.nights).toBe(3);
    expect(q.nightly).toEqual([
      { date: "2026-11-10", price: 250_000 },
      { date: "2026-11-11", price: 250_000 },
      { date: "2026-11-12", price: 250_000 },
    ]);
    expect(q.lines).toEqual([
      { kind: "base", label: "3 nights", amount: 750_000 },
      { kind: "fee", label: "Platform fee", amount: 0 },
    ]);
    expect(q.total).toBe(750_000);
    expect(q.currency).toBe("INR");
  });

  it("uses per-night price overrides", () => {
    const inventory: InventoryNight[] = [{ date: "2026-11-11", booked: 0, total: null, price: 400_000, closed: false }];
    const q = quote({ inventory });
    if (!q.available) throw new Error(q.reason);
    expect(q.nightly.map((n) => n.price)).toEqual([250_000, 400_000, 250_000]);
    expect(q.total).toBe(900_000);
  });

  it("adds cleaning fee and taxes on the room total only", () => {
    const q = quote({ listing: { ...listing, cleaningFee: 80_000, taxBps: 1200 } });
    if (!q.available) throw new Error(q.reason);
    expect(q.lines).toEqual([
      { kind: "base", label: "3 nights", amount: 750_000 },
      { kind: "other", label: "Cleaning fee", amount: 80_000 },
      { kind: "tax", label: "Taxes (12%)", amount: 90_000 },
      { kind: "fee", label: "Platform fee", amount: 0 },
    ]);
    expect(q.total).toBe(920_000);
  });

  it("rounds taxes half up to whole minor units", () => {
    // 1 night at 1,005 minor units with 5% tax = 50.25, rounds to 50. At 1,010 it is 50.5, rounds to 51.
    const a = quote({ checkOut: "2026-11-11", unit: { ...unit, basePrice: 1005 }, listing: { ...listing, taxBps: 500 } });
    const b = quote({ checkOut: "2026-11-11", unit: { ...unit, basePrice: 1010 }, listing: { ...listing, taxBps: 500 } });
    if (!a.available || !b.available) throw new Error("expected available");
    expect(a.lines.find((l) => l.kind === "tax")?.amount).toBe(50);
    expect(b.lines.find((l) => l.kind === "tax")?.amount).toBe(51);
    for (const q of [a, b]) for (const l of q.lines) expect(Number.isInteger(l.amount)).toBe(true);
  });

  it("charges extra guests above the included number, per night", () => {
    const q = quote({ adults: 2, children: 1 });
    if (!q.available) throw new Error(q.reason);
    expect(q.nightly[0].price).toBe(300_000);
    expect(q.total).toBe(900_000);
  });

  it("spreads guests across rooms before charging extra guests", () => {
    // 2 rooms include 4 guests; 5 guests pay for 1 extra.
    const q = quote({ adults: 3, children: 2, units: 2 });
    if (!q.available) throw new Error(q.reason);
    expect(q.nightly[0].price).toBe(250_000 * 2 + 50_000);
    expect(q.lines[0].label).toBe("3 nights, 2 rooms");
    expect(extraGuests(4, 2, 2)).toBe(0);
    expect(extraGuests(5, 2, 2)).toBe(1);
  });

  it("rejects more guests than the rooms sleep", () => {
    const q = quote({ adults: 3, children: 1 });
    expect(q).toEqual({ available: false, reason: "This room sleeps up to 3. Add a room or pick a larger one." });
    expect(quote({ adults: 4, children: 2, units: 2 }).available).toBe(true);
  });

  it("enforces minimum and maximum nights", () => {
    expect(quote({ listing: { ...listing, minNights: 4 } })).toMatchObject({ available: false, reason: "This place has a minimum stay of 4 nights." });
    expect(quote({ listing: { ...listing, maxNights: 2 } })).toMatchObject({ available: false, reason: "This place takes stays of up to 2 nights." });
    expect(quote({ listing: { ...listing, minNights: 3, maxNights: 3 } }).available).toBe(true);
  });

  it("rejects closed nights", () => {
    const inventory = [{ date: "2026-11-12", booked: 0, total: null, price: null, closed: true }];
    expect(quote({ inventory }).available).toBe(false);
  });

  it("respects capacity with total overrides and existing bookings", () => {
    const full = [{ date: "2026-11-11", booked: 2, total: null, price: null, closed: false }];
    expect(quote({ inventory: full }).available).toBe(false);

    const oneLeft = [{ date: "2026-11-11", booked: 1, total: null, price: null, closed: false }];
    expect(quote({ inventory: oneLeft }).available).toBe(true);
    expect(quote({ inventory: oneLeft, units: 2, adults: 2 })).toMatchObject({ available: false, reason: "Only 1 of these rooms is free on some of these nights." });

    const raised = [{ date: "2026-11-11", booked: 2, total: 3, price: null, closed: false }];
    expect(quote({ inventory: raised }).available).toBe(true);
    const lowered = [{ date: "2026-11-11", booked: 0, total: 0, price: null, closed: false }];
    expect(quote({ inventory: lowered }).available).toBe(false);
  });

  it("rejects listings that are not published and inactive units", () => {
    expect(quote({ listing: { ...listing, status: "draft" } }).available).toBe(false);
    expect(quote({ listing: { ...listing, status: "suspended" } }).available).toBe(false);
    expect(quote({ unit: { ...unit, active: false } }).available).toBe(false);
  });

  it("validates dates and guest counts", () => {
    expect(quote({ checkOut: "2026-11-10" })).toMatchObject({ available: false, reason: "Check out must be after check in." });
    expect(quote({ checkIn: "not a date" }).available).toBe(false);
    expect(quote({ checkOut: "2027-06-01" }).available).toBe(false);
    expect(quote({ adults: 0 }).available).toBe(false);
    expect(quote({ adults: 1, units: 2 })).toMatchObject({ available: false, reason: "Each room needs at least one adult." });
  });

  it("works for zero-decimal currencies", () => {
    const q = quote({ listing: { ...listing, currency: "JPY", taxBps: 1000 }, unit: { ...unit, basePrice: 12_345 } });
    if (!q.available) throw new Error(q.reason);
    expect(q.lines.find((l) => l.kind === "tax")?.amount).toBe(3704); // 37,035 * 10% = 3,703.5, rounds up
    expect(q.currency).toBe("JPY");
  });
});

describe("labels", () => {
  it("formats room and tax labels", () => {
    expect(roomLineLabel(1, 1)).toBe("1 night");
    expect(roomLineLabel(2, 3)).toBe("2 nights, 3 rooms");
    expect(taxLabel(1800)).toBe("Taxes (18%)");
    expect(taxLabel(1250)).toBe("Taxes (12.5%)");
    expect(taxLabel(1225)).toBe("Taxes (12.25%)");
  });
});
