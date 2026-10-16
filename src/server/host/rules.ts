import "server-only";
import { minorUnitDigits, toMinor } from "@/lib/money";
import { slugify } from "@/lib/slug";
import { addDays } from "@/lib/dates";

/**
 * Pure rules for the host tools. Nothing here touches the database, so each rule
 * can be tested on its own and reused by the services and the admin console.
 */

export type Role = "traveler" | "host" | "admin";
export type Actor = { userId: string; role: Role };

/** Hosts manage their own listings. Admins manage any listing. Travelers manage none. */
export function canManageListing(actor: Actor, listing: { hostId: string }) {
  if (actor.role === "admin") return true;
  if (actor.role !== "host") return false;
  return listing.hostId === actor.userId;
}

/** Hosts see bookings for their own listings. Admins see all. */
export function canSeeHostBooking(actor: Actor, booking: { hostId: string }) {
  return actor.role === "admin" || booking.hostId === actor.userId;
}

/** Statuses a host sees at all. Drafts, unpaid holds and failures are not bookings yet. */
export const HOST_VISIBLE_STATUSES = ["confirmed", "completed", "cancelled", "refunded"] as const;

/** Guest email and phone are shared with the host only while the booking is confirmed. */
export function hostCanSeeGuestContact(status: string) {
  return status === "confirmed";
}

/** Lowest base price across active units, in minor units. 0 when nothing is bookable. */
export function computeFromPrice(units: { basePrice: number; active: boolean }[]) {
  const prices = units.filter((u) => u.active && u.basePrice > 0).map((u) => u.basePrice);
  return prices.length ? Math.min(...prices) : 0;
}

/** "Sea breeze cottage" in "Panaji" becomes "sea-breeze-cottage-panaji". */
export function listingSlugBase(title: string, city: string) {
  const base = slugify(`${title} ${city}`.trim()).slice(0, 70).replace(/-+$/g, "");
  return base || "stay";
}

/**
 * Picks a slug that is not taken. Keeps the current slug when it already belongs to the
 * same base, so saving a published listing with an unchanged title never changes its URL.
 */
export function chooseSlug(base: string, current: string | null, taken: Iterable<string>) {
  const takenSet = new Set(taken);
  if (current) takenSet.delete(current);
  if (current && (current === base || new RegExp(`^${escapeRegExp(base)}-\\d+$`).test(current))) return current;
  if (!takenSet.has(base)) return base;
  for (let n = 2; n < 10_000; n++) {
    const candidate = `${base}-${n}`;
    if (!takenSet.has(candidate)) return candidate;
  }
  throw new Error("Could not find a free slug");
}

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Draft listings need a unique slug before they have a title and city. */
export function draftSlug(listingId: string) {
  return `draft-${listingId.replace(/^lst_/, "")}`;
}

export type ChecklistInput = {
  title: string;
  summary: string;
  description: string;
  city: string;
  countryCode: string;
  lat: number;
  lng: number;
  photos: { alt: string }[];
  units: { active: boolean; basePrice: number }[];
};

export type ChecklistItem = { key: string; label: string; done: boolean; href: string };

export const MIN_PHOTOS = 3;

/** What a listing needs before it can go live. `href` is the editor section that fixes it. */
export function publishChecklist(l: ChecklistInput, base: string): ChecklistItem[] {
  const activeUnits = l.units.filter((u) => u.active && u.basePrice > 0);
  return [
    { key: "title", label: "Title of at least 8 characters", done: l.title.trim().length >= 8, href: `${base}` },
    { key: "summary", label: "Short summary", done: l.summary.trim().length >= 20, href: `${base}` },
    { key: "description", label: "Description of at least 100 characters", done: l.description.trim().length >= 100, href: `${base}` },
    { key: "location", label: "Address and map pin", done: Boolean(l.city.trim() && l.countryCode && !(l.lat === 0 && l.lng === 0)), href: `${base}/location` },
    { key: "photos", label: `At least ${MIN_PHOTOS} photos`, done: l.photos.length >= MIN_PHOTOS, href: `${base}/photos` },
    { key: "alt", label: "Every photo described", done: l.photos.length > 0 && l.photos.every((p) => p.alt.trim().length > 0), href: `${base}/photos` },
    { key: "units", label: "At least one active room with a price", done: activeUnits.length > 0, href: `${base}/rooms` },
  ];
}

export function isReadyToPublish(items: ChecklistItem[]) {
  return items.every((i) => i.done);
}

/* Money and numbers typed into forms */

export type Parsed<T> = { ok: true; value: T } | { ok: false; error: string };

/**
 * Parses an amount typed in major units ("4,820" or "12.50") into integer minor units.
 * Accepts thousands separators, rejects negatives and more decimals than the currency has.
 */
export function parseMoneyInput(raw: string, currency: string, opts: { allowEmpty?: boolean } = {}): Parsed<number | null> {
  const s = raw.trim().replace(/[,\s_]/g, "");
  if (!s) return opts.allowEmpty ? { ok: true, value: null } : { ok: false, error: "Enter an amount." };
  const digits = minorUnitDigits(currency);
  const pattern = digits === 0 ? /^\d+$/ : new RegExp(`^\\d+(\\.\\d{1,${digits}})?$`);
  if (!pattern.test(s)) {
    return { ok: false, error: digits === 0 ? "Enter a whole number with no decimals." : `Enter a number with up to ${digits} decimals.` };
  }
  const value = toMinor(Number(s), currency);
  if (!Number.isSafeInteger(value) || value > 100_000_000_00) return { ok: false, error: "That amount is too large." };
  return { ok: true, value };
}

