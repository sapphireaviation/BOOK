/**
 * Flight times are local wall clock times at each airport, as the airline publishes them
 * ("2026-10-24T06:15:00", no offset). These helpers read them as text so they never shift
 * with the server's or the browser's time zone.
 */

/** "06:15" from "2026-10-24T06:15:00". */
export function localClock(iso: string) {
  const m = iso.match(/T(\d{2}):(\d{2})/);
  return m ? `${m[1]}:${m[2]}` : "";
}

/** "2026-10-24" from "2026-10-24T06:15:00". */
export function localDate(iso: string) {
  return iso.slice(0, 10);
}

/** Minutes after local midnight. */
export function localMinutes(iso: string) {
  const m = iso.match(/T(\d{2}):(\d{2})/);
  return m ? Number(m[1]) * 60 + Number(m[2]) : 0;
}

/** Whole calendar days between two local dates (arrival day marker "+1"). */
export function dayDiff(fromIso: string, toIso: string) {
  const a = Date.UTC(+fromIso.slice(0, 4), +fromIso.slice(5, 7) - 1, +fromIso.slice(8, 10));
  const b = Date.UTC(+toIso.slice(0, 4), +toIso.slice(5, 7) - 1, +toIso.slice(8, 10));
  return Math.round((b - a) / 86_400_000);
}

/** Offset of an IANA zone from UTC, in minutes, at the given instant. */
export function zoneOffsetMinutes(timeZone: string, at: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(at);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return Math.round((asUtc - Math.floor(at.getTime() / 1000) * 1000) / 60_000);
}

/** Converts a local wall clock time in a zone to a UTC instant. */
export function localToUtc(localIso: string, timeZone: string | null | undefined) {
  const naive = new Date(`${localIso.slice(0, 19)}Z`);
  if (!timeZone) return naive;
  // Two passes settle the offset across DST changes.
  let utc = new Date(naive.getTime() - zoneOffsetMinutes(timeZone, naive) * 60_000);
  utc = new Date(naive.getTime() - zoneOffsetMinutes(timeZone, utc) * 60_000);
  return utc;
}

/** Formats a UTC instant as a local wall clock ISO string ("2026-10-24T06:15:00") in a zone. */
export function utcToLocal(utc: Date, timeZone: string | null | undefined) {
  const offset = timeZone ? zoneOffsetMinutes(timeZone, utc) : 0;
  return new Date(utc.getTime() + offset * 60_000).toISOString().slice(0, 19);
}

/** Minutes between two local times in their own zones. */
export function minutesBetween(fromLocal: string, fromZone: string | null | undefined, toLocal: string, toZone: string | null | undefined) {
  return Math.round((localToUtc(toLocal, toZone).getTime() - localToUtc(fromLocal, fromZone).getTime()) / 60_000);
}

/** ISO 8601 duration ("PT2H35M", "P1DT2H") to minutes. */
export function isoDurationMinutes(d: string | null | undefined) {
  if (!d) return null;
  const m = d.match(/^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:[\d.]+S)?)?$/);
  if (!m) return null;
  return Number(m[1] ?? 0) * 1440 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0);
}

export type DepartWindow = "early" | "morning" | "afternoon" | "evening";

export const departWindows: { key: DepartWindow; label: string; from: number; to: number }[] = [
  { key: "early", label: "Before 06:00", from: 0, to: 6 * 60 },
  { key: "morning", label: "06:00 to 12:00", from: 6 * 60, to: 12 * 60 },
  { key: "afternoon", label: "12:00 to 18:00", from: 12 * 60, to: 18 * 60 },
  { key: "evening", label: "After 18:00", from: 18 * 60, to: 24 * 60 },
];

export function departWindowOf(iso: string): DepartWindow {
  const mins = localMinutes(iso);
  return departWindows.find((w) => mins >= w.from && mins < w.to)?.key ?? "evening";
}
