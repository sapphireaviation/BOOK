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
