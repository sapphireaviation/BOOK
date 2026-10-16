import { after } from "next/server";
import { z } from "zod";
import { authorizeBookingById, bookingPath } from "@/server/bookings/access";
import { confirmClientPayment } from "@/server/bookings/checkout";

const bodySchema = z.object({
  bookingId: z.string().min(1).max(64),
  token: z.string().max(128).optional(),
  razorpay_order_id: z.string().min(1).max(64),
  razorpay_payment_id: z.string().min(1).max(64),
  razorpay_signature: z.string().min(1).max(256),
});

/** Razorpay checkout's handler posts here. Verifies the signature, then confirms from the server's own records. */
export async function POST(request: Request) {
  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await request.json());
  } catch {
    return Response.json({ ok: false, error: "Missing payment details." }, { status: 400 });
  }

  const access = await authorizeBookingById(body.bookingId, body.token);
  if (!access) return Response.json({ ok: false, error: "Booking not found." }, { status: 404 });

  try {
    const outcome = await confirmClientPayment({
      bookingId: body.bookingId,
      provider: "razorpay",
      payload: { razorpay_order_id: body.razorpay_order_id, razorpay_payment_id: body.razorpay_payment_id, razorpay_signature: body.razorpay_signature },
      schedule: (task) => after(task),
    });
    if (outcome.kind === "rejected" || outcome.kind === "unknown_order") {
      return Response.json(
        { ok: false, error: "We could not confirm this payment yet. If it went through, your booking updates within a few minutes. Contact support if it does not." },
        { status: 400 },
      );
    }
    return Response.json({ ok: true, outcome: outcome.kind, redirect: bookingPath(access.booking.reference, access.booking.accessToken) });
  } catch (err) {
    console.error(`[razorpay:verify] ${err instanceof Error ? err.stack : err}`);
    return Response.json({ ok: false, error: "Something went wrong while confirming the payment. Check your booking page in a minute." }, { status: 500 });
  }
}
