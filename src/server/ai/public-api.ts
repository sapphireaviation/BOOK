import "server-only";
import type { z } from "zod";
import { absoluteUrl, site } from "@/config/site";
import { formatDuration } from "@/lib/dates";
import { amenityLabel, cancellationPolicyText, propertyTypeLabels } from "@/lib/amenities";
import { formatMoney } from "@/lib/money";
import { flightSearchSchema, staySearchSchema, toQuery, type FlightSearch, type StaySearch } from "@/lib/search-params";
import { getOffer, searchFlights } from "@/server/flights";
import type { Offer } from "@/server/flights/types";
import { OfferExpiredError } from "@/server/flights/types";
import { getListingPublic, searchStays, type PublicListing } from "@/server/stays/search";
import type { StayCard } from "@/server/stays/types";
import { parseTripQuery, type ParsedTrip } from "./parse-query";

/**
 * The assistant facing surface: one implementation behind the REST API
 * (/api/v1/*) and the MCP tools, so both return the same compact JSON with
 * absolute links a person can open to book.
 */

export type Source = "api" | "mcp";

export type ApiError = {
  code: "invalid_request" | "not_found" | "unavailable" | "expired";
  message: string;
  issues?: { field: string; message: string }[];
  understood?: string[];
  missing?: string[];
};

export type ApiResult<T> = { ok: true; data: T } | { ok: false; status: 400 | 404 | 410 | 503; error: ApiError };

const FEE_NOTE = "Prices are what the airline or owner charges. There is no platform fee.";

function issuesOf(err: z.ZodError) {
  return err.issues.map((i) => ({ field: i.path.join(".") || "query", message: i.message }));
}

/** Drops empty values so explicit parameters only override what was actually given. */
function compact(input: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input)) if (v !== undefined && v !== null && v !== "") out[k] = v;
  return out;
}

function money(amount: number, currency: string) {
  return { amount, currency, text: formatMoney({ amount, currency }, site.defaultLocale) };
}

export function flightSearchPath(p: Partial<FlightSearch>) {
  return `/flights/search?${toQuery(p)}`;
}

export function staySearchPath(p: Partial<StaySearch>) {
  return `/stays/search?${toQuery(p)}`;
}

/** Search page for a parsed sentence, or null when something is still missing. */
export function pathForParsed(parsed: ParsedTrip): string | null {
  if (parsed.missing.length) return null;
  if (parsed.kind === "flight" && parsed.flight) return flightSearchPath(parsed.flight);
  if (parsed.kind === "stay" && parsed.stay) return staySearchPath(parsed.stay);
  return null;
}

async function withParsedQuery(input: Record<string, unknown>) {
  const { q, ...rest } = input;
  const explicit = compact(rest);
  if (typeof q !== "string" || !q.trim()) return { merged: explicit, parsed: undefined };
  const parsed = await parseTripQuery(q);
  return { merged: explicit, parsed };
}

// ---------------------------------------------------------------------------
// Stays

function stayCard(card: StayCard, params: StaySearch) {
  const query = toQuery({ checkin: params.checkin, checkout: params.checkout, adults: params.adults, children: params.children || undefined, rooms: params.rooms > 1 ? params.rooms : undefined });
  return {
    name: card.title,
    url: absoluteUrl(`${card.url}?${query}`),
    type: propertyTypeLabels[card.propertyType] ?? card.propertyType,
    city: card.city,
    region: card.region,
    summary: card.summary,
    rating: card.ratingCount ? Number(card.ratingAvg.toFixed(1)) : null,
    reviews: card.ratingCount,
    maxGuests: card.maxGuests,
    bedrooms: card.bedrooms,
    amenities: card.amenities.map(amenityLabel),
    freeCancellation: card.freeCancellation,
    instantBook: card.instantBook,
    nights: card.nights,
    perNight: money(card.perNight, card.currency),
    total: money(card.total, card.currency),
    photo: card.photo ? { url: card.photo.url.startsWith("http") ? card.photo.url : absoluteUrl(card.photo.url), alt: card.photo.alt } : null,
  };
}

