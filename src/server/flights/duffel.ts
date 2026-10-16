import "server-only";
import { Duffel, DuffelError } from "@duffel/api";
import type {
  Airline as DuffelAirline,
  Airport as DuffelAirport,
  CreateOfferRequest,
  CreateOrder,
  CreateOrderPassenger,
  FlightsCondition,
  Offer as DuffelOffer,
  OfferRequest as DuffelOfferRequest,
  OfferSlice as DuffelSlice,
  OfferSliceSegment as DuffelSegment,
  Place as DuffelPlace,
} from "@duffel/api/types";
import type { FlightSearch } from "@/lib/search-params";
import { isoDurationMinutes, minutesBetween } from "@/lib/flight-time";
import { minorUnitDigits, toMinor } from "@/lib/money";
import {
  FlightProviderError,
  OfferExpiredError,
  type Baggage,
  type Carrier,
  type Conditions,
  type FlightProvider,
  type Offer,
  type OfferPassenger,
  type PassengerInput,
  type PassengerType,
  type Place,
  type RuleStatus,
  type SearchResult,
  type Segment,
  type Slice,
} from "./types";

/**
 * Duffel adapter. The mapping functions are pure and typed against the SDK's own types, so they
 * are unit tested with fixture JSON (src/server/flights/__tests__/duffel.test.ts) without network.
 */

/** Per airline search budget. Kept below our own request timeout so Duffel returns what it has. */
export const SUPPLIER_TIMEOUT_MS = 15_000;

/** Decimal string ("1234.50") to integer minor units. */
export function amountToMinor(amount: string | null | undefined, currency: string) {
  if (amount === null || amount === undefined || amount === "") return 0;
  const major = Number(amount);
  if (!Number.isFinite(major)) throw new FlightProviderError(`Unexpected amount "${amount}" from Duffel`);
  return toMinor(major, currency);
}

/** Integer minor units to the decimal string Duffel expects ("1234.50"). */
export function minorToDecimalString(minor: number, currency: string) {
  if (!Number.isInteger(minor)) throw new Error("Amount must be integer minor units");
  const digits = minorUnitDigits(currency);
  if (!digits) return String(minor);
  const sign = minor < 0 ? "-" : "";
  const abs = Math.abs(minor);
  const base = 10 ** digits;
  return `${sign}${Math.floor(abs / base)}.${String(abs % base).padStart(digits, "0")}`;
}

// Search request

type TypedPassenger = { type: PassengerType };

/**
 * Passengers by type. The SDK typings only list `type` for adults and steer children towards an
 * exact `age`, but the API accepts `child` and `infant_without_seat` types, and our search form asks
 * for counts by type, not ages. Children and infants are confirmed by date of birth at booking.
 */
export function buildOfferRequest(params: FlightSearch): CreateOfferRequest {
  const slices: CreateOfferRequest["slices"] = [
    { origin: params.from, destination: params.to, departure_date: params.depart, departure_time: null, arrival_time: null },
  ];
  if (params.return) {
    slices.push({ origin: params.to, destination: params.from, departure_date: params.return, departure_time: null, arrival_time: null });
  }
  const passengers: TypedPassenger[] = [
    ...Array.from({ length: params.adults }, () => ({ type: "adult" as const })),
    ...Array.from({ length: params.children }, () => ({ type: "child" as const })),
    ...Array.from({ length: params.infants }, () => ({ type: "infant_without_seat" as const })),
  ];
  return {
    slices,
    passengers: passengers as CreateOfferRequest["passengers"],
    cabin_class: params.cabin,
  };
}

// Offer mapping

export function mapCarrier(a: DuffelAirline): Carrier {
  return { iata: a.iata_code ?? a.id, name: a.name, logoUrl: a.logo_symbol_url ?? a.logo_lockup_url ?? null };
}

function mapAirport(a: DuffelAirport, terminal?: string | null): Place {
  return {
    iata: a.iata_code ?? a.icao_code ?? a.id,
    name: a.name,
    city: a.city_name || a.city?.name || a.name,
    timeZone: a.time_zone || undefined,
    terminal: terminal ?? null,
    countryCode: a.iata_country_code,
  };
}

function mapPlace(p: DuffelPlace): Place {
  if (p.type === "airport") return mapAirport(p);
  return { iata: p.iata_code, name: p.name, city: p.name, countryCode: p.iata_country_code };
}

function segmentBaggage(seg: DuffelSegment): Baggage | null {
  const pax = seg.passengers?.[0];
  if (!pax?.baggages) return null;
  const sum = (type: "checked" | "carry_on") => pax.baggages.filter((b) => b.type === type).reduce((n, b) => n + b.quantity, 0);
  return { checked: sum("checked"), cabin: sum("carry_on") };
}

