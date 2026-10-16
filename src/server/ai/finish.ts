import { addDays, formatDay as formatDayLocale, nightsBetween, type ISODate } from "../../lib/dates";
import { amenityLabel, propertyTypeLabels } from "../../lib/amenities";
import { formatMoney, toMinor } from "../../lib/money";
import type { FlightSearch, StaySearch } from "../../lib/search-params";
import { slugify } from "../../lib/slug";
import type { Intent } from "./intent";

export type AirportMatch = { iata: string; name: string; city: string };
export type PlaceMatch = { slug: string; name: string };

/** Lookups the finisher needs. Production wires these to searchAirports and suggestPlaces. */
export type Resolvers = {
  airports: (q: string) => Promise<AirportMatch[]>;
  places: (q: string) => Promise<PlaceMatch[]>;
};

export type MissingField = "from" | "to" | "depart" | "return" | "place" | "checkin" | "checkout" | "kind";

export type ParsedTrip = {
  kind: "flight" | "stay" | "unknown";
  flight?: Partial<FlightSearch>;
  stay?: Partial<StaySearch>;
  /** Plain phrases describing what was understood, in reading order. */
  understood: string[];
  /** Fields still needed before a search can run. */
  missing: MissingField[];
  /** Length of stay or trip when given without an end date ("for 3 nights"). */
  nights?: number;
  source: "rules" | "ai";
};

/**
 * Airports for the cities people type most, used when the airport lookup is
 * unavailable or finds nothing. Codes are the main commercial airport.
 */
const KNOWN_AIRPORTS: Record<string, AirportMatch> = Object.fromEntries(
  (
    [
      ["delhi", "DEL", "Indira Gandhi International Airport", "Delhi"],
      ["new delhi", "DEL", "Indira Gandhi International Airport", "Delhi"],
      ["mumbai", "BOM", "Chhatrapati Shivaji Maharaj International Airport", "Mumbai"],
      ["bombay", "BOM", "Chhatrapati Shivaji Maharaj International Airport", "Mumbai"],
      ["bengaluru", "BLR", "Kempegowda International Airport", "Bengaluru"],
      ["bangalore", "BLR", "Kempegowda International Airport", "Bengaluru"],
      ["goa", "GOI", "Dabolim Airport", "Goa"],
      ["chennai", "MAA", "Chennai International Airport", "Chennai"],
      ["madras", "MAA", "Chennai International Airport", "Chennai"],
      ["kolkata", "CCU", "Netaji Subhas Chandra Bose International Airport", "Kolkata"],
      ["calcutta", "CCU", "Netaji Subhas Chandra Bose International Airport", "Kolkata"],
      ["hyderabad", "HYD", "Rajiv Gandhi International Airport", "Hyderabad"],
      ["pune", "PNQ", "Pune Airport", "Pune"],
      ["ahmedabad", "AMD", "Sardar Vallabhbhai Patel International Airport", "Ahmedabad"],
      ["jaipur", "JAI", "Jaipur International Airport", "Jaipur"],
      ["kochi", "COK", "Cochin International Airport", "Kochi"],
      ["cochin", "COK", "Cochin International Airport", "Kochi"],
      ["lucknow", "LKO", "Chaudhary Charan Singh International Airport", "Lucknow"],
      ["srinagar", "SXR", "Srinagar Airport", "Srinagar"],
      ["leh", "IXL", "Kushok Bakula Rimpochee Airport", "Leh"],
      ["amritsar", "ATQ", "Sri Guru Ram Dass Jee International Airport", "Amritsar"],
      ["udaipur", "UDR", "Maharana Pratap Airport", "Udaipur"],
      ["varanasi", "VNS", "Lal Bahadur Shastri International Airport", "Varanasi"],
      ["thiruvananthapuram", "TRV", "Thiruvananthapuram International Airport", "Thiruvananthapuram"],
      ["trivandrum", "TRV", "Thiruvananthapuram International Airport", "Thiruvananthapuram"],
      ["guwahati", "GAU", "Lokpriya Gopinath Bordoloi International Airport", "Guwahati"],
      ["bhubaneswar", "BBI", "Biju Patnaik International Airport", "Bhubaneswar"],
      ["chandigarh", "IXC", "Chandigarh International Airport", "Chandigarh"],
      ["indore", "IDR", "Devi Ahilya Bai Holkar Airport", "Indore"],
      ["nagpur", "NAG", "Dr. Babasaheb Ambedkar International Airport", "Nagpur"],
      ["port blair", "IXZ", "Veer Savarkar International Airport", "Port Blair"],
      ["andaman", "IXZ", "Veer Savarkar International Airport", "Port Blair"],
      ["bagdogra", "IXB", "Bagdogra Airport", "Siliguri"],
      ["dubai", "DXB", "Dubai International Airport", "Dubai"],
      ["singapore", "SIN", "Singapore Changi Airport", "Singapore"],
      ["bangkok", "BKK", "Suvarnabhumi Airport", "Bangkok"],
      ["kathmandu", "KTM", "Tribhuvan International Airport", "Kathmandu"],
      ["colombo", "CMB", "Bandaranaike International Airport", "Colombo"],
      ["male", "MLE", "Velana International Airport", "Male"],
      ["maldives", "MLE", "Velana International Airport", "Male"],
      ["bali", "DPS", "Ngurah Rai International Airport", "Denpasar"],
      ["london", "LHR", "Heathrow Airport", "London"],
      ["new york", "JFK", "John F. Kennedy International Airport", "New York"],
      ["doha", "DOH", "Hamad International Airport", "Doha"],
      ["abu dhabi", "AUH", "Zayed International Airport", "Abu Dhabi"],
      ["kuala lumpur", "KUL", "Kuala Lumpur International Airport", "Kuala Lumpur"],
    ] as const
  ).map(([key, iata, name, city]) => [key, { iata, name, city }]),
);

