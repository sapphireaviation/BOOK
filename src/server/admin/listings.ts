import "server-only";
import { and, desc, eq, ilike, or, type SQL } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { listings, user } from "@/db/schema";
import { AccessError } from "@/server/host/access";
import { revalidateListing, syncListing } from "@/server/host/listings";
import type { Actor } from "@/server/host/rules";
import { ADMIN_PAGE_SIZE, escapeLike } from "./bookings";

export const listingStatuses = ["draft", "published", "suspended", "archived"] as const;

export const listingFilterSchema = z.object({
  q: z.string().trim().max(200).optional().catch(undefined),
  status: z.enum([...listingStatuses, "review"]).optional().catch(undefined),
  page: z.coerce.number().int().min(1).max(1000).optional().catch(undefined),
});

export async function searchListings(filter: z.infer<typeof listingFilterSchema>) {
  const conds: SQL[] = [];
  if (filter.q) {
    const like = `%${escapeLike(filter.q)}%`;
    conds.push(or(ilike(listings.title, like), ilike(listings.city, like), ilike(user.email, like), eq(listings.id, filter.q))!);
  }
  if (filter.status === "review") conds.push(and(eq(listings.status, "published"), eq(listings.verified, false))!);
  else if (filter.status) conds.push(eq(listings.status, filter.status));
  const page = filter.page ?? 1;
  const rows = await db
    .select({
      id: listings.id,
      title: listings.title,
      status: listings.status,
      verified: listings.verified,
      city: listings.city,
      countryCode: listings.countryCode,
      currency: listings.currency,
      fromPrice: listings.fromPrice,
      publishedAt: listings.publishedAt,
      updatedAt: listings.updatedAt,
      hostName: user.name,
      hostEmail: user.email,
    })
    .from(listings)
    .innerJoin(user, eq(user.id, listings.hostId))
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(listings.updatedAt))
    .limit(ADMIN_PAGE_SIZE + 1)
    .offset((page - 1) * ADMIN_PAGE_SIZE);
  return { rows: rows.slice(0, ADMIN_PAGE_SIZE), hasMore: rows.length > ADMIN_PAGE_SIZE, page };
}

export type ModerationAction = "suspend" | "restore" | "verify" | "unverify";

/** Suspend hides a listing from travelers; restore puts it back where it was (published if it ever was). */
export async function moderateListing(actor: Actor, listingId: string, action: ModerationAction) {
  if (actor.role !== "admin") throw new AccessError("forbidden", "Only operators can moderate listings.");
  const [l] = await db.select({ status: listings.status, publishedAt: listings.publishedAt }).from(listings).where(eq(listings.id, listingId)).limit(1);
  if (!l) throw new AccessError("not_found", "No listing with that id.");
  const now = new Date();
  switch (action) {
    case "suspend":
      await db.update(listings).set({ status: "suspended", updatedAt: now }).where(eq(listings.id, listingId));
      break;
    case "restore":
      if (l.status !== "suspended") return;
      await db
        .update(listings)
        .set({ status: l.publishedAt ? "published" : "draft", updatedAt: now })
        .where(eq(listings.id, listingId));
      await syncListing(listingId, { revalidate: false });
      break;
    case "verify":
    case "unverify":
      await db
        .update(listings)
        .set({ verified: action === "verify", updatedAt: now })
        .where(eq(listings.id, listingId));
      break;
  }
  await revalidateListing(listingId);
}
