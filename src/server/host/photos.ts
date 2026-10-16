import "server-only";
import { and, asc, eq, max } from "drizzle-orm";
import { db } from "@/db";
import { listingPhotos } from "@/db/schema";
import { newId } from "@/lib/id";
import { AccessError } from "./access";
import { ValidationError } from "./errors";
import { loadManagedListing, syncListing } from "./listings";
import { MIN_PHOTOS, type Actor } from "./rules";

export const MAX_PHOTOS = 40;

export async function addPhoto(actor: Actor, listingId: string, photo: { url: string; width: number | null; height: number | null; alt?: string }) {
  await loadManagedListing(actor, listingId);
  const existing = await db.select({ id: listingPhotos.id }).from(listingPhotos).where(eq(listingPhotos.listingId, listingId));
  if (existing.length >= MAX_PHOTOS) throw new ValidationError(`A listing can have up to ${MAX_PHOTOS} photos. Delete one to add another.`);
  const [{ top }] = await db.select({ top: max(listingPhotos.position) }).from(listingPhotos).where(eq(listingPhotos.listingId, listingId));
  const id = newId("pho");
  const [row] = await db
    .insert(listingPhotos)
    .values({ id, listingId, url: photo.url, width: photo.width, height: photo.height, alt: photo.alt ?? "", position: (top ?? -1) + 1 })
    .returning();
  await syncListing(listingId);
  return row;
}

async function loadPhoto(actor: Actor, listingId: string, photoId: string) {
  const listing = await loadManagedListing(actor, listingId);
  const [photo] = await db
    .select()
    .from(listingPhotos)
    .where(and(eq(listingPhotos.id, photoId), eq(listingPhotos.listingId, listingId)))
    .limit(1);
  if (!photo) throw new AccessError("not_found", "That photo is no longer on this listing.");
  return { listing, photo };
}

export async function updatePhotoAlt(actor: Actor, listingId: string, photoId: string, alt: string) {
  await loadPhoto(actor, listingId, photoId);
  await db.update(listingPhotos).set({ alt }).where(eq(listingPhotos.id, photoId));
  await syncListing(listingId);
}

export async function deletePhoto(actor: Actor, listingId: string, photoId: string) {
  const { listing } = await loadPhoto(actor, listingId, photoId);
  if (listing.status === "published") {
    const all = await db.select({ id: listingPhotos.id }).from(listingPhotos).where(eq(listingPhotos.listingId, listingId));
    if (all.length <= MIN_PHOTOS) {
      throw new ValidationError(`A published listing needs at least ${MIN_PHOTOS} photos. Add another photo first, or unpublish the listing.`);
    }
  }
  await db.delete(listingPhotos).where(eq(listingPhotos.id, photoId));
  await syncListing(listingId);
}

/** Moves a photo one place up or down. The first photo is the cover in search results. */
export async function movePhoto(actor: Actor, listingId: string, photoId: string, direction: "up" | "down" | "first") {
  await loadPhoto(actor, listingId, photoId);
  const photos = await db
    .select({ id: listingPhotos.id })
    .from(listingPhotos)
    .where(eq(listingPhotos.listingId, listingId))
    .orderBy(asc(listingPhotos.position), asc(listingPhotos.createdAt));
  const ids = photos.map((p) => p.id);
  const from = ids.indexOf(photoId);
  const to = direction === "first" ? 0 : direction === "up" ? Math.max(0, from - 1) : Math.min(ids.length - 1, from + 1);
  if (from === to) return;
  ids.splice(to, 0, ...ids.splice(from, 1));
  await db.transaction(async (tx) => {
    for (const [position, id] of ids.entries()) {
      await tx.update(listingPhotos).set({ position }).where(eq(listingPhotos.id, id));
    }
  });
  await syncListing(listingId);
}
