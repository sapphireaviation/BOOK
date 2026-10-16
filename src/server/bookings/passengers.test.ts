import { describe, expect, it, vi } from "vitest";

vi.mock("@/db", () => ({ db: {} }));
const { ageOn, validatePassengers } = await import("./index");

const offer = {
  passengerIds: ["pas_1", "pas_2", "pas_3"],
  slices: [{ departAt: "2026-12-20T06:15:00" }, { departAt: "2027-01-05T21:40:00" }],
} as Parameters<typeof validatePassengers>[0];

const base = { title: "mr" as const, gender: "m" as const, email: "a@example.com", phone: "+919800000000", familyName: "Rao" };
const adult = { ...base, id: "pas_1", type: "adult" as const, givenName: "Arun", bornOn: "1988-04-02" };
const child = { ...base, id: "pas_2", type: "child" as const, givenName: "Mira", bornOn: "2019-03-10" };
const infant = { ...base, id: "pas_3", type: "infant_without_seat" as const, givenName: "Dev", bornOn: "2025-11-01" };

describe("ageOn", () => {
  it("counts whole years and handles birthdays", () => {
    expect(ageOn("2000-06-15", "2026-06-14")).toBe(25);
    expect(ageOn("2000-06-15", "2026-06-15")).toBe(26);
    expect(ageOn("2024-02-29", "2026-02-28")).toBe(1);
  });
});

describe("validatePassengers", () => {
  it("accepts passengers that match the offer ids and ages", () => {
    expect(() => validatePassengers(offer, [adult, child, infant])).not.toThrow();
  });
  it("requires every offer passenger exactly once", () => {
    expect(() => validatePassengers(offer, [adult, child])).toThrow(/3 passengers/);
    expect(() => validatePassengers(offer, [adult, child, { ...infant, id: "pas_9" }])).toThrow(/does not match/);
    expect(() => validatePassengers(offer, [adult, { ...child, id: "pas_1" }, infant])).toThrow(/twice/);
  });
  it("checks the type against the age", () => {
    expect(() => validatePassengers(offer, [{ ...adult, bornOn: "2016-01-01" }, child, infant])).toThrow(/under 12/);
    expect(() => validatePassengers(offer, [adult, { ...child, bornOn: "2025-06-01" }, infant])).toThrow(/child fare/);
    // Turns 2 on 2027-01-01, before the return flight.
    expect(() => validatePassengers(offer, [adult, child, { ...infant, bornOn: "2025-01-01" }])).toThrow(/own seat/);
    expect(() => validatePassengers(offer, [adult, child, { ...infant, bornOn: "2027-01-01" }])).toThrow(/date of birth/);
  });
  it("needs an adult for every lap infant", () => {
    const two = { ...offer, passengerIds: ["pas_1", "pas_3", "pas_4"] };
    expect(() => validatePassengers(two, [adult, infant, { ...infant, id: "pas_4" }])).toThrow(/adult/);
  });
});
