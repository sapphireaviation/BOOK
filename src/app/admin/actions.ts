"use server";

import { z } from "zod";
import type { ActionState } from "@/components/host/action-state";
import { formatMoney } from "@/lib/money";
import { adminCancelBooking } from "@/server/admin/bookings";
import { moderateListing } from "@/server/admin/listings";
import { markPayoutPaid, markPayoutScheduled } from "@/server/admin/payouts";
import { changeUserRole, roles } from "@/server/admin/users";
import { runAction } from "@/server/host/action-helpers";
import { ValidationError } from "@/server/host/errors";
import { parseMoneyInput } from "@/server/host/rules";

const id = z.string().regex(/^[a-z]{2,4}_[a-z0-9]+$|^[A-Za-z0-9_-]{8,64}$/);
const admin = ["admin"] as const;

const cancelSchema = z.object({
  reason: z.string().trim().min(3, "Write a short reason. The guest sees it in the cancellation email.").max(500, "Keep the reason under 500 characters."),
  refund: z.string().trim().max(20).default(""),
});

export async function cancelBookingAction(bookingId: string, currency: string, _prev: ActionState, formData: FormData) {
  id.parse(bookingId);
  return runAction({
    roles: [...admin],
    schema: cancelSchema,
    formData,
    ok: "Booking cancelled",
    run: async (actor, input) => {
      const refund = parseMoneyInput(input.refund, currency, { allowEmpty: true });
      if (!refund.ok) throw new ValidationError(refund.error, { refund: refund.error });
      const result = await adminCancelBooking(actor, { bookingId, reason: input.reason, refundAmount: refund.value ?? undefined });
      if (!result.ok) throw new ValidationError(result.message);
      const amount = formatMoney({ amount: result.result.refundAmount, currency: result.result.currency });
      return result.result.refundAmount > 0 ? `Booking cancelled. ${amount} refunded to the guest.` : "Booking cancelled. No refund was due.";
    },
  });
}

const moderateSchema = z.object({ action: z.enum(["suspend", "restore", "verify", "unverify"]) });
const moderateMessages = { suspend: "Listing suspended", restore: "Listing restored", verify: "Listing verified", unverify: "Verification removed" } as const;

export async function moderateListingAction(listingId: string, _prev: ActionState, formData: FormData) {
  id.parse(listingId);
  return runAction({
    roles: [...admin],
    schema: moderateSchema,
    formData,
    ok: "Listing updated",
    run: async (actor, input) => {
      await moderateListing(actor, listingId, input.action);
      return moderateMessages[input.action];
    },
  });
}

const roleSchema = z.object({ role: z.enum(roles, { error: "Choose a role." }) });

export async function changeRoleAction(userId: string, _prev: ActionState, formData: FormData) {
  id.parse(userId);
  return runAction({
    roles: [...admin],
    schema: roleSchema,
    formData,
    ok: "Role changed",
    run: async (actor, input) => {
      await changeUserRole(actor, userId, input.role);
      return `Role changed to ${input.role}`;
    },
  });
}

const paidSchema = z.object({
  reference: z.string().trim().min(3, "Enter the bank or UPI transfer reference.").max(120, "Keep the reference under 120 characters."),
});

export async function markPaidAction(payoutId: string, _prev: ActionState, formData: FormData) {
  id.parse(payoutId);
  return runAction({
    roles: [...admin],
    schema: paidSchema,
    formData,
    ok: "Marked as paid",
    run: async (actor, input) => {
      await markPayoutPaid(actor, payoutId, input.reference);
    },
  });
}

export async function scheduleAction(payoutId: string, _prev: ActionState, formData: FormData) {
  id.parse(payoutId);
  return runAction({
    roles: [...admin],
    schema: z.object({}),
    formData,
    ok: "Marked as scheduled",
    run: async (actor) => {
      await markPayoutScheduled(actor, payoutId);
    },
  });
}
