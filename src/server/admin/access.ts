import "server-only";
import { requireActor } from "@/server/host/access";

/** The acting admin for server actions. Throws AccessError for anyone else. */
export function requireAdmin() {
  return requireActor(["admin"]);
}
