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
};

export type StaySearchResult = {
  place: { slug: string | null; name: string; lat: number; lng: number } | null;
  results: StayCard[];
  total: number;
  page: number;
  pageSize: number;
  /** Counts for filter facets, computed before price and type filters are applied. */
  facets: { types: Record<string, number>; priceMin: number; priceMax: number };
};

export type PlaceSuggestion = { slug: string; name: string; region: string | null; countryName: string; listingCount: number };
