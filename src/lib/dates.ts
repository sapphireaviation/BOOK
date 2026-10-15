/** Date helpers that work on plain "YYYY-MM-DD" strings in UTC so stay dates never shift with time zones. */

export type ISODate = string; // "2026-10-24"

export function parseISODate(d: ISODate) {
  const [y, m, day] = d.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, day));
}

export function toISODate(d: Date): ISODate {
  return d.toISOString().slice(0, 10);
}

export function addDays(d: ISODate, n: number): ISODate {
  const date = parseISODate(d);
  date.setUTCDate(date.getUTCDate() + n);
  return toISODate(date);
}

export function nightsBetween(checkIn: ISODate, checkOut: ISODate) {
  return Math.round((parseISODate(checkOut).getTime() - parseISODate(checkIn).getTime()) / 86_400_000);
}

/** Each night of a stay: check in date up to the night before check out. */
export function eachNight(checkIn: ISODate, checkOut: ISODate): ISODate[] {
  const out: ISODate[] = [];
  for (let d = checkIn; d < checkOut; d = addDays(d, 1)) out.push(d);
  return out;
}

export function isISODate(s: unknown): s is ISODate {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(parseISODate(s).getTime());
}

/** "Fri 24 Oct" */
export function formatDay(d: ISODate | Date, locale = "en-IN") {
  const date = typeof d === "string" ? parseISODate(d) : d;
  return new Intl.DateTimeFormat(locale, { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(date);
}

/** "24 Oct 2026" */
export function formatDate(d: ISODate | Date, locale = "en-IN") {
  const date = typeof d === "string" ? parseISODate(d) : d;
  return new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(date);
}

/** "06:15" in the given IANA zone (flight times are shown in the airport's local time). */
export function formatTime(iso: string, timeZone?: string, locale = "en-GB") {
  return new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit", hour12: false, timeZone }).format(new Date(iso));
}

/** ISO 8601 duration ("PT2H35M") or minutes to "2h 35m". */
export function formatDuration(input: string | number) {
  let minutes: number;
  if (typeof input === "number") minutes = input;
  else {
    const m = input.match(/P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?/);
    minutes = m ? Number(m[1] ?? 0) * 1440 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0) : 0;
  }
  const h = Math.floor(minutes / 60);
  const mm = minutes % 60;
  return h ? (mm ? `${h}h ${mm}m` : `${h}h`) : `${mm}m`;
}
