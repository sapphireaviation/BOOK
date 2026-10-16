import "server-only";
import { and, eq, ne } from "drizzle-orm";
import { db } from "@/db";
import { user } from "@/db/schema";
import { parseAdminEmails } from "@/server/host/rules";

/**
 * Promotes the signed-in user to admin when their email is listed in ADMIN_EMAILS.
 * Runs whenever someone opens a host or admin page, so the first operator only has to sign up.
 * Returns true when the role changed.
 */
export async function bootstrapAdmin(u: { id: string; email: string; role: string }) {
  if (u.role === "admin") return false;
  const allowed = parseAdminEmails(process.env.ADMIN_EMAILS);
  if (!allowed.has(u.email.trim().toLowerCase())) return false;
  const updated = await db
    .update(user)
    .set({ role: "admin", updatedAt: new Date() })
    .where(and(eq(user.id, u.id), ne(user.role, "admin")))
    .returning({ id: user.id });
  return updated.length > 0;
}
