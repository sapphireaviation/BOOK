import { describe, expect, it } from "vitest";
import { flightSearchSchema } from "@/lib/search-params";
import { minutesBetween } from "@/lib/flight-time";
import { decodeOfferId, FixtureProvider, generateOffers } from "../fixture";
import { OfferExpiredError } from "../types";

const now = new Date("2026-10-16T08:00:00Z");
const search = (o: Record<string, unknown>) => flightSearchSchema.parse({ from: "DEL", to: "GOI", depart: "2026-11-20", ...o });

describe("fixture provider", () => {
  it("is deterministic for the same search", () => {
    const a = generateOffers(search({}), now);
    const b = generateOffers(search({}), now);
    expect(a.length).toBeGreaterThan(3);
    expect(b).toEqual(a);
  });

  it("changes prices with the date", () => {
    const a = generateOffers(search({ depart: "2026-11-20" }), now);
    const b = generateOffers(search({ depart: "2026-12-18" }), now);
    expect(a[0].total).not.toBe(b[0].total);
  });

  it("uses Indian carriers on Indian domestic routes, nonstop or one stop", () => {
    const offers = generateOffers(search({}), now);
    const indian = new Set(["6E", "AI", "IX", "QP", "SG"]);
    for (const o of offers) {
      expect(indian.has(o.owner.iata)).toBe(true);
      expect(o.slices[0].stops).toBeLessThanOrEqual(1);
      expect(o.requiresPassport).toBe(false);
      expect(o.provider).toBe("fixture");
    }
    expect(offers.some((o) => o.slices[0].stops === 0)).toBe(true);
  });

  it("gives realistic durations from distance", () => {
    const nonstop = generateOffers(search({}), now).find((o) => o.slices[0].stops === 0)!;
    // Delhi to Goa is about 1,500 km: roughly two and a half hours.
    expect(nonstop.slices[0].durationMinutes).toBeGreaterThanOrEqual(140);
    expect(nonstop.slices[0].durationMinutes).toBeLessThanOrEqual(170);
  });

  it("keeps local times consistent with zones on international routes", () => {
    const offers = generateOffers(search({ from: "DEL", to: "LHR", depart: "2026-11-20" }), now);
    expect(offers.length).toBeGreaterThan(0);
    for (const o of offers) {
      const s = o.slices[0];
      expect(minutesBetween(s.departAt, s.origin.timeZone, s.arriveAt, s.destination.timeZone)).toBe(s.durationMinutes);
      expect(o.requiresPassport).toBe(true);
    }
    expect(offers.some((o) => ["AI", "BA", "VS"].includes(o.owner.iata))).toBe(true);
  });

  it("builds return trips with two slices and prices all passengers", () => {
    const one = generateOffers(search({}), now)[0];
    const family = generateOffers(search({ return: "2026-11-27", adults: 2, children: 1, infants: 1 }), now);
    expect(family[0].slices).toHaveLength(2);
    expect(family[0].slices[1].origin.iata).toBe("GOI");
    expect(family[0].passengers?.map((p) => p.type)).toEqual(["adult", "adult", "child", "infant_without_seat"]);
    expect(family[0].total).toBeGreaterThan(one.total * 2);
    for (const o of family) expect(o.baseAmount + o.taxAmount).toBe(o.total);
    for (const o of family) expect(o.total % 100).toBe(0);
  });

  it("returns no offers for unknown airports", () => {
    expect(generateOffers(search({ from: "ZZZ" }), now)).toEqual([]);
  });

  it("round trips offer ids through getOffer", async () => {
    const provider = new FixtureProvider(() => now);
    const { offers } = await provider.search(search({ return: "2026-11-27" }));
    const again = await provider.getOffer(offers[2].id);
    expect(again).toEqual(offers[2]);
    expect(decodeOfferId(offers[2].id)?.search).toMatchObject({ from: "DEL", to: "GOI", return: "2026-11-27" });
    await expect(provider.getOffer("fx_bogus")).rejects.toBeInstanceOf(OfferExpiredError);
    await expect(provider.getOffer("off_123")).rejects.toBeInstanceOf(OfferExpiredError);
  });

  it("treats offers for past dates as expired", async () => {
    const later = new FixtureProvider(() => new Date("2026-12-01T00:00:00Z"));
    const id = generateOffers(search({}), now)[0].id;
    await expect(later.getOffer(id)).rejects.toBeInstanceOf(OfferExpiredError);
  });
});
