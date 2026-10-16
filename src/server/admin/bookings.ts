import "server-only";
import { and, desc, eq, ilike, or, type SQL } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { bookings, flightBookings, listings, listingUnits, payments, payouts, refunds, stayBookings } from "@/db/schema";
import { cancelBooking, type CancelResult } from "@/server/bookings/cancel";
import { AccessError } from "@/server/host/access";
import type { Actor } from "@/server/host/rules";

export const bookingStatuses = ["draft", "pending_payment", "confirmed", "completed", "cancelled", "refunded", "expired", "failed"] as const;
export const bookingKinds = ["stay", "flight"] as const;

export const bookingFilterSchema = z.object({
  q: z.string().trim().max(200).optional().catch(undefined),
  status: z.enum(bookingStatuses).optional().catch(undefined),
  kind: z.enum(bookingKinds).optional().catch(undefined),
  page: z.coerce.number().int().min(1).max(1000).optional().catch(undefined),
});

export type BookingFilter = z.infer<typeof bookingFilterSchema>;

export const ADMIN_PAGE_SIZE = 50;

export async function searchBookings(filter: BookingFilter) {
  const conds: SQL[] = [];
  const q = filter.q?.trim();
  if (q) {
    const ref = q.toUpperCase().replace(/\s/g, "");
    const like = `%${escapeLike(q)}%`;
    conds.push(or(eq(bookings.reference, ref), ilike(bookings.contactEmail, like), ilike(bookings.contactName, like))!);
  }
  if (filter.status) conds.push(eq(bookings.status, filter.status));
  if (filter.kind) conds.push(eq(bookings.kind, filter.kind));
  const page = filter.page ?? 1;
  const rows = await db
    .select({
      id: bookings.id,
      reference: bookings.reference,
      kind: bookings.kind,
      status: bookings.status,
      contactName: bookings.contactName,
      contactEmail: bookings.contactEmail,
      currency: bookings.currency,
      total: bookings.total,
      createdAt: bookings.createdAt,
      checkIn: stayBookings.checkIn,
      listingTitle: listings.title,
      origin: flightBookings.origin,
      destination: flightBookings.destination,
      departAt: flightBookings.departAt,
    })
    .from(bookings)
    .leftJoin(stayBookings, eq(stayBookings.bookingId, bookings.id))
    .leftJoin(listings, eq(listings.id, stayBookings.listingId))
    .leftJoin(flightBookings, eq(flightBookings.bookingId, bookings.id))
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(bookings.createdAt))
    .limit(ADMIN_PAGE_SIZE + 1)
    .offset((page - 1) * ADMIN_PAGE_SIZE);
  return { rows: rows.slice(0, ADMIN_PAGE_SIZE), hasMore: rows.length > ADMIN_PAGE_SIZE, page };
}

export function escapeLike(s: string) {
  return s.replace(/[\\%_]/g, (c) => `\\${c}`);
}

export async function getBookingForAdmin(bookingId: string) {
  const [b] = await db.select().from(bookings).where(eq(bookings.id, bookingId)).limit(1);
  if (!b) throw new AccessError("not_found", "No booking with that id.");
  const [stay, flight, pays, refs, payout] = await Promise.all([
    db
      .select({
        listingId: stayBookings.listingId,
        listingTitle: listings.title,
        unitName: listingUnits.name,
        hostId: stayBookings.hostId,
        checkIn: stayBookings.checkIn,
        checkOut: stayBookings.checkOut,
        nights: stayBookings.nights,
        units: stayBookings.units,
        adults: stayBookings.adults,
        children: stayBookings.children,
        guestNote: stayBookings.guestNote,
        cancellationPolicy: stayBookings.cancellationPolicy,
      })
      .from(stayBookings)
      .innerJoin(listings, eq(listings.id, stayBookings.listingId))
      .innerJoin(listingUnits, eq(listingUnits.id, stayBookings.unitId))
      .where(eq(stayBookings.bookingId, bookingId))
      .then((r) => r[0] ?? null),
    db
      .select({
        provider: flightBookings.provider,
        origin: flightBookings.origin,
        destination: flightBookings.destination,
        departAt: flightBookings.departAt,
        returnAt: flightBookings.returnAt,
        airlineReference: flightBookings.airlineReference,
        providerOrderId: flightBookings.providerOrderId,
        passengers: flightBookings.passengers,
      })
      .from(flightBookings)
      .where(eq(flightBookings.bookingId, bookingId))
      .then((r) => r[0] ?? null),
    db.select().from(payments).where(eq(payments.bookingId, bookingId)).orderBy(desc(payments.createdAt)),
    db.select().from(refunds).where(eq(refunds.bookingId, bookingId)).orderBy(desc(refunds.createdAt)),
    db
      .select()
      .from(payouts)
      .where(eq(payouts.bookingId, bookingId))
      .then((r) => r[0] ?? null),
  ]);
  return { booking: b, stay, flight, payments: pays, refunds: refs, payout };
}

export const CANCELLABLE = ["pending_payment", "confirmed"] as const;

/**
 * Operator cancellation. The refund rules live in the bookings workstream's cancelBooking;
 * this only checks the actor and turns its failures into a message for the console.
 */
export async function adminCancelBooking(
  actor: Actor,
  input: { bookingId: string; reason: string; refundAmount?: number },
): Promise<{ ok: true; result: CancelResult } | { ok: false; message: string }> {
  if (actor.role !== "admin") throw new AccessError("forbidden", "Only operators can cancel bookings here.");
  const [b] = await db.select({ status: bookings.status }).from(bookings).where(eq(bookings.id, input.bookingId)).limit(1);
  if (!b) return { ok: false, message: "No booking with that id." };
  if (!(CANCELLABLE as readonly string[]).includes(b.status)) return { ok: false, message: `A ${b.status.replace("_", " ")} booking cannot be cancelled.` };
  try {
    const result = await cancelBooking({ bookingId: input.bookingId, actor: { kind: "admin", userId: actor.userId }, reason: input.reason, refundAmount: input.refundAmount });
    return { ok: true, result };
  } catch (err) {
    console.error("admin cancel failed", err);
    const detail = err instanceof Error && err.message ? ` (${err.message})` : "";
    return { ok: false, message: `The booking was not cancelled${detail}. Nothing was refunded. Try again, or cancel it in the payment provider's dashboard and note it here.` };
  }
}
