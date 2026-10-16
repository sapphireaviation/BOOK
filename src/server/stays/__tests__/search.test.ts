import { and, desc, eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/db";
import { searchLog, unitInventory } from "@/db/schema";
import { staySearchSchema } from "@/lib/search-params";
import { newId } from "@/lib/id";
import { quoteStay } from "../inventory";
import { searchStays, suggestPlaces } from "../search";
import { fixtures } from "./fixtures";

const fx = fixtures();
// A made-up place in the South Pacific so seed data never lands inside the radius.
const tag = newId("t").slice(2, 10);
const slug = `testplace-${tag}`;
const name = `Testplace ${tag}`;
const center = { lat: -40.5, lng: -150.5 };

const ids: Record<string, { id: string; unitIds: string[] }> = {};

function search(over: Record<string, unknown> = {}) {
  return searchStays(staySearchSchema.parse({ place: slug, checkin: "2027-02-01", checkout: "2027-02-03", adults: 2, ...over }));
}

beforeAll(async () => {
  await fx.destination({ slug, name, lat: center.lat, lng: center.lng, radiusKm: 20 });
  const near = (dLat: number) => ({ lat: center.lat + dLat, lng: center.lng, city: `City ${tag}` });

  ids.villa = await fx.listing(
    { ...near(0.01), propertyType: "villa", amenities: ["pool", "wifi"], cancellationPolicy: "flexible", instantBook: true, cleaningFee: 100_000, taxBps: 1800 },
    [
      { basePrice: 900_000, maxGuests: 6, name: "Whole villa" },
      { basePrice: 400_000, maxGuests: 2, name: "Garden room" },
    ],
  );
  ids.hotel = await fx.listing(
    { ...near(0.02), propertyType: "hotel", amenities: ["wifi"], cancellationPolicy: "strict", instantBook: false, ratingAvg: 4.6, ratingCount: 12 },
    [{ basePrice: 250_000, maxGuests: 2, quantity: 1 }],
  );
  ids.hostel = await fx.listing(
    { ...near(-0.03), propertyType: "hostel", amenities: [], cancellationPolicy: "moderate", ratingAvg: 3.9, ratingCount: 4 },
    [{ basePrice: 80_000, maxGuests: 4, includedGuests: 1, extraGuestPrice: 20_000 }],
  );
  // 0.5 degrees of latitude is about 55 km: outside the 20 km radius.
  ids.far = await fx.listing({ ...near(0.5), propertyType: "hotel" }, [{ basePrice: 100_000 }]);
  ids.draft = await fx.listing({ ...near(0.01), status: "draft" }, [{ basePrice: 100_000 }]);
  ids.longStay = await fx.listing({ ...near(0.01), minNights: 5 }, [{ basePrice: 100_000 }]);
});

afterAll(fx.cleanup);

describe("searchStays", () => {
  it("resolves the destination and matches listings inside the radius only", async () => {
    const r = await search();
    expect(r.place).toMatchObject({ slug, name });
    const found = r.results.map((c) => c.id).sort();
    expect(found).toEqual([ids.villa.id, ids.hotel.id, ids.hostel.id].sort());
    expect(r.total).toBe(3);
  });

  it("resolves a destination by name and listings by city", async () => {
    expect((await search({ place: name.toLowerCase() })).total).toBe(3);
    const byCity = await search({ place: `City ${tag}` });
    expect(byCity.place?.slug).toBeNull();
    expect(byCity.total).toBe(4); // includes the far listing, which shares the city name
  });

  it("returns nothing for an unknown place", async () => {
    const r = await search({ place: `nowhere-${tag}` });
    expect(r).toMatchObject({ place: null, total: 0, results: [] });
  });

  it("picks the cheapest available unit that fits, priced like quoteStay", async () => {
    const r = await search();
    const villa = r.results.find((c) => c.id === ids.villa.id)!;
    expect(villa.unitId).toBe(ids.villa.unitIds[1]);
    const q = await quoteStay({ listingId: ids.villa.id, unitId: villa.unitId, checkIn: "2027-02-01", checkOut: "2027-02-03", adults: 2, children: 0, units: 1 });
    if (!q.available) throw new Error(q.reason);
    expect(villa.total).toBe(q.total);
    expect(villa.perNight).toBe(400_000);
    expect(villa.nights).toBe(2);

    // Four guests no longer fit the garden room, so the whole villa is the cheapest that fits.
    const big = await search({ adults: 4 });
    expect(big.results.find((c) => c.id === ids.villa.id)?.unitId).toBe(ids.villa.unitIds[0]);
    expect(big.results.some((c) => c.id === ids.hotel.id)).toBe(false);

    // Extra guest pricing applies in search too: 3 guests in the hostel pay for 2 extra.
    const three = await search({ adults: 3 });
    const hostel = three.results.find((c) => c.id === ids.hostel.id)!;
    expect(hostel.perNight).toBe(80_000 + 2 * 20_000);
  });

  it("drops listings with a closed or full night and honours minimum nights", async () => {
    await db.insert(unitInventory).values({ unitId: ids.hotel.unitIds[0], date: "2027-02-02", booked: 1 });
    try {
      const r = await search();
      expect(r.results.some((c) => c.id === ids.hotel.id)).toBe(false);
      // The full night is the second one; a one night stay before it is fine.
      expect((await search({ checkout: "2027-02-02" })).results.some((c) => c.id === ids.hotel.id)).toBe(true);
    } finally {
      await db.delete(unitInventory).where(eq(unitInventory.unitId, ids.hotel.unitIds[0]));
    }
    expect((await search({ checkout: "2027-02-06" })).results.some((c) => c.id === ids.longStay.id)).toBe(true);
  });

  it("filters by type, amenities, cancellation, instant book, rating and price", async () => {
    const only = async (over: Record<string, unknown>) => (await search(over)).results.map((c) => c.id).sort();
    expect(await only({ types: "hotel,hostel" })).toEqual([ids.hotel.id, ids.hostel.id].sort());
    expect(await only({ amenities: "pool" })).toEqual([ids.villa.id]);
    expect(await only({ amenities: "pool,not_a_key" })).toEqual([ids.villa.id]);
    expect(await only({ freeCancellation: "1" })).toEqual([ids.villa.id, ids.hostel.id].sort());
    expect(await only({ instantBook: "1" })).toEqual([ids.villa.id, ids.hostel.id].sort());
    expect(await only({ minRating: "4.5" })).toEqual([ids.hotel.id]);
    expect(await only({ minPrice: "150000", maxPrice: "300000" })).toEqual([ids.hotel.id]);
  });

  it("computes facets before type and price filters", async () => {
    const r = await search({ types: "hotel", maxPrice: "100000" });
    expect(r.total).toBe(0);
    expect(r.facets.types).toEqual({ villa: 1, hotel: 1, hostel: 1 });
    // The hostel includes 1 guest, so 2 adults pay 80,000 plus 20,000 for the second guest.
    expect(r.facets.priceMin).toBe(100_000);
    expect(r.facets.priceMax).toBe(400_000);
    expect(r.facets.currency).toBe("INR");
  });

  it("sorts by price and rating", async () => {
    expect((await search({ sort: "price_asc" })).results.map((c) => c.perNight)).toEqual([100_000, 250_000, 400_000]);
    expect((await search({ sort: "price_desc" })).results.map((c) => c.perNight)).toEqual([400_000, 250_000, 100_000]);
    expect((await search({ sort: "rating" })).results[0].id).toBe(ids.hotel.id);
  });

  it("logs the search", async () => {
    await search({ sort: "price_asc" });
    const [row] = await db
      .select()
      .from(searchLog)
      .where(and(eq(searchLog.kind, "stay"), sql`${searchLog.query}->>'placeSlug' = ${slug}`))
      .orderBy(desc(searchLog.createdAt))
      .limit(1);
    expect(row.resultCount).toBe(3);
    expect(row.source).toBe("web");
    await db.delete(searchLog).where(sql`${searchLog.query}->>'placeSlug' = ${slug}`);
  });
});

describe("searchStays pagination", () => {
  const pslug = `pageplace-${tag}`;
  beforeAll(async () => {
    await fx.destination({ slug: pslug, name: `Pageplace ${tag}`, lat: -45, lng: -140, radiusKm: 10 });
    const hostId = await fx.host();
    for (let i = 0; i < 23; i++) await fx.listing({ hostId, lat: -45 + i * 0.001, lng: -140 }, [{ basePrice: 100_000 + i }]);
  });

  it("returns 20 per page with the right total", async () => {
    const base = { place: pslug, checkin: "2027-03-01", checkout: "2027-03-02", sort: "price_asc" };
    const p1 = await searchStays(staySearchSchema.parse(base));
    const p2 = await searchStays(staySearchSchema.parse({ ...base, page: 2 }));
    expect(p1.total).toBe(23);
    expect(p1.results).toHaveLength(20);
    expect(p2.results).toHaveLength(3);
    expect(p2.results[0].perNight).toBe(100_020);
    expect(new Set([...p1.results, ...p2.results].map((c) => c.id)).size).toBe(23);
  });
});

describe("suggestPlaces", () => {
  it("matches destination names by prefix and counts published listings", async () => {
    const s = await suggestPlaces(`testplace ${tag}`);
    expect(s[0]).toMatchObject({ slug, name, countryName: "India" });
    expect(s[0].listingCount).toBe(0); // test listings are not grouped under the destination slug
  });

  it("escapes LIKE wildcards", async () => {
    expect(await suggestPlaces("%%%")).toEqual([]);
  });
});
