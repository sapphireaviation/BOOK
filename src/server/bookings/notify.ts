import "server-only";
import { db } from "@/db";
import { sendEmail } from "@/server/email/send";
import {
  bookingCancelledEmail,
  bookingConfirmedEmail,
  flightTicketingFailedEmail,
  hostBookingCancelledEmail,
  hostNewBookingEmail,
  paymentRefundedEmail,
  type EmailContent,
} from "@/server/email/templates";
import { claimMetaFlag } from "./meta";
import { getBookingDetailById } from "./queries";

function send(to: string, template: string, content: EmailContent) {
  return sendEmail({ to, template, ...content });
}

/** Traveler confirmation, plus the host notice for stays. Sent once per booking. */
export async function sendConfirmationEmails(bookingId: string) {
  if (!(await claimMetaFlag(db, bookingId, "confirmationEmailAt", new Date().toISOString()))) return;
  const detail = await getBookingDetailById(bookingId);
  if (!detail) return;
  await send(detail.booking.contactEmail, "booking-confirmed", bookingConfirmedEmail(detail));
  if (detail.stay) {
    const hostTo = detail.stay.listing.contactEmail ?? detail.stay.host.email;
    await send(hostTo, "host-new-booking", hostNewBookingEmail(detail));
  }
}

export async function sendCancellationEmails(bookingId: string, refund: { amount: number; explanation: string }, hostPayout: number | null) {
  const detail = await getBookingDetailById(bookingId);
  if (!detail) return;
  await send(detail.booking.contactEmail, "booking-cancelled", bookingCancelledEmail(detail, refund));
  if (detail.stay && hostPayout != null) {
    const hostTo = detail.stay.listing.contactEmail ?? detail.stay.host.email;
    await send(hostTo, "host-booking-cancelled", hostBookingCancelledEmail(detail, hostPayout));
  }
}

export async function sendTicketingFailedEmail(bookingId: string, refundAmount: number) {
  const detail = await getBookingDetailById(bookingId);
  if (!detail?.flight) return;
  await send(detail.booking.contactEmail, "flight-ticketing-failed", flightTicketingFailedEmail(detail, refundAmount));
}

export async function sendPaymentRefundedEmail(bookingId: string, refundAmount: number, reason: "late" | "duplicate" | "mismatch") {
  const detail = await getBookingDetailById(bookingId);
  if (!detail) return;
  await send(detail.booking.contactEmail, `payment-refunded-${reason}`, paymentRefundedEmail(detail, refundAmount, reason));
}
