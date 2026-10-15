import type { FlightSearch } from "@/lib/search-params";

/** Provider-neutral flight types. UI and bookings only ever see these, never a provider SDK type. */

export type Place = { iata: string; name: string; city: string; timeZone?: string; terminal?: string | null };
export type Carrier = { iata: string; name: string; logoUrl?: string | null };

export type Segment = {
  id: string;
  origin: Place;
  destination: Place;
  departAt: string; // local ISO without offset as returned by airline, plus zone in Place
  arriveAt: string;
  durationMinutes: number;
  marketingCarrier: Carrier;
  operatingCarrier: Carrier;
  flightNumber: string; // "6E 2031"
  aircraft?: string | null;
};

export type Slice = {
  id: string;
  origin: Place;
  destination: Place;
  departAt: string;
  arriveAt: string;
  durationMinutes: number;
  stops: number;
  segments: Segment[];
  fareBrand?: string | null;
};

export type Conditions = {
  refundable: boolean;
  refundPenalty?: { amount: number; currency: string } | null;
  changeable: boolean;
  changePenalty?: { amount: number; currency: string } | null;
  checkedBags?: number | null;
  cabinBags?: number | null;
};

export type Offer = {
  id: string;
  provider: string;
  /** Total in minor units, exactly what the airline charges. We add nothing. */
  total: number;
  currency: string;
  baseAmount: number;
  taxAmount: number;
  slices: Slice[];
  owner: Carrier;
  conditions: Conditions;
  expiresAt: string;
  passengerIds: string[];
  /** Passport details needed at booking. */
  requiresPassport: boolean;
};

export type SearchResult = { offers: Offer[]; requestId: string; currency: string };

export type PassengerInput = {
  id: string; // provider passenger id from the offer
  type: "adult" | "child" | "infant_without_seat";
  title: "mr" | "ms" | "mrs" | "miss" | "dr";
  givenName: string;
  familyName: string;
  bornOn: string;
  gender: "m" | "f";
  email: string;
  phone: string;
};

export type OrderResult = { orderId: string; airlineReference: string; raw: unknown };

export interface FlightProvider {
  readonly name: string;
  search(params: FlightSearch): Promise<SearchResult>;
  /** Re-fetches the offer with a fresh price. Throws OfferExpiredError when gone. */
  getOffer(offerId: string): Promise<Offer>;
  /** Books and tickets. Pays the airline from our provider balance. */
  createOrder(input: { offerId: string; passengers: PassengerInput[]; amount: number; currency: string }): Promise<OrderResult>;
  cancelOrder?(orderId: string): Promise<{ refundAmount: number; currency: string }>;
}

export class OfferExpiredError extends Error {
  constructor() {
    super("This fare is no longer available. Search again to see current fares.");
  }
}

export class FlightsNotConfiguredError extends Error {
  constructor() {
    super("Flight booking is not connected yet.");
  }
}
