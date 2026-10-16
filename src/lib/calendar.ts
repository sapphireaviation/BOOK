/**
 * Calendar math for the date pickers. Pure functions on "YYYY-MM-DD" strings so they are
 * easy to test and never shift with the viewer's time zone.
 */
import { addDays, nightsBetween, parseISODate, toISODate, type ISODate } from "./dates";

/** Today on the viewer's own calendar (not UTC), as "YYYY-MM-DD". Call only in the browser or at request time. */
export function localToday(now: Date = new Date()): ISODate {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** 0 is Sunday, 6 is Saturday. */
export function weekday(d: ISODate) {
  return parseISODate(d).getUTCDay();
}

export function startOfMonth(d: ISODate): ISODate {
  return `${d.slice(0, 7)}-01`;
}

export function daysInMonth(d: ISODate) {
  const date = parseISODate(startOfMonth(d));
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
}

/** Adds whole months and keeps the day where it can (31 Jan + 1 month is 28 or 29 Feb). */
export function addMonths(d: ISODate, n: number): ISODate {
  const date = parseISODate(d);
  const target = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + n, 1));
  const first = toISODate(target);
  const day = Math.min(date.getUTCDate(), daysInMonth(first));
  return `${first.slice(0, 8)}${String(day).padStart(2, "0")}`;
}

export function monthsBetween(from: ISODate, to: ISODate) {
  const a = parseISODate(from);
  const b = parseISODate(to);
  return (b.getUTCFullYear() - a.getUTCFullYear()) * 12 + (b.getUTCMonth() - a.getUTCMonth());
}

export function sameMonth(a: ISODate, b: ISODate) {
  return a.slice(0, 7) === b.slice(0, 7);
}

/**
 * Weeks of a month as rows of 7 cells. Cells outside the month are null so the grid lines up
 * under the weekday headings. `weekStartsOn` 1 is Monday.
 */
export function monthGrid(month: ISODate, weekStartsOn = 1): (ISODate | null)[][] {
  const first = startOfMonth(month);
  const lead = (weekday(first) - weekStartsOn + 7) % 7;
  const total = daysInMonth(first);
  const cells: (ISODate | null)[] = Array.from({ length: lead }, () => null);
  for (let i = 0; i < total; i++) cells.push(addDays(first, i));
  while (cells.length % 7) cells.push(null);
  const weeks: (ISODate | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

export function clampDate(d: ISODate, min?: ISODate, max?: ISODate): ISODate {
  if (min && d < min) return min;
  if (max && d > max) return max;
  return d;
}

export type GridKey = "ArrowLeft" | "ArrowRight" | "ArrowUp" | "ArrowDown" | "Home" | "End" | "PageUp" | "PageDown";

export const gridKeys: readonly string[] = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End", "PageUp", "PageDown"];

/**
 * Where keyboard focus goes in a date grid (WAI-ARIA date picker pattern).
 * Shift with PageUp or PageDown moves a year.
 */
export function moveFocus(d: ISODate, key: GridKey, opts: { shift?: boolean; weekStartsOn?: number } = {}): ISODate {
  const weekStartsOn = opts.weekStartsOn ?? 1;
  switch (key) {
    case "ArrowLeft":
      return addDays(d, -1);
    case "ArrowRight":
      return addDays(d, 1);
    case "ArrowUp":
      return addDays(d, -7);
    case "ArrowDown":
      return addDays(d, 7);
    case "Home":
      return addDays(d, -((weekday(d) - weekStartsOn + 7) % 7));
    case "End":
      return addDays(d, 6 - ((weekday(d) - weekStartsOn + 7) % 7));
    case "PageUp":
      return addMonths(d, opts.shift ? -12 : -1);
    case "PageDown":
      return addMonths(d, opts.shift ? 12 : 1);
  }
}

export type DateRange = { start?: ISODate; end?: ISODate };
export type RangeEnd = "start" | "end";

/**
 * Applies a click (or Enter) on a day.
 * - single mode: the day becomes the date and the pick is done.
 * - range mode: picking the start keeps a still-valid end; picking an end before the start
 *   (or closer than `minGap` days) starts over from that day.
 * `minGap` is 0 for flights (same day return) and 1 for stays (at least one night).
 */
export function selectDay(
  value: DateRange,
  day: ISODate,
  opts: { mode: "single" | "range"; editing: RangeEnd; minGap?: number },
): { value: DateRange; editing: RangeEnd; done: boolean } {
  const minGap = opts.minGap ?? 0;
  if (opts.mode === "single") return { value: { start: day }, editing: "start", done: true };

  if (opts.editing === "start" || !value.start) {
    const keepEnd = value.end && nightsBetween(day, value.end) >= minGap ? value.end : undefined;
    return keepEnd ? { value: { start: day, end: keepEnd }, editing: "start", done: true } : { value: { start: day }, editing: "end", done: false };
  }

  if (nightsBetween(value.start, day) < minGap) return { value: { start: day }, editing: "end", done: false };
  return { value: { start: value.start, end: day }, editing: "start", done: true };
}

/** True for days strictly between start and end. */
export function isBetween(day: ISODate, start?: ISODate, end?: ISODate) {
  return Boolean(start && end && day > start && day < end);
}

/**
 * Suggested dates when the visitor has not picked any: the first Friday at least
 * three days away, back on the Monday after.
 */
export function suggestedTrip(today: ISODate): { start: ISODate; end: ISODate } {
  let start = addDays(today, 3);
  while (weekday(start) !== 5) start = addDays(start, 1);
  return { start, end: addDays(start, 3) };
}

/** "Fri 24 Oct", the house style in docs/WRITING.md (Intl adds a comma for some locales). */
export function formatShortDay(d: ISODate, locale = "en-IN") {
  const parts = new Intl.DateTimeFormat(locale, { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).formatToParts(parseISODate(d));
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("weekday")} ${get("day")} ${get("month")}`;
}

/** "October 2026" */
export function formatMonth(d: ISODate, locale = "en-IN") {
  return new Intl.DateTimeFormat(locale, { month: "long", year: "numeric", timeZone: "UTC" }).format(parseISODate(d));
}

/** "Friday 24 October 2026", used as the accessible name of a day. */
export function formatLongDay(d: ISODate, locale = "en-IN") {
  return new Intl.DateTimeFormat(locale, { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(parseISODate(d));
}

/** Weekday headings starting from `weekStartsOn`: [{ short: "Mon", long: "Monday" }, ...] */
export function weekdayLabels(locale = "en-IN", weekStartsOn = 1) {
  // 2023-01-01 was a Sunday.
  return Array.from({ length: 7 }, (_, i) => {
    const d = parseISODate(addDays("2023-01-01", (i + weekStartsOn) % 7));
    return {
      short: new Intl.DateTimeFormat(locale, { weekday: "short", timeZone: "UTC" }).format(d),
      long: new Intl.DateTimeFormat(locale, { weekday: "long", timeZone: "UTC" }).format(d),
    };
  });
}