/** Major units for an input's default value: 482000 INR becomes "4820", 1250 EUR becomes "12.50". */
export function minorToInput(minor: number | null | undefined, currency: string) {
  if (minor === null || minor === undefined) return "";
  const digits = minorUnitDigits(currency);
  const major = minor / 10 ** digits;
  return Number.isInteger(major) ? String(major) : major.toFixed(digits);
}

/** "12.5" percent becomes 1250 basis points. Up to two decimals, 0 to 100. */
export function parsePercentToBps(raw: string): Parsed<number> {
  const s = raw.trim().replace(/%$/, "").trim();
  if (!s) return { ok: true, value: 0 };
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return { ok: false, error: "Enter a percentage with up to 2 decimals, like 12 or 12.5." };
  const bps = Math.round(Number(s) * 100);
  if (bps > 10_000) return { ok: false, error: "Tax cannot be more than 100%." };
  return { ok: true, value: bps };
}

export function bpsToPercentInput(bps: number) {
  const pct = bps / 100;
  return Number.isInteger(pct) ? String(pct) : pct.toFixed(2).replace(/0$/, "");
}

/** Factor to apply to stored minor amounts when a listing changes currency (INR to JPY is 0.01). */
export function currencyRescale(from: string, to: string) {
  return 10 ** (minorUnitDigits(to) - minorUnitDigits(from));
}

/* Calendar */

export type CalendarAction = { kind: "price"; price: number } | { kind: "reset_price" } | { kind: "close" } | { kind: "open" } | { kind: "total"; total: number | null };

export const MAX_CALENDAR_RANGE_DAYS = 366;

/** Every date from `from` to `to`, both included. */
export function eachDateInclusive(from: string, to: string) {
  const [a, b] = from <= to ? [from, to] : [to, from];
  const out: string[] = [];
  for (let d = a; d <= b; d = addDays(d, 1)) {
    out.push(d);
    if (out.length > MAX_CALENDAR_RANGE_DAYS) break;
  }
  return out;
}

/**
 * Builds the rows to insert and the columns to set on conflict for a calendar range update.
 * New rows start with booked = 0. Existing rows only change the column the action is about,
 * so `booked` (owned by the booking flow) is never written for a row that already exists.
 */
export function calendarUpsertPlan(unitId: string, dates: string[], action: CalendarAction) {
  const blank = { unitId, booked: 0, total: null as number | null, price: null as number | null, closed: false };
  switch (action.kind) {
    case "price":
      return { rows: dates.map((date) => ({ ...blank, date, price: action.price })), set: { price: action.price } as const };
    case "reset_price":
      return { rows: dates.map((date) => ({ ...blank, date })), set: { price: null } as const };
    case "close":
      return { rows: dates.map((date) => ({ ...blank, date, closed: true })), set: { closed: true } as const };
    case "open":
      return { rows: dates.map((date) => ({ ...blank, date })), set: { closed: false } as const };
    case "total":
      return { rows: dates.map((date) => ({ ...blank, date, total: action.total })), set: { total: action.total } as const };
  }
}

export type DayCell = {
  date: string;
  price: number;
  priceOverridden: boolean;
  total: number;
  booked: number;
  left: number;
  closed: boolean;
};

/** Merges a unit's defaults with its inventory rows into one cell per date. */
export function buildMonthCells(
  dates: string[],
  unit: { basePrice: number; quantity: number },
  rows: { date: string; booked: number; total: number | null; price: number | null; closed: boolean }[],
): DayCell[] {
  const byDate = new Map(rows.map((r) => [r.date, r]));
  return dates.map((date) => {
    const r = byDate.get(date);
    const total = r?.total ?? unit.quantity;
    const booked = r?.booked ?? 0;
    return {
      date,
      price: r?.price ?? unit.basePrice,
      priceOverridden: r?.price !== null && r?.price !== undefined,
      total,
      booked,
      left: Math.max(0, total - booked),
      closed: r?.closed ?? false,
    };
  });
}

/** All dates in a "2026-10" month. */
export function monthDates(month: string) {
  const [y, m] = month.split("-").map(Number);
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return Array.from({ length: days }, (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`);
}

export function shiftMonth(month: string, delta: number) {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/* Geography */

/** Great circle distance in km. */
export function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Destinations sorted by distance from the point, nearest first. */
export function rankDestinations<T extends { lat: number; lng: number }>(point: { lat: number; lng: number }, list: T[]) {
  return list.map((d) => ({ ...d, distanceKm: distanceKm(point, d) })).sort((a, b) => a.distanceKm - b.distanceKm);
}

/** Nearest destination whose search radius covers the point, or null. */
export function nearestDestination<T extends { lat: number; lng: number; radiusKm: number }>(point: { lat: number; lng: number }, list: T[]) {
  const ranked = rankDestinations(point, list);
  return ranked.find((d) => d.distanceKm <= d.radiusKm) ?? null;
}

/* Admin bootstrap */

export function parseAdminEmails(raw: string | undefined) {
  return new Set(
    (raw ?? "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  );
}

/** Splits "English, Hindi ,  Konkani" into clean, unique language names. */
export function parseLanguages(raw: string) {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of raw.split(/[,\n]/)) {
    const v = part.trim().replace(/\s+/g, " ");
    if (v && !seen.has(v.toLowerCase())) {
      seen.add(v.toLowerCase());
      out.push(v);
    }
  }
  return out.slice(0, 12);
}
