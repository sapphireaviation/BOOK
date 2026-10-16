import "server-only";
import type { CabinClass, FlightSearch } from "@/lib/search-params";
import { localToUtc, utcToLocal } from "@/lib/flight-time";
import { getAirport, type AirportRecord } from "./airports";
import { approxFlightMinutes, greatCircleKm } from "./geo";
import {
  OfferExpiredError,
  type Carrier,
  type Conditions,
  type FlightProvider,
  type Offer,
  type OfferPassenger,
  type OrderResult,
  type PassengerInput,
  type PassengerType,
  type Place,
  type SearchResult,
  type Segment,
  type Slice,
} from "./types";

/**
 * Fixture provider: deterministic synthetic offers for development and tests only.
 * getFlightProvider() never returns it when NODE_ENV is production, and every page that shows its
 * offers carries a visible "Test data" badge. Airline codes are real and chosen by the countries
 * they are based in; schedules and prices are computed from distance and date, not taken from airlines.
 */

type FixtureCarrier = { iata: string; name: string; country: string; hubs: string[]; lowCost?: boolean; connector?: boolean };

const CARRIERS: FixtureCarrier[] = [
  { iata: "6E", name: "IndiGo", country: "IN", hubs: ["DEL", "BOM", "BLR", "HYD"], lowCost: true },
  { iata: "AI", name: "Air India", country: "IN", hubs: ["DEL", "BOM", "BLR"] },
  { iata: "IX", name: "Air India Express", country: "IN", hubs: ["BLR", "COK", "DEL"], lowCost: true },
  { iata: "QP", name: "Akasa Air", country: "IN", hubs: ["BOM", "BLR"], lowCost: true },
  { iata: "SG", name: "SpiceJet", country: "IN", hubs: ["DEL", "BOM"], lowCost: true },
  { iata: "EK", name: "Emirates", country: "AE", hubs: ["DXB"], connector: true },
  { iata: "EY", name: "Etihad Airways", country: "AE", hubs: ["AUH"], connector: true },
  { iata: "FZ", name: "flydubai", country: "AE", hubs: ["DXB"], lowCost: true },
  { iata: "G9", name: "Air Arabia", country: "AE", hubs: ["SHJ"], lowCost: true },
  { iata: "QR", name: "Qatar Airways", country: "QA", hubs: ["DOH"], connector: true },
  { iata: "WY", name: "Oman Air", country: "OM", hubs: ["MCT"] },
  { iata: "SV", name: "Saudia", country: "SA", hubs: ["JED", "RUH"] },
  { iata: "XY", name: "flynas", country: "SA", hubs: ["RUH"], lowCost: true },
  { iata: "GF", name: "Gulf Air", country: "BH", hubs: ["BAH"] },
  { iata: "KU", name: "Kuwait Airways", country: "KW", hubs: ["KWI"] },
  { iata: "SQ", name: "Singapore Airlines", country: "SG", hubs: ["SIN"], connector: true },
  { iata: "TR", name: "Scoot", country: "SG", hubs: ["SIN"], lowCost: true },
  { iata: "TG", name: "Thai Airways", country: "TH", hubs: ["BKK"] },
  { iata: "FD", name: "Thai AirAsia", country: "TH", hubs: ["DMK"], lowCost: true },
  { iata: "MH", name: "Malaysia Airlines", country: "MY", hubs: ["KUL"] },
  { iata: "AK", name: "AirAsia", country: "MY", hubs: ["KUL"], lowCost: true },
  { iata: "GA", name: "Garuda Indonesia", country: "ID", hubs: ["CGK"] },
  { iata: "VN", name: "Vietnam Airlines", country: "VN", hubs: ["HAN", "SGN"] },
  { iata: "VJ", name: "VietJet Air", country: "VN", hubs: ["SGN", "HAN"], lowCost: true },
  { iata: "PR", name: "Philippine Airlines", country: "PH", hubs: ["MNL"] },
  { iata: "UL", name: "SriLankan Airlines", country: "LK", hubs: ["CMB"] },
  { iata: "BG", name: "Biman Bangladesh Airlines", country: "BD", hubs: ["DAC"] },
  { iata: "BA", name: "British Airways", country: "GB", hubs: ["LHR"], connector: true },
  { iata: "VS", name: "Virgin Atlantic", country: "GB", hubs: ["LHR"] },
  { iata: "U2", name: "easyJet", country: "GB", hubs: ["LGW"], lowCost: true },
  { iata: "EI", name: "Aer Lingus", country: "IE", hubs: ["DUB"] },
  { iata: "FR", name: "Ryanair", country: "IE", hubs: ["DUB", "STN"], lowCost: true },
  { iata: "AF", name: "Air France", country: "FR", hubs: ["CDG"], connector: true },
  { iata: "LH", name: "Lufthansa", country: "DE", hubs: ["FRA", "MUC"], connector: true },
  { iata: "KL", name: "KLM", country: "NL", hubs: ["AMS"], connector: true },
  { iata: "LX", name: "Swiss", country: "CH", hubs: ["ZRH"] },
  { iata: "TK", name: "Turkish Airlines", country: "TR", hubs: ["IST"], connector: true },
  { iata: "IB", name: "Iberia", country: "ES", hubs: ["MAD"] },
  { iata: "AZ", name: "ITA Airways", country: "IT", hubs: ["FCO"] },
  { iata: "AA", name: "American Airlines", country: "US", hubs: ["DFW", "CLT", "ORD", "MIA"] },
  { iata: "DL", name: "Delta Air Lines", country: "US", hubs: ["ATL", "MSP", "DTW", "JFK"] },
  { iata: "UA", name: "United Airlines", country: "US", hubs: ["ORD", "EWR", "DEN", "IAH", "SFO"] },
  { iata: "B6", name: "JetBlue", country: "US", hubs: ["JFK", "BOS"], lowCost: true },
  { iata: "AC", name: "Air Canada", country: "CA", hubs: ["YYZ", "YVR"] },
  { iata: "QF", name: "Qantas", country: "AU", hubs: ["SYD", "MEL"] },
  { iata: "JQ", name: "Jetstar", country: "AU", hubs: ["MEL", "SYD"], lowCost: true },
  { iata: "NZ", name: "Air New Zealand", country: "NZ", hubs: ["AKL"] },
  { iata: "JL", name: "Japan Airlines", country: "JP", hubs: ["HND", "NRT"] },
  { iata: "NH", name: "ANA", country: "JP", hubs: ["HND", "NRT"] },
  { iata: "KE", name: "Korean Air", country: "KR", hubs: ["ICN"] },
  { iata: "CA", name: "Air China", country: "CN", hubs: ["PEK"] },
  { iata: "MU", name: "China Eastern Airlines", country: "CN", hubs: ["PVG"] },
  { iata: "CZ", name: "China Southern Airlines", country: "CN", hubs: ["CAN"] },
  { iata: "CX", name: "Cathay Pacific", country: "HK", hubs: ["HKG"], connector: true },
  { iata: "CI", name: "China Airlines", country: "TW", hubs: ["TPE"] },
  { iata: "ET", name: "Ethiopian Airlines", country: "ET", hubs: ["ADD"], connector: true },
  { iata: "KQ", name: "Kenya Airways", country: "KE", hubs: ["NBO"] },
  { iata: "SA", name: "South African Airways", country: "ZA", hubs: ["JNB"] },
  { iata: "MS", name: "EgyptAir", country: "EG", hubs: ["CAI"] },
  { iata: "AM", name: "Aeromexico", country: "MX", hubs: ["MEX"] },
  { iata: "LA", name: "LATAM Airlines", country: "CL", hubs: ["SCL", "GRU", "LIM"] },
  { iata: "G3", name: "Gol", country: "BR", hubs: ["GRU"], lowCost: true },
];

