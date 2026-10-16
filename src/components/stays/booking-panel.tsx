"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useId, useMemo, useRef, useState, useTransition } from "react";
import { quoteAction, type QuoteResult } from "@/app/(site)/stays/actions";
import { stayLimits } from "@/components/search/limits";
import { BarField, PanelFooter, Steppers, usePickers } from "@/components/search/parts";
import { summarizeGuests } from "@/components/search/serialize";
import { useToday } from "@/components/search/use-today";
import { buttonClass, PriceBreakdown, Select, Skeleton } from "@/components/ui";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { Popover } from "@/components/ui/popover";
import { formatShortDay, type DateRange } from "@/lib/calendar";
import { isISODate, nightsBetween } from "@/lib/dates";
import { formatMoney } from "@/lib/money";

export type PanelUnit = { id: string; name: string; maxGuests: number; basePrice: number; quantity: number };

type Props = {
  listingId: string;
  units: PanelUnit[];
  currency: string;
  fromPrice: number;
  minNights: number;
  maxNights: number;
  cancellationPolicy: string;
  checkInTime: string;
  instantBook: boolean;
  bookPath: string;
};

type Picker = "checkin" | "checkout" | "guests";

function intParam(v: string | null, min: number, max: number, dflt: number) {
  const n = Number(v);
  return Number.isInteger(n) && n >= min && n <= max ? n : dflt;
}

