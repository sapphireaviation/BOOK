import { formatDuration } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import type { Conditions, Offer, Slice } from "@/server/flights/types";

/** Copy helpers shared by flight rows, the offer page and route pages. */

export function stopsLabel(stops: number) {
  if (stops === 0) return "Nonstop";
  return stops === 1 ? "1 stop" : `${stops} stops`;
}

export function stopCities(slice: Slice) {
  return slice.segments.slice(0, -1).map((s) => s.destination.city || s.destination.iata);
}

export function durationLabel(minutes: number) {
  return formatDuration(Math.max(0, Math.round(minutes)));
}

export function passengerCountLabel(p: { adults: number; children: number; infants: number }) {
  const parts = [`${p.adults} ${p.adults === 1 ? "adult" : "adults"}`];
  if (p.children) parts.push(`${p.children} ${p.children === 1 ? "child" : "children"}`);
  if (p.infants) parts.push(`${p.infants} ${p.infants === 1 ? "infant" : "infants"}`);
  return parts.join(", ");
}

export const cabinLabels: Record<string, string> = {
  economy: "Economy",
  premium_economy: "Premium economy",
  business: "Business",
  first: "First",
};

export function refundSummary(c: Conditions) {
  const status = c.refund ?? (c.refundable ? "allowed" : "not_allowed");
  if (status === "unknown") return "Refund rules not shared by the airline";
  if (status === "not_allowed") return "Non refundable";
  if (c.refundPenalty && c.refundPenalty.amount > 0) return `Refundable, ${formatMoney(c.refundPenalty)} fee`;
  return "Refundable without a fee";
}

export function changeSummary(c: Conditions) {
  const status = c.change ?? (c.changeable ? "allowed" : "not_allowed");
  if (status === "unknown") return "Change rules not shared by the airline";
  if (status === "not_allowed") return "No changes";
  if (c.changePenalty && c.changePenalty.amount > 0) return `Changes allowed, ${formatMoney(c.changePenalty)} fee plus any fare difference`;
  return "Changes allowed without a fee, plus any fare difference";
}

export function bagsSummary(c: Conditions) {
  const parts: string[] = [];
  if (c.cabinBags !== null && c.cabinBags !== undefined) parts.push(c.cabinBags ? `${c.cabinBags} cabin ${c.cabinBags === 1 ? "bag" : "bags"}` : "No cabin bag");
  if (c.checkedBags !== null && c.checkedBags !== undefined)
    parts.push(c.checkedBags ? `${c.checkedBags} checked ${c.checkedBags === 1 ? "bag" : "bags"}` : "No checked bag");
  return parts.length ? parts.join(", ") : "Baggage allowance not shared by the airline";
}

/** True when a refund is allowed with no penalty: shown in fern as good news. */
export function freeRefund(c: Conditions) {
  return (c.refund ?? (c.refundable ? "allowed" : "not_allowed")) === "allowed" && !(c.refundPenalty && c.refundPenalty.amount > 0);
}

export function offerCarriers(offer: Offer) {
  const names = new Map<string, string>();
  for (const s of offer.slices) for (const seg of s.segments) names.set(seg.marketingCarrier.iata, seg.marketingCarrier.name);
  return [...names.values()];
}

/** Last flight date, used for age and passport checks ("2026-11-27"). */
export function lastTravelDate(offer: Offer) {
  const last = offer.slices[offer.slices.length - 1];
  return (last?.segments[last.segments.length - 1]?.departAt ?? last?.departAt ?? "").slice(0, 10);
}
