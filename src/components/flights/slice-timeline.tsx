import { dayDiff, localClock } from "@/lib/flight-time";
import type { Slice } from "@/server/flights/types";
import { durationLabel, stopCities, stopsLabel } from "./format";

/**
 * One line of the timetable: departure time and airport, a route line with a dot for each stop,
 * arrival time with a "+1" marker when it lands on a later day, and the total duration.
 */
export function SliceTimeline({ slice, label }: { slice: Slice; label?: string }) {
  const days = dayDiff(slice.departAt, slice.arriveAt);
  const via = stopCities(slice);
  return (
    <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-4">
      <div className="text-left">
        {label && <p className="text-2xs text-slate">{label}</p>}
        <p className="tnum text-xl leading-tight font-extrabold">{localClock(slice.departAt)}</p>
        <p className="text-xs text-slate">
          <abbr title={slice.origin.name} className="no-underline">
            {slice.origin.iata}
          </abbr>
        </p>
      </div>

      <div className="min-w-0 px-1 text-center">
        <p className="tnum text-xs text-slate">{durationLabel(slice.durationMinutes)}</p>
        <div className="relative my-1.5 h-px bg-line-strong" aria-hidden="true">
          <span className="absolute top-1/2 left-0 size-1.5 -translate-y-1/2 rounded-full bg-ink" />
          {via.map((_, i) => (
            <span
              key={i}
              className="absolute top-1/2 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-ink bg-surface"
              style={{ left: `${((i + 1) / (via.length + 1)) * 100}%` }}
            />
          ))}
          <span className="absolute top-1/2 right-0 size-1.5 -translate-y-1/2 rounded-full bg-ink" />
        </div>
        <p className={`truncate text-xs ${slice.stops ? "text-ink" : "text-fern"}`}>
          {stopsLabel(slice.stops)}
          {via.length > 0 && <span className="text-slate"> via {via.join(", ")}</span>}
        </p>
      </div>

      <div className="text-right">
        {label && <p className="text-2xs text-transparent select-none" aria-hidden="true">{label}</p>}
        <p className="tnum text-xl leading-tight font-extrabold">
          {localClock(slice.arriveAt)}
          {days > 0 && (
            <sup className="ml-0.5 text-2xs font-bold text-ink">
              +{days}
              <span className="sr-only"> {days === 1 ? "day" : "days"}</span>
            </sup>
          )}
        </p>
        <p className="text-xs text-slate">
          <abbr title={slice.destination.name} className="no-underline">
            {slice.destination.iata}
          </abbr>
        </p>
      </div>
    </div>
  );
}
