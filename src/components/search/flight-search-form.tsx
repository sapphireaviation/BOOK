"use client";

import Form from "next/form";
import { useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";
import { Combobox, HighlightMatch } from "@/components/ui/combobox";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { Popover } from "@/components/ui/popover";
import { formatShortDay, suggestedTrip, type DateRange } from "@/lib/calendar";
import { cabinClasses, type CabinClass, type FlightSearch } from "@/lib/search-params";
import { flightLimits } from "./limits";
import { BarField, ErrorList, PanelFooter, Steppers, Token, TripType, usePickers } from "./parts";
import { cabinLabels, serializeFlightSearch, summarizePassengers, validateFlightSearch, type FlightField, type FlightFormState } from "./serialize";
import { findAirport, suggestAirports, type AirportSuggestion } from "./suggest";
import { useToday } from "./use-today";

type Airport = { iata: string; city: string };
type Picker = "from" | "to" | "depart" | "return" | "pax" | "cabin";

const fieldOrder: FlightField[] = ["from", "to", "depart", "return", "adults", "children", "infants", "cabin"];
const pickerFor: Record<FlightField, Picker> = {
  from: "from",
  to: "to",
  depart: "depart",
  return: "return",
  adults: "pax",
  children: "pax",
  infants: "pax",
  cabin: "cabin",
};

/**
 * Flight search. `hero` is the sentence on the home and /flights pages; `bar` is the compact row
 * above results. Both submit GET to /flights/search with the params in src/lib/search-params.ts.
 */
export function FlightSearchForm({ initial, layout = "bar" }: { initial?: Partial<FlightSearch>; layout?: "hero" | "bar" }) {
  const id = useId();
  const today = useToday();
  const pickers = usePickers<Picker>();

  const [from, setFrom] = useState<Airport | undefined>(initial?.from ? { iata: initial.from, city: initial.from } : undefined);
  const [to, setTo] = useState<Airport | undefined>(initial?.to ? { iata: initial.to, city: initial.to } : undefined);
  const [dates, setDates] = useState<DateRange | null>(initial?.depart ? { start: initial.depart, end: initial.return } : null);
  const [oneWay, setOneWay] = useState(Boolean(initial?.depart && !initial?.return));
  const [pax, setPax] = useState({ adults: initial?.adults ?? 1, children: initial?.children ?? 0, infants: initial?.infants ?? 0 });
  const [cabin, setCabin] = useState<CabinClass>(initial?.cabin ?? "economy");
  const [showErrors, setShowErrors] = useState(false);

  // Searches that arrive as codes (from=DEL) get their city names once the airport list answers.
  useEffect(() => {
    const ctrl = new AbortController();
    for (const [code, set] of [
      [initial?.from, setFrom],
      [initial?.to, setTo],
    ] as const) {
      if (!code) continue;
      findAirport(code, ctrl.signal)
        .then((a) => a && set((cur) => (cur?.iata === a.iata ? { iata: a.iata, city: a.city } : cur)))
        .catch(() => {});
    }
    return () => ctrl.abort();
  }, [initial?.from, initial?.to]);

  // Until the visitor picks dates, suggest the next long weekend. Computed in the browser only.
  const suggestion = today ? suggestedTrip(today) : null;
  const range: DateRange = dates ?? suggestion ?? {};

  const state: FlightFormState = {
    from: from?.iata,
    to: to?.iata,
    depart: range.start,
    return: oneWay ? undefined : range.end,
    oneWay,
    ...pax,
    cabin,
  };
  const validation = validateFlightSearch(state, today ?? undefined);
  const errors = showErrors && !validation.ok ? validation.errors : {};
  const errorList = fieldOrder.filter((f) => errors[f]).map((f) => [f, errors[f]!] as [string, string]);
  const errorId = (field: string) => `${id}-error-${field}`;
  const paxError = errors.adults ?? errors.children ?? errors.infants;
  const paxErrorField = errors.adults ? "adults" : errors.children ? "children" : "infants";

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    pickers.close();
    if (validation.ok) return;
    e.preventDefault();
    setShowErrors(true);
    const first = fieldOrder.find((f) => validation.errors[f]);
    if (first) pickers.anchor(pickerFor[first]).current?.focus();
  };

  const swap = () => {
    setFrom(to);
    setTo(from);
  };

  const pickAirport = (which: "from" | "to") => (a: AirportSuggestion) => {
    const value = { iata: a.iata, city: a.city };
    if (which === "from") {
      setFrom(value);
      pickers.setOpen(to ? null : "to");
    } else {
      setTo(value);
      pickers.close();
    }
  };

  const onDates = (value: DateRange, { done }: { done: boolean }) => {
    setDates(value);
    if (done) pickers.close();
  };

  const departText = range.start ? formatShortDay(range.start) : null;
  const returnText = range.end ? formatShortDay(range.end) : null;
  const paxText = summarizePassengers(pax);

  const hidden = serializeFlightSearch(state).map(([name, value]) => <input key={name} type="hidden" name={name} value={value} />);

  const popovers = (
    <>
      <AirportPopover
        open={pickers.open === "from"}
        onClose={pickers.close}
        anchorRef={pickers.anchor("from")}
        label="Flying from"
        onSelect={pickAirport("from")}
      />
      <AirportPopover open={pickers.open === "to"} onClose={pickers.close} anchorRef={pickers.anchor("to")} label="Flying to" onSelect={pickAirport("to")} />
      {(["depart", "return"] as const).map((which) => (
        <Popover
          key={which}
          open={pickers.open === which}
          onClose={pickers.close}
          anchorRef={pickers.anchor(which)}
          label={oneWay ? "Departure date" : "Travel dates"}
          className="sm:w-auto"
        >
          {today && (
            <DateRangePicker
              mode={oneWay ? "single" : "range"}
              value={oneWay ? { start: range.start } : range}
              editing={which === "return" ? "end" : "start"}
              onChange={onDates}
              min={today}
              minGap={0}
              startMarker="Out"
              endMarker="Back"
              prompts={{ start: "Choose a departure date", end: "Choose a return date" }}
              summary={
                range.start
                  ? oneWay
                    ? `${formatShortDay(range.start)}, one way`
                    : range.end
                      ? `${formatShortDay(range.start)} to ${formatShortDay(range.end)}`
                      : `${formatShortDay(range.start)}, return not chosen`
                  : null
              }
              onDone={pickers.close}
            />
          )}
        </Popover>
      ))}
      <Popover open={pickers.open === "pax"} onClose={pickers.close} anchorRef={pickers.anchor("pax")} label="Passengers" className="sm:w-96">
        <div className="p-4 sm:p-5">
          <PassengerSteppers pax={pax} onChange={setPax} />
          {layout === "bar" && (
            <div className="mt-2 border-t border-line pt-4">
              <CabinOptions value={cabin} onChange={setCabin} />
            </div>
          )}
          <div className="mt-2">
            <PanelFooter onDone={pickers.close}>{layout === "bar" ? `${paxText}, ${cabinLabels[cabin]}` : paxText}</PanelFooter>
          </div>
        </div>
      </Popover>
      <Popover open={pickers.open === "cabin"} onClose={pickers.close} anchorRef={pickers.anchor("cabin")} label="Cabin" className="sm:w-80">
        <div className="p-4 sm:p-5">
          <CabinOptions value={cabin} onChange={setCabin} />
          <div className="mt-4">
            <PanelFooter onDone={pickers.close} />
          </div>
        </div>
      </Popover>
    </>
  );

  if (layout === "bar") {
    return (
      <Form action="/flights/search" onSubmit={onSubmit} aria-label="Search flights" className="rounded-md border border-line bg-surface p-2">
        <div className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-2 px-1 pt-1">
          <TripType oneWay={oneWay} onChange={setOneWay} size="sm" />
          <button type="button" onClick={swap} className="link inline-flex min-h-10 items-center text-sm font-semibold">
            Swap from and to
          </button>
        </div>
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-[1fr_1fr_1.3fr_1.2fr_auto]">
          <BarField
            ref={pickers.anchor("from")}
            label="From"
            value={from ? airportLabel(from) : null}
            placeholder="City or airport"
            expanded={pickers.open === "from"}
            error={errors.from}
            errorId={errorId("from")}
            onClick={() => pickers.toggle("from")}
          />
          <BarField
            ref={pickers.anchor("to")}
            label="To"
            value={to ? airportLabel(to) : null}
            placeholder="City or airport"
            expanded={pickers.open === "to"}
            error={errors.to}
            errorId={errorId("to")}
            onClick={() => pickers.toggle("to")}
          />
          <BarField
            ref={pickers.anchor("depart")}
            label={oneWay ? "Departure" : "Dates"}
            value={departText ? (oneWay ? departText : `${departText} to ${returnText ?? "?"}`) : null}
            placeholder="Choose dates"
            expanded={pickers.open === "depart"}
            error={errors.depart ?? errors.return}
            errorId={errorId(errors.depart ? "depart" : "return")}
            onClick={() => pickers.toggle("depart")}
            className="col-span-2 lg:col-span-1"
          />
          <BarField
            ref={pickers.anchor("pax")}
            label="Passengers and cabin"
            value={`${paxText}, ${cabinLabels[cabin]}`}
            placeholder=""
            expanded={pickers.open === "pax"}
            error={paxError}
            errorId={errorId(paxErrorField)}
            onClick={() => pickers.toggle("pax")}
            className="col-span-2 lg:col-span-1"
          />
          <Button type="submit" className="col-span-2 h-auto min-h-12 lg:col-span-1">
            Search flights
          </Button>
        </div>
        <ErrorList errors={errorList} idFor={errorId} />
        {hidden}
        {popovers}
      </Form>
    );
  }

  return (
    <Form action="/flights/search" onSubmit={onSubmit} aria-label="Search flights">
      <p className="text-[1.75rem] leading-[1.3] font-bold tracking-[-0.02em] text-ink sm:text-3xl sm:leading-[1.25] lg:text-4xl lg:leading-[1.2]">
        Fly from{" "}
        <Token
          ref={pickers.anchor("from")}
          label="Flying from"
          value={from?.city}
          placeholder="city"
          expanded={pickers.open === "from"}
          error={errors.from}
          errorId={errorId("from")}
          onClick={() => pickers.toggle("from")}
        />{" "}
        to{" "}
        <Token
          ref={pickers.anchor("to")}
          label="Flying to"
          value={to?.city}
          placeholder="city"
          expanded={pickers.open === "to"}
          error={errors.to}
          errorId={errorId("to")}
          onClick={() => pickers.toggle("to")}
        />
        , leaving{" "}
        <Token
          ref={pickers.anchor("depart")}
          label="Leaving"
          value={departText}
          placeholder="date"
          expanded={pickers.open === "depart"}
          error={errors.depart}
          errorId={errorId("depart")}
          onClick={() => pickers.toggle("depart")}
        />
        {!oneWay && (
          <>
            , returning{" "}
            <Token
              ref={pickers.anchor("return")}
              label="Returning"
              value={returnText}
              placeholder="date"
              expanded={pickers.open === "return"}
              error={errors.return}
              errorId={errorId("return")}
              onClick={() => pickers.toggle("return")}
            />
          </>
        )}
        ,{" "}
        <Token
          ref={pickers.anchor("pax")}
          label="Passengers"
          value={paxText}
          placeholder="passengers"
          expanded={pickers.open === "pax"}
          error={paxError}
          errorId={errorId(paxErrorField)}
          onClick={() => pickers.toggle("pax")}
        />
        ,{" "}
        <Token
          ref={pickers.anchor("cabin")}
          label="Cabin"
          value={cabinLabels[cabin]}
          placeholder="cabin"
          expanded={pickers.open === "cabin"}
          onClick={() => pickers.toggle("cabin")}
        />
        .
      </p>
      <ErrorList errors={errorList} idFor={errorId} />
      <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-4">
        <Button type="submit" size="lg">
          Search flights
        </Button>
        <TripType oneWay={oneWay} onChange={setOneWay} />
        <button type="button" onClick={swap} className={cn("link inline-flex min-h-10 items-center text-sm font-semibold", !from && !to && "hidden")}>
          Swap from and to
        </button>
      </div>
      {hidden}
      {popovers}
    </Form>
  );
}

