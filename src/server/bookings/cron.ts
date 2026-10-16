import "server-only";
import { safeEqual } from "@/server/payments/signature";

/**
 * Vercel Cron sends `Authorization: Bearer ${CRON_SECRET}`. Without a secret configured the jobs refuse
 * to run, so they can never be triggered by anyone on the internet.
 */
export function cronAuthorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = request.headers.get("authorization") ?? "";
  return safeEqual(header, `Bearer ${secret}`);
}
