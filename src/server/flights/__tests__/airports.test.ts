import { describe, expect, it } from "vitest";
import { airportsInCity, getAirport, rankAirports, suggestAirports } from "../airports";

describe("rankAirports", () => {
  const items = [
    { iata: "DEL", city: "Delhi", name: "Indira Gandhi International Airport", popularity: 1900 },
    { iata: "DED", city: "Dehradun", name: "Jolly Grant Airport", popularity: 1000 },
    { iata: "GOI", city: "Goa", name: "Goa Dabolim International Airport", popularity: 1400 },
    { iata: "IXD", city: "Prayagraj", name: "Allahabad Airport", popularity: 100 },
    { iata: "KUL", city: "Kuala Lumpur", name: "Kuala Lumpur International Airport", popularity: 1700 },
    { iata: "SZB", city: "Subang", name: "Sultan Abdul Aziz Shah Airport (Kuala Lumpur)", popularity: 100 },
    { iata: "ZRH", city: "Zürich", name: "Zürich Airport", popularity: 1500 },
  ];

  it("puts an exact IATA match first even when less popular", () => {
    expect(rankAirports(items, "ded").map((a) => a.iata)).toEqual(["DED"]);
    expect(rankAirports(items, "IXD")[0].iata).toBe("IXD");
  });

  it("ranks city prefix above name contains, then by popularity", () => {
    expect(rankAirports(items, "de").map((a) => a.iata)).toEqual(["DEL", "DED"]);
    expect(rankAirports(items, "kuala").map((a) => a.iata)).toEqual(["KUL", "SZB"]);
  });

  it("matches words inside a city name and ignores accents", () => {
    expect(rankAirports(items, "lumpur")[0].iata).toBe("KUL");
    expect(rankAirports(items, "zurich")[0].iata).toBe("ZRH");
  });

  it("matches airport names", () => {
    expect(rankAirports(items, "dabolim").map((a) => a.iata)).toEqual(["GOI"]);
    expect(rankAirports(items, "allahabad").map((a) => a.iata)).toEqual(["IXD"]);
  });

  it("needs two characters and respects the limit", () => {
    expect(rankAirports(items, "d")).toEqual([]);
    expect(rankAirports(items, "a", 2)).toEqual([]);
    expect(rankAirports(items, "air", 2)).toHaveLength(2);
  });
});

describe("airport data", () => {
  it("has the busy Indian airports with time zones", () => {
    expect(getAirport("del")).toMatchObject({ iata: "DEL", city: "Delhi", countryCode: "IN", countryName: "India", timeZone: "Asia/Kolkata" });
    expect(getAirport("GOI")?.city).toBe("Goa");
    expect(getAirport("ZZZ")).toBeNull();
  });

  it("suggests by code, city and name", () => {
    expect(suggestAirports("bom")[0]).toEqual({ iata: "BOM", name: expect.stringContaining("Chhatrapati"), city: "Mumbai", countryCode: "IN", countryName: "India" });
    expect(suggestAirports("london").slice(0, 2).map((a) => a.iata)).toEqual(["LHR", "LGW"]);
    expect(suggestAirports("heathrow")[0].iata).toBe("LHR");
  });

  it("finds other airports in the same city", () => {
    expect(airportsInCity("Goa", "IN").map((a) => a.iata).sort()).toEqual(["GOI", "GOX"]);
  });
});