function airportLabel(a: Airport) {
  return a.city === a.iata ? a.iata : `${a.city} (${a.iata})`;
}

function AirportPopover({
  open,
  onClose,
  anchorRef,
  label,
  onSelect,
}: {
  open: boolean;
  onClose: () => void;
  anchorRef: React.RefObject<HTMLButtonElement | null>;
  label: string;
  onSelect: (a: AirportSuggestion) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <Popover open={open} onClose={onClose} anchorRef={anchorRef} label={label} initialFocusRef={inputRef} className="sm:w-[26rem]">
      <div className="flex max-h-[inherit] flex-col p-4 sm:p-5">
        <Combobox<AirportSuggestion>
          label={label}
          placeholder="City, airport or code"
          inputRef={inputRef}
          fetchOptions={suggestAirports}
          getKey={(a) => a.iata}
          getText={(a) => `${a.city}, ${a.name} (${a.iata})`}
          renderOption={(a, q) => (
            <span className="flex items-baseline justify-between gap-4">
              <span className="min-w-0">
                <span className="block font-semibold">
                  <HighlightMatch text={a.city} query={q} />
                </span>
                <span className="block truncate text-sm text-slate">
                  <HighlightMatch text={a.name} query={q} />, {a.countryName}
                </span>
              </span>
              <span className="tnum shrink-0 text-sm font-bold text-slate">
                <HighlightMatch text={a.iata} query={q} />
              </span>
            </span>
          )}
          onSelect={onSelect}
          hint="Type a city, an airport name or a three letter code such as DEL."
          emptyMessage={(q) => `No airports match "${q}". Try the city name or the airport code.`}
        />
      </div>
    </Popover>
  );
}

