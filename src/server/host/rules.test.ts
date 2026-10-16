import { describe, expect, it } from "vitest";
import {
  bpsToPercentInput,
  buildMonthCells,
  calendarUpsertPlan,
  canManageListing,
  canSeeHostBooking,
  chooseSlug,
  computeFromPrice,
  currencyRescale,
  eachDateInclusive,
  hostCanSeeGuestContact,
  isReadyToPublish,
  listingSlugBase,
  minorToInput,
  monthDates,
  nearestDestination,
  parseAdminEmails,
  parseLanguages,
  parseMoneyInput,
  parsePercentToBps,
  publishChecklist,
  shiftMonth,
} from "./rules";

describe("ownership", () => {
  const listing = { hostId: "u_owner" };

  it("lets a host manage their own listing", () => {
    expect(canManageListing({ userId: "u_owner", role: "host" }, listing)).toBe(true);
  });

  it("refuses another host", () => {
    expect(canManageListing({ userId: "u_other", role: "host" }, listing)).toBe(false);
  });

  it("refuses a traveler even on a listing that names them as host", () => {
    expect(canManageListing({ userId: "u_owner", role: "traveler" }, listing)).toBe(false);
  });

  it("lets an admin manage any listing", () => {
    expect(canManageListing({ userId: "u_ops", role: "admin" }, listing)).toBe(true);
  });

  it("shows bookings only to their host or an admin", () => {
    expect(canSeeHostBooking({ userId: "u_owner", role: "host" }, { hostId: "u_owner" })).toBe(true);
    expect(canSeeHostBooking({ userId: "u_other", role: "host" }, { hostId: "u_owner" })).toBe(false);
    expect(canSeeHostBooking({ userId: "u_ops", role: "admin" }, { hostId: "u_owner" })).toBe(true);
  });

  it("shares guest contact only for confirmed bookings", () => {
    expect(hostCanSeeGuestContact("confirmed")).toBe(true);
    for (const s of ["pending_payment", "completed", "cancelled", "refunded", "draft"]) expect(hostCanSeeGuestContact(s)).toBe(false);
  });
});

describe("fromPrice", () => {
  it("is the lowest base price among active units", () => {
    expect(
      computeFromPrice([
        { basePrice: 450000, active: true },
        { basePrice: 300000, active: false },
        { basePrice: 380000, active: true },
      ]),
    ).toBe(380000);
  });

  it("is 0 with no active priced units", () => {
    expect(computeFromPrice([])).toBe(0);
    expect(computeFromPrice([{ basePrice: 1000, active: false }])).toBe(0);
    expect(computeFromPrice([{ basePrice: 0, active: true }])).toBe(0);
  });
});

describe("slugs", () => {
  it("builds the base from title and city", () => {
    expect(listingSlugBase("Sea Breeze Cottage", "Panaji")).toBe("sea-breeze-cottage-panaji");
    expect(listingSlugBase("Café & Rooms", "Mysuru")).toBe("cafe-and-rooms-mysuru");
    expect(listingSlugBase("!!!", "")).toBe("stay");
  });

  it("uses the base when it is free", () => {
    expect(chooseSlug("sea-view-goa", null, ["other"])).toBe("sea-view-goa");
  });

  it("adds the next free number when the base is taken", () => {
    expect(chooseSlug("sea-view-goa", null, ["sea-view-goa", "sea-view-goa-2"])).toBe("sea-view-goa-3");
  });

  it("keeps the current slug when the title and city have not changed", () => {
    expect(chooseSlug("sea-view-goa", "sea-view-goa-2", ["sea-view-goa", "sea-view-goa-2"])).toBe("sea-view-goa-2");
    expect(chooseSlug("sea-view-goa", "sea-view-goa", ["sea-view-goa"])).toBe("sea-view-goa");
  });

  it("moves to a new slug when the title changes", () => {
    expect(chooseSlug("hill-house-ooty", "sea-view-goa", ["sea-view-goa"])).toBe("hill-house-ooty");
  });

  it("does not treat a longer slug with a number as the same base", () => {
    expect(chooseSlug("sea-view", "sea-view-goa-2", [])).toBe("sea-view");
  });
});

