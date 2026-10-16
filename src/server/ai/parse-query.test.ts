import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { parseTripQuery } from "./parse-query";
import type { Resolvers } from "./finish";
import { extractIntent, normalize } from "./rules";

// Thursday 15 October 2026
const today = "2026-10-15";

const airports: Record<string, { iata: string; name: string; city: string }> = {
  delhi: { iata: "DEL", name: "Indira Gandhi International Airport", city: "Delhi" },
  goa: { iata: "GOX", name: "Manohar International Airport", city: "Goa" },
  mumbai: { iata: "BOM", name: "Chhatrapati Shivaji Maharaj International Airport", city: "Mumbai" },
  bengaluru: { iata: "BLR", name: "Kempegowda International Airport", city: "Bengaluru" },
};

const resolvers: Resolvers = {
  airports: async (q) => (airports[q.toLowerCase()] ? [airports[q.toLowerCase()]] : []),
  places: async (q) => {
    const known: Record<string, { slug: string; name: string }> = {
      goa: { slug: "goa", name: "Goa" },
      "north goa": { slug: "north-goa", name: "North Goa" },
      manali: { slug: "manali", name: "Manali" },
      jaipur: { slug: "jaipur", name: "Jaipur" },
    };
    return known[q.toLowerCase()] ? [known[q.toLowerCase()]] : [];
  },
};

const broken: Resolvers = {
  airports: async () => {
    throw new Error("searchAirports not implemented");
  },
  places: async () => {
    throw new Error("suggestPlaces not implemented");
  },
};

const parse = (text: string, r: Resolvers = resolvers) => parseTripQuery(text, { today, defaultCurrency: "INR", resolvers: r, useModel: false });
const intent = (text: string) => extractIntent(text, { today, defaultCurrency: "INR" });

describe("normalize", () => {
  it("expands number words, k and lakh, and rupee markers", () => {
    expect(normalize("Two adults under 4k")).toContain("2 adults under 4000");
    expect(normalize("budget 1.5 lakh")).toContain("150000");
    expect(normalize("below Rs. 4,000")).toContain("₹4000");
    expect(normalize("one way")).toContain("oneway");
  });
});

describe("dates", () => {
  it("reads tomorrow", () => expect(intent("hotel in goa tomorrow").start).toBe("2026-10-16"));
  it("reads today and tonight", () => {
    expect(intent("stay in goa tonight")).toMatchObject({ start: "2026-10-15", nights: 1 });
  });
  it("reads day after tomorrow", () => expect(intent("flight to goa day after tomorrow").start).toBe("2026-10-17"));
  it("reads this friday", () => expect(intent("fly delhi to goa this friday").start).toBe("2026-10-16"));
  it("reads next friday as the friday of next week", () => expect(intent("fly delhi to goa next friday").start).toBe("2026-10-23"));
  it("reads a bare weekday name", () => expect(intent("fly to mumbai on saturday").start).toBe("2026-10-17"));
  it("reads this weekend as friday to sunday", () => {
    expect(intent("villa in goa this weekend")).toMatchObject({ start: "2026-10-16", end: "2026-10-18" });
  });
  it("reads next weekend as friday to sunday of next week", () => {
    expect(intent("villa in goa next weekend")).toMatchObject({ start: "2026-10-23", end: "2026-10-25" });
  });
  it("reads 24 oct", () => expect(intent("hotel in goa 24 oct").start).toBe("2026-10-24"));
  it("reads 24th october", () => expect(intent("hotel in goa from 24th october").start).toBe("2026-10-24"));
  it("reads oct 24", () => expect(intent("hotel in goa oct 24").start).toBe("2026-10-24"));
  it("reads 24/10 as day first", () => expect(intent("flight delhi to goa 24/10").start).toBe("2026-10-24"));
  it("reads 24/10/2026", () => expect(intent("flight delhi to goa 24/10/2026").start).toBe("2026-10-24"));
  it("reads ISO dates", () => expect(intent("flight delhi to goa 2026-11-02").start).toBe("2026-11-02"));
  it("rolls a past day and month into next year", () => expect(intent("hotel in goa 3 jan").start).toBe("2027-01-03"));
  it("reads a range inside one month", () => {
    expect(intent("goa 24-27 oct")).toMatchObject({ start: "2026-10-24", end: "2026-10-27" });
    expect(intent("goa 24 to 27 october")).toMatchObject({ start: "2026-10-24", end: "2026-10-27" });
  });
  it("reads a range across months", () => {
    expect(intent("stay in manali 30 oct to 2 nov")).toMatchObject({ start: "2026-10-30", end: "2026-11-02" });
  });
  it("reads return on 27th", () => {
    expect(intent("delhi to goa on 24 oct return on 27th")).toMatchObject({ start: "2026-10-24", end: "2026-10-27" });
  });
  it("reads coming back on a weekday", () => {
    expect(intent("delhi to goa this friday coming back on sunday")).toMatchObject({ start: "2026-10-16", end: "2026-10-18" });
  });
  it("reads for 3 nights", () => expect(intent("hotel in goa for 3 nights").nights).toBe(3));
  it("reads 3 nights from 24 oct", () => expect(intent("3 nights from 24 oct in goa")).toMatchObject({ start: "2026-10-24", nights: 3 }));
  it("reads a week", () => expect(intent("homestay in manali for a week from 1 nov").nights).toBe(7));
  it("does not read 'sun' in a sentence as sunday", () => expect(intent("sun and sand stay in goa").start).toBeUndefined());
});