function PassengerSteppers({
  pax,
  onChange,
}: {
  pax: { adults: number; children: number; infants: number };
  onChange: (pax: { adults: number; children: number; infants: number }) => void;
}) {
  const infantMax = Math.min(flightLimits.infants.max, pax.adults);
  return (
    <Steppers
      rows={[
        { key: "adults", label: "Adults", hint: "12 or older", value: pax.adults, ...flightLimits.adults },
        { key: "children", label: "Children", hint: "2 to 11", value: pax.children, ...flightLimits.children },
        {
          key: "infants",
          label: "Infants",
          hint: "Under 2, on a lap",
          value: pax.infants,
          min: flightLimits.infants.min,
          max: infantMax,
          limitNote: pax.infants >= flightLimits.infants.max ? undefined : "Each infant travels on an adult's lap",
        },
      ]}
      onChange={(key, value) => {
        const next = { ...pax, [key]: value };
        // Fewer adults than infants is not allowed by airlines; keep the two in step.
        if (next.infants > next.adults) next.infants = next.adults;
        onChange(next);
      }}
    />
  );
}

function CabinOptions({ value, onChange }: { value: CabinClass; onChange: (c: CabinClass) => void }) {
  const name = useId();
  return (
    <fieldset>
      <legend className="mb-2 font-semibold">Cabin</legend>
      <div className="space-y-1">
        {cabinClasses.map((c) => (
          <label
            key={c}
            className={cn(
              "flex cursor-pointer items-center gap-3 rounded-md px-3 py-2.5 has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-runway",
              value === c ? "bg-sapphire-wash font-semibold" : "hover:bg-mist",
            )}
          >
            <input type="radio" name={name} checked={value === c} onChange={() => onChange(c)} className="size-4 accent-sapphire" />
            <span>{cabinLabels[c].charAt(0).toUpperCase() + cabinLabels[c].slice(1)}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