export async function searchStaysPublic(input: Record<string, unknown>, source: Source) {
  const { merged, parsed } = await withParsedQuery(input);
  const candidate = { ...(parsed?.stay ?? {}), ...merged };
  const check = staySearchSchema.safeParse(candidate);
  if (!check.success) {
    return {
      ok: false,
      status: 400,
      error: {
        code: "invalid_request",
        message: parsed ? "The request needs a few more details before stays can be searched." : "Some parameters are missing or invalid.",
        issues: issuesOf(check.error),
        ...(parsed ? { understood: parsed.understood, missing: parsed.missing } : {}),
      },
    } satisfies ApiResult<never>;
  }
  const params = check.data;
  try {
    const result = await searchStays(params, { source });
    const searchUrl = absoluteUrl(staySearchPath(params));
    return {
      ok: true,
      data: {
        query: params,
        ...(parsed ? { understood: parsed.understood } : {}),
        place: result.place ? { name: result.place.name, slug: result.place.slug } : null,
        total: result.total,
        page: result.page,
        pageSize: result.pageSize,
        results: result.results.map((c) => stayCard(c, params)),
        searchUrl,
        nextPage: result.page * result.pageSize < result.total ? absoluteUrl(staySearchPath({ ...params, page: result.page + 1 })) : null,
        note: FEE_NOTE,
      },
    } as const;
  } catch (err) {
    console.error("[public-api] searchStays failed:", err);
    return unavailable("Stay search is not available right now. Try again in a few minutes.");
  }
}

// ---------------------------------------------------------------------------
// Flights

function offerOut(offer: Offer, params?: FlightSearch) {
  const searchPath = params ? flightSearchPath(params) : "/flights";
  return {
    id: offer.id,
    airline: `${offer.owner.name} (${offer.owner.iata})`,
    price: money(offer.total, offer.currency),
    baseFare: money(offer.baseAmount, offer.currency),
    taxes: money(offer.taxAmount, offer.currency),
    slices: offer.slices.map((s) => ({
      from: s.origin.iata,
      to: s.destination.iata,
      depart: s.departAt,
      arrive: s.arriveAt,
      duration: formatDuration(s.durationMinutes),
      stops: s.stops,
      via: s.segments.slice(0, -1).map((seg) => seg.destination.iata),
      flights: s.segments.map((seg) => seg.flightNumber),
      fareBrand: s.fareBrand ?? null,
    })),
    refundable: offer.conditions.refundable,
    changeable: offer.conditions.changeable,
    checkedBags: offer.conditions.checkedBags ?? null,
    cabinBags: offer.conditions.cabinBags ?? null,
    expiresAt: offer.expiresAt,
    bookUrl: absoluteUrl(`${searchPath}${searchPath.includes("?") ? "&" : "?"}offer=${encodeURIComponent(offer.id)}`),
  };
}

export async function searchFlightsPublic(input: Record<string, unknown>, source: Source, limit = 20) {
  const { merged, parsed } = await withParsedQuery(input);
  const candidate = { ...(parsed?.flight ?? {}), ...merged };
  const check = flightSearchSchema.safeParse(candidate);
  if (!check.success) {
    return {
      ok: false,
      status: 400,
      error: {
        code: "invalid_request",
        message: parsed ? "The request needs a few more details before flights can be searched." : "Some parameters are missing or invalid.",
        issues: issuesOf(check.error),
        ...(parsed ? { understood: parsed.understood, missing: parsed.missing } : {}),
      },
    } satisfies ApiResult<never>;
  }
  const params = check.data;
  try {
    const result = await searchFlights(params, { source });
    return {
      ok: true,
      data: {
        query: params,
        ...(parsed ? { understood: parsed.understood } : {}),
        count: result.offers.length,
        offers: result.offers.slice(0, Math.max(1, Math.min(50, limit))).map((o) => offerOut(o, params)),
        searchUrl: absoluteUrl(flightSearchPath(params)),
        note: `${FEE_NOTE} Fares change often; offers expire at the time shown.`,
      },
    } as const;
  } catch (err) {
    console.error("[public-api] searchFlights failed:", err);
    return unavailable("Flight search is not available right now. Try again in a few minutes.");
  }
}

export async function getOfferPublic(offerId: string) {
  if (!/^[A-Za-z0-9_-]{4,100}$/.test(offerId)) {
    return { ok: false, status: 400, error: { code: "invalid_request", message: "That offer id is not valid." } } satisfies ApiResult<never>;
  }
  try {
    const offer = await getOffer(offerId);
    return { ok: true, data: { offer: offerOut(offer), note: FEE_NOTE } } as const;
  } catch (err) {
    if (err instanceof OfferExpiredError) {
      return { ok: false, status: 410, error: { code: "expired", message: err.message } } satisfies ApiResult<never>;
    }
    console.error("[public-api] getOffer failed:", err);
    return unavailable("This fare could not be checked right now. Search again to see current fares.");
  }
}