const LOW_COST_RANGE_KM = 4500;
const LONG_RANGE_KM = 15500;
const MAX_OFFERS = 30;

const FIXTURE_CURRENCY = "INR";
const OFFER_TTL_MS = 30 * 60_000;

// Deterministic randomness

export function hash(s: string) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function rng(seed: string) {
  let a = hash(seed);
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Offer ids carry the search so getOffer can rebuild the same offer without storage.

type EncodedSearch = [string, string, string, string, number, number, number, CabinClass];

function encodeSearch(p: FlightSearch): string {
  const tuple: EncodedSearch = [p.from, p.to, p.depart, p.return ?? "", p.adults, p.children, p.infants, p.cabin];
  return Buffer.from(JSON.stringify(tuple)).toString("base64url");
}

export function decodeOfferId(offerId: string): { search: FlightSearch; key: string } | null {
  const m = offerId.match(/^fx_([A-Za-z0-9_-]+)\.([A-Za-z0-9-]+)$/);
  if (!m) return null;
  try {
    const t = JSON.parse(Buffer.from(m[1], "base64url").toString("utf8")) as EncodedSearch;
    if (!Array.isArray(t) || t.length !== 8) return null;
    const [from, to, depart, ret, adults, children, infants, cabin] = t;
    return { search: { from, to, depart, return: ret || undefined, adults, children, infants, cabin, sort: "price" }, key: m[2] };
  } catch {
    return null;
  }
}

// Geography

function zoneOf(a: AirportRecord) {
  if (a.timeZone) return a.timeZone;
  const hours = Math.max(-12, Math.min(14, Math.round(a.lng / 15)));
  return hours === 0 ? "Etc/UTC" : `Etc/GMT${hours > 0 ? "-" : "+"}${Math.abs(hours)}`;
}

function toPlace(a: AirportRecord): Place {
  return { iata: a.iata, name: a.name, city: a.city, timeZone: zoneOf(a), countryCode: a.countryCode, terminal: null };
}

function km(a: AirportRecord, b: AirportRecord) {
  return greatCircleKm(a, b);
}

// Itinerary building

type Leg = { from: AirportRecord; to: AirportRecord };
type Option = { carrier: FixtureCarrier; legs: Leg[]; departMinute: number; layovers: number[]; key: string };

function allowedCarriers(cabin: CabinClass) {
  return cabin === "economy" ? CARRIERS : CARRIERS.filter((c) => !c.lowCost);
}

function nonstopCarriers(o: AirportRecord, d: AirportRecord, dist: number, cabin: CabinClass) {
  const domestic = o.countryCode === d.countryCode;
  return allowedCarriers(cabin).filter((c) => {
    if (dist > (c.lowCost ? LOW_COST_RANGE_KM : LONG_RANGE_KM)) return false;
    return domestic ? c.country === o.countryCode : c.country === o.countryCode || c.country === d.countryCode;
  });
}

function connections(o: AirportRecord, d: AirportRecord, dist: number, cabin: CabinClass) {
  const domestic = o.countryCode === d.countryCode;
  const out: { carrier: FixtureCarrier; hub: AirportRecord; detour: number }[] = [];
  for (const c of allowedCarriers(cabin)) {
    const local = c.country === o.countryCode || c.country === d.countryCode;
    if (domestic ? c.country !== o.countryCode : !(local || c.connector)) continue;
    for (const code of c.hubs) {
      if (code === o.iata || code === d.iata) continue;
      const hub = getAirport(code);
      if (!hub) continue;
      const a = km(o, hub);
      const b = km(hub, d);
      const range = c.lowCost ? LOW_COST_RANGE_KM : LONG_RANGE_KM;
      if (a > range || b > range || a < 150 || b < 150) continue;
      out.push({ carrier: c, hub, detour: (a + b) / Math.max(dist, 1) });
    }
  }
  out.sort((x, y) => x.detour - y.detour || x.carrier.iata.localeCompare(y.carrier.iata));
  const close = out.filter((x) => x.detour <= 1.3);
  // Remote pairs with no sensible hub still get the least bad connections.
  return close.length ? close : out.slice(0, 3);
}

function buildOptions(o: AirportRecord, d: AirportRecord, date: string, cabin: CabinClass): Option[] {
  const dist = km(o, d);
  const options: Option[] = [];
  if (dist < 80) return options;
  const flightsPerCarrier = dist < 1300 ? 3 : dist < 3500 ? 2 : 1;

  for (const c of nonstopCarriers(o, d, dist, cabin)) {
    const r = rng(`${o.iata}${d.iata}${c.iata}${date}ns`);
    const count = 1 + Math.floor(r() * flightsPerCarrier);
    for (let i = 0; i < count; i++) {
      // Departures between 05:00 and 23:30, five minute steps.
      const departMinute = 300 + Math.floor(r() * 222) * 5;
      options.push({ carrier: c, legs: [{ from: o, to: d }], departMinute, layovers: [], key: `${c.iata}-n${i}` });
    }
  }

  const conns = connections(o, d, dist, cabin).slice(0, options.length ? 4 : 6);
  conns.forEach(({ carrier, hub }, idx) => {
    const r = rng(`${o.iata}${d.iata}${carrier.iata}${hub.iata}${date}cx`);
    const minLayover = o.countryCode === d.countryCode ? 50 : 75;
    const count = options.length ? 1 : 2;
    for (let i = 0; i < count; i++) {
      const departMinute = 300 + Math.floor(r() * 222) * 5;
      const layover = minLayover + Math.floor(r() * 30) * 5;
      options.push({
        carrier,
        legs: [
          { from: o, to: hub },
          { from: hub, to: d },
        ],
        departMinute,
        layovers: [layover],
        key: `${carrier.iata}-${hub.iata}${idx}${i}`,
      });
    }
  });

  return options;
}

const AIRCRAFT = {
  regional: ["ATR 72-600", "De Havilland Dash 8-400"],
  narrow: ["Airbus A320neo", "Airbus A321neo", "Boeing 737 MAX 8", "Boeing 737-800"],
  wide: ["Boeing 787-9", "Airbus A350-900", "Boeing 777-300ER", "Airbus A330-300"],
};

function aircraftFor(dist: number, seed: string) {
  const list = dist < 500 ? AIRCRAFT.regional : dist < 4000 ? AIRCRAFT.narrow : AIRCRAFT.wide;
  return list[hash(seed) % list.length];
}

const CABIN_NAMES: Record<CabinClass, string> = { economy: "Economy", premium_economy: "Premium Economy", business: "Business", first: "First" };

function carrierOf(c: FixtureCarrier): Carrier {
  return { iata: c.iata, name: c.name, logoUrl: null };
}

function buildSlice(opt: Option, date: string, cabin: CabinClass, sliceIdx: number): Slice {
  const segments: Segment[] = [];
  let departLocal = `${date}T${String(Math.floor(opt.departMinute / 60)).padStart(2, "0")}:${String(opt.departMinute % 60).padStart(2, "0")}:00`;
  opt.legs.forEach((leg, i) => {
    const from = toPlace(leg.from);
    const to = toPlace(leg.to);
    const dist = km(leg.from, leg.to);
    const duration = approxFlightMinutes(dist) + (hash(`${opt.key}${i}${date}`) % 4) * 5;
    const departUtc = localToUtc(departLocal, from.timeZone);
    const arriveUtc = new Date(departUtc.getTime() + duration * 60_000);
    const arriveLocal = utcToLocal(arriveUtc, to.timeZone);
    const flightNo = 100 + (hash(`${opt.carrier.iata}${leg.from.iata}${leg.to.iata}${opt.departMinute}`) % 8900);
    segments.push({
      id: `seg_fx_${sliceIdx}_${i}`,
      origin: from,
      destination: to,
      departAt: departLocal,
      arriveAt: arriveLocal,
      durationMinutes: duration,
      marketingCarrier: carrierOf(opt.carrier),
      operatingCarrier: carrierOf(opt.carrier),
      flightNumber: `${opt.carrier.iata} ${flightNo}`,
      aircraft: aircraftFor(dist, `${opt.key}${i}`),
      cabin: CABIN_NAMES[cabin],
      baggage: null,
      technicalStops: [],
    });
    if (i < opt.layovers.length) departLocal = utcToLocal(new Date(arriveUtc.getTime() + opt.layovers[i] * 60_000), to.timeZone);
  });
  const first = segments[0];
  const last = segments[segments.length - 1];
  const durationMinutes = Math.round(
    (localToUtc(last.arriveAt, last.destination.timeZone).getTime() - localToUtc(first.departAt, first.origin.timeZone).getTime()) / 60_000,
  );
  return {
    id: `sli_fx_${sliceIdx}`,
    origin: first.origin,
    destination: last.destination,
    departAt: first.departAt,
    arriveAt: last.arriveAt,
    durationMinutes,
    stops: segments.length - 1,
    segments,
    fareBrand: null,
  };
}

// Pricing, in whole rupees, converted to paise at the end.

const CABIN_FACTOR: Record<CabinClass, number> = { economy: 1, premium_economy: 1.7, business: 3.4, first: 5.5 };
const MONTH_FACTOR = [1, 0.95, 1, 1, 1.1, 1.1, 1, 0.95, 1, 1.05, 1.05, 1.15];
const WEEKDAY_FACTOR = [1.12, 1, 0.92, 0.92, 1, 1.12, 1]; // Sun to Sat

function adultFare(dist: number, opt: Option, date: string, cabin: CabinClass) {
  const d = new Date(`${date}T00:00:00Z`);
  let fare = dist < 2000 ? 1800 + 3.2 * dist : 1800 + 3.9 * dist;
  fare *= CABIN_FACTOR[cabin];
  fare *= MONTH_FACTOR[d.getUTCMonth()] * WEEKDAY_FACTOR[d.getUTCDay()];
  fare *= opt.carrier.lowCost ? 0.88 : 1.08;
  if (opt.legs.length > 1) fare *= 0.9;
  if (opt.departMinute < 360) fare *= 0.93;
  else if ((opt.departMinute >= 420 && opt.departMinute < 570) || (opt.departMinute >= 1080 && opt.departMinute < 1260)) fare *= 1.06;
  fare *= 0.92 + (hash(`${opt.key}${date}price`) % 17) / 100;
  return fare;
}

type FareBrand = { name: string; factor: number; conditions: (domestic: boolean, lowCost: boolean, longHaul: boolean) => Omit<Conditions, "checkedBags" | "cabinBags"> };

const RUPEES = (n: number) => ({ amount: n * 100, currency: FIXTURE_CURRENCY });

const BRANDS: FareBrand[] = [
  {
    name: "Saver",
    factor: 1,
    conditions: (domestic) => ({
      refundable: true,
      refundPenalty: RUPEES(domestic ? 3500 : 6000),
      changeable: true,
      changePenalty: RUPEES(domestic ? 2999 : 4500),
      refund: "allowed",
      change: "allowed",
    }),
  },
  {
    name: "Basic",
    factor: 0.94,
    conditions: (domestic) => ({
      refundable: false,
      refundPenalty: null,
      changeable: true,
      changePenalty: RUPEES(domestic ? 3500 : 9000),
      refund: "not_allowed",
      change: "allowed",
    }),
  },
  {
    name: "Flexi",
    factor: 1.18,
    conditions: (domestic) => ({
      refundable: true,
      refundPenalty: RUPEES(domestic ? 1500 : 3000),
      changeable: true,
      changePenalty: null,
      refund: "allowed",
      change: "allowed",
    }),
  },
];

function brandFor(opt: Option, date: string, cabin: CabinClass) {
  if (cabin === "business" || cabin === "first") return BRANDS[2];
  return BRANDS[hash(`${opt.key}${date}brand`) % BRANDS.length];
}

function baggageFor(c: FixtureCarrier, cabin: CabinClass, domestic: boolean, longHaul: boolean) {
  if (cabin === "business" || cabin === "first") return { checked: 2, cabin: 1 };
  if (c.lowCost && !domestic && (c.country === "IE" || c.country === "GB")) return { checked: 0, cabin: 1 };
  return { checked: longHaul && !c.lowCost ? 2 : 1, cabin: 1 };
}

function passengersFor(p: FlightSearch): OfferPassenger[] {
  const types: PassengerType[] = [
    ...Array<PassengerType>(p.adults).fill("adult"),
    ...Array<PassengerType>(p.children).fill("child"),
    ...Array<PassengerType>(p.infants).fill("infant_without_seat"),
  ];
  return types.map((type, i) => ({ id: `pas_fx_${i + 1}`, type, age: null }));
}

function priceOffer(slices: { opt: Option; date: string }[], p: FlightSearch, domestic: boolean) {
  let base = 0;
  let tax = 0;
  for (const { opt, date } of slices) {
    const dist = opt.legs.reduce((s, l) => s + km(l.from, l.to), 0);
    const brand = brandFor(opt, date, p.cabin);
    const adult = adultFare(dist, opt, date, p.cabin) * brand.factor;
    const perPax: { count: number; fare: number; infant: boolean }[] = [
      { count: p.adults, fare: adult, infant: false },
      { count: p.children, fare: adult * 0.75, infant: false },
      { count: p.infants, fare: Math.max(1500, adult * 0.1), infant: true },
    ];
    for (const { count, fare, infant } of perPax) {
      if (!count) continue;
      const b = Math.round(fare);
      const t = infant ? 300 : Math.round(domestic ? 600 + b * 0.05 : 1500 + b * 0.08 + (dist > 3000 ? 1500 : 0));
      base += b * count;
      tax += t * count;
    }
  }
  return { base: base * 100, tax: tax * 100 };
}

export function generateOffers(p: FlightSearch, now = new Date()): Offer[] {
  const o = getAirport(p.from);
  const d = getAirport(p.to);
  if (!o || !d || o.iata === d.iata) return [];
  const domestic = o.countryCode === d.countryCode;
  const dist = km(o, d);
  const longHaul = dist > 4000;
  const outbound = buildOptions(o, d, p.depart, p.cabin);
  const inbound = p.return ? buildOptions(d, o, p.return, p.cabin) : [];
  const passengers = passengersFor(p);
  const prefix = `fx_${encodeSearch(p)}`;
  const expiresAt = new Date(now.getTime() + OFFER_TTL_MS).toISOString();

  const offers: Offer[] = [];
  outbound.forEach((out, i) => {
    let back: Option | undefined;
    if (p.return) {
      const same = inbound.filter((x) => x.carrier.iata === out.carrier.iata);
      back = same.length ? same[i % same.length] : inbound[i % Math.max(inbound.length, 1)];
      if (!back) return;
    }
    const parts = [{ opt: out, date: p.depart }, ...(back ? [{ opt: back, date: p.return! }] : [])];
    const slices = parts.map((part, idx) => buildSlice(part.opt, part.date, p.cabin, idx));
    const brand = brandFor(out, p.depart, p.cabin);
    slices.forEach((s) => (s.fareBrand = brand.name));
    const bags = baggageFor(out.carrier, p.cabin, domestic, longHaul);
    slices.forEach((s) => s.segments.forEach((seg) => (seg.baggage = bags)));
    const { base, tax } = priceOffer(parts, p, domestic);
    offers.push({
      id: `${prefix}.${out.key}${back ? `-${back.key}` : ""}`,
      provider: "fixture",
      total: base + tax,
      currency: FIXTURE_CURRENCY,
      baseAmount: base,
      taxAmount: tax,
      slices,
      owner: carrierOf(out.carrier),
      conditions: { ...brand.conditions(domestic, Boolean(out.carrier.lowCost), longHaul), checkedBags: bags.checked, cabinBags: bags.cabin },
      expiresAt,
      passengerIds: passengers.map((x) => x.id),
      requiresPassport: !domestic,
      passengers,
      cabinClass: p.cabin,
      live: false,
    });
  });

  return offers.sort((a, b) => a.total - b.total || a.id.localeCompare(b.id)).slice(0, MAX_OFFERS);
}

export class FixtureProvider implements FlightProvider {
  readonly name = "fixture";

  constructor(private readonly clock: () => Date = () => new Date()) {}

  async search(params: FlightSearch): Promise<SearchResult> {
    const offers = generateOffers(params, this.clock());
    return { offers, requestId: `orq_fx_${hash(JSON.stringify([params.from, params.to, params.depart, params.return]))}`, currency: FIXTURE_CURRENCY, provider: this.name };
  }

  async getOffer(offerId: string): Promise<Offer> {
    const decoded = decodeOfferId(offerId);
    if (!decoded) throw new OfferExpiredError();
    const today = this.clock().toISOString().slice(0, 10);
    if (decoded.search.depart < today) throw new OfferExpiredError();
    const offer = generateOffers(decoded.search, this.clock()).find((o) => o.id === offerId);
    if (!offer) throw new OfferExpiredError();
    return offer;
  }

  async createOrder(input: { offerId: string; passengers: PassengerInput[]; amount: number; currency: string }): Promise<OrderResult> {
    const offer = await this.getOffer(input.offerId);
    if (input.amount !== offer.total || input.currency !== offer.currency) throw new Error("The amount does not match the offer total.");
    const seed = hash(`${input.offerId}${input.passengers.map((p) => p.familyName).join()}`);
    const ref = seed.toString(36).toUpperCase().padStart(6, "X").slice(0, 6);
    return { orderId: `ord_fx_${seed.toString(36)}`, airlineReference: ref, raw: { provider: "fixture", offerId: input.offerId } };
  }

  async cancelOrder(orderId: string) {
    void orderId;
    return { refundAmount: 0, currency: FIXTURE_CURRENCY };
  }
}
