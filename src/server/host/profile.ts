import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { hostProfiles, user } from "@/db/schema";
import { AccessError } from "./access";
import { ensureHostProfile } from "./listings";
import { parseLanguages, type Actor } from "./rules";
import type { z } from "zod";
import type { profileSchema } from "./schemas";

/**
 * Turns a signed-in traveler into a host: creates the host profile and sets role "host".
 * Admins keep the admin role and get a host profile so they can list too.
 */
export async function becomeHost(userId: string) {
  const [u] = await db.select({ id: user.id, role: user.role }).from(user).where(eq(user.id, userId)).limit(1);
  if (!u) throw new AccessError("unauthenticated", "Sign in to start listing.");
  await ensureHostProfile(userId);
  if (u.role === "traveler") await db.update(user).set({ role: "host", updatedAt: new Date() }).where(eq(user.id, userId));
}

export async function getHostProfile(actor: Actor) {
  await ensureHostProfile(actor.userId);
  const [row] = await db.select().from(hostProfiles).where(eq(hostProfiles.userId, actor.userId)).limit(1);
  return row;
}

export async function updateHostProfile(actor: Actor, input: z.infer<typeof profileSchema>) {
  if (actor.role !== "host" && actor.role !== "admin") throw new AccessError("forbidden", "Start hosting to set up a host profile.");
  await ensureHostProfile(actor.userId);
  await db
    .update(hostProfiles)
    .set({
      displayName: input.displayName,
      about: input.about,
      languages: parseLanguages(input.languages),
      payoutMethod: input.payoutMethod,
      payoutReference: input.payoutReference,
      taxId: input.taxId,
      updatedAt: new Date(),
    })
    .where(eq(hostProfiles.userId, actor.userId));
}
