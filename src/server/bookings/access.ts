import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { bookings } from "@/db/schema";
import { getSession } from "@/server/auth";
import { safeEqual } from "@/server/payments/signature";

export type Viewer = { via: "owner" | "token" | "admin"; userId: string | null };

/**
 * Who is looking at a booking: its owner (signed in), anyone holding the email link token, or an admin.
 * The token is compared in constant time. Returns null when none apply; callers answer with a 404
 * so references cannot be probed.
 */
export async function bookingViewer(booking: { userId: string | null; accessToken: string }, token: string | null | undefined): Promise<Viewer | null> {
  let session: Awaited<ReturnType<typeof getSession>> = null;
  try {
    session = await getSession();
  } catch {
    session = null;
  }
  const userId = session?.user.id ?? null;
  if (userId && booking.userId === userId) return { via: "owner", userId };
  if (token && safeEqual(token, booking.accessToken)) return { via: "token", userId };
  if (userId && (session?.user as { role?: string } | undefined)?.role === "admin") return { via: "admin", userId };
  return null;
}

/** Loads the minimal booking header and checks access in one go. */
export async function authorizeBookingById(bookingId: string, token: string | null | undefined) {
  const [booking] = await db
    .select({ id: bookings.id, reference: bookings.reference, userId: bookings.userId, accessToken: bookings.accessToken, status: bookings.status })
    .from(bookings)
    .where(eq(bookings.id, bookingId))
    .limit(1);
  if (!booking) return null;
  const viewer = await bookingViewer(booking, token);
  return viewer ? { booking, viewer } : null;
}

export function bookingPath(reference: string, accessToken: string) {
  return `/bookings/${reference}?token=${encodeURIComponent(accessToken)}`;
}
