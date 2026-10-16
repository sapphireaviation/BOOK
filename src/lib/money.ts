/**
 * Money is always integer minor units plus an ISO 4217 code.
 * Never use floats for amounts. Format only through these helpers.
 */
export type Money = { amount: number; currency: string };

const ZERO_DECIMAL = new Set(["JPY", "KRW", "VND", "IDR", "CLP", "ISK", "HUF", "TWD", "UGX"]);

export function minorUnitDigits(currency: string) {
  return ZERO_DECIMAL.has(currency.toUpperCase()) ? 0 : 2;
}

export function toMinor(major: number, currency: string) {
  return Math.round(major * 10 ** minorUnitDigits(currency));
}

export function toMajor(minor: number, currency: string) {
  return minor / 10 ** minorUnitDigits(currency);
}

const formatters = new Map<string, Intl.NumberFormat>();

function formatter(currency: string, locale: string, showCents: boolean) {
  const key = `${locale}|${currency}|${showCents}`;
  let f = formatters.get(key);
  if (!f) {
    f = new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      currencyDisplay: "narrowSymbol",
      minimumFractionDigits: showCents ? minorUnitDigits(currency) : 0,
      maximumFractionDigits: showCents ? minorUnitDigits(currency) : 0,
    });
    formatters.set(key, f);
  }
  return f;
}

/**
 * Formats minor units for display. Whole amounts drop the decimals ("₹4,820"),
 * amounts with a fraction keep them ("€12.50").
 */
export function formatMoney(money: Money, locale = "en-IN") {
  const major = toMajor(money.amount, money.currency);
  const showCents = !Number.isInteger(major);
  return formatter(money.currency, locale, showCents).format(major);
}

/** Short form for tight spaces such as a phone width calendar cell: "₹4.5K", "₹1.2L", "$95". */
export function formatMoneyCompact(money: Money, locale = "en-IN") {
  return new Intl.NumberFormat(locale, { style: "currency", currency: money.currency, currencyDisplay: "narrowSymbol", notation: "compact", maximumFractionDigits: 1 }).format(
    toMajor(money.amount, money.currency),
  );
}

export function sumMoney(items: Money[], currency: string): Money {
  return { amount: items.reduce((s, m) => s + m.amount, 0), currency };
}

/** Basis points of an amount, rounded half up. 1200 bps = 12%. */
export function bps(amount: number, basisPoints: number) {
  return Math.round((amount * basisPoints) / 10_000);
}
