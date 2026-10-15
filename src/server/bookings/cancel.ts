import "server-only";

export type CancelInput = {
  bookingId: string;
  actor: { kind: "traveler"; userId: string | null; accessToken?: string } | { kind: "admin"; userId: string } | { kind: "system" };
  reason: string;
  /** Admin only: override the policy refund amount (minor units). */
  refundAmount?: number;
};

export type CancelResult = { status: "cancelled" | "refunded"; refundAmount: number; currency: string };

/** CONTRACT (bookings workstream). Computes the refund from the cancellation policy, refunds, releases inventory. */
export async function cancelBooking(input: CancelInput): Promise<CancelResult> {
  void input;
  throw new Error("cancelBooking not implemented");
}

/** CONTRACT. What the traveler would get back if they cancelled now. */
export async function previewCancellation(bookingId: string): Promise<{ refundAmount: number; currency: string; policy: string; explanation: string }> {
  void bookingId;
  throw new Error("previewCancellation not implemented");
}
