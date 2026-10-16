"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useId, useMemo, useRef, useState, useSyncExternalStore, useTransition } from "react";
import { quoteAction, type QuoteResult } from "@/app/(site)/stays/actions";
import { buttonClass, inputClass, PriceBreakdown, Select, Skeleton } from "@/components/ui";
import { addDays, isISODate, nightsBetween } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { dayLabel } from "./format";

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

const noopSubscribe = () => () => {};
const todayISO = () => new Date().toISOString().slice(0, 10);

function intParam(v: string | null, min: number, max: number, dflt: number) {
  const n = Number(v);
  return Number.isInteger(n) && n >= min && n <= max ? n : dflt;
}

/** The sticky panel on a listing page: dates, guests and rooms in, a server-computed price out. */
export function BookingPanel(props: Props) {
  const sp = useSearchParams();
  const id = useId();
  // Read on the client only, so the server render is the same for every visitor.
  const today = useSyncExternalStore(noopSubscribe, todayISO, () => null);
  const [checkIn, setCheckIn] = useState(() => (isISODate(sp.get("checkin")) ? sp.get("checkin")! : ""));
  const [checkOut, setCheckOut] = useState(() => (isISODate(sp.get("checkout")) ? sp.get("checkout")! : ""));
  const [adults, setAdults] = useState(() => intParam(sp.get("adults"), 1, 16, 2));
  const [children, setChildren] = useState(() => intParam(sp.get("children"), 0, 10, 0));
  const [rooms, setRooms] = useState(() => intParam(sp.get("units") ?? sp.get("rooms"), 1, 8, 1));
  const [unitId, setUnitId] = useState(() => {
    const fromUrl = sp.get("unit");
    return props.units.find((u) => u.id === fromUrl)?.id ?? props.units[0]?.id ?? "";
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

  return (
    <section aria-labelledby={`${id}-title`} className="rounded-md border border-line bg-surface p-5 shadow-[var(--shadow-float)]">
      <h2 id={`${id}-title`} className="text-lg">
        <span className="tnum">{formatMoney({ amount: props.fromPrice, currency: props.currency })}</span>{" "}
        <span className="text-sm font-semibold text-slate">a night before taxes</span>
      </h2>
      {props.instantBook && <p className="mt-1 text-sm text-slate">Instant book: confirmed as soon as you pay.</p>}

      <div className="mt-4 grid grid-cols-2 gap-3">
        <label className="text-sm font-semibold">
          Check in
          <input
            type="date"
            className={`${inputClass} mt-1.5 px-2`}
            value={checkIn}
            min={today ?? undefined}
            onChange={(e) => {
              const v = e.target.value;
              setCheckIn(v);
              if (isISODate(v) && (!isISODate(checkOut) || checkOut <= v)) setCheckOut(addDays(v, Math.max(1, props.minNights)));
            }}
          />
        </label>
        <label className="text-sm font-semibold">
          Check out
          <input
            type="date"
            className={`${inputClass} mt-1.5 px-2`}
            value={checkOut}
            min={isISODate(checkIn) ? addDays(checkIn, 1) : (today ?? undefined)}
            onChange={(e) => setCheckOut(e.target.value)}
          />
        </label>
        <label className="text-sm font-semibold">
          Adults
          <Select className="mt-1.5" value={adults} onChange={(e) => { const v = Number(e.target.value); setAdults(v); if (rooms > v) setRooms(v); pickFittingUnit(v + children, Math.min(rooms, v)); }}>
            {Array.from({ length: 16 }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </Select>
        </label>
        <label className="text-sm font-semibold">
          Children
          <Select className="mt-1.5" value={children} onChange={(e) => { const v = Number(e.target.value); setChildren(v); pickFittingUnit(adults + v, rooms); }}>
            {Array.from({ length: 11 }, (_, i) => i).map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </Select>
        </label>
        {props.units.length > 1 && (
          <label className="col-span-2 text-sm font-semibold">
            Room
            <Select className="mt-1.5" value={unitId} onChange={(e) => setUnitId(e.target.value)}>
              {props.units.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}, sleeps {u.maxGuests}, from {formatMoney({ amount: u.basePrice, currency: props.currency })}
                </option>
              ))}
            </Select>
          </label>
        )}
        {(unit?.quantity ?? 1) > 1 && (
          <label className="col-span-2 text-sm font-semibold">
            Rooms
            <Select className="mt-1.5" value={rooms} onChange={(e) => { const v = Number(e.target.value); setRooms(v); pickFittingUnit(guests, v); }}>
              {Array.from({ length: maxRooms }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </Select>
          </label>
        )}
      </div>

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
              {dayLabel(checkIn)} to {dayLabel(checkOut)}, {nights} {nights === 1 ? "night" : "nights"}, {guests} {guests === 1 ? "guest" : "guests"}
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
