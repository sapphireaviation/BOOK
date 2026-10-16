/**
 * Cancellation policy math for stays. Pure functions, no I/O.
 *
 * Check in is the listing's check-in time on the check-in date. We treat that wall clock time as UTC,
 * which is what the product spec allows; the error is at most the listing's UTC offset.
 */
export type StayPolicy = "flexible" | "moderate" | "strict" | "non_refundable";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

export type StayRefund = {
  refundAmount: number;
  /** Share of the total refunded, 0 to 100. */
  percent: number;
  explanation: string;
  /** False once check in has passed. Travelers cannot cancel then; an admin still can. */
  travelerCanCancel: boolean;
};

export function checkInInstant(checkIn: string, checkInTime: string) {
  const [h = "14", m = "00"] = checkInTime.split(":");
  const [y, mo, d] = checkIn.split("-").map(Number);
  return new Date(Date.UTC(y, mo - 1, d, Number(h), Number(m)));
}

function share(total: number, percent: number) {
  // Round down so we never refund more than the policy allows; the host keeps the odd minor unit.
  return Math.floor((total * percent) / 100);
}

export function policyLabel(policy: string) {
  switch (policy) {
    case "flexible":
      return "Flexible";
    case "moderate":
      return "Moderate";
    case "strict":
      return "Strict";
    case "non_refundable":
      return "Non refundable";
    default:
      return policy;
  }
}

/** One sentence per policy, for the booking page and emails. */
export function policySummary(policy: string) {
  switch (policy) {
    case "flexible":
      return "Full refund if you cancel at least 24 hours before check in. No refund after that.";
    case "moderate":
      return "Full refund if you cancel at least 5 days before check in. Half refund after that.";
    case "strict":
      return "Half refund if you cancel at least 7 days before check in. No refund after that.";
    case "non_refundable":
      return "No refund if you cancel.";
    default:
      return "Ask the host about cancellation.";
  }
}

export function computeStayRefund(input: { policy: string; total: number; checkIn: string; checkInTime: string; now: Date }): StayRefund {
  const { policy, total } = input;
  const start = checkInInstant(input.checkIn, input.checkInTime);
  const msBefore = start.getTime() - input.now.getTime();

  if (msBefore <= 0) {
    return { refundAmount: 0, percent: 0, travelerCanCancel: false, explanation: "Check in has passed, so this booking can no longer be refunded under its policy." };
  }

  const at = (percent: number, explanation: string): StayRefund => ({ refundAmount: share(total, percent), percent, explanation, travelerCanCancel: true });

  switch (policy) {
    case "flexible":
      return msBefore >= DAY
        ? at(100, "Flexible policy: you get a full refund because check in is at least 24 hours away.")
        : at(0, "Flexible policy: check in is less than 24 hours away, so there is no refund.");
    case "moderate":
      return msBefore >= 5 * DAY
        ? at(100, "Moderate policy: you get a full refund because check in is at least 5 days away.")
        : at(50, "Moderate policy: check in is less than 5 days away, so you get half of the total back.");
    case "strict":
      return msBefore >= 7 * DAY
        ? at(50, "Strict policy: check in is at least 7 days away, so you get half of the total back.")
        : at(0, "Strict policy: check in is less than 7 days away, so there is no refund.");
    case "non_refundable":
      return at(0, "This booking is non refundable.");
    default:
      return at(0, "This booking has no refund policy on record. Contact support if you think that is wrong.");
  }
}

/**
 * Flight refund estimate from the offer conditions. The airline confirms the real amount when the order
 * is cancelled; we never refund more than the traveler paid.
 */
export function estimateFlightRefund(input: {
  total: number;
  conditions: { refundable?: boolean; refundPenalty?: { amount: number; currency: string } | null } | null | undefined;
  canCancelWithAirline: boolean;
}) {
  if (!input.canCancelWithAirline) {
    return {
      refundAmount: 0,
      explanation: "We cannot cancel this ticket with the airline online. Cancelling here closes the booking without a refund. Contact the airline directly to ask about a refund.",
    };
  }
  if (!input.conditions?.refundable) {
    return { refundAmount: 0, explanation: "This fare is not refundable. The airline keeps the fare if you cancel." };
  }
  const penalty = input.conditions.refundPenalty?.amount ?? 0;
  const refundAmount = Math.max(0, input.total - penalty);
  return {
    refundAmount,
    explanation: penalty
      ? "This fare is refundable with an airline cancellation charge. The airline confirms the exact amount when you cancel."
      : "This fare is refundable. The airline confirms the exact amount when you cancel.",
  };
}
