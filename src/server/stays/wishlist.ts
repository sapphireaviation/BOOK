import "server-only";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { listings, wishlists } from "@/db/schema";
import { listingPath } from "./paths";

/** Which of these listings the user has saved. */
export async function savedListingIds(userId: string, listingIds: string[]): Promise<Set<string>> {
  if (!listingIds.length) return new Set();
  const rows = await db
    .select({ id: wishlists.listingId })
    .from(wishlists)
    .where(and(eq(wishlists.userId, userId), inArray(wishlists.listingId, listingIds)));
  return new Set(rows.map((r) => r.id));
}

/** Saves or unsaves a published listing. Returns whether it is saved afterwards, or null if the listing does not exist. */
export async function setSaved(userId: string, listingId: string, saved: boolean): Promise<boolean | null> {
  const [exists] = await db.select({ id: listings.id }).from(listings).where(eq(listings.id, listingId)).limit(1);
  if (!exists) return null;
  if (saved) {
    await db.insert(wishlists).values({ userId, listingId }).onConflictDoNothing();
  } else {
    await db.delete(wishlists).where(and(eq(wishlists.userId, userId), eq(wishlists.listingId, listingId)));
  }
  return saved;
}

export type SavedListing = {
  id: string;
  url: string;
  title: string;
  summary: string;
  propertyType: string;
  city: string;
  countryCode: string;
  currency: string;
  fromPrice: number;
  ratingAvg: number;
  ratingCount: number;
  isDemo: boolean;
  available: boolean;
  photo: { url: string; alt: string } | null;
  savedAt: string;
};

/** The user's saved listings, newest first. Listings that were unpublished stay in the list, marked unavailable. */
export async function listSaved(userId: string): Promise<SavedListing[]> {
  const rows = await db.execute<{
    id: string;
    slug: string;
    title: string;
    summary: string;
    property_type: string;
    city: string;
    destination_slug: string | null;
    country_code: string;
    currency: string;
    from_price: number;
    rating_avg: number;
    rating_count: number;
    is_demo: boolean;
    status: string;
    photo: { url: string; alt: string } | null;
    saved_at: string;
  }>(sql`
    select l.id, l.slug, l.title, l.summary, l.property_type, l.city, l.destination_slug, l.country_code, l.currency,
           coalesce((select min(u.base_price) from booking.listing_units u where u.listing_id = l.id and u.active), l.from_price) as from_price,
           l.rating_avg, l.rating_count, l.is_demo, l.status,
           (select json_build_object('url', p.url, 'alt', p.alt) from booking.listing_photos p
              where p.listing_id = l.id order by p.position, p.id limit 1) as photo,
           to_char(w.created_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as saved_at
    from booking.wishlists w
    join booking.listings l on l.id = w.listing_id
    where w.user_id = ${userId}
    order by w.created_at desc
    limit 200
  `);
  return rows.map((r) => ({
    id: r.id,
    url: listingPath(r),
    title: r.title,
    summary: r.summary,
    propertyType: r.property_type,
    city: r.city,
    countryCode: r.country_code,
    currency: r.currency,
    fromPrice: Number(r.from_price),
    ratingAvg: Number(r.rating_avg),
    ratingCount: Number(r.rating_count),
    isDemo: r.is_demo,
    available: r.status === "published",
    photo: r.photo,
    savedAt: r.saved_at,
  }));
}
