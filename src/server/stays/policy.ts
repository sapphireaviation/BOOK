import "server-only";
import { cancellationPolicyText } from "@/lib/amenities";
import { dayLabel } from "@/components/stays/format";
import { addDays, isISODate } from "@/lib/dates";

/**
 * Cancellation policies in plain words. Pure, so it is easy to test.
 * The refund rules match `cancellationPolicyText` in src/lib/amenities.ts.
 */

export type PolicyExplanation = { label: string; summary: string; steps: string[] };

/** Days before check in that each policy's first deadline falls. */
export const POLICY_DEADLINE_DAYS: Record<string, number | null> = {
  flexible: 1,
  moderate: 5,
  strict: 7,
  non_refundable: null,
};

/**
 * Explains a policy. With a check in date the steps name the actual deadline, for example
 * "Cancel before 14:00 on Sun 9 Nov for a full refund."
 */
export function explainPolicy(policy: string, checkIn?: string, checkInTime = "14:00"): PolicyExplanation {
  const text = cancellationPolicyText[policy] ?? cancellationPolicyText.moderate;
  const days = POLICY_DEADLINE_DAYS[policy] ?? POLICY_DEADLINE_DAYS.moderate;
  const deadline = checkIn && isISODate(checkIn) && days !== null ? `${checkInTime} on ${dayLabel(addDays(checkIn, -days))}` : null;

  switch (policy) {
    case "flexible":
      return {
        ...text,
        steps: deadline
          ? [`Cancel before ${deadline} for a full refund.`, "Cancel later than that and there is no refund."]
          : ["Cancel at least 24 hours before check in for a full refund.", "Cancel later than that and there is no refund."],
      };
    case "strict":
      return {
        ...text,
        steps: deadline
          ? [`Cancel before ${deadline} and you get half of what you paid back.`, "Cancel later than that and there is no refund."]
          : ["Cancel at least 7 days before check in and you get half of what you paid back.", "Cancel later than that and there is no refund."],
      };
    case "non_refundable":
      return { ...text, steps: ["You cannot get a refund if you cancel, so book only when your dates are fixed."] };
    default:
      return {
        ...text,
        steps: deadline
          ? [`Cancel before ${deadline} for a full refund.`, "Cancel later than that and you get half of what you paid back."]
          : ["Cancel at least 5 days before check in for a full refund.", "Cancel later than that and you get half of what you paid back."],
      };
  }
}
