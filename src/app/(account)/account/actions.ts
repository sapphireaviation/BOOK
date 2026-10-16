"use server";

import { and, eq, inArray, sql } from "drizzle-orm";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { account, bookings, flightBookings, hostProfiles, listings, reviews, session, stayBookings, user, verification, wishlists } from "@/db/schema";
import { auth, AuthError, requireUser } from "@/server/auth";
import { clientIp, consume, policies } from "@/server/rate-limit";

export type ActionState = { ok: boolean; message: string | null; fieldErrors?: Record<string, string> };

const profileSchema = z.object({
  name: z.string().trim().min(2, "Enter the name you travel under.").max(80, "Use at most 80 characters."),
  phone: z
    .string()
    .trim()
    .max(20)
    .transform((v) => v.replace(/[\s()-]/g, ""))
    .refine((v) => v === "" || /^\+?\d{7,15}$/.test(v), "Enter a phone number with country code, like +91 98765 43210.")
    .transform((v) => v || null),
});

async function signedIn() {
  try {
    return await requireUser();
  } catch (err) {
    if (err instanceof AuthError) redirect("/sign-in?next=/account");
    throw err;
  }
}

export async function updateProfile(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await signedIn();
  const parsed = profileSchema.safeParse({ name: formData.get("name") ?? "", phone: formData.get("phone") ?? "" });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0])] ??= issue.message;
    return { ok: false, message: null, fieldErrors };
  }
  try {
    // Through Better Auth so the cached session cookie picks up the new name.
    await auth.api.updateUser({ headers: await headers(), body: { name: parsed.data.name, phone: parsed.data.phone } });
    return { ok: true, message: "Profile saved." };
  } catch (err) {
    console.error("[account] updateProfile failed:", err);
    return { ok: false, message: "We could not save your profile. Try again in a minute." };
  }
}

/**
 * Deletes an account the way docs/SECURITY.md describes: personal data is
 * removed or replaced, booking rows stay (anonymized) for accounting and tax
 * records, and the person is signed out everywhere.
 */
export async function deleteAccount(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const me = await signedIn();
  const userId = me.user.id;

  const limit = await consume(`account:delete:${clientIp(await headers())}`, policies.account);
  if (!limit.ok) return { ok: false, message: `Too many attempts. Try again in ${limit.retryAfter} seconds.` };

  const confirm = String(formData.get("confirm") ?? "").trim().toLowerCase();
  if (confirm !== me.user.email.toLowerCase()) {
    return { ok: false, message: null, fieldErrors: { confirm: "Type the email address on this account to confirm." } };
  }

  const upcoming = await db.execute<{ reference: string }>(sql`
    select b.reference from ${bookings} b
    left join ${stayBookings} s on s.booking_id = b.id
    left join ${flightBookings} f on f.booking_id = b.id
    where b.user_id = ${userId}
      and b.status in ('pending_payment', 'confirmed')
      and (s.check_in >= current_date or f.depart_at >= now())
    limit 1`);
  if (upcoming.length) {
    return {
      ok: false,
      message: `You have an upcoming trip (${upcoming[0].reference}). Cancel it from Trips, or wait until it is over, then delete your account.`,
    };
  }

  const hosting = await db.execute<{ n: number }>(sql`
    select 1 as n from ${listings} where host_id = ${userId} and status = 'published'
    union all
    select 1 from ${stayBookings} s join ${bookings} b on b.id = s.booking_id
      where s.host_id = ${userId} and b.status in ('pending_payment', 'confirmed') and s.check_out >= current_date
    limit 1`);
  if (hosting.length) {
    return {
      ok: false,
      message: "You still host guests or have published listings. Unpublish your listings and finish upcoming stays first, or write to support for help.",
    };
  }

  const placeholder = `deleted-${userId}@deleted.invalid`;
  try {
    await db.transaction(async (tx) => {
      const myBookings = await tx.select({ id: bookings.id }).from(bookings).where(eq(bookings.userId, userId));
      const ids = myBookings.map((b) => b.id);
      if (ids.length) {
        await tx
          .update(bookings)
          .set({ contactName: "Deleted user", contactEmail: placeholder, contactPhone: null, updatedAt: new Date() })
          .where(inArray(bookings.id, ids));
        await tx.update(flightBookings).set({ passengers: [] }).where(inArray(flightBookings.bookingId, ids));
        await tx.update(stayBookings).set({ guestNote: null }).where(inArray(stayBookings.bookingId, ids));
      }
      await tx.update(reviews).set({ authorName: "Former guest" }).where(eq(reviews.userId, userId));
      await tx
        .update(hostProfiles)
        .set({ displayName: "Former host", about: "", languages: [], payoutReference: null, payoutMethod: null, taxId: null, meta: {}, updatedAt: new Date() })
        .where(eq(hostProfiles.userId, userId));
      await tx.update(listings).set({ contactPhone: null, contactEmail: null, updatedAt: new Date() }).where(and(eq(listings.hostId, userId)));
      await tx.delete(wishlists).where(eq(wishlists.userId, userId));
      await tx.delete(verification).where(eq(verification.identifier, me.user.email));
      await tx.delete(account).where(eq(account.userId, userId));
      await tx.delete(session).where(eq(session.userId, userId));
      await tx
        .update(user)
        .set({ name: "Deleted user", email: placeholder, emailVerified: false, image: null, phone: null, updatedAt: new Date() })
        .where(eq(user.id, userId));
    });
  } catch (err) {
    console.error("[account] deleteAccount failed:", err);
    return { ok: false, message: "We could not delete your account. Nothing was changed. Try again, or write to support." };
  }

  const jar = await cookies();
  for (const c of jar.getAll()) if (/^(__Secure-)?better-auth[.-]/.test(c.name)) jar.delete(c.name);
  redirect("/?account=deleted");
}
