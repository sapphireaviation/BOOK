"use client";

import { useRef, useState } from "react";
import { cn } from "@/components/ui/cn";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { inputClass } from "@/components/ui/field";
import { Popover } from "@/components/ui/popover";
import { formatShortDay } from "@/lib/calendar";
import { isISODate, type ISODate } from "@/lib/dates";
import { useToday } from "./use-today";

type Props = {
  id: string;
  name: string;
  /** Accessible name of the calendar, such as "Leaving on". */
  label: string;
  defaultValue?: string;
  /** Fallback for the earliest day while the viewer's date is not known yet. */
  min: ISODate;
  /** Lets the traveler remove the date, for an optional return. */
  clearable?: boolean;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
};

/**
 * A single date field for plain forms: a button that opens the site calendar, with the date
 * submitted as YYYY-MM-DD in a hidden input. Shows "Fri 24 Oct" whatever the browser's locale.
 */
export function DateInput({ id, name, label, defaultValue, min, clearable, ...aria }: Props) {
  const today = useToday() ?? min;
  const [value, setValue] = useState(isISODate(defaultValue) ? defaultValue : "");
  const [open, setOpen] = useState(false);
  const anchor = useRef<HTMLButtonElement>(null);

  return (
    <>
      <div className="flex items-center gap-3">
        <button
          ref={anchor}
          id={id}
          type="button"
          aria-haspopup="dialog"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
          className={cn(inputClass, "text-left", !value && "text-slate/70")}
          {...aria}
        >
          {value ? formatShortDay(value) : "Choose a date"}
        </button>
        {clearable && value && (
          <button type="button" onClick={() => setValue("")} className="link shrink-0 text-sm font-semibold">
            Clear
          </button>
        )}
      </div>
      <input type="hidden" name={name} value={value} />
      <Popover open={open} onClose={() => setOpen(false)} anchorRef={anchor} label={label}>
        <DateRangePicker
          mode="single"
          value={{ start: value || undefined }}
          onChange={(v, { done }) => {
            setValue(v.start ?? "");
            if (done) setOpen(false);
          }}
          min={today}
          startMarker=""
          endMarker=""
          prompts={{ start: label, end: label }}
          summary={value ? formatShortDay(value) : null}
          onDone={() => setOpen(false)}
        />
      </Popover>
    </>
  );
}
