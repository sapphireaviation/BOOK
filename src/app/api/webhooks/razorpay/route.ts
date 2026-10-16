import { after } from "next/server";
import { handleWebhook } from "@/server/payments/webhooks";

/**
 * Razorpay webhook. Register <site>/api/webhooks/razorpay for payment.captured, payment.authorized,
 * payment.failed and refund.processed.
 */
export async function POST(request: Request) {
  // The signature covers the exact bytes Razorpay sent, so read the raw body before any parsing.
  const rawBody = await request.text();
  try {
    const result = await handleWebhook("razorpay", rawBody, request.headers, (task) => after(task));
    return Response.json(result.body, { status: result.status });
  } catch (err) {
    console.error(`[webhook:razorpay] ${err instanceof Error ? err.stack : err}`);
    return Response.json({ ok: false, error: "Processing failed." }, { status: 500 });
  }
}
