import { after } from "next/server";
import { handleWebhook } from "@/server/payments/webhooks";

/**
 * Stripe webhook. Register <site>/api/webhooks/stripe for checkout.session.completed,
 * checkout.session.async_payment_succeeded, checkout.session.async_payment_failed,
 * checkout.session.expired and charge.refunded.
 */
export async function POST(request: Request) {
  // constructEvent needs the raw body exactly as sent.
  const rawBody = await request.text();
  try {
    const result = await handleWebhook("stripe", rawBody, request.headers, (task) => after(task));
    return Response.json(result.body, { status: result.status });
  } catch (err) {
    console.error(`[webhook:stripe] ${err instanceof Error ? err.stack : err}`);
    return Response.json({ ok: false, error: "Processing failed." }, { status: 500 });
  }
}
