import { formatDay } from "@/lib/dates";

/**
 * Passenger detail rules shared by the booking form (instant feedback) and the server action
 * (the check that counts). Pure functions, safe in client and server code.
 */

export type PassengerKind = "adult" | "child" | "infant_without_seat";

export type PassengerFields = {
  title: string;
  givenName: string;
  familyName: string;
  bornOn: string;
  gender: string;
  passportNumber?: string;
  passportCountry?: string;
  passportExpiry?: string;
};

export type ContactFields = { name: string; email: string; phone: string };

export type RuleContext = {
  /** Date of the last flight ("2026-11-27"). Ages are checked on this date, as airlines do. */
  travelDate: string;
  /** Today in UTC ("2026-10-16"). */
  today: string;
  requiresPassport: boolean;
};

export type FieldErrors = Record<string, string>;

export const titles = [
  { value: "mr", label: "Mr" },
  { value: "ms", label: "Ms" },
  { value: "mrs", label: "Mrs" },
  { value: "miss", label: "Miss" },
  { value: "dr", label: "Dr" },
] as const;

export const kindLabels: Record<PassengerKind, string> = { adult: "Adult", child: "Child", infant_without_seat: "Infant on lap" };

export const ageRules: Record<PassengerKind, string> = {
  adult: "12 or older on the day of the last flight",
  child: "2 to 11 on the day of the last flight",
  infant_without_seat: "Under 2 on the day of the last flight, sits on an adult's lap",
};

/** Field names in the form: p0_givenName, p1_bornOn, contact_email. */
export const fieldName = (index: number, field: keyof PassengerFields) => `p${index}_${field}`;

// Airlines accept Latin letters only (Duffel: ASCII, Latin-1 Supplement and Latin Extended-A), 20 at most.
const NAME = /^[A-Za-zÀ-ÖØ-öø-ſ' -]{1,20}$/;
const PASSPORT = /^[A-Z0-9]{5,20}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function validDate(s: string) {
  if (!ISO_DATE.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

/** Age in whole years on a date. */
export function ageOn(bornOn: string, on: string) {
  const [by, bm, bd] = bornOn.split("-").map(Number);
  const [y, m, d] = on.split("-").map(Number);
  let age = y - by;
  if (m < bm || (m === bm && d < bd)) age--;
  return age;
}

/** "+91 98765-43210" to "+919876543210". */
export function normalizePhone(phone: string) {
  return phone.replace(/[\s().-]/g, "");
}

export function checkBirthDate(kind: PassengerKind, bornOn: string, ctx: RuleContext): string | null {
  if (!bornOn) return "Enter the date of birth";
  if (!validDate(bornOn)) return "Use a date like 1990-04-21";
  if (bornOn > ctx.today) return "Date of birth cannot be in the future";
  if (bornOn < "1900-01-01") return "Check the year of birth";
  const age = ageOn(bornOn, ctx.travelDate);
  const on = formatDay(ctx.travelDate);
  if (kind === "adult" && age < 12) return `An adult must be 12 or older on ${on}. Search again with this traveler as a child.`;
  if (kind === "child" && age >= 12) return `This traveler is 12 or older on ${on}, so needs an adult ticket. Search again with one more adult.`;
  if (kind === "child" && age < 2) return `This traveler is under 2 on ${on}. Search again with them as an infant.`;
  if (kind === "infant_without_seat" && age >= 2) return `An infant must be under 2 on ${on}. Search again with this traveler as a child.`;
  return null;
}

export function validatePassenger(index: number, kind: PassengerKind, p: PassengerFields, ctx: RuleContext): FieldErrors {
  const errors: FieldErrors = {};
  const f = (k: keyof PassengerFields) => fieldName(index, k);
  if (!titles.some((t) => t.value === p.title)) errors[f("title")] = "Choose a title";
  if (!p.givenName.trim()) errors[f("givenName")] = "Enter the first and middle names as on the ID";
  else if (!NAME.test(p.givenName.trim())) errors[f("givenName")] = "Use Latin letters, spaces, hyphens or apostrophes, up to 20 characters";
  if (!p.familyName.trim()) errors[f("familyName")] = "Enter the last name as on the ID";
  else if (!NAME.test(p.familyName.trim())) errors[f("familyName")] = "Use Latin letters, spaces, hyphens or apostrophes, up to 20 characters";
  if (p.gender !== "m" && p.gender !== "f") errors[f("gender")] = "Choose the gender shown on the ID";
  const dob = checkBirthDate(kind, p.bornOn, ctx);
  if (dob) errors[f("bornOn")] = dob;

  if (ctx.requiresPassport) {
    const number = (p.passportNumber ?? "").replace(/\s/g, "").toUpperCase();
    if (!number) errors[f("passportNumber")] = "Enter the passport number";
    else if (!PASSPORT.test(number)) errors[f("passportNumber")] = "Use the letters and numbers printed on the passport";
    if (!/^[A-Z]{2}$/.test(p.passportCountry ?? "")) errors[f("passportCountry")] = "Choose the country that issued the passport";
    const expiry = p.passportExpiry ?? "";
    if (!expiry) errors[f("passportExpiry")] = "Enter the passport expiry date";
    else if (!validDate(expiry)) errors[f("passportExpiry")] = "Use a date like 2031-04-21";
    else if (expiry <= ctx.travelDate) errors[f("passportExpiry")] = `The passport must be valid after ${formatDay(ctx.travelDate)}`;
  }
  return errors;
}

export function validateContact(c: ContactFields): FieldErrors {
  const errors: FieldErrors = {};
  if (c.name.trim().length < 2) errors.contact_name = "Enter the name of the person we should contact";
  if (!EMAIL.test(c.email.trim())) errors.contact_email = "Enter an email address like name@example.com";
  if (!/^\+[1-9]\d{7,14}$/.test(normalizePhone(c.phone))) errors.contact_phone = "Include the country code, for example +91 98765 43210";
  return errors;
}

/** Infants sit on an adult's lap, so each needs an adult on the booking. */
export function validateInfantRatio(kinds: PassengerKind[]): string | null {
  const adults = kinds.filter((k) => k === "adult").length;
  const infants = kinds.filter((k) => k === "infant_without_seat").length;
  return infants > adults ? "Each infant needs an adult on the same booking." : null;
}