const IATA_INDEX = new Map(Object.values(KNOWN_AIRPORTS).map((a) => [a.iata, a]));

/** "Fri 24 Oct", per docs/WRITING.md. */
function formatDay(d: ISODate) {
  return formatDayLocale(d).replace(",", "");
}

function titleCase(s: string) {
  return s.replace(/\b[a-z]/g, (c) => c.toUpperCase());
}

export async function resolveAirport(q: string, resolvers: Resolvers): Promise<AirportMatch | undefined> {
  const query = q.trim();
  const upper = query.toUpperCase();
  if (/^[A-Za-z]{3}$/.test(query) && IATA_INDEX.has(upper)) return IATA_INDEX.get(upper);
  try {
    const found = await resolvers.airports(query);
    const lower = query.toLowerCase();
    const byCode = found.find((a) => a.iata === upper);
    const byCity = found.find((a) => a.city.toLowerCase() === lower);
    // "GOA" typed in capitals is the code (Genoa); "goa" or "Goa" is the city.
    const best =
      (query === upper ? (byCode ?? byCity) : (byCity ?? byCode)) ??
      found.find((a) => a.city.toLowerCase().startsWith(lower) || a.name.toLowerCase().includes(lower));
    if (best) return best;
  } catch {
    // Lookup unavailable: fall through to the built in list.
  }
  return KNOWN_AIRPORTS[query.toLowerCase()];
}

export async function resolvePlace(q: string, resolvers: Resolvers): Promise<PlaceMatch> {
  try {
    const found = await resolvers.places(q);
    const lower = q.toLowerCase();
    const best = found.find((p) => p.name.toLowerCase() === lower || p.slug === slugify(q)) ?? found[0];
    if (best) return best;
  } catch {
    // Lookup unavailable: search by the typed name; the stays search resolves free text.
  }
  return { slug: slugify(q), name: titleCase(q) };
}

function travelersPhrase(adults?: number, children?: number, infants?: number) {
  const parts: string[] = [];
  if (adults) parts.push(`${adults} ${adults === 1 ? "adult" : "adults"}`);
  if (children) parts.push(`${children} ${children === 1 ? "child" : "children"}`);
  if (infants) parts.push(`${infants} ${infants === 1 ? "infant" : "infants"}`);
  return parts.join(", ");
}

