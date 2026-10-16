import "server-only";
import { addDays, isISODate, type ISODate } from "@/lib/dates";
import { resolveAirport, resolvePlace, type MissingField, type ParsedTrip } from "@/server/ai/finish";
import { defaultResolvers } from "@/server/ai/resolvers";

export type Answers = Partial<Record<"from" | "to" | "depart" | "return" | "place" | "checkin" | "checkout", string>>;

export type Completed = ParsedTrip & { errors: Partial<Record<MissingField, string>>; answered: boolean };

const date = (v: string | undefined, min: ISODate) => (v && isISODate(v) && v >= min ? v : undefined);

/**
 * Applies what the person typed into the follow-up form on top of the parsed
 * sentence, and works out what is still missing.
 */
export async function applyAnswers(parsed: ParsedTrip, answers: Answers, today: ISODate): Promise<Completed> {
  const errors: Completed["errors"] = {};
  const answered = Object.values(answers).some((v) => v && v.trim());
  const out: Completed = { ...parsed, flight: parsed.flight && { ...parsed.flight }, stay: parsed.stay && { ...parsed.stay }, errors, answered };

  if (parsed.kind === "flight") {
    const f = (out.flight ??= {});
    for (const field of ["from", "to"] as const) {
      const value = answers[field]?.trim();
      if (!value) continue;
      const airport = await resolveAirport(value, defaultResolvers);
      if (airport) f[field] = airport.iata;
      else errors[field] = `We could not find an airport for "${value}". Try the city name or a 3 letter code like DEL.`;
    }
    if (answers.depart) {
      const d = date(answers.depart, today);
      if (d) f.depart = d;
      else errors.depart = "Pick a departure date from today onwards.";
    }
    if (answers.return) {
      const r = date(answers.return, f.depart ?? today);
      if (r) f.return = r;
      else errors.return = "Pick a return date on or after the departure date.";
    }
    if (f.depart && !f.return && parsed.nights && parsed.missing.includes("return")) f.return = addDays(f.depart, parsed.nights);
    if (f.from && f.to && f.from === f.to) errors.to = "Pick an arrival airport different from the departure airport.";
    out.missing = (["from", "to", "depart"] as const).filter((k) => !f[k]);
    if (parsed.missing.includes("return") && !f.return) out.missing.push("return");
  } else if (parsed.kind === "stay") {
    const s = (out.stay ??= {});
    if (answers.place?.trim()) s.place = (await resolvePlace(answers.place.trim(), defaultResolvers)).slug;
    if (answers.checkin) {
      const d = date(answers.checkin, today);
      if (d) s.checkin = d;
      else errors.checkin = "Pick a check in date from today onwards.";
    }
    if (answers.checkout) {
      const d = s.checkin ? date(answers.checkout, addDays(s.checkin, 1)) : undefined;
      if (d) s.checkout = d;
      else errors.checkout = "Pick a check out date after check in.";
    }
    if (s.checkin && !s.checkout && parsed.nights) s.checkout = addDays(s.checkin, parsed.nights);
    out.missing = [];
    if (!s.place) out.missing.push("place");
    if (!s.checkin) out.missing.push("checkin");
    if (!s.checkout) out.missing.push("checkout");
  }

  for (const k of Object.keys(errors) as MissingField[]) if (!out.missing.includes(k)) out.missing.push(k);
  return out;
}
