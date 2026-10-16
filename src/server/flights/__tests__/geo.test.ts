import { describe, expect, it } from "vitest";
import { dayDiff, departWindowOf, isoDurationMinutes, localClock, localToUtc, minutesBetween, utcToLocal } from "@/lib/flight-time";
import { approxFlightMinutes, greatCircleKm, kmToMiles } from "../geo";

describe("greatCircleKm", () => {
  it("matches known airport distances within a kilometre or two", () => {
    const del = { lat: 28.5665, lng: 77.1031 };
    const goi = { lat: 15.3808, lng: 73.8314 };
    const lhr = { lat: 51.47, lng: -0.4543 };
    const jfk = { lat: 40.6398, lng: -73.7789 };
    expect(greatCircleKm(del, goi)).toBeGreaterThan(1495);
    expect(greatCircleKm(del, goi)).toBeLessThan(1505);
    expect(Math.round(greatCircleKm(lhr, jfk))).toBeGreaterThan(5535);
    expect(Math.round(greatCircleKm(lhr, jfk))).toBeLessThan(5560);
    expect(greatCircleKm(del, del)).toBe(0);
    expect(greatCircleKm(del, goi)).toBeCloseTo(greatCircleKm(goi, del), 9);
  });

  it("converts to miles", () => {
    expect(kmToMiles(1609.344)).toBeCloseTo(1000, 6);
  });
});

describe("approxFlightMinutes", () => {
  it("estimates block time from distance in five minute steps", () => {
    expect(approxFlightMinutes(1500)).toBe(145);
    expect(approxFlightMinutes(5550)).toBe(445);
    expect(approxFlightMinutes(10)).toBe(35);
    expect(approxFlightMinutes(1234) % 5).toBe(0);
  });
});

describe("local flight times", () => {
  it("reads clock and day difference as text", () => {
    expect(localClock("2026-11-20T06:05:00")).toBe("06:05");
    expect(dayDiff("2026-11-20T22:30:00", "2026-11-21T03:40:00")).toBe(1);
    expect(dayDiff("2026-12-31T22:30:00", "2027-01-01T03:40:00")).toBe(1);
    expect(dayDiff("2026-11-21T01:00:00", "2026-11-20T23:00:00")).toBe(-1);
  });

  it("converts between zones, including across a DST change", () => {
    expect(localToUtc("2026-11-20T06:00:00", "Asia/Kolkata").toISOString()).toBe("2026-11-20T00:30:00.000Z");
    expect(utcToLocal(new Date("2026-11-20T00:30:00Z"), "Europe/London")).toBe("2026-11-20T00:30:00");
    expect(utcToLocal(new Date("2026-07-01T00:30:00Z"), "Europe/London")).toBe("2026-07-01T01:30:00");
    // Delhi 02:15 to London 06:40 the same morning in summer is 8h 55m.
    expect(minutesBetween("2026-07-01T02:15:00", "Asia/Kolkata", "2026-07-01T06:40:00", "Europe/London")).toBe(535);
  });

  it("parses ISO 8601 durations", () => {
    expect(isoDurationMinutes("PT2H35M")).toBe(155);
    expect(isoDurationMinutes("P1DT2H")).toBe(1560);
    expect(isoDurationMinutes("PT45M")).toBe(45);
    expect(isoDurationMinutes(null)).toBeNull();
    expect(isoDurationMinutes("garbage")).toBeNull();
  });

  it("buckets departure times into windows", () => {
    expect(departWindowOf("2026-11-20T05:59:00")).toBe("early");
    expect(departWindowOf("2026-11-20T06:00:00")).toBe("morning");
    expect(departWindowOf("2026-11-20T12:00:00")).toBe("afternoon");
    expect(departWindowOf("2026-11-20T18:00:00")).toBe("evening");
  });
});
