import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { user } from "@/db/schema";
import { getSession } from "@/server/auth";
import { bootstrapAdmin } from "@/server/admin/bootstrap";
import type { Actor, Role } from "./rules";

export type Viewer = { id: string; name: string; email: string; role: Role };

/**
 * The signed-in person for host and admin pages, with the role read from the database
 * (the session cookie cache can lag behind a role change for a few minutes).
 * Promotes ADMIN_EMAILS on the way. Deduplicated per request.
 */
export const getViewer = cache(async (): Promise<Viewer | null> => {
  const session = await getSession();
  if (!session) return null;
  const [row] = await db
    .select({ id: user.id, name: user.name, email: user.email, role: user.role })
    .from(user)
    .where(eq(user.id, session.user.id))
    .limit(1);
  if (!row) return null;
  if (await bootstrapAdmin(row)) row.role = "admin";
  return row;
});

export class AccessError extends Error {
  constructor(
    public readonly code: "unauthenticated" | "forbidden" | "not_found",
    message: string,
  ) {
    super(message);
  }
}

/** For server actions and route handlers: the acting host or admin, or an AccessError. */
export async function requireActor(roles: Role[] = ["host", "admin"]): Promise<Actor & { viewer: Viewer }> {
  const viewer = await getViewer();
  if (!viewer) throw new AccessError("unauthenticated", "Your session has ended. Sign in again to continue.");
  if (!roles.includes(viewer.role) && viewer.role !== "admin") throw new AccessError("forbidden", "You do not have access to this.");
  return { userId: viewer.id, role: viewer.role, viewer };
}

/** For pages: redirects instead of throwing. */
export async function requireHostPage(next: string): Promise<Viewer> {
  const viewer = await getViewer();
  if (!viewer) redirect(`/sign-in?next=${encodeURIComponent(next)}`);
  if (viewer.role !== "host" && viewer.role !== "admin") redirect("/host");
  return viewer;
}

export async function requireAdminPage(next: string): Promise<Viewer> {
  const viewer = await getViewer();
  if (!viewer) redirect(`/sign-in?next=${encodeURIComponent(next)}`);
  if (viewer.role !== "admin") redirect("/");
  return viewer;
}

export function actorOf(viewer: Viewer): Actor {
  return { userId: viewer.id, role: viewer.role };
}
