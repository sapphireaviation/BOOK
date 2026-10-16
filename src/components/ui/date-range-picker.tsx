"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { addDays, type ISODate } from "@/lib/dates";
import {
  addMonths,
  clampDate,
  formatLongDay,
  formatMonth,
  gridKeys,
  isBetween,
  monthGrid,
  monthsBetween,
  moveFocus,
  sameMonth,
  selectDay,
  startOfMonth,
  weekdayLabels,
  type DateRange,
  type GridKey,
  type RangeEnd,
} from "@/lib/calendar";
import { cn } from "./cn";
import { useSheetLayout } from "./popover";

export type DateRangePickerProps = {
  mode: "range" | "single";
  value: DateRange;
  /** Called on every pick. `done` is true once the range (or the single date) is complete. */
  onChange: (value: DateRange, info: { done: boolean }) => void;
  /** Which end the next click sets. */
  editing?: RangeEnd;
  /** Earliest pickable day, normally today. */
  min: ISODate;
  max?: ISODate;
  /** Minimum days between start and end: 0 lets a return be the same day, 1 means one night. */
  minGap?: number;
  /** Short markers shown under the start and end days, such as "In" and "Out". */
  startMarker: string;
  endMarker: string;
  /** Instruction shown above the calendar for each end, such as "Choose a check in date". */
  prompts: { start: string; end: string };
  /** Extra text in the footer, such as "3 nights". */
  summary?: React.ReactNode;
  onDone?: () => void;
  locale?: string;
  weekStartsOn?: number;
};

/**
 * A calendar built for the sentence search. Two months side by side on wider screens, a scrolling
 * list of months on small screens. Arrow keys move by day and week, PageUp and PageDown by month
 * (with Shift, by year), Home and End to the ends of the week. The check in or departure day is
 * filled sapphire; the end day is filled runway yellow.
 */