const cabinLabel: Record<string, string> = {
  economy: "Economy",
  premium_economy: "Premium economy",
  business: "Business class",
  first: "First class",
};

const windowLabel: Record<string, string> = {
  early: "Leaving early morning",
  morning: "Leaving in the morning",
  afternoon: "Leaving in the afternoon",
  evening: "Leaving in the evening",
};

export async function finishIntent(
  intent: Intent,
  opts: { today: ISODate; defaultCurrency: string; resolvers: Resolvers; source: "rules" | "ai" },
): Promise<ParsedTrip> {
  const { today, resolvers } = opts;
  const currency = intent.currency ?? opts.defaultCurrency;
  const money = (major: number) => formatMoney({ amount: toMinor(major, currency), currency });
  const understood: string[] = [];
  const missing: MissingField[] = [];

  // Dates in the past are not searchable; drop them so the form asks again.
  const start = intent.start && intent.start >= today ? intent.start : undefined;
  const end = intent.end && start && intent.end >= start ? intent.end : undefined;

  if (intent.kind === "flight") {
    const flight: Partial<FlightSearch> = {};
    const [origin, destination] = await Promise.all([
      intent.origin ? resolveAirport(intent.origin, resolvers) : undefined,
      intent.destination ? resolveAirport(intent.destination, resolvers) : undefined,
    ]);
    if (origin) flight.from = origin.iata;
    if (destination) flight.to = destination.iata;
    if (origin && destination) understood.push(`Flight from ${origin.city} (${origin.iata}) to ${destination.city} (${destination.iata})`);
    else if (destination) understood.push(`Flight to ${destination.city} (${destination.iata})`);
    else if (origin) understood.push(`Flight from ${origin.city} (${origin.iata})`);
    else understood.push("A flight");
    if (!origin) missing.push("from");
    if (!destination) missing.push("to");

    if (start) {
      flight.depart = start;
      understood.push(`Leaving ${formatDay(start)}`);
    } else missing.push("depart");

    const returnDate = intent.oneWay ? undefined : (end ?? (start && intent.nights ? addDays(start, intent.nights) : undefined));
    if (returnDate) {
      flight.return = returnDate;
      understood.push(`Returning ${formatDay(returnDate)}`);
    } else if (intent.oneWay) understood.push("One way");
    else if (intent.roundTrip) missing.push("return");

    if (intent.adults || intent.children || intent.infants) {
      if (intent.adults) flight.adults = Math.min(9, intent.adults);
      if (intent.children) flight.children = Math.min(8, intent.children);
      if (intent.infants) flight.infants = Math.min(4, intent.infants, flight.adults ?? 1);
      understood.push(travelersPhrase(flight.adults, flight.children, flight.infants));
    }
    if (intent.cabin) {
      flight.cabin = intent.cabin;
      understood.push(cabinLabel[intent.cabin]);
    }
    if (intent.maxStops !== undefined) {
      flight.stops = intent.maxStops;
      understood.push(intent.maxStops === 0 ? "Non-stop only" : `At most ${intent.maxStops} stop`);
    }
    if (intent.departWindow) {
      flight.departWindow = intent.departWindow;
      understood.push(windowLabel[intent.departWindow]);
    }
    if (intent.maxPrice) {
      flight.maxPrice = toMinor(intent.maxPrice, currency);
      understood.push(`Up to ${money(intent.maxPrice)} in total`);
    }
    if (intent.sort === "cheap") {
      flight.sort = "price";
      understood.push("Cheapest first");
    } else if (intent.sort === "fast") {
      flight.sort = "duration";
      understood.push("Shortest first");
    } else if (intent.sort === "early") {
      flight.sort = "depart";
      understood.push("Earliest first");
    }
    return { kind: "flight", flight, understood, missing, nights: intent.nights, source: opts.source };
  }

  if (intent.kind === "stay" || (intent.kind === "unknown" && intent.destination && !intent.origin && (start || intent.nights))) {
    const stay: Partial<StaySearch> = {};
    if (intent.destination) {
      const place = await resolvePlace(intent.destination, resolvers);
      stay.place = place.slug;
      understood.push(intent.types?.length === 1 ? `${propertyTypeLabels[intent.types[0]]}s in ${place.name}` : `Stays in ${place.name}`);
    } else {
      understood.push(intent.types?.length === 1 ? `${propertyTypeLabels[intent.types[0]]}s` : "A place to stay");
      missing.push("place");
    }

    const checkout = end ?? (start && intent.nights ? addDays(start, intent.nights) : undefined);
    if (start) stay.checkin = start;
    if (checkout) stay.checkout = checkout;
    if (start && checkout) {
      const n = nightsBetween(start, checkout);
      understood.push(`${n} ${n === 1 ? "night" : "nights"}, ${formatDay(start)} to ${formatDay(checkout)}`);
    } else if (start) {
      understood.push(`Checking in ${formatDay(start)}`);
      missing.push("checkout");
    } else {
      if (intent.nights) understood.push(`${intent.nights} ${intent.nights === 1 ? "night" : "nights"}`);
      missing.push("checkin");
      if (!intent.nights) missing.push("checkout");
    }

    if (intent.adults || intent.children || intent.infants) {
      if (intent.adults) stay.adults = Math.min(16, intent.adults);
      const kids = (intent.children ?? 0) + (intent.infants ?? 0);
      if (kids) stay.children = Math.min(10, kids);
      if (!intent.adults && kids) stay.adults = 1;
      understood.push(travelersPhrase(stay.adults, stay.children));
    }
    if (intent.minPrice && intent.maxPrice) {
      stay.minPrice = toMinor(intent.minPrice, currency);
      stay.maxPrice = toMinor(intent.maxPrice, currency);
      understood.push(`${money(intent.minPrice)} to ${money(intent.maxPrice)} a night`);
    } else if (intent.maxPrice) {
      stay.maxPrice = toMinor(intent.maxPrice, currency);
      understood.push(`Under ${money(intent.maxPrice)} a night`);
    } else if (intent.minPrice) {
      stay.minPrice = toMinor(intent.minPrice, currency);
      understood.push(`Over ${money(intent.minPrice)} a night`);
    }
    if (intent.types?.length) {
      stay.types = intent.types.join(",");
      if (intent.types.length > 1) understood.push(intent.types.map((t) => propertyTypeLabels[t]).join(" or "));
    }
    if (intent.amenities?.length) {
      stay.amenities = intent.amenities.join(",");
      understood.push(`With ${intent.amenities.map((a) => amenityLabel(a).toLowerCase()).join(", ")}`);
    }
    if (intent.freeCancellation) {
      stay.freeCancellation = true;
      understood.push("Free cancellation");
    }
    if (intent.instantBook) {
      stay.instantBook = true;
      understood.push("Instant booking");
    }
    if (intent.minRating) {
      stay.minRating = intent.minRating;
      understood.push(`Rated ${intent.minRating} or higher`);
    }
    if (intent.sort === "cheap") {
      stay.sort = "price_asc";
      understood.push("Lowest price first");
    } else if (intent.sort === "luxury") {
      stay.sort = "price_desc";
      understood.push("Highest price first");
    } else if (intent.sort === "rating") {
      stay.sort = "rating";
      understood.push("Best rated first");
    }
    return { kind: "stay", stay, understood, missing, nights: intent.nights, source: opts.source };
  }

  // Not sure yet whether this is a flight or a stay. Keep what we can and ask.
  if (intent.destination) understood.push(`Somewhere around ${titleCase(intent.destination)}`);
  if (start) understood.push(end ? `${formatDay(start)} to ${formatDay(end)}` : `From ${formatDay(start)}`);
  if (intent.adults || intent.children) understood.push(travelersPhrase(intent.adults, intent.children, intent.infants));
  return { kind: "unknown", understood, missing: ["kind"], source: opts.source };
}
