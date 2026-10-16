import { createHash, createHmac, timingSafeEqual } from "node:crypto";

/** Constant time string comparison. Hashing first makes the lengths equal, so length leaks nothing. */
export function safeEqual(a: string, b: string) {
  const ha = createHash("sha256").update(a, "utf8").digest();
  const hb = createHash("sha256").update(b, "utf8").digest();
  return timingSafeEqual(ha, hb) && a.length === b.length;
}

export function hmacSha256Hex(payload: string, secret: string) {
  return createHmac("sha256", secret).update(payload, "utf8").digest("hex");
}

/** Razorpay checkout callback: HMAC SHA256 of "order_id|payment_id" with the key secret. */
export function verifyRazorpayPaymentSignature(input: { orderId: string; paymentId: string; signature: string; keySecret: string }) {
  if (!input.orderId || !input.paymentId || !input.signature || !input.keySecret) return false;
  return safeEqual(hmacSha256Hex(`${input.orderId}|${input.paymentId}`, input.keySecret), input.signature);
}

/** Razorpay webhook: HMAC SHA256 of the raw request body with the webhook secret. */
export function verifyRazorpayWebhookSignature(rawBody: string, signature: string | null, webhookSecret: string) {
  if (!signature || !webhookSecret) return false;
  return safeEqual(hmacSha256Hex(rawBody, webhookSecret), signature);
}