describe("publish checklist", () => {
  const ready = {
    title: "Sea breeze cottage",
    summary: "Two bedroom cottage a short walk from the beach",
    description: "x".repeat(120),
    city: "Panaji",
    countryCode: "IN",
    lat: 15.49,
    lng: 73.82,
    photos: [{ alt: "Front" }, { alt: "Bedroom" }, { alt: "Kitchen" }],
    units: [{ active: true, basePrice: 450000 }],
  };

  it("passes a complete listing", () => {
    expect(isReadyToPublish(publishChecklist(ready, "/host/listings/x"))).toBe(true);
  });

  it("needs three photos, each described", () => {
    const two = publishChecklist({ ...ready, photos: ready.photos.slice(0, 2) }, "/b");
    expect(two.find((i) => i.key === "photos")?.done).toBe(false);
    const undescribed = publishChecklist({ ...ready, photos: [...ready.photos.slice(0, 2), { alt: " " }] }, "/b");
    expect(undescribed.find((i) => i.key === "alt")?.done).toBe(false);
  });

  it("needs a map pin and an active priced room", () => {
    expect(isReadyToPublish(publishChecklist({ ...ready, lat: 0, lng: 0 }, "/b"))).toBe(false);
    expect(isReadyToPublish(publishChecklist({ ...ready, units: [{ active: false, basePrice: 450000 }] }, "/b"))).toBe(false);
  });

  it("links each item to the section that fixes it", () => {
    const items = publishChecklist({ ...ready, photos: [] }, "/host/listings/lst_1");
    expect(items.find((i) => i.key === "photos")?.href).toBe("/host/listings/lst_1/photos");
  });
});

describe("money typed into forms", () => {
  it("converts major units to minor units", () => {
    expect(parseMoneyInput("4820", "INR")).toEqual({ ok: true, value: 482000 });
    expect(parseMoneyInput("4,820.50", "INR")).toEqual({ ok: true, value: 482050 });
    expect(parseMoneyInput("12.5", "EUR")).toEqual({ ok: true, value: 1250 });
    expect(parseMoneyInput("0.1", "USD")).toEqual({ ok: true, value: 10 });
    expect(parseMoneyInput("1.15", "USD")).toEqual({ ok: true, value: 115 });
    expect(parseMoneyInput("15000", "JPY")).toEqual({ ok: true, value: 15000 });
  });

  it("rejects negatives, letters and extra decimals", () => {
    expect(parseMoneyInput("-5", "INR").ok).toBe(false);
    expect(parseMoneyInput("abc", "INR").ok).toBe(false);
    expect(parseMoneyInput("12.345", "INR").ok).toBe(false);
    expect(parseMoneyInput("150.5", "JPY").ok).toBe(false);
  });

  it("treats empty as an error unless allowed", () => {
    expect(parseMoneyInput("", "INR").ok).toBe(false);
    expect(parseMoneyInput("  ", "INR", { allowEmpty: true })).toEqual({ ok: true, value: null });
  });

  it("round trips through the input default value", () => {
    expect(minorToInput(482000, "INR")).toBe("4820");
    expect(minorToInput(1250, "EUR")).toBe("12.50");
    expect(minorToInput(15000, "JPY")).toBe("15000");
    expect(minorToInput(null, "INR")).toBe("");
    for (const [minor, cur] of [
      [482050, "INR"],
      [1, "USD"],
      [99999, "EUR"],
    ] as const) {
      const back = parseMoneyInput(minorToInput(minor, cur), cur);
      expect(back).toEqual({ ok: true, value: minor });
    }
  });

  it("converts tax percent to basis points and back", () => {
    expect(parsePercentToBps("12")).toEqual({ ok: true, value: 1200 });
    expect(parsePercentToBps("12.5%")).toEqual({ ok: true, value: 1250 });
    expect(parsePercentToBps("")).toEqual({ ok: true, value: 0 });
    expect(parsePercentToBps("101").ok).toBe(false);
    expect(parsePercentToBps("1.234").ok).toBe(false);
    expect(bpsToPercentInput(1200)).toBe("12");
    expect(bpsToPercentInput(1250)).toBe("12.5");
    expect(bpsToPercentInput(1825)).toBe("18.25");
  });

  it("rescales stored amounts between currencies with different decimals", () => {
    expect(currencyRescale("INR", "USD")).toBe(1);
    expect(currencyRescale("INR", "JPY")).toBe(0.01);
    expect(currencyRescale("JPY", "EUR")).toBe(100);
  });
});

