export type ProviderName = "razorpay" | "stripe" | "test";

/** What a provider needs to start a checkout. Built from the booking row on the server, never from the client. */
export type CheckoutBooking = {
  id: string;
  reference: string;
  /** Minor units, straight from bookings.total. */
  total: number;
  currency: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string | null;
  accessToken: string;
  /** One line shown on the provider's page, e.g. "Sea view room, Goa, 24 to 27 Oct". */
  description: string;
  expiresAt: Date | null;
};

export type CheckoutSession =
  | { provider: "razorpay"; providerOrderId: string; keyId: string; amount: number; currency: string }
  | { provider: "stripe"; providerOrderId: string; url: string; expiresAt: Date }
  | { provider: "test"; providerOrderId: string };

export type CapturedPayment = {
  providerOrderId: string;
  providerPaymentId: string;
  /** Minor units as reported by the provider. Checked against the payment row before confirming. */
  amount: number;
  currency: string;
  method?: string | null;
  raw?: Record<string, unknown>;
};

export type ClientCallbackResult = { ok: true; payment: CapturedPayment } | { ok: false; reason: string };

type EventBase = { id: string; type: string; raw: Record<string, unknown> };

export type WebhookEvent = EventBase &
  (
    | { kind: "captured"; payment: CapturedPayment }
    | { kind: "authorized"; providerOrderId: string; providerPaymentId: string; amount: number; currency: string }
    | { kind: "failed"; providerOrderId: string; providerPaymentId: string | null; reason: string }
    | {
        kind: "refund_processed";
        providerPaymentId: string;
        /** Razorpay names the refund. Stripe reports the charge's refunded total instead. */
        providerRefundId: string | null;
        amountRefunded: number | null;
      }
    | { kind: "ignored" }
  );

export type RefundRequest = {
  providerPaymentId: string;
  amount: number;
  currency: string;
  /** Our refunds.id, used as the idempotency key where the provider supports one. */
  refundId: string;
  reason: string;
};

export type RefundResult = { providerRefundId: string; status: "pending" | "processed" | "failed" };

export interface PaymentProvider {
  readonly name: ProviderName;
  createCheckout(booking: CheckoutBooking): Promise<CheckoutSession>;
  /** Verifies what the browser sends back after paying. Returns the captured payment or why it was rejected. */
  verifyClientCallback(payload: unknown): Promise<ClientCallbackResult>;
  /** Verifies the signature over the raw body. Throws WebhookSignatureError when it does not match. */
  parseWebhook(rawBody: string, headers: Headers): Promise<WebhookEvent>;
  refund(input: RefundRequest): Promise<RefundResult>;
  /** Captures an authorized payment (Razorpay accounts without auto capture). */
  capture?(input: { providerOrderId: string; providerPaymentId: string; amount: number; currency: string }): Promise<CapturedPayment>;
  /** Closes an open hosted checkout so it cannot be paid after the booking hold ends. Best effort. */
  expireCheckout?(providerOrderId: string): Promise<void>;
}

export class WebhookSignatureError extends Error {
  constructor(message = "Webhook signature did not match.") {
    super(message);
    this.name = "WebhookSignatureError";
  }
}
