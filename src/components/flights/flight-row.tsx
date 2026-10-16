import Link from "next/link";
import { buttonClass } from "@/components/ui";
import { formatMoney } from "@/lib/money";
import type { Offer } from "@/server/flights/types";
import { AirlineMark } from "./airline-mark";
import { FareRules } from "./fare-rules";
import { bagsSummary, freeRefund, offerCarriers, refundSummary } from "./format";
import { SliceItinerary } from "./itinerary";
import { SliceTimeline } from "./slice-timeline";

/**
 * A timetable row: airline, times and route line per slice, conditions in one line, price and
 * select on the right. "Flight details" expands segments, layovers, baggage and rules without JavaScript.
 */
export function FlightRow({ offer, travelers }: { offer: Offer; travelers: number }) {
  const carriers = offerCarriers(offer);
  const isReturn = offer.slices.length > 1;
  const detailsId = `details-${offer.id.replace(/[^A-Za-z0-9_-]/g, "")}`.slice(0, 80);
  const href = `/flights/offer/${encodeURIComponent(offer.id)}`;
  const route = `${offer.slices[0].origin.city} to ${offer.slices[0].destination.city}`;

  return (
    <li className="border-b border-line py-5" aria-labelledby={`${detailsId}-title`}>
      <div className="grid gap-4 md:grid-cols-[11rem_minmax(0,1fr)_10rem] md:items-center md:gap-6">
        <div className="flex items-center gap-3">
          <AirlineMark carrier={offer.owner} />
          <div className="min-w-0">
            <p id={`${detailsId}-title`} className="truncate text-sm font-semibold">
              {offer.owner.name}
              <span className="sr-only">, {route}, {formatMoney({ amount: offer.total, currency: offer.currency })}</span>
            </p>
            {carriers.length > 1 && <p className="truncate text-2xs text-slate">with {carriers.filter((c) => c !== offer.owner.name).join(", ")}</p>}
          </div>
        </div>

        <div className="space-y-4">
          {offer.slices.map((slice, i) => (
            <SliceTimeline key={slice.id} slice={slice} label={isReturn ? (i === 0 ? "Outbound" : "Return") : undefined} />
          ))}
          <p className="text-xs text-slate">
            <span className={freeRefund(offer.conditions) ? "text-fern" : undefined}>{refundSummary(offer.conditions)}</span>
            <span aria-hidden="true">, </span>
            <span>{bagsSummary(offer.conditions).toLowerCase()}</span>
          </p>
        </div>

        <div className="flex items-center justify-between gap-4 border-t border-line pt-3 md:flex-col md:items-end md:border-0 md:pt-0">
          <div className="md:text-right">
            <p className="tnum text-xl font-extrabold">{formatMoney({ amount: offer.total, currency: offer.currency })}</p>
            <p className="text-2xs text-slate">
              {isReturn ? "Return" : "One way"}, {travelers === 1 ? "1 traveler" : `${travelers} travelers`}
            </p>
          </div>
          <Link href={href} prefetch={false} className={buttonClass({ size: "sm" })} aria-label={`Select ${offer.owner.name}, ${route}`}>
            Select
          </Link>
        </div>
      </div>

      <details className="group mt-3">
        <summary className="inline-flex min-h-10 cursor-pointer list-none items-center gap-1 rounded-sm text-sm font-semibold text-sapphire hover:text-sapphire-deep [&::-webkit-details-marker]:hidden">
          <svg viewBox="0 0 16 16" className="size-4 transition-transform duration-150 group-open:rotate-90" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M6 4l4 4-4 4" />
          </svg>
          Flight details, baggage and rules
        </summary>
        <div className="mt-3 grid gap-6 rounded-md border border-line bg-surface p-4 md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          <div className="space-y-5">
            {offer.slices.map((slice, i) => (
              <SliceItinerary key={slice.id} slice={slice} heading={isReturn ? (i === 0 ? "Outbound" : "Return") : "Flight"} />
            ))}
          </div>
          <div>
            <h3 className="text-base">Fare rules</h3>
            <p className="mb-3 text-xs text-slate">Set by {offer.owner.name}. Fees apply per traveler, before departure.</p>
            <FareRules conditions={offer.conditions} />
          </div>
        </div>
      </details>
    </li>
  );
}
