import { describe, expect, it } from "vitest";
import { flightSearchSchema } from "@/lib/search-params";
import { amountToMinor, buildCreateOrder, buildOfferRequest, mapOffer, mapOfferRequest, minorToDecimalString } from "../duffel";
import { offer, offerRequest } from "./duffel-fixtures";

describe("amounts", () => {
  it("maps decimal strings to integer minor units", () => {
    expect(amountToMinor("7432.50", "INR")).toBe(743250);
    expect(amountToMinor("0.10", "GBP")).toBe(10);
    expect(amountToMinor("1999.99", "USD")).toBe(199999);
    expect(amountToMinor("12000", "JPY")).toBe(12000);
    expect(amountToMinor(null, "INR")).toBe(0);
  });

  it("formats minor units back to the exact decimal Duffel expects", () => {
    expect(minorToDecimalString(743250, "INR")).toBe("7432.50");
    expect(minorToDecimalString(5, "GBP")).toBe("0.05");
    expect(minorToDecimalString(12000, "JPY")).toBe("12000");
    expect(() => minorToDecimalString(1.5, "INR")).toThrow();
  });
});

describe("buildOfferRequest", () => {
  it("builds a one way request with passengers by type and cabin", () => {
    const req = buildOfferRequest(flightSearchSchema.parse({ from: "del", to: "goi", depart: "2026-11-20", adults: 2, children: 1, infants: 1, cabin: "business" }));
    expect(req.cabin_class).toBe("business");
    expect(req.slices).toEqual([{ origin: "DEL", destination: "GOI", departure_date: "2026-11-20", departure_time: null, arrival_time: null }]);
    expect(req.passengers).toEqual([{ type: "adult" }, { type: "adult" }, { type: "child" }, { type: "infant_without_seat" }]);
  });

  it("adds the return slice", () => {
    const req = buildOfferRequest(flightSearchSchema.parse({ from: "DEL", to: "GOI", depart: "2026-11-20", return: "2026-11-27" }));
    expect(req.slices).toHaveLength(2);
    expect(req.slices[1]).toMatchObject({ origin: "GOI", destination: "DEL", departure_date: "2026-11-27" });
  });
});

describe("mapOffer", () => {
  const mapped = mapOffer(offer);

  it("maps money to minor units, base plus tax equals total", () => {
    expect(mapped.total).toBe(743250);
    expect(mapped.baseAmount).toBe(621000);
    expect(mapped.taxAmount).toBe(122250);
    expect(mapped.baseAmount + mapped.taxAmount).toBe(mapped.total);
    expect(mapped.currency).toBe("INR");
  });

  it("maps slices, segments, stops and carriers", () => {
    const [slice] = mapped.slices;
    expect(slice.origin.iata).toBe("DEL");
    expect(slice.destination.iata).toBe("GOI");
    expect(slice.stops).toBe(1);
    expect(slice.durationMinutes).toBe(310);
    expect(slice.fareBrand).toBe("Saver");
    expect(slice.departAt).toBe("2026-11-20T22:30:00");
    expect(slice.arriveAt).toBe("2026-11-21T03:40:00");
    expect(slice.segments[0]).toMatchObject({ flightNumber: "6E 2031", durationMinutes: 130, aircraft: "Airbus A320neo", cabin: "Economy" });
    expect(slice.segments[0].origin.terminal).toBe("1");
    // Computed from local times when Duffel leaves duration out.
    expect(slice.segments[1].durationMinutes).toBe(70);
    expect(mapped.owner).toEqual({ iata: "6E", name: "IndiGo", logoUrl: offer.owner.logo_symbol_url });
  });

  it("maps conditions, penalties and baggage", () => {
    expect(mapped.conditions).toEqual({
      refundable: true,
      refundPenalty: { amount: 350000, currency: "INR" },
      changeable: false,
      changePenalty: null,
      checkedBags: 1,
      cabinBags: 1,
      refund: "allowed",
      change: "not_allowed",
    });
  });

  it("marks rules the airline did not share as unknown", () => {
    const m = mapOffer({ ...offer, conditions: { refund_before_departure: null, change_before_departure: null } });
    expect(m.conditions.refund).toBe("unknown");
    expect(m.conditions.refundable).toBe(false);
  });

  it("maps passengers, passport requirement and expiry", () => {
    expect(mapped.passengerIds).toEqual(["pas_adult", "pas_child", "pas_infant"]);
    expect(mapped.passengers?.map((p) => p.type)).toEqual(["adult", "child", "infant_without_seat"]);
    expect(mapped.requiresPassport).toBe(false);
    expect(mapOffer({ ...offer, passenger_identity_documents_required: true }).requiresPassport).toBe(true);
    expect(mapped.expiresAt).toBe(offer.expires_at);
    expect(mapped.provider).toBe("duffel");
    expect(mapped.live).toBe(false);
  });
});

describe("mapOfferRequest", () => {
  it("drops partial offers and derives tax when the airline sends none", () => {
    const res = mapOfferRequest(offerRequest, "INR");
    expect(res.requestId).toBe("orq_0000AbCdEf");
    expect(res.offers.map((o) => o.id)).toEqual(["off_0000AbCdEf", "off_no_tax"]);
    const noTax = res.offers[1];
    expect(noTax.baseAmount).toBe(700000);
    expect(noTax.taxAmount).toBe(43250);
  });
});

describe("buildCreateOrder", () => {
  const base = { email: "a@example.com", phone: "+919876543210", title: "mr" as const, gender: "m" as const };

  it("creates an instant order paid from balance for the exact amount", () => {
    const order = buildCreateOrder({
      offerId: "off_1",
      amount: 743250,
      currency: "INR",
      passengers: [
        { ...base, id: "pas_adult", type: "adult", givenName: "Asha", familyName: "Rao", bornOn: "1990-02-01" },
        { ...base, id: "pas_infant", type: "infant_without_seat", givenName: "Mira", familyName: "Rao", bornOn: "2026-01-01", title: "miss", gender: "f" },
      ],
    });
    expect(order.type).toBe("instant");
    expect(order.selected_offers).toEqual(["off_1"]);
    expect(order.payments).toEqual([{ type: "balance", amount: "7432.50", currency: "INR" }]);
    expect(order.passengers[0]).toMatchObject({ id: "pas_adult", given_name: "Asha", born_on: "1990-02-01", phone_number: "+919876543210", infant_passenger_id: "pas_infant" });
    expect(order.passengers[1].infant_passenger_id).toBeUndefined();
  });

  it("adds passport details when given", () => {
    const order = buildCreateOrder({
      offerId: "off_1",
      amount: 100,
      currency: "GBP",
      passengers: [
        {
          ...base,
          id: "pas_1",
          type: "adult",
          givenName: "Sam",
          familyName: "Lee",
          bornOn: "1985-05-05",
          identityDocument: { type: "passport", number: "K1234567", issuingCountryCode: "GB", expiresOn: "2031-01-01" },
        },
      ],
    });
    expect(order.passengers[0].identity_documents).toEqual([{ type: "passport", unique_identifier: "K1234567", issuing_country_code: "GB", expires_on: "2031-01-01" }]);
    expect(order.payments?.[0].amount).toBe("1.00");
  });
});
