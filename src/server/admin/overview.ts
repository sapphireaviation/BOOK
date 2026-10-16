import "server-only";
import { and, eq, gte, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { bookings, listings, payments, payouts } from "@/db/schema";

const counted = ["pending_payment", "confirmed", "completed", "cancelled", "refunded"] as const;
const kept = ["confirmed", "completed"] as const;

/**
 * Numbers for the operations overview. `now` is passed in so the page decides the clock.
 * "Today" and "this week" use UTC days; the week starts on Monday.
 */
export async function adminOverview(now: Date) {
  const dayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const weekStart = new Date(dayStart);
  weekStart.setUTCDate(weekStart.getUTCDate() - ((weekStart.getUTCDay() + 6) % 7));
  const monthAgo = new Date(dayStart);
  monthAgo.setUTCDate(monthAgo.getUTCDate() - 30);

  const [today, week, value, pendingPayments, owed, review] = await Promise.all([
    countBookings(dayStart),
    countBookings(weekStart),
    db
      .select({ currency: bookings.currency, amount: sql<string>`sum(${bookings.total})`, n: sql<string>`count(*)` })
      .from(bookings)
      .where(and(inArray(bookings.status, [...kept]), gte(bookings.createdAt, monthAgo)))
      .groupBy(bookings.currency),
    db
      .select({ n: sql<string>`count(*)`, currency: payments.currency, amount: sql<string>`sum(${payments.amount})` })
      .from(payments)
      .innerJoin(bookings, eq(bookings.id, payments.bookingId))
      .where(and(inArray(payments.status, ["created", "authorized"]), eq(bookings.status, "pending_payment")))
      .groupBy(payments.currency),
    db
      .select({ currency: payouts.currency, amount: sql<string>`sum(${payouts.amount})`, n: sql<string>`count(*)` })
      .from(payouts)
      .where(inArray(payouts.status, ["owed", "scheduled"]))
      .groupBy(payouts.currency),
    db
      .select({ n: sql<string>`count(*)` })
      .from(listings)
      .where(and(eq(listings.status, "published"), eq(listings.verified, false))),
  ]);

  const num = (rows: { currency: string; amount: string; n: string }[]) => rows.map((r) => ({ currency: r.currency, amount: Number(r.amount), count: Number(r.n) }));
  return {
    bookingsToday: today,
    bookingsThisWeek: week,
    valueLast30Days: num(value),
    pendingPayments: num(pendingPayments),
    payoutsOwed: num(owed),
    listingsAwaitingReview: Number(review[0]?.n ?? 0),
  };
}

async function countBookings(since: Date) {
  const rows = await db
    .select({ kind: bookings.kind, n: sql<string>`count(*)` })
    .from(bookings)
    .where(and(inArray(bookings.status, [...counted]), gte(bookings.createdAt, since)))
    .groupBy(bookings.kind);
  const byKind = Object.fromEntries(rows.map((r) => [r.kind, Number(r.n)])) as Partial<Record<"stay" | "flight", number>>;
  return { total: (byKind.stay ?? 0) + (byKind.flight ?? 0), stay: byKind.stay ?? 0, flight: byKind.flight ?? 0 };
}
