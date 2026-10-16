import "server-only";
import { and, desc, eq, ilike, or, sql, type SQL } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { hostProfiles, listings, user } from "@/db/schema";
import { AccessError } from "@/server/host/access";
import { ValidationError } from "@/server/host/errors";
import { ensureHostProfile } from "@/server/host/listings";
import type { Actor, Role } from "@/server/host/rules";
import { ADMIN_PAGE_SIZE, escapeLike } from "./bookings";

export const roles = ["traveler", "host", "admin"] as const;

export const userFilterSchema = z.object({
  q: z.string().trim().max(200).optional().catch(undefined),
  role: z.enum(roles).optional().catch(undefined),
  page: z.coerce.number().int().min(1).max(1000).optional().catch(undefined),
});

export async function searchUsers(filter: z.infer<typeof userFilterSchema>) {
  const conds: SQL[] = [];
  if (filter.q) {
    const like = `%${escapeLike(filter.q)}%`;
    conds.push(or(ilike(user.email, like), ilike(user.name, like))!);
  }
  if (filter.role) conds.push(eq(user.role, filter.role));
  const page = filter.page ?? 1;
  const rows = await db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      emailVerified: user.emailVerified,
      createdAt: user.createdAt,
      listingCount: sql<string>`(select count(*) from ${listings} where ${listings.hostId} = ${user.id})`,
      hostName: hostProfiles.displayName,
    })
    .from(user)
    .leftJoin(hostProfiles, eq(hostProfiles.userId, user.id))
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(user.createdAt))
    .limit(ADMIN_PAGE_SIZE + 1)
    .offset((page - 1) * ADMIN_PAGE_SIZE);
  return { rows: rows.slice(0, ADMIN_PAGE_SIZE).map((r) => ({ ...r, listingCount: Number(r.listingCount) })), hasMore: rows.length > ADMIN_PAGE_SIZE, page };
}

/** Changes a role. Operators cannot demote themselves, so the console always keeps one admin who can undo it. */
export async function changeUserRole(actor: Actor, userId: string, role: Role) {
  if (actor.role !== "admin") throw new AccessError("forbidden", "Only operators can change roles.");
  if (userId === actor.userId && role !== "admin") throw new ValidationError("You cannot remove your own admin role. Ask another operator.");
  const [u] = await db.select({ id: user.id }).from(user).where(eq(user.id, userId)).limit(1);
  if (!u) throw new AccessError("not_found", "No user with that id.");
  await db.update(user).set({ role, updatedAt: new Date() }).where(eq(user.id, userId));
  if (role === "host") await ensureHostProfile(userId);
}