describe("calendar range updates", () => {
  const dates = eachDateInclusive("2026-10-30", "2026-11-02");

  it("covers every date in the range, in either order", () => {
    expect(dates).toEqual(["2026-10-30", "2026-10-31", "2026-11-01", "2026-11-02"]);
    expect(eachDateInclusive("2026-11-02", "2026-10-30")).toEqual(dates);
  });

  it("never sets booked on rows that already exist", () => {
    const actions = [
      { kind: "price", price: 500000 },
      { kind: "reset_price" },
      { kind: "close" },
      { kind: "open" },
      { kind: "total", total: 2 },
    ] as const;
    for (const action of actions) {
      const plan = calendarUpsertPlan("unt_1", dates, action);
      expect(Object.keys(plan.set)).not.toContain("booked");
      expect(Object.keys(plan.set)).toHaveLength(1);
    }
  });

  it("inserts new rows with nothing booked", () => {
    const plan = calendarUpsertPlan("unt_1", dates, { kind: "price", price: 500000 });
    expect(plan.rows).toHaveLength(4);
    for (const row of plan.rows) {
      expect(row.booked).toBe(0);
      expect(row.price).toBe(500000);
      expect(row.closed).toBe(false);
    }
  });

  it("changes only the column the action is about", () => {
    expect(calendarUpsertPlan("u", dates, { kind: "close" }).set).toEqual({ closed: true });
    expect(calendarUpsertPlan("u", dates, { kind: "open" }).set).toEqual({ closed: false });
    expect(calendarUpsertPlan("u", dates, { kind: "reset_price" }).set).toEqual({ price: null });
    expect(calendarUpsertPlan("u", dates, { kind: "total", total: null }).set).toEqual({ total: null });
  });

  it("merges inventory rows with unit defaults for the month grid", () => {
    const cells = buildMonthCells(["2026-10-01", "2026-10-02", "2026-10-03"], { basePrice: 400000, quantity: 3 }, [
      { date: "2026-10-02", booked: 2, total: null, price: 550000, closed: false },
      { date: "2026-10-03", booked: 1, total: 1, price: null, closed: true },
    ]);
    expect(cells[0]).toMatchObject({ price: 400000, priceOverridden: false, total: 3, booked: 0, left: 3, closed: false });
    expect(cells[1]).toMatchObject({ price: 550000, priceOverridden: true, booked: 2, left: 1 });
    expect(cells[2]).toMatchObject({ total: 1, booked: 1, left: 0, closed: true });
  });

  it("knows month lengths and moves between months", () => {
    expect(monthDates("2028-02")).toHaveLength(29);
    expect(monthDates("2026-10")[30]).toBe("2026-10-31");
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
  });
});

describe("destinations", () => {
  const list = [
    { slug: "goa", lat: 15.4909, lng: 73.8278, radiusKm: 60 },
    { slug: "mumbai", lat: 19.076, lng: 72.8777, radiusKm: 40 },
  ];

  it("picks the nearest destination that covers the point", () => {
    expect(nearestDestination({ lat: 15.55, lng: 73.75 }, list)?.slug).toBe("goa");
  });

  it("returns null when no destination covers the point", () => {
    expect(nearestDestination({ lat: 28.6, lng: 77.2 }, list)).toBeNull();
  });
});

describe("text inputs", () => {
  it("parses admin emails case insensitively", () => {
    expect([...parseAdminEmails(" Ops@Example.com, ,b@x.io ")]).toEqual(["ops@example.com", "b@x.io"]);
    expect(parseAdminEmails(undefined).size).toBe(0);
  });

  it("cleans language lists", () => {
    expect(parseLanguages("English, hindi ,English\nKonkani")).toEqual(["English", "hindi", "Konkani"]);
  });
});