describe("travelers", () => {
  it("reads 2 adults and a child", () => expect(intent("2 adults and a child in goa")).toMatchObject({ adults: 2, children: 1 }));
  it("reads number words", () => expect(intent("two adults and three kids")).toMatchObject({ adults: 2, children: 3 }));
  it("reads family of four", () => expect(intent("family of four in goa")).toMatchObject({ adults: 2, children: 2 }));
  it("reads family of 3", () => expect(intent("family of 3")).toMatchObject({ adults: 2, children: 1 }));
  it("reads a couple", () => expect(intent("a couple in goa").adults).toBe(2));
  it("reads solo", () => expect(intent("solo trip to manali").adults).toBe(1));
  it("reads 4 people", () => expect(intent("stay for 4 people in jaipur").adults).toBe(4));
  it("reads an infant on a flight", () => expect(intent("flight delhi to goa 2 adults and a baby")).toMatchObject({ adults: 2, infants: 1 }));
});

describe("prices and filters", () => {
  it("reads under 4000", () => expect(intent("hotel in goa under 4000")).toMatchObject({ maxPrice: 4000, currency: "INR" }));
  it("reads below ₹4,000 a night", () => expect(intent("villa below ₹4,000 a night")).toMatchObject({ maxPrice: 4000, currency: "INR" }));
  it("reads 3k", () => expect(intent("stay in goa max 3k per night").maxPrice).toBe(3000));
  it("reads a price range", () => expect(intent("stay in goa between 2000 and 5000")).toMatchObject({ minPrice: 2000, maxPrice: 5000 }));
  it("reads dollars", () => expect(intent("hotel in goa under $80 a night")).toMatchObject({ maxPrice: 80, currency: "USD" }));
  it("reads dollars written out", () => expect(intent("hotel in goa under 90 dollars")).toMatchObject({ maxPrice: 90, currency: "USD" }));
  it("does not read a date range as a price", () => expect(intent("goa between 24 and 27 oct")).toMatchObject({ start: "2026-10-24", end: "2026-10-27" }));
  it("reads cheap", () => expect(intent("cheap hotel in goa").sort).toBe("cheap"));
  it("reads luxury", () => expect(intent("luxury villa in goa").sort).toBe("luxury"));
  it("reads with pool", () => expect(intent("villa in goa with pool").amenities).toContain("pool"));
  it("reads pet friendly", () => expect(intent("pet friendly homestay in manali").amenities).toContain("pets"));
  it("reads beach", () => expect(intent("stay near the beach in goa").amenities).toContain("beach_access"));
  it("reads property types", () => expect(intent("villa or homestay in goa").types).toEqual(expect.arrayContaining(["villa", "homestay"])));
  it("reads free cancellation", () => expect(intent("hotel in goa with free cancellation").freeCancellation).toBe(true));
  it("reads one way", () => expect(intent("one way flight delhi to goa").oneWay).toBe(true));
  it("reads business class", () => expect(intent("business class delhi to mumbai").cabin).toBe("business"));
  it("reads premium economy", () => expect(intent("premium economy flight to goa").cabin).toBe("premium_economy"));
  it("reads non-stop", () => expect(intent("non-stop flight delhi to goa").maxStops).toBe(0));
  it("reads morning flights", () => expect(intent("morning flight from delhi to goa").departWindow).toBe("morning"));
});