// ---------------------------------------------------------------------------
// Listings

function listingOut(l: PublicListing, dates?: { checkin?: string; checkout?: string; adults?: number }) {
  const query = dates?.checkin && dates?.checkout ? `?${toQuery(dates)}` : "";
  const policy = cancellationPolicyText[l.cancellationPolicy];
  return {
    name: l.title,
    slug: l.slug,
    url: absoluteUrl(`${l.url}${query}`),
    type: propertyTypeLabels[l.propertyType] ?? l.propertyType,
    summary: l.summary,
    description: l.description,
    location: { city: l.city, region: l.region, country: l.countryCode, lat: l.lat, lng: l.lng },
    rating: l.ratingCount ? Number(l.ratingAvg.toFixed(1)) : null,
    reviews: l.ratingCount,
    maxGuests: l.maxGuests,
    bedrooms: l.bedrooms,
    beds: l.beds,
    bathrooms: l.bathrooms,
    checkInFrom: l.checkInFrom.slice(0, 5),
    checkOutUntil: l.checkOutUntil.slice(0, 5),
    amenities: l.amenities.map(amenityLabel),
    cancellation: policy ? `${policy.label}. ${policy.summary}` : l.cancellationPolicy,
    instantBook: l.instantBook,
    fromPrice: { ...money(l.fromPrice, l.currency), per: "night" },
    units: l.units.map((u) => ({ name: u.name, maxGuests: u.maxGuests, beds: u.beds, nightlyFrom: money(u.basePrice, l.currency) })),
    photos: l.photos.slice(0, 6).map((p) => ({ url: p.url.startsWith("http") ? p.url : absoluteUrl(p.url), alt: p.alt })),
    updatedAt: l.updatedAt,
    note: `${FEE_NOTE} Open the url with check in and check out dates to see the exact total.`,
  };
}

export async function getListingPublicApi(slug: string, dates?: { checkin?: string; checkout?: string; adults?: number }) {
  if (!/^[a-z0-9-]{1,120}$/.test(slug)) {
    return { ok: false, status: 404, error: { code: "not_found", message: "No listing has that address." } } satisfies ApiResult<never>;
  }
  try {
    const listing = await getListingPublic(slug);
    if (!listing) return { ok: false, status: 404, error: { code: "not_found", message: "No published listing has that address." } } satisfies ApiResult<never>;
    return { ok: true, data: listingOut(listing, dates) } as const;
  } catch (err) {
    console.error("[public-api] getListingPublic failed:", err);
    return unavailable("Listings are not available right now. Try again in a few minutes.");
  }
}

// ---------------------------------------------------------------------------
// Parse

export async function parseTripPublic(text: string) {
  const parsed = await parseTripQuery(text);
  const path = pathForParsed(parsed);
  return {
    kind: parsed.kind,
    understood: parsed.understood,
    missing: parsed.missing,
    flight: parsed.flight ?? null,
    stay: parsed.stay ?? null,
    searchUrl: path ? absoluteUrl(path) : null,
    reviewUrl: absoluteUrl(`/search?q=${encodeURIComponent(text)}`),
  };
}

function unavailable(message: string) {
  return { ok: false, status: 503, error: { code: "unavailable", message } } satisfies ApiResult<never>;
}

// ---------------------------------------------------------------------------
// HTTP helpers for the REST routes

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Max-Age": "86400",
} as const;

export function preflight() {
  return new Response(null, { status: 204, headers: corsHeaders });
}

export function respond(result: { ok: true; data: unknown } | { ok: false; status: number; error: ApiError }, extra: Record<string, string> = {}) {
  if (result.ok) {
    return Response.json(result.data, { headers: { ...corsHeaders, ...extra, "Cache-Control": "no-store" } });
  }
  return Response.json({ error: result.error }, { status: result.status, headers: { ...corsHeaders, ...extra, "Cache-Control": "no-store" } });
}

/** Reads a URL's query string into a flat record. */
export function queryOf(req: Request) {
  const out: Record<string, string> = {};
  for (const [k, v] of new URL(req.url).searchParams) if (!(k in out)) out[k] = v;
  return out;
}
