"use client";

import Form from "next/form";
import { useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Combobox, HighlightMatch } from "@/components/ui/combobox";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { Popover } from "@/components/ui/popover";
import { formatShortDay, suggestedTrip, type DateRange } from "@/lib/calendar";
import { nightsBetween } from "@/lib/dates";
import type { StaySearch } from "@/lib/search-params";
import { stayLimits } from "./limits";
import { BarField, ErrorList, PanelFooter, Steppers, Token, usePickers } from "./parts";
import { serializeStaySearch, summarizeGuests, titleFromSlug, validateStaySearch, type StayField, type StayFormState } from "./serialize";
import { findPlace, suggestPlaces, type PlaceSuggestion } from "./suggest";
import { useToday } from "./use-today";

type Place = { value: string; label: string };
type Picker = "place" | "checkin" | "checkout" | "guests";
type PlaceOption = PlaceSuggestion & { freeText?: boolean };

const fieldOrder: StayField[] = ["place", "checkin", "checkout", "adults", "children", "rooms"];
const pickerFor: Record<StayField, Picker> = {
  place: "place",
  checkin: "checkin",
  checkout: "checkout",
  adults: "guests",
  children: "guests",
  rooms: "guests",
};

/**
 * Stay search. `hero` is the sentence on the home and /stays pages; `bar` is the compact row above
 * results. Both submit GET to /stays/search with the params in src/lib/search-params.ts.
 */
