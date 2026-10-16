import type { FlightSearch } from "@/lib/search-params";

/** Provider-neutral flight types. UI and bookings only ever see these, never a provider SDK type. */

export type Place = { iata: string; name: string; city: string; timeZone?: string; terminal?: string | null; countryCode?: string };
export type Carrier = { iata: string; name: string; logoUrl?: string | null };

export type Baggage = { checked: number | null; cabin: number | null };

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
  /** Cabin marketing name for the first passenger, e.g. "Economy". */
  cabin?: string | null;
  /** Bags included per passenger on this segment, when the airline says. */
  baggage?: Baggage | null;
  /** Technical stops where passengers stay on board. */
  technicalStops?: { iata: string; city: string }[];
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

/** Whether the airline allows something, does not, or did not say. */
export type RuleStatus = "allowed" | "not_allowed" | "unknown";

export type Conditions = {
  refundable: boolean;
  refundPenalty?: { amount: number; currency: string } | null;
  changeable: boolean;
  changePenalty?: { amount: number; currency: string } | null;
  checkedBags?: number | null;
  cabinBags?: number | null;
  /** Finer grained than the booleans above: "unknown" when the airline shares no rule. */
  refund?: RuleStatus;
  change?: RuleStatus;
};

export type PassengerType = "adult" | "child" | "infant_without_seat";
export type OfferPassenger = { id: string; type: PassengerType; age?: number | null };

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
  /** Passenger ids with their type, in the order the provider returned them. */
  passengers?: OfferPassenger[];
  cabinClass?: string | null;
  /** False for provider test mode and the fixture provider. */
  live?: boolean;
};

export type AirlineFacet = { iata: string; name: string; logoUrl?: string | null; count: number; cheapest: number };

export type SearchFacets = {
  airlines: AirlineFacet[];
  /** Result count and cheapest total by the most stops on any slice (0, 1, 2). */
  stops: { stops: number; count: number; cheapest: number }[];
  minPrice: number | null;
  maxPrice: number | null;
  /** Offers returned by the provider before result filters. */
  total: number;
};

export type SearchResult = {
  offers: Offer[];
  requestId: string;
  currency: string;
  /** Provider name ("duffel", "fixture"). */
  provider?: string;
  /** Computed from the unfiltered results so filter controls can show counts. */
  facets?: SearchFacets;
};

export type IdentityDocument = {
  type: "passport";
  number: string;
  issuingCountryCode: string; // ISO 3166-1 alpha-2
  expiresOn: string; // YYYY-MM-DD
};

export type PassengerInput = {
  id: string; // provider passenger id from the offer
  type: PassengerType;
  title: "mr" | "ms" | "mrs" | "miss" | "dr";
  givenName: string;
  familyName: string;
  bornOn: string;
  gender: "m" | "f";
  email: string;
  phone: string;
  /** Required when the offer has requiresPassport. */
  identityDocument?: IdentityDocument;
  /** For an adult travelling with an infant on their lap: the infant's passenger id. */
  infantPassengerId?: string;
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

/** The provider could not be reached or returned an error that is not about the request itself. */
export class FlightProviderError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
  }
}
