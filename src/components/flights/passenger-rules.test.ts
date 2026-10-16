import { describe, expect, it } from "vitest";
import { ageOn, checkBirthDate, normalizePhone, validateContact, validateInfantRatio, validatePassenger } from "./passenger-rules";

const ctx = { travelDate: "2026-11-27", today: "2026-10-16", requiresPassport: false };

describe("ageOn", () => {
  it("counts whole years and handles birthdays on the day", () => {
    expect(ageOn("2014-11-27", "2026-11-27")).toBe(12);
    expect(ageOn("2014-11-28", "2026-11-27")).toBe(11);
    expect(ageOn("2024-02-29", "2026-02-28")).toBe(1);
  });
});

describe("checkBirthDate", () => {
  it("accepts ages that match the ticket type", () => {
    expect(checkBirthDate("adult", "1990-04-21", ctx)).toBeNull();
    expect(checkBirthDate("adult", "2014-11-27", ctx)).toBeNull();
    expect(checkBirthDate("child", "2014-11-28", ctx)).toBeNull();
    expect(checkBirthDate("child", "2024-11-27", ctx)).toBeNull();
    expect(checkBirthDate("infant_without_seat", "2024-11-28", ctx)).toBeNull();
    expect(checkBirthDate("infant_without_seat", "2026-10-01", ctx)).toBeNull();
  });

  it("rejects ages that do not match on the last flight date", () => {
    expect(checkBirthDate("adult", "2015-01-01", ctx)).toMatch(/12 or older/);
    expect(checkBirthDate("child", "2014-11-27", ctx)).toMatch(/adult ticket/);
    expect(checkBirthDate("child", "2024-11-28", ctx)).toMatch(/as an infant/);
    expect(checkBirthDate("infant_without_seat", "2024-11-27", ctx)).toMatch(/under 2/);
  });

  it("rejects impossible dates", () => {
    expect(checkBirthDate("infant_without_seat", "2026-10-17", ctx)).toMatch(/future/);
    expect(checkBirthDate("adult", "1990-02-30", ctx)).toMatch(/like/);
    expect(checkBirthDate("adult", "", ctx)).toMatch(/Enter/);
  });
});

describe("validatePassenger", () => {
  const ok = { title: "ms", givenName: "Asha Maria", familyName: "D'Souza", bornOn: "1990-04-21", gender: "f" };

  it("passes a complete adult", () => {
    expect(validatePassenger(0, "adult", ok, ctx)).toEqual({});
  });

  it("flags names airlines will not accept", () => {
    const e = validatePassenger(1, "adult", { ...ok, givenName: "आशा", familyName: "A very long family name here" }, ctx);
    expect(Object.keys(e).sort()).toEqual(["p1_familyName", "p1_givenName"]);
  });

  it("requires passport details when the airline asks, valid past the trip", () => {
    const strict = { ...ctx, requiresPassport: true };
    expect(Object.keys(validatePassenger(0, "adult", ok, strict)).sort()).toEqual(["p0_passportCountry", "p0_passportExpiry", "p0_passportNumber"]);
    expect(validatePassenger(0, "adult", { ...ok, passportNumber: "k 123 4567", passportCountry: "IN", passportExpiry: "2026-11-01" }, strict)).toEqual({
      p0_passportExpiry: expect.stringMatching(/valid after/),
    });
    expect(validatePassenger(0, "adult", { ...ok, passportNumber: "K1234567", passportCountry: "IN", passportExpiry: "2030-01-01" }, strict)).toEqual({});
  });
});

describe("contact", () => {
  it("normalises and checks phone numbers with a country code", () => {
    expect(normalizePhone("+91 98765-43210")).toBe("+919876543210");
    expect(validateContact({ name: "Asha", email: "asha@example.com", phone: "+91 98765 43210" })).toEqual({});
    expect(Object.keys(validateContact({ name: "", email: "asha@", phone: "98765 43210" })).sort()).toEqual(["contact_email", "contact_name", "contact_phone"]);
  });

  it("needs an adult for each infant", () => {
    expect(validateInfantRatio(["adult", "infant_without_seat"])).toBeNull();
    expect(validateInfantRatio(["adult", "infant_without_seat", "infant_without_seat"])).toMatch(/adult/);
  });
});
