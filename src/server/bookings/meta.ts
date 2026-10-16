import "server-only";
import { and, eq, sql, type SQL } from "drizzle-orm";
import { bookings } from "@/db/schema";
import type { Executor } from "./transitions";

/**
 * Sets `meta[key]` only if it is not set yet and returns whether this caller won.
 * Used as a one-time claim (send an email once, create an airline order once) without extra columns.
 */
export async function claimMetaFlag(exec: Executor, bookingId: string, key: string, value: unknown, where?: SQL) {
  const rows = await exec
    .update(bookings)
    .set({ meta: sql`${bookings.meta} || ${JSON.stringify({ [key]: value })}::jsonb`, updatedAt: new Date() })
    .where(and(eq(bookings.id, bookingId), sql`not (${bookings.meta} ? ${key})`, where))
    .returning({ id: bookings.id });
  return rows.length > 0;
}

/** Merges keys into bookings.meta. Status never changes here; use transitions.ts for that. */
export async function mergeMeta(exec: Executor, bookingId: string, patch: Record<string, unknown>) {
  await exec
    .update(bookings)
    .set({ meta: sql`${bookings.meta} || ${JSON.stringify(patch)}::jsonb`, updatedAt: new Date() })
    .where(eq(bookings.id, bookingId));
}
