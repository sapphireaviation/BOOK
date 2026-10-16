import { describe, expect, it } from "vitest";
import { placeFaq, placeLead, typeBreakdown } from "../place-copy";
import { computePlaceStats } from "../places";

const row = (over: Partial<Parameters<typeof computePlaceStats>[0][number]> = {}) => ({
  currency: "INR",
  fromPrice: 300_000,
  propertyType: "guesthouse",
  freeCancellation: true,
  instantBook: true,
  ratingAvg: 0,
  ratingCount: 0,
  ...over,
});

describe("computePlaceStats", () => {
  it("computes price range, types and weighted rating", () => {
    const s = computePlaceStats([
      row({ fromPrice: 240_000, propertyType: "cabin", ratingAvg: 4, ratingCount: 1 }),
      row({ fromPrice: 1_450_000, propertyType: "house", freeCancellation: false, instantBook: false }),
      row({ fromPrice: 320_000, ratingAvg: 5, ratingCount: 3 }),
      row({ currency: "USD", fromPrice: 9_000 }),
    ]);
    expect(s).toMatchObject({
      count: 4,
      currency: "INR",
      priceMin: 240_000,
      priceMax: 1_450_000,
      priceAvg: 670_000,
      types: { cabin: 1, house: 1, guesthouse: 2 },
      freeCancellation: 3,
      instantBook: 3,
      ratedListings: 2,
      reviewCount: 4,
      ratingAvg: 4.8,
    });
  });

  it("handles a place with no listings", () => {
    expect(computePlaceStats([])).toMatchObject({ count: 0, currency: null, priceMin: null, ratingAvg: null });
  });
});

describe("place copy", () => {
  const stats = computePlaceStats([row({ fromPrice: 240_000, propertyType: "cabin" }), row({ fromPrice: 680_000, propertyType: "apartment", freeCancellation: false }), row()]);

  it("writes the lead from the numbers", () => {
    expect(placeLead("Goa", stats, "2026-10")).toBe(
      "There are 3 stays in Goa listed here, from ₹2,400 to ₹6,800 a night before taxes, as of October 2026. They are 1 apartment, 1 cabin or cottage and 1 guesthouse. Owners set their own prices and nobody pays a platform fee. Pick dates to see the full price, then book directly.",
    );
    expect(placeLead("Leh", computePlaceStats([]), "2026-10")).toMatch(/^No stays in Leh are listed yet\./);
  });

  it("builds FAQ answers only from data", () => {
    const faq = placeFaq("Goa", stats, "2026-10", [{ code: "GOX", name: null }, { code: "GOI", name: "Dabolim Airport" }]);
    expect(faq.map((f) => f.q)).toEqual([
      "How much does a stay in Goa cost per night?",
      "What kinds of places can I book in Goa?",
      "Can I cancel a stay in Goa for free?",
      "Can I book a stay in Goa instantly?",
      "Which airport is nearest to Goa?",
    ]);
    expect(faq[0].a).toBe(
      "Starting prices for the 3 stays listed in Goa range from ₹2,400 to ₹6,800 a night before taxes, as of October 2026. The average starting price is ₹4,067 a night.",
    );
    expect(faq[2].a).toBe("2 of the 3 stays listed in Goa give a full refund if you cancel before a deadline. Each listing shows the exact date for your stay.");
    expect(faq[4].a).toBe("The nearest airports are GOX and Dabolim Airport (GOI).");
    // No reviews, so no rating question.
    expect(faq.some((f) => f.q.includes("rate"))).toBe(false);
  });

  it("joins type counts", () => {
    expect(typeBreakdown({ hotel: 2, villa: 1, hostel: 3 })).toBe("3 hostels, 2 hotels and 1 villa");
  });
});
