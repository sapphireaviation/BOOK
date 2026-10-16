import { addDays, parseISODate, toISODate, type ISODate } from "../../lib/dates";
import type { Intent } from "./intent";

/**
 * Rule based trip parser. Turns a sentence like
 * "2 adults and a child in goa next weekend under ₹4,000 a night with pool"
 * into an Intent without calling any service. Deterministic for a fixed `today`.
 */

const MONTHS: Record<string, number> = {
  jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4, may: 5, jun: 6, june: 6,
  jul: 7, july: 7, aug: 8, august: 8, sep: 9, sept: 9, september: 9, oct: 10, october: 10, nov: 11, november: 11,
  dec: 12, december: 12,
};
const MONTH_RE = "(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\\.?";
const ORD = "(?:st|nd|rd|th)?";

const WEEKDAYS: Record<string, number> = {
  sun: 0, sunday: 0, mon: 1, monday: 1, tue: 2, tues: 2, tuesday: 2, wed: 3, wednesday: 3,
  thu: 4, thur: 4, thurs: 4, thursday: 4, fri: 5, friday: 5, sat: 6, saturday: 6,
};
const WEEKDAY_RE = "(sun(?:day)?|mon(?:day)?|tue(?:s(?:day)?)?|wed(?:nesday)?|thu(?:r(?:s(?:day)?)?)?|fri(?:day)?|sat(?:urday)?)";

const NUMBER_WORDS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12,
};

export type RuleContext = { today: ISODate; defaultCurrency: string };

type Span = { start: number; end: number };

/** Mutable working copy of the sentence. Matched parts are blanked so later rules and place extraction skip them. */
class Text {
  value: string;
  constructor(value: string) {
    this.value = value;
  }
  /** Runs `re` (global) and calls `fn` for each match; when fn returns true the match is blanked out. */
  take(re: RegExp, fn: (m: RegExpExecArray) => boolean | void) {
    const flags = re.flags.includes("g") ? re.flags : `${re.flags}g`;
    const rx = new RegExp(re.source, flags);
    const spans: Span[] = [];
    let m: RegExpExecArray | null;
    while ((m = rx.exec(this.value))) {
      if (m[0].length === 0) {
        rx.lastIndex++;
        continue;
      }
      if (fn(m)) spans.push({ start: m.index, end: m.index + m[0].length });
    }
    for (const s of spans) this.blank(s);
    return spans.length > 0;
  }
  has(re: RegExp) {
    return re.test(this.value);
  }
  blank(s: Span) {
    // Same length keeps earlier match positions valid; the bar stops phrases running across the gap.
    const len = s.end - s.start;
    const filler = len >= 3 ? ` |${" ".repeat(len - 2)}` : " ".repeat(len);
    this.value = this.value.slice(0, s.start) + filler + this.value.slice(s.end);
  }
}

