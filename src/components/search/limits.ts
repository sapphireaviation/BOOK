/** Stepper limits read from the URL schemas, so the pickers never offer a value the server rejects. */
import { flightSearchSchema, staySearchSchema } from "@/lib/search-params";

type Bounded = { unwrap: () => { minValue: number | null; maxValue: number | null } };

function bounds(field: Bounded) {
  const inner = field.unwrap();
  return { min: inner.minValue ?? 0, max: inner.maxValue ?? 99 };
}

const f = flightSearchSchema.shape;
const s = staySearchSchema.shape;

export const flightLimits = {
  adults: bounds(f.adults),
  children: bounds(f.children),
  infants: bounds(f.infants),
};

export const stayLimits = {
  adults: bounds(s.adults),
  children: bounds(s.children),
  rooms: bounds(s.rooms),
};
