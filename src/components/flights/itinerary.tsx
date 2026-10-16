import { formatDay } from "@/lib/dates";
import { dayDiff, localClock, localDate, minutesBetween } from "@/lib/flight-time";
import type { Segment, Slice } from "@/server/flights/types";
import { durationLabel, stopsLabel } from "./format";

function SegmentBlock({ seg }: { seg: Segment }) {
  const operatedBy = seg.operatingCarrier.iata !== seg.marketingCarrier.iata ? seg.operatingCarrier.name : null;
  const days = dayDiff(seg.departAt, seg.arriveAt);
  const bags = seg.baggage;
  return (
    <li className="grid grid-cols-[3.5rem_minmax(0,1fr)] gap-x-3 py-3">
      <p className="tnum font-bold">{localClock(seg.departAt)}</p>
      <p>
        {seg.origin.city} ({seg.origin.iata})<span className="text-slate">, {seg.origin.name}</span>
        {seg.origin.terminal && <span className="text-slate">, terminal {seg.origin.terminal}</span>}
      </p>

      <p className="tnum text-xs text-slate">{durationLabel(seg.durationMinutes)}</p>
      <div className="border-l-2 border-line py-1 pl-3 text-xs text-slate">
        <p>
          <span className="font-semibold text-ink">{seg.flightNumber}</span> {seg.marketingCarrier.name}
          {operatedBy && <>, operated by {operatedBy}</>}
        </p>
        {(seg.aircraft || seg.cabin) && <p>{[seg.cabin, seg.aircraft].filter(Boolean).join(", ")}</p>}
        {bags && (bags.checked !== null || bags.cabin !== null) && (
          <p>
            Included: {bags.cabin ?? 0} cabin, {bags.checked ?? 0} checked {bags.checked === 1 ? "bag" : "bags"}
          </p>
        )}
        {seg.technicalStops && seg.technicalStops.length > 0 && (
          <p>Stops briefly in {seg.technicalStops.map((s) => `${s.city} (${s.iata})`).join(", ")} without changing planes</p>
        )}
      </div>

      <p className="tnum font-bold">
        {localClock(seg.arriveAt)}
        {days > 0 && <sup className="ml-0.5 text-2xs text-signal">+{days}</sup>}
      </p>
      <p>
        {seg.destination.city} ({seg.destination.iata})<span className="text-slate">, {seg.destination.name}</span>
        {seg.destination.terminal && <span className="text-slate">, terminal {seg.destination.terminal}</span>}
      </p>
    </li>
  );
}

/** Full segment by segment itinerary of one slice, with layovers between segments. */
export function SliceItinerary({ slice, heading }: { slice: Slice; heading: string }) {
  return (
    <section aria-label={heading}>
      <h3 className="text-base">
        {heading}: {slice.origin.city} to {slice.destination.city}
      </h3>
      <p className="text-xs text-slate">
        {formatDay(localDate(slice.departAt))}, {stopsLabel(slice.stops).toLowerCase()}, {durationLabel(slice.durationMinutes)} in total
        {slice.fareBrand ? `, ${slice.fareBrand} fare` : ""}
      </p>
      <ol className="mt-1">
        {slice.segments.map((seg, i) => {
          const next = slice.segments[i + 1];
          const layover = next ? minutesBetween(seg.arriveAt, seg.destination.timeZone, next.departAt, next.origin.timeZone) : 0;
          const terminalChange = next && seg.destination.terminal && next.origin.terminal && seg.destination.terminal !== next.origin.terminal;
          const airportChange = next && seg.destination.iata !== next.origin.iata;
          return [
            <SegmentBlock key={seg.id} seg={seg} />,
            next && (
              <li key={`${seg.id}-layover`} className="my-1 rounded-sm bg-mist px-3 py-2 text-xs">
                <span className="tnum font-semibold">{durationLabel(layover)}</span> layover in {seg.destination.city} ({seg.destination.iata})
                {airportChange && <span className="font-semibold text-signal">. You change airports to {next.origin.iata}</span>}
                {!airportChange && terminalChange && <span>. You change terminals</span>}
              </li>
            ),
          ];
        })}
      </ol>
    </section>
  );
}
