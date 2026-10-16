import "server-only";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";
import { db } from "@/db";
import { destinations, hostProfiles, listingPhotos, listings, listingUnits, reviews, user } from "@/db/schema";
import { listingPath, placeSlugOf } from "./paths";

export type ListingReview = {
  id: string;
  authorName: string;
  rating: number;
  body: string;
  hostReply: string | null;
  stayMonth: string | null;
  createdAt: string;
};

export type ListingUnitDetail = {
  id: string;
  name: string;
  description: string;
  maxGuests: number;
  beds: string;
  basePrice: number;
  extraGuestPrice: number;
  includedGuests: number;
  quantity: number;
};

export type ListingPage = {
  id: string;
  slug: string;
  url: string;
  placeSlug: string;
  title: string;
  summary: string;
  description: string;
  propertyType: string;
  addressLine: string | null;
  locality: string | null;
  city: string;
  region: string | null;
  postalCode: string | null;
  countryCode: string;
  lat: number;
  lng: number;
  maxGuests: number;
  bedrooms: number;
  beds: number;
  bathrooms: number;
  amenities: string[];
  houseRules: string[];
  checkInFrom: string;
  checkOutUntil: string;
  currency: string;
  fromPrice: number;
  cleaningFee: number;
  taxBps: number;
  minNights: number;
  maxNights: number;
  instantBook: boolean;
  cancellationPolicy: string;
  verified: boolean;
  isDemo: boolean;
  updatedAt: string;
  photos: { url: string; alt: string; width: number | null; height: number | null }[];
  units: ListingUnitDetail[];
  host: { name: string; about: string; languages: string[]; verified: boolean };
  destination: { slug: string; name: string } | null;
  /** Computed from the reviews table, so the numbers always match the reviews shown. */
  rating: { avg: number; count: number; cleanliness: number | null; accuracy: number | null; location: number | null; value: number | null };
  reviews: ListingReview[];
};

const REVIEWS_SHOWN = 24;

/** Everything the listing page shows, for a published stay. Cached and tagged `listing:<id>`. */
export async function getListingPage(slug: string): Promise<ListingPage | null> {
  "use cache";
  cacheLife("hours");
  cacheTag(`listing-slug:${slug}`);

  const [row] = await db
    .select({
      l: listings,
      hostName: user.name,
      hostDisplayName: hostProfiles.displayName,
      hostAbout: hostProfiles.about,
      hostLanguages: hostProfiles.languages,
      hostVerified: hostProfiles.verified,
      destinationName: destinations.name,
    })
    .from(listings)
    .innerJoin(user, eq(user.id, listings.hostId))
    .leftJoin(hostProfiles, eq(hostProfiles.userId, listings.hostId))
    .leftJoin(destinations, eq(destinations.slug, listings.destinationSlug))
    .where(and(eq(listings.slug, slug), eq(listings.status, "published"), eq(listings.kind, "stay")))
    .limit(1);
  if (!row) return null;
  const l = row.l;
  cacheTag(`listing:${l.id}`);

  const [photos, units, reviewRows, [agg]] = await Promise.all([
    db
      .select({ url: listingPhotos.url, alt: listingPhotos.alt, width: listingPhotos.width, height: listingPhotos.height })
      .from(listingPhotos)
      .where(eq(listingPhotos.listingId, l.id))
      .orderBy(asc(listingPhotos.position), asc(listingPhotos.id)),
    db
      .select({
        id: listingUnits.id,
        name: listingUnits.name,
        description: listingUnits.description,
        maxGuests: listingUnits.maxGuests,
        beds: listingUnits.beds,
        basePrice: listingUnits.basePrice,
        extraGuestPrice: listingUnits.extraGuestPrice,
        includedGuests: listingUnits.includedGuests,
        quantity: listingUnits.quantity,
      })
      .from(listingUnits)
      .where(and(eq(listingUnits.listingId, l.id), eq(listingUnits.active, true)))
      .orderBy(asc(listingUnits.position), asc(listingUnits.basePrice)),
    db
      .select({
        id: reviews.id,
        authorName: reviews.authorName,
        rating: reviews.rating,
        body: reviews.body,
        hostReply: reviews.hostReply,
        stayMonth: reviews.stayMonth,
        createdAt: reviews.createdAt,
      })
      .from(reviews)
      .where(eq(reviews.listingId, l.id))
      .orderBy(desc(reviews.createdAt))
      .limit(REVIEWS_SHOWN),
    db
      .select({
        count: sql<number>`count(*)::int`,
        avg: sql<number | null>`avg(${reviews.rating})::float8`,
        cleanliness: sql<number | null>`avg(${reviews.cleanliness})::float8`,
        accuracy: sql<number | null>`avg(${reviews.accuracy})::float8`,
        location: sql<number | null>`avg(${reviews.location})::float8`,
        value: sql<number | null>`avg(${reviews.value})::float8`,
      })
      .from(reviews)
      .where(eq(reviews.listingId, l.id)),
  ]);

  const round1 = (n: number | null) => (n === null ? null : Math.round(n * 10) / 10);

  return {
    id: l.id,
    slug: l.slug,
    url: listingPath(l),
    placeSlug: placeSlugOf(l),
    title: l.title,
    summary: l.summary,
    description: l.description,
    propertyType: l.propertyType,
    addressLine: l.addressLine,
    locality: l.locality,
    city: l.city,
    region: l.region,
    postalCode: l.postalCode,
    countryCode: l.countryCode,
    lat: l.lat,
    lng: l.lng,
    maxGuests: l.maxGuests,
    bedrooms: l.bedrooms,
    beds: l.beds,
    bathrooms: l.bathrooms,
    amenities: l.amenities,
    houseRules: l.houseRules
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean),
    checkInFrom: l.checkInFrom.slice(0, 5),
    checkOutUntil: l.checkOutUntil.slice(0, 5),
    currency: l.currency,
    fromPrice: units.length ? Math.min(...units.map((u) => u.basePrice)) : l.fromPrice,
    cleaningFee: l.cleaningFee,
    taxBps: l.taxBps,
    minNights: l.minNights,
    maxNights: l.maxNights,
    instantBook: l.instantBook,
    cancellationPolicy: l.cancellationPolicy,
    verified: l.verified,
    isDemo: l.isDemo,
    updatedAt: l.updatedAt.toISOString(),
    photos,
    units,
    host: {
      name: row.hostDisplayName || row.hostName,
      about: row.hostAbout ?? "",
      languages: row.hostLanguages ?? [],
      verified: row.hostVerified ?? false,
    },
    destination: l.destinationSlug && row.destinationName ? { slug: l.destinationSlug, name: row.destinationName } : null,
    rating: {
      count: agg?.count ?? 0,
      avg: round1(agg?.avg ?? null) ?? 0,
      cleanliness: round1(agg?.cleanliness ?? null),
      accuracy: round1(agg?.accuracy ?? null),
      location: round1(agg?.location ?? null),
      value: round1(agg?.value ?? null),
    },
    reviews: reviewRows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })),
  };
}
