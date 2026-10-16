import { describe, expect, it } from "vitest";
import { flatten, flightSearchSchema, staySearchSchema } from "@/lib/search-params";
import { splitMatch } from "@/components/ui/combobox";
import { flightLimits, stayLimits } from "./limits";
import {
  serializeFlightSearch,
  serializeStaySearch,
  summarizeGuests,
  summarizePassengers,
  titleFromSlug,
  toSearchUrl,
  validateFlightSearch,
  validateStaySearch,
  type FlightFormState,
  type StayFormState,
} from "./serialize";

const flight: FlightFormState = {
  from: "DEL",
  to: "GOI",
  depart: "2026-10-24",
  return: "2026-10-27",
  oneWay: false,
  adults: 1,
  children: 0,
  infants: 0,
  cabin: "economy",
};

const stay: StayFormState = { place: "goa", checkin: "2026-10-24", checkout: "2026-10-27", adults: 2, children: 0, rooms: 1 };

describe("flight serialization", () => {
  it("produces the documented URL", () => {
    expect(toSearchUrl("/flights/search", serializeFlightSearch(flight))).toBe(
      "/flights/search?from=DEL&to=GOI&depart=2026-10-24&return=2026-10-27&adults=1&children=0&infants=0&cabin=economy",
    );
  });

  it("drops the return date for one way trips", () => {
    const params = Object.fromEntries(serializeFlightSearch({ ...flight, oneWay: true }));
    expect(params).not.toHaveProperty("return");
  });

  it("round trips through the server schema", () => {
    const qs = new URLSearchParams(serializeFlightSearch({ ...flight, adults: 2, infants: 1, cabin: "premium_economy" }));
    const parsed = flightSearchSchema.parse(flatten(Object.fromEntries(qs)));
    expect(parsed).toMatchObject({ from: "DEL", to: "GOI", depart: "2026-10-24", return: "2026-10-27", adults: 2, infants: 1, cabin: "premium_economy" });
  });
});

describe("flight validation", () => {
  it("accepts a complete search", () => {
    expect(validateFlightSearch(flight, "2026-10-16")).toEqual({ ok: true });
  });

  it("asks for missing airports and dates in plain words", () => {
    const r = validateFlightSearch({ ...flight, from: undefined, to: undefined, depart: undefined, return: undefined });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errors.from).toBe("Pick a departure airport");
    expect(r.errors.to).toBe("Pick an arrival airport");
    expect(r.errors.depart).toBe("Pick a departure date");
    expect(r.errors.return).toBe("Pick a return date, or switch to one way");
  });

  it("uses the schema rules for same airports, early returns and infants", () => {
    const r = validateFlightSearch({ ...flight, to: "DEL", return: "2026-10-20", adults: 1, infants: 2 });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errors.to).toBe("Departure and arrival must be different");
    expect(r.errors.return).toBe("Return must be on or after departure");
    expect(r.errors.infants).toBe("Each infant needs an adult");
  });

  it("rejects a departure in the past when today is known", () => {
    const r = validateFlightSearch(flight, "2026-10-25");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.depart).toMatch(/passed/);
  });

  it("one way needs no return date", () => {
    expect(validateFlightSearch({ ...flight, oneWay: true, return: undefined })).toEqual({ ok: true });
  });
});

describe("stay serialization and validation", () => {
  it("produces the documented URL", () => {
    expect(toSearchUrl("/stays/search", serializeStaySearch(stay))).toBe(
      "/stays/search?place=goa&checkin=2026-10-24&checkout=2026-10-27&adults=2&children=0&rooms=1",
    );
  });

  it("keeps free text places intact", () => {
    const qs = new URLSearchParams(serializeStaySearch({ ...stay, place: "quiet beach near Palolem" }));
    expect(staySearchSchema.parse(flatten(Object.fromEntries(qs))).place).toBe("quiet beach near Palolem");
  });

  it("explains missing fields and a check out before check in", () => {
    const empty = validateStaySearch({ ...stay, place: undefined, checkin: undefined, checkout: undefined });
    expect(empty.ok).toBe(false);
    if (!empty.ok) {
      expect(empty.errors.place).toBe("Where are you going?");
      expect(empty.errors.checkin).toBe("Pick a check in date");
      expect(empty.errors.checkout).toBe("Pick a check out date");
    }
    const backwards = validateStaySearch({ ...stay, checkout: "2026-10-24" });
    expect(backwards.ok).toBe(false);
    if (!backwards.ok) expect(backwards.errors.checkout).toBe("Check out must be after check in");
  });
});

describe("summaries and limits", () => {
  it("summarizes passengers and guests", () => {
    expect(summarizePassengers({ adults: 1, children: 0, infants: 0 })).toBe("1 adult");
    expect(summarizePassengers({ adults: 2, children: 1, infants: 2 })).toBe("2 adults, 1 child, 2 infants");
    expect(summarizeGuests({ adults: 2, children: 0, rooms: 1 })).toBe("2 adults, 1 room");
    expect(summarizeGuests({ adults: 1, children: 3, rooms: 2 })).toBe("1 adult, 3 children, 2 rooms");
  });

  it("reads stepper limits from the schemas", () => {
    expect(flightLimits).toEqual({ adults: { min: 1, max: 9 }, children: { min: 0, max: 8 }, infants: { min: 0, max: 4 } });
    expect(stayLimits).toEqual({ adults: { min: 1, max: 16 }, children: { min: 0, max: 10 }, rooms: { min: 1, max: 8 } });
  });

  it("turns slugs into names", () => {
    expect(titleFromSlug("north-goa")).toBe("North Goa");
  });

  it("highlights a match, preferring word starts", () => {
    expect(splitMatch("Indira Gandhi International Airport", "in")).toEqual({ before: "", match: "In", after: "dira Gandhi International Airport" });
    expect(splitMatch("Kempegowda International", "inter")).toEqual({ before: "Kempegowda ", match: "Inter", after: "national" });
    expect(splitMatch("Goa", "go")?.match).toBe("Go");
    expect(splitMatch("Goa", "xyz")).toBeNull();
    expect(splitMatch("Goa", "  ")).toBeNull();
  });
});
