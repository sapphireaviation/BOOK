import { describe, expect, it } from "vitest";
import { applyFilters, computeFacets, parseAirlines, priceSteps, sortOffers } from "../filters";
import type { Offer, Slice } from "../types";

function slice(departAt: string, durationMinutes: number, stops: number): Slice {
  const place = { iata: "DEL", name: "Delhi", city: "Delhi" };
  return { id: "s", origin: place, destination: { ...place, iata: "GOI" }, departAt, arriveAt: departAt, durationMinutes, stops, segments: [] };
}

function offer(id: string, airline: string, total: number, departAt: string, duration: number, stops = 0, ret?: Slice): Offer {
  return {
    id,
    provider: "test",
    total,
    currency: "INR",
    baseAmount: total,
    taxAmount: 0,
    slices: [slice(departAt, duration, stops), ...(ret ? [ret] : [])],
    owner: { iata: airline, name: `Airline ${airline}` },
    conditions: { refundable: false, changeable: false },
    expiresAt: "2099-01-01T00:00:00Z",
    passengerIds: ["p1"],
    requiresPassport: false,
  };
}

const offers = [
  offer("a", "6E", 500000, "2026-11-20T05:30:00", 150),
  offer("b", "AI", 650000, "2026-11-20T09:15:00", 140),
  offer("c", "6E", 420000, "2026-11-20T14:00:00", 310, 1),
  offer("d", "QP", 500000, "2026-11-20T19:45:00", 145),
  offer("e", "AI", 390000, "2026-11-20T23:10:00", 600, 0, slice("2026-11-27T10:00:00", 400, 2)),
];

describe("applyFilters", () => {
  it("keeps everything without filters", () => {
    expect(applyFilters(offers, {})).toHaveLength(5);
  });

  it("filters by most stops on any slice", () => {
    expect(applyFilters(offers, { stops: 0 }).map((o) => o.id)).toEqual(["a", "b", "d"]);
    expect(applyFilters(offers, { stops: 1 }).map((o) => o.id)).toEqual(["a", "b", "c", "d"]);
  });

  it("filters by airline codes, ignoring junk", () => {
    expect(applyFilters(offers, { airlines: "6e, QP,xx-1" }).map((o) => o.id)).toEqual(["a", "c", "d"]);
    expect(parseAirlines("6E,,ai,<script>")).toEqual(["6E", "AI"]);
  });

  it("filters by max price in minor units, inclusive", () => {
    expect(applyFilters(offers, { maxPrice: 500000 }).map((o) => o.id)).toEqual(["a", "c", "d", "e"]);
  });

  it("filters by outbound departure window", () => {
    expect(applyFilters(offers, { departWindow: "early" }).map((o) => o.id)).toEqual(["a"]);
    expect(applyFilters(offers, { departWindow: "morning" }).map((o) => o.id)).toEqual(["b"]);
    expect(applyFilters(offers, { departWindow: "afternoon" }).map((o) => o.id)).toEqual(["c"]);
    expect(applyFilters(offers, { departWindow: "evening" }).map((o) => o.id)).toEqual(["d", "e"]);
  });

  it("combines filters", () => {
    expect(applyFilters(offers, { stops: 0, airlines: "6E,QP", maxPrice: 500000, departWindow: "evening" }).map((o) => o.id)).toEqual(["d"]);
  });
});

describe("sortOffers", () => {
  it("sorts by price with duration as the tie breaker", () => {
    expect(sortOffers(offers, "price").map((o) => o.id)).toEqual(["e", "c", "d", "a", "b"]);
  });

  it("sorts by total duration across slices", () => {
    expect(sortOffers(offers, "duration").map((o) => o.id)).toEqual(["b", "d", "a", "c", "e"]);
  });

  it("sorts by outbound departure time", () => {
    expect(sortOffers(offers, "depart").map((o) => o.id)).toEqual(["a", "b", "c", "d", "e"]);
  });

  it("does not mutate its input", () => {
    const copy = [...offers];
    sortOffers(offers, "duration");
    expect(offers).toEqual(copy);
  });
});

describe("computeFacets", () => {
  it("counts airlines and stops from the unfiltered results", () => {
    const f = computeFacets(offers);
    expect(f.total).toBe(5);
    expect(f.airlines.map((a) => [a.iata, a.count, a.cheapest])).toEqual([
      ["AI", 2, 390000],
      ["6E", 2, 420000],
      ["QP", 1, 500000],
    ]);
    expect(f.stops).toEqual([
      { stops: 0, count: 3, cheapest: 500000 },
      { stops: 1, count: 1, cheapest: 420000 },
      { stops: 2, count: 1, cheapest: 390000 },
    ]);
    expect(f.minPrice).toBe(390000);
    expect(f.maxPrice).toBe(650000);
  });
});

describe("priceSteps", () => {
  it("returns tidy caps strictly between min and max", () => {
    const steps = priceSteps(390000, 1650000);
    expect(steps.length).toBeGreaterThan(1);
    for (const s of steps) {
      expect(s % 50000).toBe(0);
      expect(s).toBeGreaterThan(390000);
      expect(s).toBeLessThan(1650000);
    }
    expect(priceSteps(null, null)).toEqual([]);
    expect(priceSteps(500, 500)).toEqual([]);
  });
});
