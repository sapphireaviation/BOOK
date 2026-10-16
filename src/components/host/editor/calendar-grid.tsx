"use client";

import Link from "next/link";
import { useState } from "react";
import { updateCalendar } from "@/app/host/actions";
import { Button, cn } from "@/components/ui";
import { ActionForm, MoneyField, SubmitButton, TextField } from "../form";

export type CalendarCell = {
  date: string;
  day: number;
  weekday: number; // 0 Monday ... 6 Sunday
  priceLabel: string;
  priceOverridden: boolean;
  total: number;
  booked: number;
  left: number;
  closed: boolean;
  past: boolean;
};

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function fmt(date: string) {
  const [y, m, d] = date.split("-").map(Number);
  return new Intl.DateTimeFormat("en-IN", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(Date.UTC(y, m - 1, d)));
}

export function CalendarGrid({
  listingId,
  unitId,
  currency,
  monthLabel,
  prevHref,
  nextHref,
  cells,
  basePriceLabel,
  quantity,
}: {
  listingId: string;
  unitId: string;
  currency: string;
  monthLabel: string;
  prevHref: string | null;
  nextHref: string;
  cells: CalendarCell[];
  basePriceLabel: string;
  quantity: number;
}) {
  const [start, setStart] = useState<string | null>(null);
  const [end, setEnd] = useState<string | null>(null);

  const from = start && end ? (start < end ? start : end) : start;
  const to = start && end ? (start < end ? end : start) : start;
  const inRange = (d: string) => Boolean(from && to && d >= from && d <= to);

  function choose(date: string) {
    if (!start || (start && end)) {
      setStart(date);
      setEnd(null);
    } else setEnd(date);
  }

  const lead = cells[0]?.weekday ?? 0;
  const selectedCount = from && to ? cells.filter((c) => inRange(c.date)).length : 0;
  const booked = from && to ? cells.filter((c) => inRange(c.date) && c.booked > 0).length : 0;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_19rem]">
      <div className="min-w-0">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-lg">{monthLabel}</h2>
          <div className="flex gap-2">
            {prevHref ? (
              <Link href={prevHref} className="rounded-md border border-line-strong bg-surface px-3 py-1.5 text-sm font-semibold hover:border-ink">
                Previous month
              </Link>
            ) : (
              <span className="rounded-md border border-line px-3 py-1.5 text-sm font-semibold text-slate/60" aria-disabled="true">
                Previous month
              </span>
            )}
            <Link href={nextHref} className="rounded-md border border-line-strong bg-surface px-3 py-1.5 text-sm font-semibold hover:border-ink">
              Next month
            </Link>
          </div>
        </div>
        <p id="cal-help" className="mb-3 text-sm text-slate">
          Click a first and a last date to select a range, then change it on the right. Prices are for one night.
        </p>
        <div role="group" aria-label={`${monthLabel} calendar`} className="overflow-hidden rounded-md border border-line bg-surface">
          <div aria-hidden="true" className="grid grid-cols-7 border-b border-line bg-mist/60">
            {WEEKDAYS.map((w) => (
              <div key={w} className="px-2 py-1.5 text-xs font-semibold text-slate">
                {w}
              </div>
            ))}
          </div>
          <div className="-mr-px -mb-px grid grid-cols-7">
            {Array.from({ length: lead }, (_, i) => (
              <div key={`lead-${i}`} aria-hidden="true" className="min-h-20 border-b border-r border-line bg-paper" />
            ))}
            {cells.map((c) => {
              const selected = inRange(c.date);
              const edge = c.date === from || c.date === to;
              return (
                <div key={c.date} className="border-b border-r border-line">
                  <button
                    type="button"
                    disabled={c.past}
                    aria-pressed={selected}
                    aria-describedby="cal-help"
                    onClick={() => choose(c.date)}
                    aria-label={`${fmt(c.date)}. ${c.closed ? "Closed" : `${c.left} of ${c.total} left`}. ${c.priceLabel}${c.priceOverridden ? ", custom price" : ""}${c.booked ? `. ${c.booked} booked` : ""}`}
                    className={cn(
                      "flex h-full min-h-20 w-full flex-col items-start gap-0.5 px-1.5 py-1 text-left text-xs transition-colors duration-150 sm:px-2",
                      c.past && "cursor-not-allowed bg-paper text-slate/60",
                      !c.past && !selected && "hover:bg-mist",
                      !c.past && c.closed && !selected && "bg-signal-wash",
                      selected && (edge ? "bg-runway text-ink" : "bg-runway/40 text-ink"),
                    )}
                  >
                    <span className="tnum text-sm font-bold">{c.day}</span>
                    {c.closed ? (
                      <span className="font-semibold text-signal">Closed</span>
                    ) : (
                      <span className={cn("tnum", c.priceOverridden ? "font-bold text-sapphire" : "text-ink")}>{c.priceLabel}</span>
                    )}
                    <span className="tnum hidden text-slate sm:inline">{c.closed ? "" : `${c.left} of ${c.total} left`}</span>
                    {c.booked > 0 && <span className="tnum font-semibold text-fern">{c.booked} booked</span>}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
        <p className="mt-3 text-xs text-slate">
          Base price {basePriceLabel} a night, {quantity} {quantity === 1 ? "room" : "rooms"}. Prices in <span className="font-bold text-sapphire">blue</span> are custom for that date.
          Booked nights stay booked whatever you change here.
        </p>
      </div>

      <aside className="space-y-4 self-start lg:sticky lg:top-20">
        {!from ? (
          <div className="rounded-md border border-line bg-surface p-4 text-sm text-slate">Select dates on the calendar to change their price or close them.</div>
        ) : (
          <div className="rounded-md border border-line bg-surface">
            <div className="border-b border-line p-4">
              <p className="text-sm font-semibold">{from === to || !end ? fmt(from) : `${fmt(from!)} to ${fmt(to!)}`}</p>
              <p className="text-xs text-slate">
                {end ? `${selectedCount} ${selectedCount === 1 ? "night" : "nights"} selected` : "Click another date to select a range, or change this one night."}
                {booked > 0 && `. ${booked} with bookings.`}
              </p>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="mt-2 -ml-2"
                onClick={() => {
                  setStart(null);
                  setEnd(null);
                }}
              >
                Clear selection
              </Button>
            </div>
            <RangeAction listingId={listingId} unitId={unitId} currency={currency} from={from} to={to ?? from} />
          </div>
        )}
      </aside>
    </div>
  );
}

function RangeAction({ listingId, unitId, currency, from, to }: { listingId: string; unitId: string; currency: string; from: string; to: string }) {
  const action = updateCalendar.bind(null, listingId, unitId, currency);
  const hidden = (
    <>
      <input type="hidden" name="from" value={from} />
      <input type="hidden" name="to" value={to} />
    </>
  );
  return (
    <div className="divide-y divide-line">
      <ActionForm action={action} aria-label="Set price" className="p-4">
        {hidden}
        <input type="hidden" name="kind" value="price" />
        <MoneyField name="price" label="Price a night" currency={currency} />
        <div className="mt-3 flex flex-wrap gap-2">
          <SubmitButton size="sm" pendingLabel="Setting price">
            Set price
          </SubmitButton>
        </div>
      </ActionForm>
      <ActionForm action={action} aria-label="Reset price" className="p-4">
        {hidden}
        <input type="hidden" name="kind" value="reset_price" />
        <SubmitButton size="sm" variant="secondary" pendingLabel="Resetting price">
          Reset to base price
        </SubmitButton>
      </ActionForm>
      <div className="grid grid-cols-2 gap-0 divide-x divide-line">
        <ActionForm action={action} aria-label="Close dates" className="p-4">
          {hidden}
          <input type="hidden" name="kind" value="close" />
          <SubmitButton size="sm" variant="secondary" pendingLabel="Closing">
            Close dates
          </SubmitButton>
        </ActionForm>
        <ActionForm action={action} aria-label="Reopen dates" className="p-4">
          {hidden}
          <input type="hidden" name="kind" value="open" />
          <SubmitButton size="sm" variant="secondary" pendingLabel="Reopening">
            Reopen dates
          </SubmitButton>
        </ActionForm>
      </div>
      <ActionForm action={action} aria-label="Rooms available" className="p-4">
        {hidden}
        <input type="hidden" name="kind" value="total" />
        <TextField name="total" label="Rooms available" type="number" min={0} max={1000} hint="Leave empty to use the number of identical rooms." />
        <div className="mt-3">
          <SubmitButton size="sm" variant="secondary" pendingLabel="Setting rooms">
            Set rooms
          </SubmitButton>
        </div>
      </ActionForm>
    </div>
  );
}
