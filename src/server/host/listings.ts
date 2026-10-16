import "server-only";
import { revalidateTag } from "next/cache";
import { after } from "next/server";
import { and, asc, count, desc, eq, inArray, like, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import { destinations, hostProfiles, listingPhotos, listings, listingUnits, unitInventory, user } from "@/db/schema";
import { absoluteUrl, site } from "@/config/site";
import { pingIndexNow } from "@/server/seo/indexnow";
import { newId } from "@/lib/id";
import { AccessError } from "./access";
import { ValidationError } from "./errors";
import {
  canManageListing,
  chooseSlug,
  computeFromPrice,
  currencyRescale,
  draftSlug,
  isReadyToPublish,
  listingSlugBase,
  nearestDestination,
  parseMoneyInput,
  parsePercentToBps,
  publishChecklist,
  type Actor,
} from "./rules";
import type { z } from "zod";
import type { amenitiesSchema, basicsSchema, currencySchema, locationSchema, newListingSchema, policiesSchema } from "./schemas";

export type ListingRow = typeof listings.$inferSelect;

/** Loads a listing the actor may manage. Missing and not-yours look the same from outside. */
export async function loadManagedListing(actor: Actor, listingId: string): Promise<ListingRow> {
  const [row] = await db.select().from(listings).where(eq(listings.id, listingId)).limit(1);
  if (!row || !canManageListing(actor, row)) throw new AccessError("not_found", "That listing does not exist or is not yours.");
  return row;
}

export function editorBase(listingId: string) {
  return `/host/listings/${listingId}`;
}

/** Host's listings for the table, newest first. Admins see their own listings here too. */
export async function listHostListings(actor: Actor) {
  const rows = await db
    .select({
      id: listings.id,
      title: listings.title,
      status: listings.status,
      city: listings.city,
      slug: listings.slug,
      destinationSlug: listings.destinationSlug,
      currency: listings.currency,
      fromPrice: listings.fromPrice,
      verified: listings.verified,
      updatedAt: listings.updatedAt,
      summary: listings.summary,
      description: listings.description,
      countryCode: listings.countryCode,
      lat: listings.lat,
      lng: listings.lng,
    })
    .from(listings)
    .where(and(eq(listings.hostId, actor.userId), ne(listings.status, "archived")))
    .orderBy(desc(listings.updatedAt));
  if (!rows.length) return [];
  const ids = rows.map((r) => r.id);
  const [photos, units] = await Promise.all([
    db.select({ listingId: listingPhotos.listingId, alt: listingPhotos.alt }).from(listingPhotos).where(inArray(listingPhotos.listingId, ids)),
    db
      .select({ listingId: listingUnits.listingId, active: listingUnits.active, basePrice: listingUnits.basePrice })
      .from(listingUnits)
      .where(inArray(listingUnits.listingId, ids)),
  ]);
  return rows.map((r) => {
    const p = photos.filter((x) => x.listingId === r.id);
    const u = units.filter((x) => x.listingId === r.id);
    const checklist = publishChecklist({ ...r, photos: p, units: u }, editorBase(r.id));
    return { ...r, photoCount: p.length, unitCount: u.length, checklist, ready: isReadyToPublish(checklist) };
  });
}

/** Everything the editor needs in one read. */
export async function getListingForEditor(actor: Actor, listingId: string) {
  const listing = await loadManagedListing(actor, listingId);
  const [photos, units] = await Promise.all([
    db.select().from(listingPhotos).where(eq(listingPhotos.listingId, listingId)).orderBy(asc(listingPhotos.position), asc(listingPhotos.createdAt)),
    db.select().from(listingUnits).where(eq(listingUnits.listingId, listingId)).orderBy(asc(listingUnits.position), asc(listingUnits.createdAt)),
  ]);
  const checklist = publishChecklist({ ...listing, photos, units }, editorBase(listingId));
  return { listing, photos, units, checklist, ready: isReadyToPublish(checklist) };
}

/** Makes sure a host profile exists, so a listing always has a named host. */
export async function ensureHostProfile(userId: string) {
  const [u] = await db.select({ name: user.name, email: user.email }).from(user).where(eq(user.id, userId)).limit(1);
  if (!u) return;
  await db
    .insert(hostProfiles)
    .values({ userId, displayName: u.name?.trim() || u.email.split("@")[0] })
    .onConflictDoNothing();
}

export async function createDraftListing(actor: Actor, input: z.infer<typeof newListingSchema>) {
  if (actor.role !== "host" && actor.role !== "admin") throw new AccessError("forbidden", "Start hosting before you add a listing.");
  await ensureHostProfile(actor.userId);
  const id = newId("lst");
  await db.insert(listings).values({
    id,
    hostId: actor.userId,
    status: "draft",
    slug: draftSlug(id),
    title: input.title,
    propertyType: input.propertyType,
    city: "",
    countryCode: site.country,
    lat: 0,
    lng: 0,
    currency: supportedOrDefault(site.defaultCurrency),
  });
  return id;
}

function supportedOrDefault(c: string) {
  return /^[A-Z]{3}$/.test(c) ? c : "INR";
}

/**
 * Runs after every write to a listing or its units and photos.
 * Recomputes fromPrice. For a published listing it also keeps the slug unique and in step
 * with the title and city, sets publishedAt the first time, and expires public caches.
 */
export async function syncListing(listingId: string, opts: { revalidate?: boolean } = {}) {
  const [l] = await db.select().from(listings).where(eq(listings.id, listingId)).limit(1);
  if (!l) return;
  const units = await db.select({ basePrice: listingUnits.basePrice, active: listingUnits.active }).from(listingUnits).where(eq(listingUnits.listingId, listingId));
  const patch: Partial<ListingRow> = { fromPrice: computeFromPrice(units), updatedAt: new Date() };

  if (l.status === "published") {
    if (!l.publishedAt) patch.publishedAt = new Date();
    patch.slug = await uniqueSlug(l);
  }

  for (let attempt = 0; ; attempt++) {
    try {
      await db.update(listings).set(patch).where(eq(listings.id, listingId));
      break;
    } catch (err) {
      // Two listings raced for the same slug. Pick again with the newer state of the table.
      if (attempt < 3 && l.status === "published" && isUniqueViolation(err)) {
        patch.slug = await uniqueSlug(l);
        continue;
      }
      throw err;
    }
  }

  if (opts.revalidate !== false && (l.status === "published" || l.publishedAt)) revalidateListing(listingId);
}

export function revalidateListing(listingId: string) {
  revalidateTag(`listing:${listingId}`, "max");
  revalidateTag("listings", "max");
  // Tell search engines about the change once the response is sent.
  after(async () => {
    const [row] = await db
      .select({ slug: listings.slug, destinationSlug: listings.destinationSlug, status: listings.status })
      .from(listings)
      .where(eq(listings.id, listingId));
    if (!row?.destinationSlug || row.slug.startsWith("draft-")) return;
    await pingIndexNow([absoluteUrl(`/stays/${row.destinationSlug}/${row.slug}`), absoluteUrl(`/stays/${row.destinationSlug}`)]);
  });
}

async function uniqueSlug(l: Pick<ListingRow, "id" | "title" | "city" | "slug">) {
  const base = listingSlugBase(l.title, l.city);
  const taken = await db
    .select({ slug: listings.slug })
    .from(listings)
    .where(and(ne(listings.id, l.id), like(listings.slug, `${base}%`)));
  const current = l.slug.startsWith("draft-") ? null : l.slug;
  return chooseSlug(
    base,
    current,
    taken.map((t) => t.slug),
  );
}

function isUniqueViolation(err: unknown) {
  const e = err as { code?: string; cause?: { code?: string } };
  return e?.code === "23505" || e?.cause?.code === "23505";
}

export async function updateBasics(actor: Actor, listingId: string, input: z.infer<typeof basicsSchema>) {
  await loadManagedListing(actor, listingId);
  await db.update(listings).set(input).where(eq(listings.id, listingId));
  await syncListing(listingId);
}

export async function listDestinationsForPicker() {
  return db
    .select({ slug: destinations.slug, name: destinations.name, region: destinations.region, countryCode: destinations.countryCode, lat: destinations.lat, lng: destinations.lng, radiusKm: destinations.radiusKm })
    .from(destinations)
    .orderBy(asc(destinations.name));
}

export async function updateLocation(actor: Actor, listingId: string, input: z.infer<typeof locationSchema>) {
  await loadManagedListing(actor, listingId);
  const all = await listDestinationsForPicker();
  let destinationSlug = input.destinationSlug;
  if (destinationSlug && !all.some((d) => d.slug === destinationSlug)) {
    throw new ValidationError("Choose a destination from the list.", { destinationSlug: "Choose a destination from the list." });
  }
  if (!destinationSlug) destinationSlug = nearestDestination(input, all)?.slug ?? null;
  await db
    .update(listings)
    .set({ ...input, destinationSlug })
    .where(eq(listings.id, listingId));
  await syncListing(listingId);
  return { destinationSlug };
}

export async function updateAmenities(actor: Actor, listingId: string, input: z.infer<typeof amenitiesSchema>) {
  await loadManagedListing(actor, listingId);
  await db.update(listings).set({ amenities: input.amenities }).where(eq(listings.id, listingId));
  await syncListing(listingId);
}

export async function updatePolicies(actor: Actor, listingId: string, input: z.infer<typeof policiesSchema>) {
  const l = await loadManagedListing(actor, listingId);
  const fee = parseMoneyInput(input.cleaningFee, l.currency, { allowEmpty: true });
  const tax = parsePercentToBps(input.taxPercent);
  const fields: Record<string, string> = {};
  if (!fee.ok) fields.cleaningFee = fee.error;
  if (!tax.ok) fields.taxPercent = tax.error;
  if (!fee.ok || !tax.ok) throw new ValidationError("Check the highlighted fields.", fields);
  const { cleaningFee: _fee, taxPercent: _tax, ...rest } = input;
  void _fee;
  void _tax;
  await db
    .update(listings)
    .set({ ...rest, cleaningFee: fee.value ?? 0, taxBps: tax.value })
    .where(eq(listings.id, listingId));
  await syncListing(listingId);
}

/**
 * Changes the listing currency. Stored amounts keep their value in major units, so moving
 * between currencies with different decimals (INR to JPY) rescales every price.
 */
export async function updateCurrency(actor: Actor, listingId: string, input: z.infer<typeof currencySchema>) {
  const l = await loadManagedListing(actor, listingId);
  if (l.currency === input.currency) return;
  const factor = currencyRescale(l.currency, input.currency);
  await db.transaction(async (tx) => {
    await tx
      .update(listings)
      .set({ currency: input.currency, cleaningFee: sql`round(${listings.cleaningFee} * ${factor})::int` })
      .where(eq(listings.id, listingId));
    if (factor !== 1) {
      await tx
        .update(listingUnits)
        .set({
          basePrice: sql`round(${listingUnits.basePrice} * ${factor})::int`,
          extraGuestPrice: sql`round(${listingUnits.extraGuestPrice} * ${factor})::int`,
        })
        .where(eq(listingUnits.listingId, listingId));
      await tx.execute(
        sql`update ${unitInventory} set price = round(price * ${factor})::int where price is not null and unit_id in (select id from ${listingUnits} where listing_id = ${listingId})`,
      );
    }
  });
  await syncListing(listingId);
}

export async function publishListing(actor: Actor, listingId: string) {
  const { listing, checklist, ready } = await getListingForEditor(actor, listingId);
  if (listing.status === "suspended") throw new ValidationError("This listing is suspended. Contact support to have it restored.");
  if (!ready) {
    const missing = checklist.filter((c) => !c.done).map((c) => c.label.toLowerCase());
    throw new ValidationError(`Finish these first: ${missing.join(", ")}.`);
  }
  await db.update(listings).set({ status: "published" }).where(eq(listings.id, listingId));
  await syncListing(listingId);
  const [after] = await db.select({ slug: listings.slug }).from(listings).where(eq(listings.id, listingId));
  return after;
}

export async function unpublishListing(actor: Actor, listingId: string) {
  const l = await loadManagedListing(actor, listingId);
  if (l.status !== "published") return;
  await db.update(listings).set({ status: "draft", updatedAt: new Date() }).where(eq(listings.id, listingId));
  revalidateListing(listingId);
}

/** Counts for the side panel: how many listings the host has in each status. */
export async function countListingsByStatus(hostId: string) {
  const rows = await db.select({ status: listings.status, n: count() }).from(listings).where(eq(listings.hostId, hostId)).groupBy(listings.status);
  return Object.fromEntries(rows.map((r) => [r.status, Number(r.n)])) as Partial<Record<ListingRow["status"], number>>;
}

/** Public URL of a published listing, following the stays route shape. */
export function publicListingPath(l: { slug: string; destinationSlug: string | null }) {
  return `/stays/${l.destinationSlug ?? "all"}/${l.slug}`;
}
