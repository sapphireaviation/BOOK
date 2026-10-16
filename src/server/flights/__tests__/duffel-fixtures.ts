import type { Airline, Airport, Offer, OfferRequest, OfferSlice, OfferSliceSegment } from "@duffel/api/types";

/** Duffel API payloads shaped exactly like the SDK types, for mapping tests. */

export const indigo: Airline = {
  id: "arl_00009VME7DCOaPRQvNhcMu",
  name: "IndiGo",
  iata_code: "6E",
  logo_symbol_url: "https://assets.duffel.com/img/airlines/for-light-background/full-color-logo/6E.svg",
  logo_lockup_url: "https://assets.duffel.com/img/airlines/for-light-background/full-color-lockup-logo/6E.svg",
  conditions_of_carriage_url: null,
};

function airport(iata: string, name: string, city: string, tz: string, lat: number, lng: number): Airport {
  return {
    id: `arp_${iata.toLowerCase()}_in`,
    type: "airport",
    name,
    iata_code: iata,
    icao_code: `VX${iata.slice(0, 2)}`,
    iata_country_code: "IN",
    iata_city_code: iata,
    city_name: city,
    city: null,
    latitude: lat,
    longitude: lng,
    time_zone: tz,
  };
}

export const DEL = airport("DEL", "Indira Gandhi International Airport", "Delhi", "Asia/Kolkata", 28.5665, 77.1031);
export const BOM = airport("BOM", "Chhatrapati Shivaji Maharaj International Airport", "Mumbai", "Asia/Kolkata", 19.0896, 72.8656);
export const GOI = airport("GOI", "Goa Dabolim International Airport", "Goa", "Asia/Kolkata", 15.3808, 73.8314);

function segment(id: string, from: Airport, to: Airport, dep: string, arr: string, duration: string | null, flight: string): OfferSliceSegment {
  return {
    id,
    aircraft: { id: "arc_00009VMF8AhXSSRnQDI6Hi", name: "Airbus A320neo", iata_code: "32N" },
    origin: from,
    destination: to,
    origin_terminal: "1",
    destination_terminal: null,
    departing_at: dep,
    arriving_at: arr,
    duration,
    distance: null,
    marketing_carrier: indigo,
    marketing_carrier_flight_number: flight,
    operating_carrier: indigo,
    operating_carrier_flight_number: flight,
    stops: [],
    passengers: [
      {
        passenger_id: "pas_adult",
        cabin_class: "economy",
        cabin_class_marketing_name: "Economy",
        fare_basis_code: "R0IP",
        cabin: null,
        baggages: [
          { type: "checked", quantity: 1 },
          { type: "carry_on", quantity: 1 },
        ],
      },
    ],
  };
}

const outbound: OfferSlice = {
  id: "sli_out",
  origin_type: "airport",
  destination_type: "airport",
  origin: { ...DEL, type: "airport" },
  destination: { ...GOI, type: "airport" },
  duration: "PT5H10M",
  fare_brand_name: "Saver",
  comparison_key: "abc",
  ngs_shelf: 1,
  conditions: {
    refund_before_departure: null,
    change_before_departure: null,
    advance_seat_selection: null,
    priority_boarding: null,
    priority_check_in: null,
  },
  segments: [
    segment("seg_1", DEL, BOM, "2026-11-20T22:30:00", "2026-11-21T00:40:00", "PT2H10M", "2031"),
    // Duration omitted on purpose: the mapper must compute it from the local times and zones.
    segment("seg_2", BOM, GOI, "2026-11-21T02:30:00", "2026-11-21T03:40:00", null, "5110"),
  ],
};

export const offer: Offer = {
  id: "off_0000AbCdEf",
  live_mode: false,
  created_at: "2026-10-15T10:00:00Z",
  updated_at: "2026-10-15T10:00:00Z",
  expires_at: "2099-10-15T10:30:00Z",
  total_amount: "7432.50",
  total_currency: "INR",
  base_amount: "6210.00",
  base_currency: "INR",
  tax_amount: "1222.50",
  tax_currency: "INR",
  total_emissions_kg: "120",
  owner: indigo,
  partial: false,
  passenger_identity_documents_required: false,
  supported_passenger_identity_document_types: ["passport"],
  supported_loyalty_programmes: [],
  private_fares: [],
  payment_requirements: { requires_instant_payment: false, payment_required_by: null, price_guarantee_expires_at: null },
  available_services: [],
  conditions: {
    refund_before_departure: { allowed: true, penalty_amount: "3500.00", penalty_currency: "INR" },
    change_before_departure: { allowed: false, penalty_amount: null, penalty_currency: null },
  },
  passengers: [
    { id: "pas_adult", type: "adult", age: null, fare_type: null },
    { id: "pas_child", type: null, age: 7, fare_type: null },
    { id: "pas_infant", type: "infant_without_seat", age: null, fare_type: null },
  ],
  slices: [outbound],
};

export const offerRequest: OfferRequest = {
  id: "orq_0000AbCdEf",
  live_mode: false,
  created_at: "2026-10-15T10:00:00Z",
  cabin_class: "economy",
  slices: [],
  passengers: [{ id: "pas_adult", type: "adult" }],
  offers: [
    offer,
    { ...offer, id: "off_partial", partial: true },
    { ...offer, id: "off_no_tax", tax_amount: null, tax_currency: null, base_amount: "7000.00", total_amount: "7432.50" },
  ],
};
