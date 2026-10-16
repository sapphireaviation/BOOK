/**
 * Turns form state into the query params of src/lib/search-params.ts and validates it with the
 * same zod schemas the results pages use, so the client and server agree on what is valid.
 */
import type { ISODate } from "@/lib/dates";
import { flightSearchSchema, staySearchSchema, type CabinClass } from "@/lib/search-params";

export type FlightFormState = {
  from?: string;
  to?: string;
  depart?: ISODate;
  return?: ISODate;
  oneWay: boolean;
  adults: number;
  children: number;
  infants: number;
  cabin: CabinClass;
};

export type StayFormState = {
  place?: string;
  checkin?: ISODate;
  checkout?: ISODate;
  adults: number;
  children: number;
  rooms: number;
};

export type FlightField = "from" | "to" | "depart" | "return" | "adults" | "children" | "infants" | "cabin";
export type StayField = "place" | "checkin" | "checkout" | "adults" | "children" | "rooms";

/** Param order matches the documented URL so shared links read the same every time. */
export function serializeFlightSearch(s: FlightFormState): [string, string][] {
  const out: [string, string][] = [
    ["from", s.from ?? ""],
    ["to", s.to ?? ""],
    ["depart", s.depart ?? ""],
  ];
  if (!s.oneWay) out.push(["return", s.return ?? ""]);
  out.push(["adults", String(s.adults)], ["children", String(s.children)], ["infants", String(s.infants)], ["cabin", s.cabin]);
  return out;
}

export function serializeStaySearch(s: StayFormState): [string, string][] {
  return [
    ["place", s.place ?? ""],
    ["checkin", s.checkin ?? ""],
    ["checkout", s.checkout ?? ""],
    ["adults", String(s.adults)],
    ["children", String(s.children)],
    ["rooms", String(s.rooms)],
  ];
}

export function toSearchUrl(path: string, params: [string, string][]) {
  return `${path}?${new URLSearchParams(params).toString()}`;
}

type Result<F extends string> = { ok: true } | { ok: false; errors: Partial<Record<F, string>> };

const emptyDateMessages: Record<string, string> = {
  depart: "Pick a departure date",
  return: "Pick a return date, or switch to one way",
  checkin: "Pick a check in date",
  checkout: "Pick a check out date",
};

const PAST = "That date has passed. Pick today or a later date.";

function collect<F extends string>(issues: { path: PropertyKey[]; message: string }[], values: Record<string, string>): Partial<Record<F, string>> {
  const errors: Partial<Record<F, string>> = {};
  for (const issue of issues) {
    const field = String(issue.path[0]) as F;
    if (errors[field]) continue;
    errors[field] = values[field] === "" && emptyDateMessages[field] ? emptyDateMessages[field] : issue.message;
  }
  return errors;
}

/** Validates with flightSearchSchema. Pass `today` to also reject dates in the past. */
export function validateFlightSearch(s: FlightFormState, today?: ISODate): Result<FlightField> {
  const values = Object.fromEntries(serializeFlightSearch(s));
  const parsed = flightSearchSchema.safeParse(values);
  const errors = parsed.success ? {} : collect<FlightField>(parsed.error.issues, values);
  if (today && s.depart && s.depart < today && !errors.depart) errors.depart = PAST;
  return Object.keys(errors).length ? { ok: false, errors } : { ok: true };
}

export function validateStaySearch(s: StayFormState, today?: ISODate): Result<StayField> {
  const values = Object.fromEntries(serializeStaySearch(s));
  const parsed = staySearchSchema.safeParse(values);
  const errors = parsed.success ? {} : collect<StayField>(parsed.error.issues, values);
  if (today && s.checkin && s.checkin < today && !errors.checkin) errors.checkin = PAST;
  return Object.keys(errors).length ? { ok: false, errors } : { ok: true };
}

function plural(n: number, one: string, many: string) {
  return `${n} ${n === 1 ? one : many}`;
}

/** "1 adult", "2 adults, 1 child, 1 infant" */
export function summarizePassengers(p: { adults: number; children: number; infants: number }) {
  const parts = [plural(p.adults, "adult", "adults")];
  if (p.children) parts.push(plural(p.children, "child", "children"));
  if (p.infants) parts.push(plural(p.infants, "infant", "infants"));
  return parts.join(", ");
}

/** "2 adults, 1 room", "2 adults, 1 child, 2 rooms" */
export function summarizeGuests(g: { adults: number; children: number; rooms: number }) {
  const parts = [plural(g.adults, "adult", "adults")];
  if (g.children) parts.push(plural(g.children, "child", "children"));
  parts.push(plural(g.rooms, "room", "rooms"));
  return parts.join(", ");
}

export const cabinLabels: Record<CabinClass, string> = {
  economy: "economy",
  premium_economy: "premium economy",
  business: "business",
  first: "first",
};

/** A readable name from a slug when nothing better is known yet: "north-goa" becomes "North Goa". */
export function titleFromSlug(slug: string) {
  return slug
    .split("-")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}