export function StaySearchForm({ initial, layout = "bar" }: { initial?: Partial<StaySearch>; layout?: "hero" | "bar" }) {
  const id = useId();
  const today = useToday();
  const pickers = usePickers<Picker>();

  const [place, setPlace] = useState<Place | undefined>(initial?.place ? { value: initial.place, label: titleFromSlug(initial.place) } : undefined);
  const [dates, setDates] = useState<DateRange | null>(initial?.checkin ? { start: initial.checkin, end: initial.checkout } : null);
  const [guests, setGuests] = useState({ adults: initial?.adults ?? 2, children: initial?.children ?? 0, rooms: initial?.rooms ?? 1 });
  const [showErrors, setShowErrors] = useState(false);

  // A search that arrives as a slug (place=north-goa) gets its proper name when the places list answers.
  useEffect(() => {
    if (!initial?.place) return;
    const ctrl = new AbortController();
    findPlace(initial.place, ctrl.signal)
      .then((p) => p && setPlace((cur) => (cur?.value === p.slug ? { value: p.slug, label: p.name } : cur)))
      .catch(() => {});
    return () => ctrl.abort();
  }, [initial?.place]);

  const suggestion = today ? suggestedTrip(today) : null;
  const range: DateRange = dates ?? suggestion ?? {};

  const state: StayFormState = { place: place?.value, checkin: range.start, checkout: range.end, ...guests };
  const validation = validateStaySearch(state, today ?? undefined);
  const errors = showErrors && !validation.ok ? validation.errors : {};
  const errorList = fieldOrder.filter((f) => errors[f]).map((f) => [f, errors[f]!] as [string, string]);
  const errorId = (field: string) => `${id}-error-${field}`;
  const guestError = errors.adults ?? errors.children ?? errors.rooms;
  const guestErrorField = errors.adults ? "adults" : errors.children ? "children" : "rooms";

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    pickers.close();
    if (validation.ok) return;
    e.preventDefault();
    setShowErrors(true);
    const first = fieldOrder.find((f) => validation.errors[f]);
    if (first) pickers.anchor(pickerFor[first]).current?.focus();
  };

  const onDates = (value: DateRange, { done }: { done: boolean }) => {
    setDates(value);
    if (done) pickers.close();
  };

  const checkinText = range.start ? formatShortDay(range.start) : null;
  const checkoutText = range.end ? formatShortDay(range.end) : null;
  const nights = range.start && range.end ? nightsBetween(range.start, range.end) : 0;
  const guestText = summarizeGuests(guests);
  const placeInputRef = useRef<HTMLInputElement>(null);

  const hidden = serializeStaySearch(state).map(([name, value]) => <input key={name} type="hidden" name={name} value={value} />);

  const popovers = (
    <>
      <Popover
        open={pickers.open === "place"}
        onClose={pickers.close}
        anchorRef={pickers.anchor("place")}
        label="Where to"
        initialFocusRef={placeInputRef}
        className="sm:w-[26rem]"
      >
        <div className="p-4 sm:p-5">
          <Combobox<PlaceOption>
            label="Where to"
            placeholder="Town, city or region"
            inputRef={placeInputRef}
            fetchOptions={suggestPlaces}
            getKey={(p) => (p.freeText ? `free:${p.name}` : p.slug)}
            getText={(p) => p.name}
            extraOption={(q) => ({ slug: q, name: q, countryName: "", freeText: true })}
            renderOption={(p, q) =>
              p.freeText ? (
                <span className="block">
                  <span className="font-semibold">Search for &quot;{p.name}&quot;</span>
                  <span className="block text-sm text-slate">We will look for stays matching what you typed</span>
                </span>
              ) : (
                <span className="flex items-baseline justify-between gap-4">
                  <span className="min-w-0">
                    <span className="block font-semibold">
                      <HighlightMatch text={p.name} query={q} />
                    </span>
                    <span className="block truncate text-sm text-slate">{[p.region, p.countryName].filter(Boolean).join(", ")}</span>
                  </span>
                  {typeof p.listingCount === "number" && p.listingCount > 0 && (
                    <span className="tnum shrink-0 text-sm text-slate">
                      {p.listingCount} {p.listingCount === 1 ? "stay" : "stays"}
                    </span>
                  )}
                </span>
              )
            }
            onSelect={(p) => {
              setPlace(p.freeText ? { value: p.name, label: p.name } : { value: p.slug, label: p.name });
              pickers.close();
            }}
            hint="Type a town, city or region, such as Goa or Rajasthan."
            emptyMessage={(q) => `No places match "${q}" yet.`}
          />
        </div>
      </Popover>
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
              prompts={{ start: "Choose a check in date", end: "Choose a check out date" }}
              summary={
                range.start && range.end
                  ? `${formatShortDay(range.start)} to ${formatShortDay(range.end)}, ${nights} ${nights === 1 ? "night" : "nights"}`
                  : range.start
                    ? `Check in ${formatShortDay(range.start)}`
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
              { key: "adults", label: "Adults", hint: "13 or older", value: guests.adults, ...stayLimits.adults },
              { key: "children", label: "Children", hint: "Under 13", value: guests.children, ...stayLimits.children },
              { key: "rooms", label: "Rooms", value: guests.rooms, ...stayLimits.rooms },
            ]}
            onChange={(key, value) => setGuests({ ...guests, [key]: value })}
          />
          <div className="mt-2">
            <PanelFooter onDone={pickers.close}>{guestText}</PanelFooter>
          </div>
        </div>
      </Popover>
    </>
  );

  if (layout === "bar") {
    return (
      <Form action="/stays/search" onSubmit={onSubmit} aria-label="Search stays" className="rounded-md border border-line bg-surface p-2">
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-[1.4fr_1.3fr_1.2fr_auto]">
          <BarField
            ref={pickers.anchor("place")}
            label="Where"
            value={place?.label}
            placeholder="Town or city"
            expanded={pickers.open === "place"}
            error={errors.place}
            errorId={errorId("place")}
            onClick={() => pickers.toggle("place")}
            className="col-span-2 lg:col-span-1"
          />
          <BarField
            ref={pickers.anchor("checkin")}
            label="Dates"
            value={checkinText ? `${checkinText} to ${checkoutText ?? "?"}` : null}
            placeholder="Choose dates"
            expanded={pickers.open === "checkin"}
            error={errors.checkin ?? errors.checkout}
            errorId={errorId(errors.checkin ? "checkin" : "checkout")}
            onClick={() => pickers.toggle("checkin")}
            className="col-span-2 sm:col-span-1"
          />
          <BarField
            ref={pickers.anchor("guests")}
            label="Guests"
            value={guestText}
            placeholder=""
            expanded={pickers.open === "guests"}
            error={guestError}
            errorId={errorId(guestErrorField)}
            onClick={() => pickers.toggle("guests")}
            className="col-span-2 sm:col-span-1"
          />
          <Button type="submit" className="col-span-2 h-auto min-h-12 lg:col-span-1">
            Search stays
          </Button>
        </div>
        <ErrorList errors={errorList} idFor={errorId} />
        {hidden}
        {popovers}
      </Form>
    );
  }

  return (
    <Form action="/stays/search" onSubmit={onSubmit} aria-label="Search stays">
      <p className="text-[1.75rem] leading-[1.3] font-bold tracking-[-0.02em] text-ink sm:text-3xl sm:leading-[1.25] lg:text-4xl lg:leading-[1.2]">
        Stay in{" "}
        <Token
          ref={pickers.anchor("place")}
          label="Staying in"
          value={place?.label}
          placeholder="town or city"
          expanded={pickers.open === "place"}
          error={errors.place}
          errorId={errorId("place")}
          onClick={() => pickers.toggle("place")}
        />{" "}
        from{" "}
        <Token
          ref={pickers.anchor("checkin")}
          label="Check in"
          value={checkinText}
          placeholder="date"
          expanded={pickers.open === "checkin"}
          error={errors.checkin}
          errorId={errorId("checkin")}
          onClick={() => pickers.toggle("checkin")}
        />{" "}
        to{" "}
        <Token
          ref={pickers.anchor("checkout")}
          label="Check out"
          value={checkoutText}
          placeholder="date"
          expanded={pickers.open === "checkout"}
          error={errors.checkout}
          errorId={errorId("checkout")}
          onClick={() => pickers.toggle("checkout")}
        />
        ,{" "}
        <Token
          ref={pickers.anchor("guests")}
          label="Guests"
          value={guestText}
          placeholder="guests"
          expanded={pickers.open === "guests"}
          error={guestError}
          errorId={errorId(guestErrorField)}
          onClick={() => pickers.toggle("guests")}
        />
        .
      </p>
      <ErrorList errors={errorList} idFor={errorId} />
      <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-4">
        <Button type="submit" size="lg">
          Search stays
        </Button>
      </div>
      {hidden}
      {popovers}
    </Form>
  );
}