describe("kind and places", () => {
  it("treats from X to Y as a flight", () => {
    expect(intent("from delhi to goa on 24 oct")).toMatchObject({ kind: "flight", origin: "delhi", destination: "goa" });
  });
  it("treats X to Y without keywords as a flight", () => expect(intent("delhi to goa 24 oct")).toMatchObject({ kind: "flight", origin: "delhi" }));
  it("reads multi word cities", () => expect(intent("flights from new delhi to goa").origin).toBe("new delhi"));
  it("treats in X as a stay", () => expect(intent("2 adults in goa next weekend")).toMatchObject({ kind: "stay", destination: "goa" }));
  it("finds an unmarked place", () => expect(intent("goa villa with pool").destination).toBe("goa"));
  it("keeps a region", () => expect(intent("homestay in north goa").destination).toBe("north goa"));
});

describe("parseTripQuery", () => {
  it("builds a full round trip flight", async () => {
    const r = await parse("Delhi to Goa next friday, back on the 27th, 2 adults, business class");
    expect(r.kind).toBe("flight");
    expect(r.flight).toEqual({ from: "DEL", to: "GOX", depart: "2026-10-23", return: "2026-10-27", adults: 2, cabin: "business" });
    expect(r.missing).toEqual([]);
    expect(r.understood).toContain("Flight from Delhi (DEL) to Goa (GOX)");
    expect(r.understood).toContain("Business class");
  });

  it("builds a one way flight and does not ask for a return", async () => {
    const r = await parse("one way flight from mumbai to bengaluru on 24/10");
    expect(r.flight).toMatchObject({ from: "BOM", to: "BLR", depart: "2026-10-24" });
    expect(r.flight?.return).toBeUndefined();
    expect(r.missing).toEqual([]);
    expect(r.understood).toContain("One way");
  });

  it("asks for what is missing on a flight", async () => {
    const r = await parse("cheap flights to goa");
    expect(r.kind).toBe("flight");
    expect(r.flight).toMatchObject({ to: "GOX", sort: "price" });
    expect(r.missing).toEqual(["from", "depart"]);
  });

  it("asks for the return when a round trip has no return date", async () => {
    const r = await parse("round trip delhi to goa on 24 oct");
    expect(r.missing).toEqual(["return"]);
  });

  it("falls back to the built in airport list when lookup fails", async () => {
    const r = await parse("flight from delhi to goa tomorrow", broken);
    expect(r.flight).toMatchObject({ from: "DEL", to: "GOI", depart: "2026-10-16" });
  });

  it("builds a stay with nights, travelers, price and amenities", async () => {
    const r = await parse("3 nights from 24 oct in goa for 2 adults and a child, below ₹4,000 a night with pool");
    expect(r.kind).toBe("stay");
    expect(r.stay).toEqual({
      place: "goa",
      checkin: "2026-10-24",
      checkout: "2026-10-27",
      adults: 2,
      children: 1,
      maxPrice: 400000,
      amenities: "pool",
    });
    expect(r.missing).toEqual([]);
    expect(r.understood).toEqual(["Stays in Goa", "3 nights, Sat 24 Oct to Tue 27 Oct", "2 adults, 1 child", "Under ₹4,000 a night", "With pool"]);
  });

  it("builds a weekend stay for a family", async () => {
    const r = await parse("pet friendly villa in north goa next weekend, family of four, cheap");
    expect(r.stay).toMatchObject({
      place: "north-goa",
      checkin: "2026-10-23",
      checkout: "2026-10-25",
      adults: 2,
      children: 2,
      types: "villa",
      amenities: "pets",
      sort: "price_asc",
    });
    expect(r.understood[0]).toBe("Villas in North Goa");
  });

  it("uses for N nights after a weekday", async () => {
    const r = await parse("hotel in jaipur this friday for 2 nights");
    expect(r.stay).toMatchObject({ checkin: "2026-10-16", checkout: "2026-10-18" });
  });

  it("asks for dates on a stay without them", async () => {
    const r = await parse("beach stay in goa under 5000");
    expect(r.stay).toMatchObject({ place: "goa", maxPrice: 500000, amenities: "beach_access" });
    expect(r.missing).toEqual(["checkin", "checkout"]);
  });

  it("asks for the checkout when only nights are missing", async () => {
    const r = await parse("hotel in goa from 24 oct");
    expect(r.missing).toEqual(["checkout"]);
  });

  it("uses the typed place when place lookup fails", async () => {
    const r = await parse("homestay in coorg for 2 nights from 1 nov", broken);
    expect(r.stay).toMatchObject({ place: "coorg", checkin: "2026-11-01", checkout: "2026-11-03" });
    expect(r.understood[0]).toBe("Homestays in Coorg");
  });

  it("returns unknown and asks when the sentence has no clear kind", async () => {
    const r = await parse("something fun");
    expect(r.kind).toBe("unknown");
    expect(r.missing).toEqual(["kind"]);
  });

  it("ignores dates in the past", async () => {
    const r = await parse("flight delhi to goa 2026-10-01");
    expect(r.flight?.depart).toBeUndefined();
    expect(r.missing).toContain("depart");
  });

  it("marks the source as rules without a key", async () => {
    expect((await parse("goa")).source).toBe("rules");
  });
});