/** The sticky panel on a listing page: dates, guests and rooms in, a server-computed price out. */
export function BookingPanel(props: Props) {
  const sp = useSearchParams();
  const id = useId();
  // Read on the client only, so the server render is the same for every visitor.
  const today = useToday();
  const pickers = usePickers<Picker>();
  const [checkIn, setCheckIn] = useState(() => (isISODate(sp.get("checkin")) ? sp.get("checkin")! : ""));
  const [checkOut, setCheckOut] = useState(() => (isISODate(sp.get("checkout")) ? sp.get("checkout")! : ""));
  const [adults, setAdults] = useState(() => intParam(sp.get("adults"), 1, 16, 2));
  const [children, setChildren] = useState(() => intParam(sp.get("children"), 0, 10, 0));
  const [rooms, setRooms] = useState(() => intParam(sp.get("units") ?? sp.get("rooms"), 1, 8, 1));
  const [unitId, setUnitId] = useState(() => {
    const fromUrl = sp.get("unit");
    const party = intParam(sp.get("adults"), 1, 16, 2) + intParam(sp.get("children"), 0, 10, 0);
    const rooms0 = intParam(sp.get("units") ?? sp.get("rooms"), 1, 8, 1);
    const fitting = [...props.units].filter((u) => u.maxGuests * rooms0 >= party).sort((a, b) => a.basePrice - b.basePrice)[0];
    return props.units.find((u) => u.id === fromUrl)?.id ?? fitting?.id ?? props.units[0]?.id ?? "";
  });
  const [result, setResult] = useState<{ key: string; value: QuoteResult } | null>(null);
  const [pending, startTransition] = useTransition();
  const request = useRef(0);

  const unit = props.units.find((u) => u.id === unitId);
  const guests = adults + children;
  const datesReady = isISODate(checkIn) && isISODate(checkOut) && checkOut > checkIn;
  const nights = datesReady ? nightsBetween(checkIn, checkOut) : 0;

  const inputKey = [unitId, checkIn, checkOut, adults, children, rooms].join("|");
  const current = datesReady && result?.key === inputKey ? result.value : null;

  useEffect(() => {
    if (!datesReady || !unitId) return;
    const n = ++request.current;
    startTransition(async () => {
      const r = await quoteAction({
        listingId: props.listingId,
        unitId,
        checkIn,
        checkOut,
        adults,
        children,
        units: rooms,
        cancellationPolicy: props.cancellationPolicy,
        checkInTime: props.checkInTime,
      });
      if (n === request.current) setResult({ key: inputKey, value: r });
    });
  }, [inputKey, datesReady, unitId, checkIn, checkOut, adults, children, rooms, props.listingId, props.cancellationPolicy, props.checkInTime]);

  // When the party outgrows the chosen room, switch to the cheapest room type that fits.
  function pickFittingUnit(nextGuests: number, nextRooms: number) {
    if (unit && unit.maxGuests * nextRooms >= nextGuests) return;
    const fit = props.units.filter((u) => u.maxGuests * nextRooms >= nextGuests).sort((a, b) => a.basePrice - b.basePrice)[0];
    if (fit) setUnitId(fit.id);
  }

  const reserveHref = useMemo(() => {
    const q = new URLSearchParams({ unit: unitId, checkin: checkIn, checkout: checkOut, adults: String(adults), children: String(children), units: String(rooms) });
    return `${props.bookPath}?${q}`;
  }, [unitId, checkIn, checkOut, adults, children, rooms, props.bookPath]);

  const quote = current?.quote;
  const maxRooms = Math.max(1, Math.min(8, unit?.quantity ?? 1, adults));
  const showRooms = (unit?.quantity ?? 1) > 1;
  const range: DateRange = { start: checkIn || undefined, end: checkOut || undefined };
  const guestText = showRooms ? summarizeGuests({ adults, children, rooms }) : summarizeGuests({ adults, children, rooms: 1 }).replace(/, 1 room$/, "");

  function onDates(value: DateRange, { done }: { done: boolean }) {
    setCheckIn(value.start ?? "");
    setCheckOut(value.end ?? "");
    if (done) pickers.close();
  }

  function onGuests(key: string, v: number) {
    if (key === "adults") {
      setAdults(v);
      if (rooms > v) setRooms(v);
      pickFittingUnit(v + children, Math.min(rooms, v));
    } else if (key === "children") {
      setChildren(v);
      pickFittingUnit(adults + v, rooms);
    } else {
      setRooms(v);
      pickFittingUnit(guests, v);
    }
  }

  return (
    <section aria-labelledby={`${id}-title`} className="rounded-md border border-line bg-surface p-5 shadow-[var(--shadow-float)]">
      <h2 id={`${id}-title`} className="text-lg">
        <span className="tnum">{formatMoney({ amount: props.fromPrice, currency: props.currency })}</span>{" "}
        <span className="text-sm font-semibold text-slate">a night before taxes</span>
      </h2>
      {props.instantBook && <p className="mt-1 text-sm text-slate">Instant book: confirmed as soon as you pay.</p>}

      <div className="mt-4 grid grid-cols-2 gap-2">
        <BarField
          ref={pickers.anchor("checkin")}
          label="Check in"
          value={checkIn ? formatShortDay(checkIn) : null}
          placeholder="Add date"
          expanded={pickers.open === "checkin"}
          onClick={() => pickers.toggle("checkin")}
          className="min-h-12"
        />
        <BarField
          ref={pickers.anchor("checkout")}
          label="Check out"
          value={checkOut ? formatShortDay(checkOut) : null}
          placeholder="Add date"
          expanded={pickers.open === "checkout"}
          onClick={() => pickers.toggle("checkout")}
          className="min-h-12"
        />
        <BarField
          ref={pickers.anchor("guests")}
          label="Guests"
          value={guestText}
          placeholder=""
          expanded={pickers.open === "guests"}
          onClick={() => pickers.toggle("guests")}
          className="col-span-2 min-h-12"
        />
        {props.units.length > 1 && (
          <label className="col-span-2 mt-2 text-sm font-semibold">
            Room
            <Select className="mt-1.5" value={unitId} onChange={(e) => setUnitId(e.target.value)}>
              {props.units.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}, sleeps {u.maxGuests}
                </option>
              ))}
            </Select>
          </label>
        )}
      </div>

      {(["checkin", "checkout"] as const).map((which) => (
        <Popover key={which} open={pickers.open === which} onClose={pickers.close} anchorRef={pickers.anchor(which)} label="Stay dates">
          {today && (
            <DateRangePicker
              mode="range"
              value={range}
              editing={which === "checkout" ? "end" : "start"}
              onChange={onDates}
              min={today}
              minGap={1}
              startMarker="In"
              endMarker="Out"
              prompts={{
                start: "Choose a check in date",
                end: props.minNights > 1 ? `Choose a check out date, at least ${props.minNights} nights later` : "Choose a check out date",
              }}
              summary={
                datesReady
                  ? `${formatShortDay(checkIn)} to ${formatShortDay(checkOut)}, ${nights} ${nights === 1 ? "night" : "nights"}`
                  : checkIn
                    ? `Check in ${formatShortDay(checkIn)}`
                    : null
              }
              onDone={pickers.close}
            />
          )}
        </Popover>
      ))}
      <Popover open={pickers.open === "guests"} onClose={pickers.close} anchorRef={pickers.anchor("guests")} label="Guests and rooms" className="sm:w-96">
        <div className="p-4 sm:p-5">
          <Steppers
            rows={[
              { key: "adults", label: "Adults", hint: "13 or older", value: adults, ...stayLimits.adults },
              { key: "children", label: "Children", hint: "Under 13", value: children, ...stayLimits.children },
              ...(showRooms
                ? [
                    {
                      key: "rooms",
                      label: "Rooms",
                      value: rooms,
                      min: 1,
                      max: maxRooms,
                      limitNote: maxRooms === adults && adults < Math.min(8, unit?.quantity ?? 1) ? "Each room needs at least one adult" : undefined,
                    },
                  ]
                : []),
            ]}
            onChange={onGuests}
          />
          <div className="mt-2">
            <PanelFooter onDone={pickers.close}>{guestText}</PanelFooter>
          </div>
        </div>
      </Popover>

      <div className="mt-5" aria-live="polite" aria-busy={pending || undefined}>
        {!datesReady ? (
          <p className="text-sm text-slate">
            Add your dates to see the total.{props.minNights > 1 ? ` The minimum stay is ${props.minNights} nights.` : ""}
          </p>
        ) : !quote ? (
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-5 w-full" />
          </div>
        ) : quote.available ? (
          <>
            <p className="mb-3 text-sm text-slate">
              {formatShortDay(checkIn)} to {formatShortDay(checkOut)}, {nights} {nights === 1 ? "night" : "nights"}, {guests} {guests === 1 ? "guest" : "guests"}
            </p>
            <PriceBreakdown lines={quote.lines} currency={quote.currency} total={quote.total} className={pending ? "opacity-60" : undefined} />
            <Link href={reserveHref} className={buttonClass({ size: "lg", className: "mt-5 w-full" })}>
              Reserve
            </Link>
            <p className="mt-2 text-center text-xs text-slate">You will not be charged until the next step.</p>
            {current?.policySteps && (
              <ul className="mt-4 space-y-1 border-t border-line pt-3 text-sm">
                {current.policySteps.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            )}
          </>
        ) : (
          <p role="alert" className="rounded-md border border-signal/30 bg-signal-wash px-3 py-2 text-sm">
            {quote.reason}
          </p>
        )}
      </div>
      <p className="mt-4 text-xs text-slate">Maximum stay {props.maxNights} nights.</p>
    </section>
  );
}
