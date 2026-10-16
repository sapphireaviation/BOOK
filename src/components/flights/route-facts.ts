import { site } from "@/config/site";
import { formatDay } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import type { RouteSearchFacts } from "@/server/flights/routes";
import { durationLabel } from "./format";

/** Facts about a route computed from airport data and real searches, plus the FAQ built only from them. */

export type RouteFactsInput = {
  origin: { iata: string; name: string; city: string };
  destination: { iata: string; name: string; city: string };
  distanceKm: number;
  distanceMiles: number;
  approxMinutes: number;
  otherOriginAirports: { iata: string; name: string }[];
  otherDestinationAirports: { iata: string; name: string }[];
  search: RouteSearchFacts;
};

const num = (n: number) => new Intl.NumberFormat(site.defaultLocale).format(Math.round(n));

export function listJoin(items: string[]) {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

export function routeSummary(f: RouteFactsInput) {
  const { origin: o, destination: d } = f;
  const parts = [
    `${o.city} (${o.iata}, ${o.name}) and ${d.city} (${d.iata}, ${d.name}) are ${num(f.distanceKm)} km apart in a straight line.`,
    `A nonstop flight over that distance takes about ${durationLabel(f.approxMinutes)}.`,
  ];
  if (f.search.carriers.length) {
    parts.push(
      `In searches on ${site.name} over the last ${f.search.windowDays} days, fares on this route came from ${listJoin(f.search.carriers.slice(0, 5).map((c) => c.name))}.`,
    );
  }
  parts.push(`Search live fares below. You pay the airline's fare, with no platform fee.`);
  return parts.join(" ");
}

export function routeFaqs(f: RouteFactsInput) {
  const { origin: o, destination: d } = f;
  const faqs: { q: string; a: string }[] = [
    {
      q: `How far is ${d.city} from ${o.city} by plane?`,
      a: `The great-circle distance from ${o.name} (${o.iata}) to ${d.name} (${d.iata}) is ${num(f.distanceKm)} km (${num(f.distanceMiles)} miles). Actual flight paths are usually a little longer.`,
    },
    {
      q: `How long is the flight from ${o.city} to ${d.city}?`,
      a: `A nonstop flight takes about ${durationLabel(f.approxMinutes)}. This is an estimate from the distance. Each flight's scheduled time is shown in the search results, and flights with a stop take longer.`,
    },
    {
      q: `Which airports serve flights from ${o.city} to ${d.city}?`,
      a: [
        `Flights on this route leave from ${o.name} (${o.iata}) and arrive at ${d.name} (${d.iata}).`,
        f.otherOriginAirports.length ? `${o.city} also has ${listJoin(f.otherOriginAirports.map((a) => `${a.name} (${a.iata})`))}.` : "",
        f.otherDestinationAirports.length ? `${d.city} also has ${listJoin(f.otherDestinationAirports.map((a) => `${a.name} (${a.iata})`))}.` : "",
      ]
        .filter(Boolean)
        .join(" "),
    },
  ];
  if (f.search.carriers.length) {
    faqs.push({
      q: `Which airlines fly from ${o.city} to ${d.city}?`,
      a: `In searches on ${site.name} over the last ${f.search.windowDays} days, fares came from ${listJoin(f.search.carriers.map((c) => c.name))}. Schedules change, so search your dates to see who flies that day.`,
    });
  }
  if (f.search.cheapest) {
    const c = f.search.cheapest;
    faqs.push({
      q: `What is the cheapest fare seen from ${o.city} to ${d.city}?`,
      a: `The lowest one way economy fare for one adult seen in recent searches was ${formatMoney(c)}, for travel on ${formatDay(c.depart)}. Fares change often; search your dates for the current price.`,
    });
  }
  faqs.push({
    q: "Do you charge a booking fee?",
    a: `No. ${site.name} charges no platform fee. The price you see is the airline's fare plus taxes and airline fees.`,
  });
  return faqs;
}
