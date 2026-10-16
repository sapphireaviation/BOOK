import type { PriceLine } from "@/db/schema";

export type StayQuoteInput = {
  listingId: string;
  unitId: string;
  checkIn: string;
  checkOut: string;
  adults: number;
  children: number;
  units: number;
};

export type StayQuote =
  | {
      available: true;
      currency: string;
      nights: number;
      /** Per-night prices in minor units, for the calendar breakdown. */
      nightly: { date: string; price: number }[];
      lines: PriceLine[]; // includes { kind: "fee", amount: 0 }
      total: number;
    }
  | { available: false; reason: string };

export type StayCard = {
  id: string;
  slug: string;
  url: string; // /stays/<destination>/<slug>
  title: string;
  summary: string;
  propertyType: string;
  city: string;
  region: string | null;
  countryCode: string;
  lat: number;
  lng: number;
  photo: { url: string; alt: string } | null;
  ratingAvg: number;
  ratingCount: number;
  maxGuests: number;
  bedrooms: number;
  amenities: string[];
  instantBook: boolean;
  freeCancellation: boolean;
  currency: string;
  /** Cheapest available unit for the searched dates, total for the whole stay incl. taxes and fees. */
  total: number;
  perNight: number;
  nights: number;
  unitId: string;
  /** Distance from the searched place in km, when the place has coordinates. */
  distanceKm: number | null;
  isDemo: boolean;
};

export type StaySearchResult = {
  place: { slug: string | null; name: string; lat: number; lng: number; radiusKm?: number } | null;
  results: StayCard[];
  total: number;
  page: number;
  pageSize: number;
  /** Counts for filter facets, computed before price and type filters are applied. */
  facets: { types: Record<string, number>; priceMin: number; priceMax: number; currency: string | null };
};

export type PlaceSuggestion = { slug: string; name: string; region: string | null; countryName: string; listingCount: number };

/** Inputs to the pure pricing function, loaded from the database by `quoteStay`. */
export type PricingListing = {
  status: string;
  kind: string;
  currency: string;
  cleaningFee: number;
  taxBps: number;
  minNights: number;
  maxNights: number;
};

export type PricingUnit = {
  active: boolean;
  maxGuests: number;
  basePrice: number;
  extraGuestPrice: number;
  includedGuests: number;
  quantity: number;
};

/** One `unit_inventory` row. Nights without a row use the unit defaults. */
export type InventoryNight = { date: string; booked: number; total: number | null; price: number | null; closed: boolean };
