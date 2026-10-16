import "server-only";
import { and, asc, desc, eq, inArray, type SQL } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { bookings, hostProfiles, payouts, user } from "@/db/schema";
import { AccessError } from "@/server/host/access";
import { ValidationError } from "@/server/host/errors";
import type { Actor } from "@/server/host/rules";
import { ADMIN_PAGE_SIZE } from "./bookings";

export const payoutStatuses = ["owed", "scheduled", "paid", "cancelled"] as const;

export const payoutFilterSchema = z.object({
  status: z.enum(payoutStatuses).optional().catch(undefined),
  page: z.coerce.number().int().min(1).max(1000).optional().catch(undefined),
});

export async function searchPayouts(filter: z.infer<typeof payoutFilterSchema>) {
  const conds: SQL[] = [];
  if (filter.status) conds.push(eq(payouts.status, filter.status));
  const page = filter.page ?? 1;
  const unpaidFirst = !filter.status || filter.status === "owed" || filter.status === "scheduled";
  const rows = await db
    .select({
      id: payouts.id,
      amount: payouts.amount,
      currency: payouts.currency,
      status: payouts.status,
      releaseOn: payouts.releaseOn,
      paidAt: payouts.paidAt,
      transferReference: payouts.providerTransferId,
      bookingId: bookings.id,
      reference: bookings.reference,
      bookingStatus: bookings.status,
      hostId: payouts.hostId,
      hostEmail: user.email,
      hostName: hostProfiles.displayName,
      payoutMethod: hostProfiles.payoutMethod,
      payoutDetails: hostProfiles.payoutReference,
    })
    .from(payouts)
    .innerJoin(bookings, eq(bookings.id, payouts.bookingId))
    .innerJoin(user, eq(user.id, payouts.hostId))
    .leftJoin(hostProfiles, eq(hostProfiles.userId, payouts.hostId))
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(unpaidFirst ? asc(payouts.releaseOn) : desc(payouts.releaseOn))
    .limit(ADMIN_PAGE_SIZE + 1)
    .offset((page - 1) * ADMIN_PAGE_SIZE);
  return { rows: rows.slice(0, ADMIN_PAGE_SIZE), hasMore: rows.length > ADMIN_PAGE_SIZE, page };
}

export async function markPayoutPaid(actor: Actor, payoutId: string, transferReference: string) {
  if (actor.role !== "admin") throw new AccessError("forbidden", "Only operators can record payouts.");
  const updated = await db
    .update(payouts)
    .set({ status: "paid", paidAt: new Date(), providerTransferId: transferReference })
    .where(and(eq(payouts.id, payoutId), inArray(payouts.status, ["owed", "scheduled"])))
    .returning({ id: payouts.id });
  if (!updated.length) throw new ValidationError("This payout is already paid or cancelled.");
}

export async function markPayoutScheduled(actor: Actor, payoutId: string) {
  if (actor.role !== "admin") throw new AccessError("forbidden", "Only operators can schedule payouts.");
  const updated = await db
    .update(payouts)
    .set({ status: "scheduled" })
    .where(and(eq(payouts.id, payoutId), eq(payouts.status, "owed")))
    .returning({ id: payouts.id });
  if (!updated.length) throw new ValidationError("Only an owed payout can be scheduled.");
}