export function DateRangePicker({
  mode,
  value,
  onChange,
  editing: editingProp = "start",
  min,
  max = addDays(min, 364),
  minGap = 0,
  startMarker,
  endMarker,
  prompts,
  summary,
  onDone,
  locale = "en-IN",
  weekStartsOn = 1,
}: DateRangePickerProps) {
  const id = useId();
  const sheet = useSheetLayout();
  const [editing, setEditing] = useState<RangeEnd>(mode === "single" || !value.start ? "start" : editingProp);
  const initialFocus = clampDate((editing === "end" ? (value.end ?? value.start) : value.start) ?? min, min, max);
  const [focused, setFocused] = useState<ISODate>(initialFocus);
  const [view, setView] = useState<ISODate>(startOfMonth(initialFocus));
  const [hovered, setHovered] = useState<ISODate | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  // Focus the selected day when the calendar opens, so the arrow keys work straight away.
  const moveFocusRef = useRef(true);
  const weekdays = weekdayLabels(locale, weekStartsOn);

  const firstMonth = startOfMonth(min);
  const lastMonth = startOfMonth(max);
  const months = sheet
    ? Array.from({ length: monthsBetween(firstMonth, lastMonth) + 1 }, (_, i) => addMonths(firstMonth, i))
    : [view, addMonths(view, 1)];

  // Keep keyboard focus on the focused day after it changes.
  useEffect(() => {
    if (!moveFocusRef.current) return;
    moveFocusRef.current = false;
    const cell = gridRef.current?.querySelector<HTMLElement>(`[data-date="${focused}"]`);
    cell?.focus({ preventScroll: !sheet });
    if (sheet) cell?.scrollIntoView({ block: "nearest" });
  }, [focused, view, sheet]);

  // On small screens, open with the relevant month in view.
  useLayoutEffect(() => {
    if (!sheet) return;
    const el = gridRef.current?.querySelector<HTMLElement>(`[data-month="${startOfMonth(focused)}"]`);
    el?.scrollIntoView({ block: "start" });
    // Only on open and layout change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sheet]);

  const goTo = (day: ISODate) => {
    const next = clampDate(day, min, max);
    setFocused(next);
    if (!sheet) {
      if (next < view) setView(startOfMonth(next));
      else if (next >= addMonths(view, 2)) setView(addMonths(startOfMonth(next), -1));
    }
    moveFocusRef.current = true;
  };

  const pick = (day: ISODate) => {
    if (day < min || day > max) return;
    const result = selectDay(value, day, { mode, editing, minGap });
    setEditing(result.editing);
    setFocused(day);
    setHovered(null);
    onChange(result.value, { done: result.done });
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    const day = target.dataset.date;
    if (!day) return;
    if (gridKeys.includes(e.key)) {
      e.preventDefault();
      goTo(moveFocus(day, e.key as GridKey, { shift: e.shiftKey, weekStartsOn }));
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      pick(day);
    }
  };

  const shiftView = (n: number) => {
    const nextView = addMonths(view, n);
    setView(nextView);
    setFocused((f) => clampDate(sameMonth(f, nextView) || sameMonth(f, addMonths(nextView, 1)) ? f : nextView, min, max));
  };

  const previewEnd = mode === "range" && editing === "end" && value.start && !value.end && hovered && hovered > value.start ? hovered : undefined;
  const rangeEnd = value.end ?? previewEnd;
  const prompt = mode === "single" || editing === "start" ? prompts.start : prompts.end;

  return (
    <div className={cn("p-4 sm:p-5", sheet && "pb-0")}>
      <p className="text-sm font-semibold" aria-live="polite">
        {prompt}
      </p>
      <p className="sr-only" aria-live="polite" id={`${id}-month`}>
        {formatMonth(focused, locale)}
      </p>

      {!sheet && (
        <div className="relative z-10 mt-3 flex items-center justify-between">
          <button
            type="button"
            onClick={() => shiftView(-1)}
            disabled={view <= firstMonth}
            aria-label="Previous month"
            className="grid size-9 place-items-center rounded-md border border-line text-ink hover:border-ink disabled:opacity-30"
          >
            <Chevron dir="left" />
          </button>
          <button
            type="button"
            onClick={() => shiftView(1)}
            disabled={addMonths(view, 1) >= lastMonth}
            aria-label="Next month"
            className="grid size-9 place-items-center rounded-md border border-line text-ink hover:border-ink disabled:opacity-30"
          >
            <Chevron dir="right" />
          </button>
        </div>
      )}

      {sheet && (
        <div className="sticky top-0 z-10 -mx-4 mt-3 grid grid-cols-7 border-b border-line bg-surface px-4 pb-2 text-center text-2xs font-semibold text-slate">
          {weekdays.map((w) => (
            <abbr key={w.long} title={w.long} className="no-underline">
              {w.short}
            </abbr>
          ))}
        </div>
      )}

      <div ref={gridRef} onKeyDown={onKeyDown} onPointerLeave={() => setHovered(null)} className={cn(sheet ? "space-y-6 pt-3" : "-mt-9 flex gap-8")}>
        {months.map((month) => {
          const headingId = `${id}-${month}`;
          return (
            <div key={month} data-month={month} className={cn(sheet ? "scroll-mt-12" : "w-[308px]")}>
              <h3 id={headingId} className={cn("text-base font-bold tracking-normal", sheet ? "mb-2" : "pointer-events-none mb-3 flex h-9 items-center justify-center")}>
                {formatMonth(month, locale)}
              </h3>
              <table role="grid" aria-labelledby={headingId} className="w-full table-fixed border-collapse">
                {!sheet && (
                  <thead>
                    <tr>
                      {weekdays.map((w) => (
                        <th key={w.long} scope="col" abbr={w.long} className="pb-1 text-2xs font-semibold text-slate">
                          {w.short}
                        </th>
                      ))}
                    </tr>
                  </thead>
                )}
                <tbody>
                  {monthGrid(month, weekStartsOn).map((week, wi) => (
                    <tr key={wi}>
                      {week.map((day, di) => {
                        if (!day) return <td key={di} role="gridcell" aria-hidden="true" />;
                        const disabled = day < min || day > max;
                        const isStart = day === value.start;
                        const isEnd = mode === "range" && day === rangeEnd;
                        const between = mode === "range" && isBetween(day, value.start, rangeEnd);
                        const banded = mode === "range" && value.start && rangeEnd && (between || isStart || isEnd);
                        const isToday = day === min;
                        const marker = mode === "range" ? (isStart ? startMarker : isEnd && value.end ? endMarker : null) : null;
                        const stateText = isStart ? (mode === "single" ? "selected" : startMarker) : isEnd && value.end ? endMarker : between ? "in range" : "";
                        return (
                          <td
                            key={day}
                            role="gridcell"
                            data-date={day}
                            tabIndex={day === focused ? 0 : -1}
                            aria-selected={isStart || (isEnd && Boolean(value.end)) || between}
                            aria-disabled={disabled || undefined}
                            aria-current={isToday ? "date" : undefined}
                            aria-label={`${formatLongDay(day, locale)}${stateText ? `, ${stateText}` : ""}${isToday ? ", today" : ""}${disabled ? ", not available" : ""}`}
                            onClick={() => pick(day)}
                            onPointerEnter={() => setHovered(day)}
                            className={cn(
                              "group relative h-12 cursor-pointer p-0 text-center outline-none",
                              banded && "bg-sapphire-wash",
                              banded && isStart && "rounded-l-md",
                              banded && isEnd && "rounded-r-md",
                              disabled && "cursor-not-allowed",
                            )}
                          >
                            <span
                              className={cn(
                                "mx-auto flex h-11 w-full max-w-11 flex-col items-center justify-center rounded-md leading-none transition-colors duration-150 group-focus-visible:outline-3 group-focus-visible:outline-offset-1 group-focus-visible:outline-runway",
                                disabled && "text-slate/50",
                                !disabled && !isStart && !isEnd && "hover:bg-mist",
                                isStart && (mode === "single" ? "bg-runway font-bold text-ink" : "bg-sapphire font-bold text-paper"),
                                isEnd && value.end && "bg-runway font-bold text-ink",
                                isEnd && !value.end && "border border-dashed border-sapphire",
                              )}
                            >
                              <span className={cn("tnum text-sm", isToday && !isStart && !isEnd && "font-extrabold underline decoration-2 underline-offset-4")}>
                                {Number(day.slice(8))}
                              </span>
                              {marker && (
                                <span aria-hidden="true" className="mt-0.5 text-[0.6875rem] font-semibold leading-none">
                                  {marker}
                                </span>
                              )}
                            </span>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        })}
      </div>

      <div className={cn("mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-line bg-surface pt-4", sheet && "sticky bottom-0 -mx-4 px-4 pb-4")}>
        <div className="text-sm text-slate tnum">{summary}</div>
        {onDone && (
          <button type="button" onClick={onDone} className="h-10 rounded-md bg-ink px-4 text-sm font-semibold text-paper hover:bg-sapphire-deep">
            Done
          </button>
        )}
      </div>
    </div>
  );
}

function Chevron({ dir }: { dir: "left" | "right" }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d={dir === "left" ? "M10 3L5 8l5 5" : "M6 3l5 5-5 5"} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
