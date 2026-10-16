import "server-only";
import { and, eq } from "drizzle-orm";
import type { DB } from "@/db";
import { bookings } from "@/db/schema";

export type Tx = Parameters<Parameters<DB["transaction"]>[0]>[0];
/** Anything that can run a query: the pool or an open transaction. */
export type Executor = DB | Tx;

export type BookingStatus = (typeof bookings.$inferSelect)["status"];

export const BOOKING_STATUSES: readonly BookingStatus[] = [
  "draft",
  "pending_payment",
  "confirmed",
  "completed",
  "cancelled",
  "refunded",
  "expired",
  "failed",
];

/**
 * Legal moves of the booking state machine (docs/ARCHITECTURE.md).
 *
 * confirmed -> failed exists for flights only: payment was captured but the airline order could not be
 * created, so we refund in full and fail the booking.
 */
export const LEGAL_TRANSITIONS: Readonly<Record<BookingStatus, readonly BookingStatus[]>> = {
  draft: ["pending_payment", "expired", "failed"],
  pending_payment: ["confirmed", "expired", "failed"],
  confirmed: ["completed", "cancelled", "failed"],
  completed: [],
  cancelled: ["refunded"],
  refunded: [],
  expired: [],
  failed: [],
};

export function canTransition(from: BookingStatus, to: BookingStatus) {
  return LEGAL_TRANSITIONS[from].includes(to);
}

export class TransitionError extends Error {
  constructor(
    /** "illegal": the state machine forbids the move. "conflict": the booking was not in `from` any more. */
    public readonly code: "illegal" | "conflict",
    public readonly bookingId: string,
    public readonly from: BookingStatus,
    public readonly to: BookingStatus,
  ) {
    super(
      code === "illegal"
        ? `Booking ${bookingId} cannot move from ${from} to ${to}.`
        : `Booking ${bookingId} is no longer ${from}, so it was not moved to ${to}.`,
    );
    this.name = "TransitionError";
  }
}

type Extra = Partial<Pick<typeof bookings.$inferInsert, "confirmedAt" | "cancelledAt" | "cancelReason" | "meta" | "expiresAt">>;

/**
 * The only place a booking status changes. The update is optimistic: it only applies while the row is
 * still in `from`, so two webhooks or a webhook racing the expiry job cannot both win.
 */
export async function transition(db: Executor, bookingId: string, from: BookingStatus, to: BookingStatus, extra: Extra = {}) {
  if (!canTransition(from, to)) throw new TransitionError("illegal", bookingId, from, to);
  const rows = await db
    .update(bookings)
    .set({ ...extra, status: to, updatedAt: new Date() })
    .where(and(eq(bookings.id, bookingId), eq(bookings.status, from)))
    .returning({ id: bookings.id });
  if (rows.length === 0) throw new TransitionError("conflict", bookingId, from, to);
}