export function normalize(input: string) {
  let t = ` ${input.toLowerCase()} `
    .replace(/[‘’]/g, "'")
    .replace(/[“”"]/g, " ")
    .replace(/(\d),(?=\d{2,3}\b)/g, "$1")
    .replace(/\brs\.?\s*(?=\d)/g, "₹")
    .replace(/\binr\s*(?=\d)/g, "₹")
    .replace(/(\d+(?:\.\d+)?)\s*k\b/g, (_, n) => String(Math.round(Number(n) * 1000)))
    .replace(/(\d+(?:\.\d+)?)\s*(?:lakh|lac)s?\b/g, (_, n) => String(Math.round(Number(n) * 100000)))
    .replace(/\bone[\s-]way\b/g, "oneway")
    .replace(/\ba couple of\b/g, "2")
    .replace(/[!?;]/g, " , ")
    .replace(/\s+/g, " ");
  t = t.replace(/\b(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\b/g, (w) => String(NUMBER_WORDS[w]));
  return t;
}

const FLIGHT_WORDS = /\b(fly|flying|flight|flights|airfare|airline|airlines|plane|oneway|round ?trip|return flight|nonstop|non-stop|direct flight|economy|business class|first class|premium economy|depart|departing|layover|airport)\b/;
const STAY_WORDS = /\b(stay|stays|staying|hotel|hotels|homestay|homestays|villa|villas|apartment|apartments|flat|hostel|hostels|resort|resorts|guesthouse|guest house|cottage|cabin|room|rooms|nights?|accommodation|lodging|place to stay|check ?in|check ?out|pool|pet friendly|pets|beachfront|bnb|airbnb)\b/;

export function extractIntent(input: string, ctx: RuleContext): Intent {
  const text = new Text(normalize(input));
  const intent: Intent = { kind: "unknown" };

  // Kind from vocabulary. Decided before spans are blanked so "flight" and "hotel" still count.
  const flightScore = (text.value.match(new RegExp(FLIGHT_WORDS.source, "g")) ?? []).length;
  const stayScore = (text.value.match(new RegExp(STAY_WORDS.source, "g")) ?? []).length;
  if (flightScore > stayScore) intent.kind = "flight";
  else if (stayScore > flightScore) intent.kind = "stay";

  readTripType(text, intent);
  readCabin(text, intent);
  readFlightFilters(text, intent);
  readPrice(text, intent, ctx);
  readSort(text, intent);
  readStayFilters(text, intent);
  readTravelers(text, intent);
  readDates(text, intent, ctx);
  readPlaces(text, intent);

  // Two places joined by "to" read as a flight even without the word.
  if (intent.kind === "unknown" && intent.origin && intent.destination) intent.kind = "flight";
  if (intent.kind === "unknown" && (intent.amenities?.length || intent.types?.length || intent.nights)) intent.kind = "stay";
  return intent;
}

function readTripType(text: Text, intent: Intent) {
  text.take(/\boneway\b/, () => ((intent.oneWay = true), true));
  text.take(/\b(round ?trip|return (?:ticket|flight|trip)s?)\b/, () => ((intent.roundTrip = true), true));
}

function readCabin(text: Text, intent: Intent) {
  text.take(/\bpremium economy\b/, () => ((intent.cabin = "premium_economy"), true));
  text.take(/\bbusiness(?: class)?\b/, () => ((intent.cabin = "business"), true));
  text.take(/\bfirst class\b/, () => ((intent.cabin = "first"), true));
  text.take(/\beconomy(?: class)?\b/, () => ((intent.cabin ??= "economy"), true));
}

function readFlightFilters(text: Text, intent: Intent) {
  text.take(/\b(non[\s-]?stop|direct)( flights?)?\b/, () => ((intent.maxStops = 0), true));
  text.take(/\b(?:at most |max(?:imum)? )?(1|one) stop\b/, () => ((intent.maxStops = 1), true));
  text.take(/\b(red[\s-]?eye|early morning)\b/, () => ((intent.departWindow = "early"), true));
  if (intent.kind === "flight") {
    text.take(/\b(?:in the )?(morning|afternoon|evening)( flight)?\b/, (m) => ((intent.departWindow ??= m[1] as "morning"), true));
  }
}

function currencyFrom(symbol: string | undefined, fallback: string) {
  if (!symbol) return fallback;
  if (symbol === "₹" || symbol === "inr") return "INR";
  if (symbol === "$" || symbol === "usd") return "USD";
  if (symbol === "€" || symbol === "eur") return "EUR";
  if (symbol === "£" || symbol === "gbp") return "GBP";
  return fallback;
}

function readPrice(text: Text, intent: Intent, ctx: RuleContext) {
  // Groups per amount: currency symbol, number, currency word.
  const amount = "(₹|\\$|€|£|usd |eur |gbp )?\\s*(\\d{2,8}(?:\\.\\d{1,2})?)(?:\\s*(rupees|rs|inr|dollars|usd|euros?|eur|pounds|gbp)\\b)?";
  const basis = "(?:\\s*(?:a|per|\\/|each)\\s*(night|day|person|head))?";
  const marker = (sym?: string, word?: string) => (sym ?? word ?? "").trim().replace(/^rs|rupees$/, "₹").replace(/^dollars$/, "$").replace(/^(euros?)$/, "€").replace(/^pounds$/, "£");
  // Two digit numbers only count with a currency, so "between 24 and 27" stays a date range.
  const plausible = (n: string, sym?: string, word?: string) => Number(n) >= 100 || Boolean(sym || word);

  text.take(new RegExp(`\\bbetween ${amount} and ${amount}${basis}`), (m) => {
    if (!plausible(m[2], m[1] ?? m[4], m[3] ?? m[6]) || !plausible(m[5], m[1] ?? m[4], m[3] ?? m[6])) return false;
    intent.minPrice = Number(m[2]);
    intent.maxPrice = Number(m[5]);
    intent.currency = currencyFrom(marker(m[1] ?? m[4], m[3] ?? m[6]) || undefined, ctx.defaultCurrency);
    return true;
  });
  text.take(new RegExp(`\\b(?:under|below|less than|max(?:imum)?|up to|upto|within|budget(?: of)?|not more than|no more than|cheaper than|at most)\\s*${amount}${basis}`), (m) => {
    if (!plausible(m[2], m[1], m[3])) return false;
    intent.maxPrice = Number(m[2]);
    intent.currency = currencyFrom(marker(m[1], m[3]) || undefined, ctx.defaultCurrency);
    return true;
  });
  text.take(new RegExp(`\\b(?:over|above|more than|at least|min(?:imum)?|from)\\s*${amount}${basis}`), (m) => {
    // "from 2000" only counts as a price with a currency or a per night basis, so "from 24 oct" is left alone.
    if (m[0].startsWith("from") && !m[1] && !m[3] && !m[4]) return false;
    if (!plausible(m[2], m[1], m[3])) return false;
    intent.minPrice = Number(m[2]);
    intent.currency = currencyFrom(marker(m[1], m[3]) || undefined, ctx.defaultCurrency);
    return true;
  });
  // A bare amount with a currency and a basis, e.g. "₹3000 a night".
  text.take(/(₹|\$|€|£)\s*(\d{2,8})\s*(?:a|per|\/)\s*night/, (m) => {
    if (intent.maxPrice) return false;
    intent.maxPrice = Number(m[2]);
    intent.currency = currencyFrom(m[1], ctx.defaultCurrency);
    return true;
  });
}

function readSort(text: Text, intent: Intent) {
  text.take(/\b(cheap|cheapest|cheaper|budget|affordable|inexpensive|low[\s-]cost|lowest (?:price|fare))\b/, () => ((intent.sort = "cheap"), true));
  text.take(/\b(luxury|luxurious|premium|upscale|5[\s-]star|five[\s-]star)\b/, () => ((intent.sort ??= "luxury"), true));
  text.take(/\b(fastest|quickest|shortest)\b/, () => ((intent.sort ??= "fast"), true));
  text.take(/\b(best[\s-]rated|top[\s-]rated|highest[\s-]rated|well[\s-]reviewed)\b/, () => ((intent.sort ??= "rating"), true));
  text.take(/\b(?:rated|rating(?: of)?)\s*(?:above|over|at least)?\s*([3-4](?:\.\d)?)\s*\+?/, (m) => ((intent.minRating = Number(m[1])), true));
  text.take(/\b([3-4](?:\.\d)?)\+\s*(?:rating|rated|stars?)\b/, (m) => ((intent.minRating = Number(m[1])), true));
}

const AMENITY_RULES: [RegExp, string][] = [
  [/\b(swimming pool|private pool|pool)\b/, "pool"],
  [/\b(pet[\s-]?friendly|pets? allowed|with (?:my |our )?(?:dog|cat|pet)s?|pets?)\b/, "pets"],
  [/\b(beach[\s-]?front|on the beach|near the beach|by the beach|beach access|beach)\b/, "beach_access"],
  [/\b(sea[\s-]?view|ocean view|sea[\s-]?facing)\b/, "sea_view"],
  [/\b(mountain view|hill view|valley view)\b/, "mountain_view"],
  [/\b(wi-?fi|internet)\b/, "wifi"],
  [/\b(air[\s-]?condition(?:ed|ing)?|a\/?c)\b/, "ac"],
  [/\b(kitchen|self[\s-]catering|kitchenette)\b/, "kitchen"],
  [/\b(breakfast(?: included)?)\b/, "breakfast"],
  [/\b(free )?parking\b/, "parking"],
  [/\b(gym|fitness)\b/, "gym"],
  [/\b(workspace|work desk|desk|work from|workation|remote work)\b/, "workspace"],
  [/\b(balcony)\b/, "balcony"],
  [/\b(garden|lawn)\b/, "garden"],
  [/\b(airport (?:pickup|transfer))\b/, "airport_pickup"],
  [/\b(ev charging|electric car charging)\b/, "ev_charging"],
  [/\b(lift|elevator)\b/, "lift"],
  [/\b(wheelchair|step[\s-]free|accessible)\b/, "step_free"],
  [/\b(crib|cot)\b/, "crib"],
  [/\b(washing machine|washer|laundry)\b/, "washer"],
  [/\b(power backup|inverter|generator)\b/, "power_backup"],
];

const TYPE_RULES: [RegExp, NonNullable<Intent["types"]>[number]][] = [
  [/\bhotels?\b/, "hotel"],
  [/\bhomestays?\b/, "homestay"],
  [/\bguest ?houses?\b/, "guesthouse"],
  [/\bvillas?\b/, "villa"],
  [/\b(apartments?|flats?|service apartments?)\b/, "apartment"],
  [/\bhostels?\b/, "hostel"],
  [/\bresorts?\b/, "resort"],
  [/\b(cabins?|cottages?)\b/, "cabin"],
  [/\b(whole house|entire house|bungalows?)\b/, "house"],
];

function readStayFilters(text: Text, intent: Intent) {
  const amenities = new Set<string>();
  text.take(/\b(free cancell?ation|fully refundable|refundable)\b/, () => ((intent.freeCancellation = true), true));
  text.take(/\b(instant(?:ly)? book(?:ing|able)?|book instantly)\b/, () => ((intent.instantBook = true), true));
  for (const [re, key] of AMENITY_RULES) text.take(re, () => (amenities.add(key), true));
  if (amenities.size) intent.amenities = [...amenities];
  const types = new Set<NonNullable<Intent["types"]>[number]>();
  for (const [re, key] of TYPE_RULES) text.take(re, () => (types.add(key), true));
  if (types.size) intent.types = [...types];
}

function readTravelers(text: Text, intent: Intent) {
  const n = (s: string) => (s === "a" || s === "an" ? 1 : Number(s));
  text.take(/\bfamily of (\d{1,2})\b/, (m) => {
    const size = Number(m[1]);
    intent.adults = Math.min(2, size);
    intent.children = Math.max(0, size - 2);
    return true;
  });
  text.take(/\b(\d{1,2}|a|an) (adults?|grown[\s-]?ups?)\b/, (m) => ((intent.adults = n(m[1])), true));
  text.take(/\b(\d{1,2}|a|an) (children|child|kids?|teens?|teenagers?)\b/, (m) => ((intent.children = (intent.children ?? 0) + n(m[1])), true));
  text.take(/\b(\d{1,2}|a|an) (infants?|babies|baby|toddlers?)\b/, (m) => {
    const count = n(m[1]);
    if (intent.kind === "stay") intent.children = (intent.children ?? 0) + count;
    else intent.infants = count;
    return true;
  });
  text.take(/\b(?:for |with )?(\d{1,2}) (?:people|persons|pax|guests|travell?ers|passengers|of us|friends)\b/, (m) => {
    intent.adults ??= Number(m[1]);
    return true;
  });
  text.take(/\bgroup of (\d{1,2})\b/, (m) => ((intent.adults ??= Number(m[1])), true));
  text.take(/\b(couple|me and my (?:wife|husband|partner|girlfriend|boyfriend|friend)|my (?:wife|husband|partner) and (?:i|me)|for 2(?! (?:nights?|days?|weeks?|adults?|kids?|children|people)))\b/, () => {
    intent.adults ??= 2;
    return true;
  });
  text.take(/\b(solo|just me|by myself|alone|for 1(?! (?:nights?|days?|weeks?|adults?|kids?|children|people)))\b/, () => ((intent.adults ??= 1), true));
}

// ---------------------------------------------------------------------------
// Dates

type DateMention = { pos: number; date?: ISODate; day?: number; weekday?: { day: number; next: boolean }; weekendEnd?: ISODate; isReturn: boolean };

function dow(d: ISODate) {
  return parseISODate(d).getUTCDay();
}

/** Next date on or after `from` that falls on `weekday`. */
function onOrAfter(from: ISODate, weekday: number) {
  return addDays(from, (weekday - dow(from) + 7) % 7);
}

function mondayOfWeek(d: ISODate) {
  return addDays(d, -((dow(d) + 6) % 7));
}

function resolveDayMonth(day: number, month: number, year: number | undefined, after: ISODate): ISODate | undefined {
  const make = (y: number) => {
    const d = new Date(Date.UTC(y, month - 1, day));
    if (d.getUTCMonth() !== month - 1) return undefined;
    return toISODate(d);
  };
  if (year) return make(year < 100 ? 2000 + year : year);
  const y = Number(after.slice(0, 4));
  const thisYear = make(y);
  if (thisYear && thisYear >= after) return thisYear;
  return make(y + 1);
}

function resolveDayOnly(day: number, after: ISODate): ISODate | undefined {
  let y = Number(after.slice(0, 4));
  let m = Number(after.slice(5, 7));
  for (let i = 0; i < 3; i++) {
    const d = new Date(Date.UTC(y, m - 1, day));
    if (d.getUTCMonth() === m - 1) {
      const iso = toISODate(d);
      if (iso >= after) return iso;
    }
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return undefined;
}

function weekendStart(today: ISODate, next: boolean): ISODate {
  if (next) return addDays(mondayOfWeek(today), 7 + 4);
  const d = dow(today);
  if (d === 5 || d === 6 || d === 0) return today;
  return onOrAfter(today, 5);
}

function weekendEnd(start: ISODate): ISODate {
  // Through Sunday; a weekend that starts on Sunday ends Monday.
  return dow(start) === 0 ? addDays(start, 1) : onOrAfter(addDays(start, 1), 0);
}

const RETURN_WORDS = /(?:return(?:ing)?|back|coming back|come back|check(?:ing)?[\s-]?out|leave|leaving the hotel|till|until|through|to)\s+(?:on\s+)?(?:the\s+)?$/;

function readDates(text: Text, intent: Intent, ctx: RuleContext) {
  const { today } = ctx;
  const mentions: DateMention[] = [];
  const isReturnAt = (pos: number) => {
    const before = text.value.slice(Math.max(0, pos - 40), pos);
    return RETURN_WORDS.test(before);
  };
  const push = (pos: number, m: Omit<DateMention, "pos" | "isReturn">, forceReturn = false) =>
    mentions.push({ pos, ...m, isReturn: forceReturn || isReturnAt(pos) });

  // Ranges inside one month: "24-27 oct", "24 to 27 october", "oct 24-27"
  text.take(new RegExp(`\\b(\\d{1,2})${ORD}\\s*(?:-|to|till|until|and)\\s*(\\d{1,2})${ORD}\\s+(?:of\\s+)?${MONTH_RE}(?:,?\\s*(\\d{4}))?`), (m) => {
    const month = MONTHS[m[3]];
    const year = m[4] ? Number(m[4]) : undefined;
    const a = resolveDayMonth(Number(m[1]), month, year, today);
    if (!a) return false;
    const b = resolveDayMonth(Number(m[2]), month, year ?? Number(a.slice(0, 4)), a);
    push(m.index, { date: a });
    push(m.index + 1, { date: b }, true);
    return true;
  });
  text.take(new RegExp(`\\b${MONTH_RE}\\s+(\\d{1,2})${ORD}\\s*(?:-|to|till|until)\\s*(\\d{1,2})${ORD}\\b`), (m) => {
    const month = MONTHS[m[1]];
    const a = resolveDayMonth(Number(m[2]), month, undefined, today);
    if (!a) return false;
    push(m.index, { date: a });
    push(m.index + 1, { date: resolveDayMonth(Number(m[3]), month, Number(a.slice(0, 4)), a) }, true);
    return true;
  });
  // ISO
  text.take(/\b(\d{4})-(\d{2})-(\d{2})\b/, (m) => (push(m.index, { date: resolveDayMonth(Number(m[3]), Number(m[2]), Number(m[1]), today) }), true));
  // "24 oct", "24th of october 2026"
  text.take(new RegExp(`\\b(\\d{1,2})${ORD}\\s*(?:of\\s+)?${MONTH_RE}(?:,?\\s*(\\d{4}))?\\b`), (m) => {
    const date = resolveDayMonth(Number(m[1]), MONTHS[m[2]], m[3] ? Number(m[3]) : undefined, today);
    if (!date) return false;
    push(m.index, { date });
    return true;
  });
  // "oct 24", "october 24th, 2026"
  text.take(new RegExp(`\\b${MONTH_RE}\\s+(\\d{1,2})${ORD}(?:,?\\s*(\\d{4}))?\\b`), (m) => {
    const date = resolveDayMonth(Number(m[2]), MONTHS[m[1]], m[3] ? Number(m[3]) : undefined, today);
    if (!date) return false;
    push(m.index, { date });
    return true;
  });
  // "24/10", "24/10/2026", "24.10"
  text.take(/\b(\d{1,2})[/.](\d{1,2})(?:[/.](\d{2,4}))?\b/, (m) => {
    const day = Number(m[1]);
    const month = Number(m[2]);
    if (month < 1 || month > 12 || day < 1 || day > 31) return false;
    const date = resolveDayMonth(day, month, m[3] ? Number(m[3]) : undefined, today);
    if (!date) return false;
    push(m.index, { date });
    return true;
  });
  // Relative words
  text.take(/\bday after tomorrow\b/, (m) => (push(m.index, { date: addDays(today, 2) }), true));
  text.take(/\btomorrow\b/, (m) => (push(m.index, { date: addDays(today, 1) }), true));
  text.take(/\b(today|tonight)\b/, (m) => {
    push(m.index, { date: today });
    if (m[1] === "tonight") intent.nights ??= 1;
    return true;
  });
  text.take(/\b(this|next|coming|the)?\s*weekend\b/, (m) => {
    const start = weekendStart(today, m[1] === "next");
    push(m.index, { date: start, weekendEnd: weekendEnd(start) });
    return true;
  });
  text.take(/\bnext week\b/, (m) => (push(m.index, { date: addDays(mondayOfWeek(today), 7) }), true));
  // Weekdays: "this friday", "next fri", "on saturday". Short forms need a lead word so "sun" alone is not a date.
  text.take(new RegExp(`\\b(this|next|coming|on|by)\\s+${WEEKDAY_RE}\\b`), (m) => {
    push(m.index, { weekday: { day: WEEKDAYS[m[2]], next: m[1] === "next" } });
    return true;
  });
  text.take(/\b(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/, (m) => {
    push(m.index, { weekday: { day: WEEKDAYS[m[1]], next: false } });
    return true;
  });
  // Day only with an ordinal: "the 27th", "on 27th"
  text.take(/\b(?:the\s+)?(\d{1,2})(?:st|nd|rd|th)\b/, (m) => {
    const day = Number(m[1]);
    if (day < 1 || day > 31) return false;
    push(m.index, { day });
    return true;
  });

  // Nights and durations
  text.take(/\b(?:for\s+)?(\d{1,2}|a|an|one)\s+nights?\b/, (m) => ((intent.nights = m[1] === "a" || m[1] === "an" ? 1 : Number(m[1])), true));
  text.take(/\b(?:for\s+)?(?:a|1|one)\s+week\b/, () => ((intent.nights ??= 7), true));
  text.take(/\bfor\s+(\d{1,2})\s+weeks\b/, (m) => ((intent.nights ??= Number(m[1]) * 7), true));
  text.take(/\bfor\s+(\d{1,2})\s+days?\b/, (m) => ((intent.nights ??= Number(m[1])), true));
  text.take(/\b(overnight)\b/, () => ((intent.nights ??= 1), true));

  if (!mentions.length) return;
  mentions.sort((a, b) => a.pos - b.pos);

  const resolve = (m: DateMention, after: ISODate): ISODate | undefined => {
    if (m.date) return m.date;
    if (m.day) return resolveDayOnly(m.day, after);
    if (m.weekday) {
      if (m.weekday.next) return addDays(mondayOfWeek(after), 7 + ((m.weekday.day + 6) % 7));
      return onOrAfter(after, m.weekday.day);
    }
    return undefined;
  };

  const startMention = mentions.find((m) => !m.isReturn) ?? mentions[0];
  const start = resolve(startMention, today);
  if (!start) return;
  intent.start = start;
  const endMention = mentions.find((m) => m !== startMention && m.pos > startMention.pos) ?? mentions.find((m) => m !== startMention);
  if (endMention) {
    // A return date is on or after the start; "fri to sun" or "return on 27th" resolve from the start date.
    let end = resolve(endMention, endMention.weekday || endMention.day ? addDays(start, 1) : start);
    if (end && end < start && endMention.date) end = addDays(end, 365);
    if (end && end >= start) intent.end = end;
  } else if (startMention.weekendEnd && !intent.nights) {
    intent.end = startMention.weekendEnd;
  }
}

// ---------------------------------------------------------------------------
// Places

const STOP = new Set(
  `a an the and or but with without for on in at to from by of near around under below over above between this next coming
  i we me us my our you your please want wanna need looking look find show search book get some any cheap cheapest best good nice
  trip travel travelling traveling holiday vacation getaway weekend going go visit visiting leaving departing heading
  flight flights fly flying plane ticket tickets airfare fare fares stay stays staying hotel hotels room rooms place places
  homestay homestays villa villas apartment apartments resort resorts hostel hostels guesthouse cottage cabin night nights
  day days week weeks adult adults child children kid kids people guests family couple friends class economy business
  oneway return round per a/c ac price budget under max can could would like there days somewhere something where
  is are be it that what which how much cost costs available availability options option something`
    .split(/\s+/)
    .filter(Boolean),
);

function cleanPhrase(words: string[]) {
  while (words.length && STOP.has(words[0])) words.shift();
  while (words.length && STOP.has(words[words.length - 1])) words.pop();
  const phrase = words.join(" ").replace(/[^a-z .'-]/g, "").trim();
  return phrase.length >= 2 ? phrase : undefined;
}

/** Words after a marker, up to the next stop word or separator, at most four words. */
function phraseAfter(tokens: string[], i: number) {
  const out: string[] = [];
  for (let j = i + 1; j < tokens.length && out.length < 4; j++) {
    const w = tokens[j];
    if (w === "|" || w === "," || w === "." || STOP.has(w) || /\d/.test(w)) break;
    out.push(w);
  }
  return cleanPhrase(out);
}

/** Words before a marker, back to the previous stop word or separator, at most three words. */
function phraseBefore(tokens: string[], i: number) {
  const out: string[] = [];
  for (let j = i - 1; j >= 0 && out.length < 3; j--) {
    const w = tokens[j];
    if (w === "|" || w === "," || w === "." || STOP.has(w) || /\d/.test(w)) break;
    out.unshift(w);
  }
  return cleanPhrase(out);
}

function readPlaces(text: Text, intent: Intent) {
  const tokens = text.value
    .replace(/([,.])(\s|$)/g, " $1 ")
    .split(/\s+/)
    .filter(Boolean);

  const fromIdx = tokens.indexOf("from");
  if (fromIdx >= 0) intent.origin = phraseAfter(tokens, fromIdx);

  const toIdx = tokens.findIndex((w, i) => (w === "to" || w === "into") && i !== fromIdx);
  if (toIdx >= 0) {
    intent.destination = phraseAfter(tokens, toIdx);
    if (!intent.origin && intent.kind !== "stay") {
      const before = phraseBefore(tokens, toIdx);
      if (before) intent.origin = before;
    }
  }

  for (const marker of ["in", "at", "near", "around"]) {
    if (intent.destination) break;
    const i = tokens.indexOf(marker);
    if (i >= 0) {
      intent.destination = phraseAfter(tokens, i);
      // "in Goa" describes where someone stays, not where they fly.
      if (intent.destination && intent.kind === "unknown" && !intent.origin) intent.kind = "stay";
    }
  }

  if (!intent.destination && !intent.origin) {
    // Nothing marked: the longest run of content words is the best guess ("goa villa with pool").
    let best: string[] = [];
    let run: string[] = [];
    for (const w of [...tokens, "|"]) {
      if (w === "|" || w === "," || w === "." || STOP.has(w) || /\d/.test(w)) {
        if (run.length > best.length) best = run;
        run = [];
      } else run.push(w);
    }
    const guess = cleanPhrase(best.slice(0, 4));
    if (guess) intent.destination = guess;
  }
}