export function mapSegment(seg: DuffelSegment): Segment {
  const origin = mapAirport(seg.origin, seg.origin_terminal);
  const destination = mapAirport(seg.destination, seg.destination_terminal);
  const duration =
    isoDurationMinutes(seg.duration) ?? minutesBetween(seg.departing_at, origin.timeZone, seg.arriving_at, destination.timeZone);
  const marketing = mapCarrier(seg.marketing_carrier);
  return {
    id: seg.id,
    origin,
    destination,
    departAt: seg.departing_at,
    arriveAt: seg.arriving_at,
    durationMinutes: duration,
    marketingCarrier: marketing,
    operatingCarrier: mapCarrier(seg.operating_carrier),
    flightNumber: `${marketing.iata} ${seg.marketing_carrier_flight_number}`,
    aircraft: seg.aircraft?.name ?? null,
    cabin: seg.passengers?.[0]?.cabin_class_marketing_name ?? null,
    baggage: segmentBaggage(seg),
    technicalStops: (seg.stops ?? []).map((s) => ({ iata: s.airport.iata_code ?? s.airport.id, city: s.airport.city_name || s.airport.name })),
  };
}

export function mapSlice(slice: DuffelSlice): Slice {
  const segments = slice.segments.map(mapSegment);
  const first = segments[0];
  const last = segments[segments.length - 1];
  const origin = first ? first.origin : mapPlace(slice.origin);
  const destination = last ? last.destination : mapPlace(slice.destination);
  const departAt = first?.departAt ?? "";
  const arriveAt = last?.arriveAt ?? "";
  const duration =
    isoDurationMinutes(slice.duration) ??
    (first && last ? minutesBetween(departAt, origin.timeZone, arriveAt, destination.timeZone) : 0);
  return {
    id: slice.id,
    origin,
    destination,
    departAt,
    arriveAt,
    durationMinutes: duration,
    stops: Math.max(0, segments.length - 1),
    segments,
    fareBrand: slice.fare_brand_name,
  };
}

function rule(c: FlightsCondition | null | undefined): RuleStatus {
  if (!c) return "unknown";
  return c.allowed ? "allowed" : "not_allowed";
}

function penalty(c: FlightsCondition | null | undefined, fallbackCurrency: string) {
  if (!c || !c.allowed || c.penalty_amount === null) return null;
  const currency = c.penalty_currency ?? fallbackCurrency;
  return { amount: amountToMinor(c.penalty_amount, currency), currency };
}

/** Bags for the first passenger on the first segment, which is what the row summary shows. */
function offerBaggage(offer: Pick<DuffelOffer, "slices">): Baggage {
  const seg = offer.slices[0]?.segments[0];
  return (seg && segmentBaggage(seg)) ?? { checked: null, cabin: null };
}

export function mapConditions(offer: Pick<DuffelOffer, "conditions" | "slices" | "total_currency">): Conditions {
  const refund = offer.conditions?.refund_before_departure;
  const change = offer.conditions?.change_before_departure;
  const bags = offerBaggage(offer);
  return {
    refundable: refund?.allowed === true,
    refundPenalty: penalty(refund, offer.total_currency),
    changeable: change?.allowed === true,
    changePenalty: penalty(change, offer.total_currency),
    checkedBags: bags.checked,
    cabinBags: bags.cabin,
    refund: rule(refund),
    change: rule(change),
  };
}

function passengerType(p: { type: PassengerType | null; age: number | null }): PassengerType {
  if (p.type) return p.type;
  if (p.age === null) return "adult";
  if (p.age < 2) return "infant_without_seat";
  if (p.age < 12) return "child";
  return "adult";
}

export function mapOffer(offer: Omit<DuffelOffer, "available_services"> & Partial<Pick<DuffelOffer, "available_services">>): Offer {
  const currency = offer.total_currency;
  const total = amountToMinor(offer.total_amount, currency);
  const tax = offer.tax_amount !== null && offer.tax_currency === currency ? amountToMinor(offer.tax_amount, currency) : null;
  const base = offer.base_currency === currency ? amountToMinor(offer.base_amount, currency) : null;
  // Base and tax always add up to the total we charge. When the airline only sends one, derive the other.
  const taxAmount = tax ?? (base !== null ? total - base : 0);
  const baseAmount = total - taxAmount;
  const passengers: OfferPassenger[] = offer.passengers.map((p) => ({ id: p.id, type: passengerType(p), age: p.age }));
  return {
    id: offer.id,
    provider: "duffel",
    total,
    currency,
    baseAmount,
    taxAmount,
    slices: offer.slices.map(mapSlice),
    owner: mapCarrier(offer.owner),
    conditions: mapConditions(offer),
    expiresAt: offer.expires_at,
    passengerIds: passengers.map((p) => p.id),
    requiresPassport: offer.passenger_identity_documents_required,
    passengers,
    cabinClass: offer.slices[0]?.segments[0]?.passengers?.[0]?.cabin_class ?? null,
    live: offer.live_mode,
  };
}

