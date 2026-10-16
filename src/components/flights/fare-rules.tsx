import type { Conditions } from "@/server/flights/types";
import { bagsSummary, changeSummary, freeRefund, refundSummary } from "./format";

/** Refund, change and baggage rules as a definition list. Rules apply before departure. */
export function FareRules({ conditions }: { conditions: Conditions }) {
  return (
    <dl className="grid grid-cols-[8rem_minmax(0,1fr)] gap-x-4 gap-y-2 text-sm">
      <dt className="text-slate">Cancel</dt>
      <dd className={freeRefund(conditions) ? "text-fern" : undefined}>{refundSummary(conditions)}</dd>
      <dt className="text-slate">Change</dt>
      <dd>{changeSummary(conditions)}</dd>
      <dt className="text-slate">Baggage</dt>
      <dd>{bagsSummary(conditions)} per traveler</dd>
    </dl>
  );
}
