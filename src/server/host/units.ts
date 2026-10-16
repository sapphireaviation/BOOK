import "server-only";
import { and, eq, max } from "drizzle-orm";
import { db } from "@/db";
import { listingUnits, stayBookings } from "@/db/schema";
import { newId } from "@/lib/id";
import { AccessError } from "./access";
import { ValidationError } from "./errors";
import { loadManagedListing, syncListing, type ListingRow } from "./listings";
import { parseMoneyInput, type Actor } from "./rules";
import type { z } from "zod";
import type { unitSchema } from "./schemas";

export type UnitRow = typeof listingUnits.$inferSelect;

function priceFields(input: z.infer<typeof unitSchema>, currency: string) {
  const base = parseMoneyInput(input.basePrice, currency);
  const extra = parseMoneyInput(input.extraGuestPrice, currency, { allowEmpty: true });
  const fields: Record<string, string> = {};
  if (!base.ok) fields.basePrice = base.error;
  else if (!base.value) fields.basePrice = "The nightly price must be more than 0.";
  if (!extra.ok) fields.extraGuestPrice = extra.error;
  if (Object.keys(fields).length || !base.ok || !extra.ok) throw new ValidationError("Check the highlighted fields.", fields);
  const { basePrice: _b, extraGuestPrice: _e, ...rest } = input;
  void _b;
  void _e;
  return { ...rest, basePrice: base.value ?? 0, extraGuestPrice: extra.value ?? 0 };
}

export async function loadManagedUnit(actor: Actor, listingId: string, unitId: string): Promise<{ listing: ListingRow; unit: UnitRow }> {
  const listing = await loadManagedListing(actor, listingId);
  const [unit] = await db
    .select()
    .from(listingUnits)
    .where(and(eq(listingUnits.id, unitId), eq(listingUnits.listingId, listingId)))
    .limit(1);
  if (!unit) throw new AccessError("not_found", "That room is no longer on this listing.");
  return { listing, unit };
}

export async function createUnit(actor: Actor, listingId: string, input: z.infer<typeof unitSchema>) {
  const listing = await loadManagedListing(actor, listingId);
  const values = priceFields(input, listing.currency);
  const [{ top }] = await db.select({ top: max(listingUnits.position) }).from(listingUnits).where(eq(listingUnits.listingId, listingId));
  const id = newId("unt");
  await db.insert(listingUnits).values({ id, listingId, ...values, position: (top ?? -1) + 1 });
  await syncListing(listingId);
  return id;
}

export async function updateUnit(actor: Actor, listingId: string, unitId: string, input: z.infer<typeof unitSchema>) {
  const { listing, unit } = await loadManagedUnit(actor, listingId, unitId);
  const values = priceFields(input, listing.currency);
  if (listing.status === "published" && unit.active && !values.active) await assertAnotherActiveUnit(listingId, unitId);
  await db
    .update(listingUnits)
    .set({ ...values, updatedAt: new Date() })
    .where(eq(listingUnits.id, unitId));
  await syncListing(listingId);
}

/** Deletes a room. Rooms with bookings are kept for the booking history; turn them off instead. */
export async function deleteUnit(actor: Actor, listingId: string, unitId: string) {
  const { listing, unit } = await loadManagedUnit(actor, listingId, unitId);
  const [booked] = await db.select({ id: stayBookings.bookingId }).from(stayBookings).where(eq(stayBookings.unitId, unitId)).limit(1);
  if (booked) throw new ValidationError("This room has bookings, so it cannot be deleted. Untick Bookable to stop new bookings.");
  if (listing.status === "published" && unit.active) await assertAnotherActiveUnit(listingId, unitId);
  await db.delete(listingUnits).where(eq(listingUnits.id, unitId));
  await syncListing(listingId);
}

async function assertAnotherActiveUnit(listingId: string, unitId: string) {
  const units = await db.select({ id: listingUnits.id, active: listingUnits.active }).from(listingUnits).where(eq(listingUnits.listingId, listingId));
  if (!units.some((u) => u.id !== unitId && u.active)) {
    throw new ValidationError("A published listing needs at least one bookable room. Add another room first, or unpublish the listing.");
  }
}