export function mapOfferRequest(req: DuffelOfferRequest, fallbackCurrency: string): SearchResult {
  const offers = req.offers.filter((o) => !o.partial).map(mapOffer);
  return { offers, requestId: req.id, currency: offers[0]?.currency ?? fallbackCurrency, provider: "duffel" };
}

// Orders

/**
 * Duffel needs every infant linked to the adult whose lap they sit on. When the booking form does
 * not say, infants are assigned to adults in order (the search already enforces one infant per adult).
 */
export function buildCreateOrder(input: { offerId: string; passengers: PassengerInput[]; amount: number; currency: string }): CreateOrder {
  const infants = input.passengers.filter((p) => p.type === "infant_without_seat");
  const taken = new Set(input.passengers.map((p) => p.infantPassengerId).filter(Boolean));
  const unassigned = infants.filter((i) => !taken.has(i.id));
  const passengers: CreateOrderPassenger[] = input.passengers.map((p) => {
    let infantId = p.infantPassengerId ?? null;
    if (!infantId && p.type === "adult" && unassigned.length) infantId = unassigned.shift()!.id;
    const out: CreateOrderPassenger = {
      id: p.id,
      title: p.title,
      gender: p.gender,
      given_name: p.givenName,
      family_name: p.familyName,
      born_on: p.bornOn,
      email: p.email,
      phone_number: p.phone,
    };
    if (infantId) out.infant_passenger_id = infantId;
    if (p.identityDocument) {
      out.identity_documents = [
        {
          type: "passport",
          unique_identifier: p.identityDocument.number,
          issuing_country_code: p.identityDocument.issuingCountryCode,
          expires_on: p.identityDocument.expiresOn,
        },
      ];
    }
    return out;
  });
  if (unassigned.length) throw new FlightProviderError("Each infant must travel with an adult.");
  return {
    type: "instant",
    selected_offers: [input.offerId],
    passengers,
    payments: [{ type: "balance", amount: minorToDecimalString(input.amount, input.currency), currency: input.currency }],
  };
}

// Errors

const EXPIRED_CODES = new Set(["offer_no_longer_available", "offer_expired", "offer_request_already_booked", "not_found"]);

export function isOfferGoneError(err: unknown) {
  if (!(err instanceof DuffelError)) return false;
  if (err.status === 404 || err.status === 410) return true;
  return err.errors?.some((e) => EXPIRED_CODES.has(e.code)) ?? false;
}

function describe(err: unknown) {
  if (err instanceof DuffelError) {
    const first = err.errors?.[0];
    return `Duffel ${err.status ?? ""} ${first?.code ?? ""}: ${first?.message ?? err.message}`.trim();
  }
  return err instanceof Error ? err.message : String(err);
}

// Provider

export class DuffelProvider implements FlightProvider {
  readonly name = "duffel";
  private client: Duffel;

  constructor(
    token: string,
    private readonly fallbackCurrency = "INR",
  ) {
    this.client = new Duffel({ token });
  }

  async search(params: FlightSearch): Promise<SearchResult> {
    try {
      const res = await this.client.offerRequests.create({
        ...buildOfferRequest(params),
        return_offers: true,
        supplier_timeout: SUPPLIER_TIMEOUT_MS,
      });
      return mapOfferRequest(res.data, this.fallbackCurrency);
    } catch (err) {
      throw new FlightProviderError(describe(err), err);
    }
  }

  async getOffer(offerId: string): Promise<Offer> {
    try {
      const res = await this.client.offers.get(offerId);
      if (Date.parse(res.data.expires_at) <= Date.now()) throw new OfferExpiredError();
      return mapOffer(res.data);
    } catch (err) {
      if (err instanceof OfferExpiredError) throw err;
      if (isOfferGoneError(err)) throw new OfferExpiredError();
      throw new FlightProviderError(describe(err), err);
    }
  }

  async createOrder(input: { offerId: string; passengers: PassengerInput[]; amount: number; currency: string }) {
    try {
      const res = await this.client.orders.create(buildCreateOrder(input));
      return { orderId: res.data.id, airlineReference: res.data.booking_reference, raw: res.data };
    } catch (err) {
      if (isOfferGoneError(err)) throw new OfferExpiredError();
      throw new FlightProviderError(describe(err), err);
    }
  }

  /** Quotes the cancellation, then confirms it. The refund goes back to our Duffel balance. */
  async cancelOrder(orderId: string) {
    try {
      const quote = await this.client.orderCancellations.create({ order_id: orderId });
      const confirmed = await this.client.orderCancellations.confirm(quote.data.id);
      const currency = confirmed.data.refund_currency ?? quote.data.refund_currency ?? this.fallbackCurrency;
      return { refundAmount: amountToMinor(confirmed.data.refund_amount ?? quote.data.refund_amount, currency), currency };
    } catch (err) {
      throw new FlightProviderError(describe(err), err);
    }
  }
}
