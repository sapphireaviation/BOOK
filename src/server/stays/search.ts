import "server-only";
import type { StaySearch } from "@/lib/search-params";
import type { PlaceSuggestion, StaySearchResult } from "./types";

/** CONTRACT (stays workstream). Used by /stays/search, /api/v1/search/stays and the MCP tool. */
export async function searchStays(params: StaySearch, opts?: { source?: "web" | "api" | "mcp" }): Promise<StaySearchResult> {
  void params;
  void opts;
  throw new Error("searchStays not implemented");
}

/** CONTRACT. Autocomplete for the place field. Backs GET /api/v1/places?q=. */
export async function suggestPlaces(q: string, limit = 8): Promise<PlaceSuggestion[]> {
  void q;
  void limit;
  throw new Error("suggestPlaces not implemented");
}

export type PublicListing = {
  id: string;
  slug: string;
  url: string;
  title: string;
  summary: string;
  description: string;
  propertyType: string;
  city: string;
  region: string | null;
  countryCode: string;
  lat: number;
  lng: number;
  photos: { url: string; alt: string }[];
  amenities: string[];
  maxGuests: number;
  bedrooms: number;
  beds: number;
  bathrooms: number;
  checkInFrom: string;
  checkOutUntil: string;
  cancellationPolicy: string;
  instantBook: boolean;
  currency: string;
  fromPrice: number;
  ratingAvg: number;
  ratingCount: number;
  units: { id: string; name: string; maxGuests: number; basePrice: number; beds: string }[];
  updatedAt: string;
};

/** CONTRACT. Published listing by slug, or null. Cached with tag `listing:<id>`. Used by API and MCP. */
export async function getListingPublic(slug: string): Promise<PublicListing | null> {
  void slug;
  throw new Error("getListingPublic not implemented");
}
