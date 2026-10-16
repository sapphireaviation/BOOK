import { minorUnitDigits } from "@/lib/money";

/**
 * Round price points between the cheapest and dearest result, for the price filter.
 * Values are minor units per night; steps land on 1, 2 or 5 times a power of ten in major units.
 */
export function priceSteps(min: number, max: number, currency: string, count = 6): number[] {
  if (!(max > 0) || max <= min) return [];
  const unit = 10 ** minorUnitDigits(currency);
  const span = (max - min) / unit / count;
  const pow = 10 ** Math.floor(Math.log10(Math.max(span, 1)));
  const step = [1, 2, 5, 10].map((m) => m * pow).find((s) => s >= span) ?? 10 * pow;
  const out: number[] = [];
  for (let v = Math.ceil(min / unit / step) * step; v * unit < max && out.length < count + 2; v += step) {
    if (v > 0) out.push(v * unit);
  }
  return out;
}
