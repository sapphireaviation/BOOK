import { connection } from "next/server";
import { cronAuthorized } from "@/server/bookings/cron";
import { completeFinishedStays } from "@/server/bookings/expiry";

/** Daily: marks confirmed stays completed once check out has passed. */
export async function GET(request: Request) {
  await connection();
  if (!cronAuthorized(request)) return Response.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  try {
    return Response.json({ ok: true, ...(await completeFinishedStays()) });
  } catch (err) {
    console.error(`[cron:complete-stays] ${err instanceof Error ? err.stack : err}`);
    return Response.json({ ok: false, error: "Job failed." }, { status: 500 });
  }
}
