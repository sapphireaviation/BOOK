import { describe, expect, it } from "vitest";
import { checkInInstant, computeStayRefund, estimateFlightRefund } from "./policy";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
// Check in 2026-11-20 at 14:00 (treated as UTC).
const checkIn = "2026-11-20";
const checkInTime = "14:00:00";
const start = Date.UTC(2026, 10, 20, 14, 0);
const at = (msBefore: number) => new Date(start - msBefore);

function refund(policy: string, msBefore: number, total = 10_000) {
  return computeStayRefund({ policy, total, checkIn, checkInTime, now: at(msBefore) });
}

describe("checkInInstant", () => {
  it("combines the date with the listing check-in time", () => {
    expect(checkInInstant("2026-11-20", "14:00:00").toISOString()).toBe("2026-11-20T14:00:00.000Z");
    expect(checkInInstant("2026-11-20", "09:30").toISOString()).toBe("2026-11-20T09:30:00.000Z");
  });
});

describe("flexible", () => {
  it("refunds in full up to exactly 24 hours before check in", () => {
    expect(refund("flexible", 30 * DAY).refundAmount).toBe(10_000);
    expect(refund("flexible", DAY).refundAmount).toBe(10_000);
  });
  it("refunds nothing inside 24 hours", () => {
    expect(refund("flexible", DAY - 1).refundAmount).toBe(0);
    expect(refund("flexible", HOUR).refundAmount).toBe(0);
  });
});

describe("moderate", () => {
  it("refunds in full up to 5 days before", () => {
    expect(refund("moderate", 5 * DAY).refundAmount).toBe(10_000);
    expect(refund("moderate", 20 * DAY).percent).toBe(100);
  });
  it("refunds half after that, until check in", () => {
    expect(refund("moderate", 5 * DAY - 1).refundAmount).toBe(5_000);
    expect(refund("moderate", 1).refundAmount).toBe(5_000);
  });
});

describe("strict", () => {
  it("refunds half up to 7 days before", () => {
    expect(refund("strict", 7 * DAY).refundAmount).toBe(5_000);
    expect(refund("strict", 60 * DAY).refundAmount).toBe(5_000);
  });
  it("refunds nothing inside 7 days", () => {
    expect(refund("strict", 7 * DAY - 1).refundAmount).toBe(0);
  });
});

describe("non_refundable", () => {
  it("never refunds", () => {
    expect(refund("non_refundable", 365 * DAY).refundAmount).toBe(0);
    expect(refund("non_refundable", 365 * DAY).travelerCanCancel).toBe(true);
  });
});

describe("edge cases", () => {
  it("rounds half refunds down on odd totals so we never over refund", () => {
    expect(refund("moderate", DAY, 10_001).refundAmount).toBe(5_000);
    expect(refund("strict", 10 * DAY, 1).refundAmount).toBe(0);
  });
  it("stops traveler cancellation once check in has passed", () => {
    for (const policy of ["flexible", "moderate", "strict", "non_refundable"]) {
      const r = refund(policy, 0);
      expect(r.refundAmount).toBe(0);
      expect(r.travelerCanCancel).toBe(false);
      expect(refund(policy, -DAY).travelerCanCancel).toBe(false);
    }
  });
  it("treats an unknown policy as no refund", () => {
    expect(refund("mystery", 30 * DAY).refundAmount).toBe(0);
  });
  it("handles zero decimal currencies the same way (minor units are whole yen)", () => {
    expect(refund("moderate", DAY, 15_001).refundAmount).toBe(7_500);
  });
  it("always explains the result", () => {
    expect(refund("flexible", 2 * DAY).explanation).toMatch(/full refund/);
    expect(refund("flexible", HOUR).explanation).toMatch(/no refund/);
  });
});

describe("estimateFlightRefund", () => {
  it("is zero when the airline cannot be reached online", () => {
    const r = estimateFlightRefund({ total: 50_000, conditions: { refundable: true }, canCancelWithAirline: false });
    expect(r.refundAmount).toBe(0);
    expect(r.explanation).toMatch(/Contact the airline/);
  });
  it("is zero for non refundable fares", () => {
    expect(estimateFlightRefund({ total: 50_000, conditions: { refundable: false }, canCancelWithAirline: true }).refundAmount).toBe(0);
  });
  it("subtracts the airline penalty and never goes below zero", () => {
    expect(estimateFlightRefund({ total: 50_000, conditions: { refundable: true, refundPenalty: { amount: 3_000, currency: "INR" } }, canCancelWithAirline: true }).refundAmount).toBe(47_000);
    expect(estimateFlightRefund({ total: 2_000, conditions: { refundable: true, refundPenalty: { amount: 3_000, currency: "INR" } }, canCancelWithAirline: true }).refundAmount).toBe(0);
  });
});
