import { connection } from "next/server";
import { cronAuthorized } from "@/server/bookings/cron";
import { expireStaleBookings, resumeFulfilment } from "@/server/bookings/expiry";

/** Daily (Vercel Hobby): expires unpaid holds and resumes follow-up work that was dropped after payment. */
export async function GET(request: Request) {
  await connection();
  if (!cronAuthorized(request)) return Response.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  try {
    const expiry = await expireStaleBookings();
    const fulfilment = await resumeFulfilment();
    return Response.json({ ok: true, ...expiry, ...fulfilment });
  } catch (err) {
    console.error(`[cron:expire-holds] ${err instanceof Error ? err.stack : err}`);
    return Response.json({ ok: false, error: "Job failed." }, { status: 500 });
  }
}