const llm = vi.hoisted(() => ({ intentFromModel: vi.fn() }));
vi.mock("./llm", () => llm);

describe("model path", () => {
  const withKey = (text: string) => parseTripQuery(text, { today, defaultCurrency: "INR", resolvers });

  it("uses the model result when it validates", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "test-key");
    llm.intentFromModel.mockResolvedValueOnce({ kind: "stay", destination: "goa", start: "2026-10-24", nights: 2 });
    const r = await withKey("somewhere warm in goa for two nights from the 24th");
    expect(r.source).toBe("ai");
    expect(r.stay).toMatchObject({ place: "goa", checkin: "2026-10-24", checkout: "2026-10-26" });
    vi.unstubAllEnvs();
  });

  it("falls back to rules when the model fails or times out", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "test-key");
    llm.intentFromModel.mockRejectedValueOnce(new Error("Request timed out."));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const r = await withKey("flight from delhi to goa on 24 oct");
    expect(r.source).toBe("rules");
    expect(r.flight).toMatchObject({ from: "DEL", to: "GOX", depart: "2026-10-24" });
    warn.mockRestore();
    vi.unstubAllEnvs();
  });

  it("falls back to rules when the model does not call the tool", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "test-key");
    llm.intentFromModel.mockResolvedValueOnce(null);
    const r = await withKey("hotel in goa tomorrow");
    expect(r.source).toBe("rules");
    vi.unstubAllEnvs();
  });

  it("does not call the model without a key", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    llm.intentFromModel.mockClear();
    await withKey("hotel in goa tomorrow");
    expect(llm.intentFromModel).not.toHaveBeenCalled();
    vi.unstubAllEnvs();
  });
});
