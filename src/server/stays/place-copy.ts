import "server-only";
import { propertyTypeLabels } from "@/lib/amenities";
import { formatMoney } from "@/lib/money";
import type { PlaceStats } from "./places";

/**
 * Text for destination pages, built only from live numbers. Pure, so every sentence can be tested.
 * Nothing here should claim more than the data says.
 */

const PLURAL_TYPES: Record<string, [string, string]> = {
  hotel: ["hotel", "hotels"],
  guesthouse: ["guesthouse", "guesthouses"],
  homestay: ["homestay", "homestays"],
  apartment: ["apartment", "apartments"],
  house: ["house", "houses"],
  villa: ["villa", "villas"],
  hostel: ["hostel", "hostels"],
  resort: ["resort", "resorts"],
  cabin: ["cabin or cottage", "cabins and cottages"],
  other: ["other place", "other places"],
};

/** "October 2026" from "2026-10". */
export function monthLabel(asOf: string, locale = "en-IN") {
  const [y, m] = asOf.split("-").map(Number);
  return new Intl.DateTimeFormat(locale, { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(y, m - 1, 1)));
}

/** "1 stay", "4 stays" */
export function stays(n: number) {
  return `${n} ${n === 1 ? "stay" : "stays"}`;
}

/** "a, b and c" */
export function joinAnd(items: string[]) {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`;
}

/** "2 guesthouses, 1 hotel and 1 villa", largest group first. */
export function typeBreakdown(types: Record<string, number>) {
  return joinAnd(
    Object.entries(types)
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([t, n]) => {
        const [one, many] = PLURAL_TYPES[t] ?? [propertyTypeLabels[t]?.toLowerCase() ?? t, `${propertyTypeLabels[t]?.toLowerCase() ?? t}s`];
        return `${n} ${n === 1 ? one : many}`;
      }),
  );
}

function price(amount: number, currency: string) {
  return formatMoney({ amount, currency });
}

/** The factual paragraph at the top of a destination page. */
export function placeLead(name: string, stats: PlaceStats, asOf: string) {
  if (stats.count === 0) {
    return `No stays in ${name} are listed yet. Owners list their places directly and set their own prices, with no platform fee for them or for guests.`;
  }
  const parts: string[] = [];
  if (stats.currency && stats.priceMin !== null && stats.priceMax !== null) {
    const range =
      stats.priceMin === stats.priceMax
        ? `at ${price(stats.priceMin, stats.currency)} a night`
        : `from ${price(stats.priceMin, stats.currency)} to ${price(stats.priceMax, stats.currency)} a night`;
    parts.push(`${stats.count === 1 ? "There is 1 stay" : `There are ${stats.count} stays`} in ${name} listed here, ${range} before taxes, as of ${monthLabel(asOf)}.`);
  } else {
    parts.push(`${stats.count === 1 ? "There is 1 stay" : `There are ${stats.count} stays`} in ${name} listed here.`);
  }
  parts.push(`${stats.count === 1 ? "It is" : "They are"} ${typeBreakdown(stats.types)}.`);
  parts.push("Owners set their own prices and nobody pays a platform fee. Pick dates to see the full price, then book directly.");
  return parts.join(" ");
}

/** Questions and answers computed from the data. Questions without data behind them are left out. */
export function placeFaq(name: string, stats: PlaceStats, asOf: string, airports: { code: string; name: string | null }[]) {
  const faq: { q: string; a: string }[] = [];
  const month = monthLabel(asOf);

  if (stats.count > 0 && stats.currency && stats.priceMin !== null && stats.priceMax !== null && stats.priceAvg !== null) {
    faq.push({
      q: `How much does a stay in ${name} cost per night?`,
      a:
        stats.count === 1
          ? `The one stay listed in ${name} starts at ${price(stats.priceMin, stats.currency)} a night before taxes, as of ${month}.`
          : `Starting prices for the ${stats.count} stays listed in ${name} range from ${price(stats.priceMin, stats.currency)} to ${price(stats.priceMax, stats.currency)} a night before taxes, as of ${month}. The average starting price is ${price(stats.priceAvg, stats.currency)} a night.`,
    });
  }

  if (stats.count > 0) {
    faq.push({ q: `What kinds of places can I book in ${name}?`, a: `${typeBreakdown(stats.types).replace(/^./, (c) => c.toUpperCase())}.` });

    faq.push({
      q: `Can I cancel a stay in ${name} for free?`,
      a:
        stats.freeCancellation === 0
          ? `None of the ${stats.count === 1 ? "stays" : stats.count + " stays"} listed in ${name} offer a full refund on cancellation right now. Each listing explains its own policy.`
          : `${stats.freeCancellation === stats.count ? (stats.count === 1 ? "The stay" : `All ${stats.count} stays`) : `${stats.freeCancellation} of the ${stats.count} stays`} listed in ${name} give a full refund if you cancel before a deadline. Each listing shows the exact date for your stay.`,
    });

    if (stats.instantBook > 0) {
      faq.push({
        q: `Can I book a stay in ${name} instantly?`,
        a: `${stats.instantBook === stats.count ? (stats.count === 1 ? "Yes, the stay" : `Yes, all ${stats.count} stays`) : `${stats.instantBook} of the ${stats.count} stays`} listed in ${name} confirm as soon as you pay. The others ask the owner to accept first.`,
      });
    }
  }

  if (stats.reviewCount > 0 && stats.ratingAvg !== null) {
    faq.push({
      q: `How do guests rate stays in ${name}?`,
      a: `Guests rate the ${stays(stats.ratedListings)} with reviews ${stats.ratingAvg.toFixed(1)} out of 5 on average, from ${stats.reviewCount} ${stats.reviewCount === 1 ? "review" : "reviews"}. Only guests who completed a booking can leave a review.`,
    });
  }

  if (airports.length) {
    const names = airports.map((a) => (a.name ? `${a.name} (${a.code})` : a.code));
    faq.push({
      q: `Which airport is nearest to ${name}?`,
      a: airports.length === 1 ? `The nearest airport is ${names[0]}.` : `The nearest airports are ${joinAnd(names)}.`,
    });
  }

  return faq;
}
