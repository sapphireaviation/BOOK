/**
 * Airports seed.
 *
 * Downloads OurAirports (public domain) airports.csv and countries.csv, keeps large and medium
 * airports that have an IATA code and scheduled service, writes the compact `src/data/airports.json`
 * used by autocomplete and the fixture provider, and upserts the `airports` table.
 *
 * Time zones are not part of OurAirports. They come from the mwgg/Airports dataset (MIT licence),
 * matched by ICAO code, then IATA code, then the nearest airport in the same country.
 *
 * Run directly:   pnpm tsx --env-file=.env.local scripts/seed/airports.ts
 * Or import:      await seedAirports(db)
 */
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { sql } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { airports as airportsTable } from "../../src/db/schema/places";

const OURAIRPORTS = "https://raw.githubusercontent.com/davidmegginson/ourairports-data/main/";
const TIMEZONES = "https://raw.githubusercontent.com/mwgg/Airports/master/airports.json";
export const AIRPORTS_JSON_PATH = join(process.cwd(), "src", "data", "airports.json");

// Any drizzle Postgres database (postgres-js, node-postgres, pglite).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type SeedDb = PgDatabase<PgQueryResultHKT, any>;

/** [iata, name, city, countryCode, lat, lng, timeZone, popularity] */
export type AirportTuple = [string, string, string, string, number, number, string | null, number];
export type AirportsFile = { source: string; generatedAt: string; countries: Record<string, string>; airports: AirportTuple[] };

/**
 * City names people search for, where the OurAirports municipality is a suburb or the airport's town.
 * Slugs for route pages are built from these names, so keep them to the common English name.
 */
const CITY_NAMES: Record<string, string> = {
  DEL: "Delhi",
  GOI: "Goa",
  GOX: "Goa",
  KUL: "Kuala Lumpur",
  NRT: "Tokyo",
  DPS: "Denpasar",
  IXB: "Bagdogra",
  CDG: "Paris",
  ORY: "Paris",
  DFW: "Dallas",
  LCY: "London",
  STN: "London",
  LTN: "London",
  EWR: "New York",
  ICN: "Seoul",
  GMP: "Seoul",
  KIX: "Osaka",
  BER: "Berlin",
  MXP: "Milan",
  FCO: "Rome",
  CMB: "Colombo",
  MLE: "Male",
  PEK: "Beijing",
  PKX: "Beijing",
  PVG: "Shanghai",
  SHA: "Shanghai",
  IAD: "Washington",
  DCA: "Washington",
  HYD: "Hyderabad",
};

/**
 * Major hubs, roughly in order of annual passenger traffic, plus India's busiest airports.
 * Used only to rank autocomplete results; it is never shown to people.
 */
const HUB_RANK = [
  "ATL", "DXB", "DFW", "LHR", "HND", "DEN", "IST", "LAX", "ORD", "DEL", "CDG", "JFK", "LAS", "AMS", "MIA", "MAD", "ICN",
  "PVG", "CAN", "SIN", "FRA", "BKK", "SFO", "DOH", "CLT", "SEA", "MCO", "EWR", "PEK", "BCN", "BOM", "PHX", "IAH", "HKG",
  "FCO", "MUC", "SZX", "KUL", "CGK", "CTU", "BLR", "JED", "MNL", "LGW", "SYD", "RUH", "MEX", "YYZ", "SGN", "BOS", "AUH",
  "NRT", "TPE", "MSP", "ZRH", "HYD", "MAA", "CCU", "VIE", "CPH", "DUB", "LIS", "OSL", "ARN", "MAN", "MEL", "GRU", "GOI",
  "COK", "AMD", "PNQ", "GOX", "SHJ", "MCT", "BAH", "KWI", "CMB", "KTM", "HKT", "DPS", "HAN", "DMK", "JAI", "LKO", "GAU",
  "TRV", "IXC", "SXR", "PAT", "BBI", "IXB", "NAG", "IDR", "VNS", "ATQ", "CCJ", "IXE", "VTZ", "CJB", "IXR", "IXZ",
];

const TYPE_WEIGHT: Record<string, number> = { large_airport: 1000, medium_airport: 100 };

/** Minimal RFC 4180 CSV parser (quoted fields, escaped quotes, commas and newlines inside quotes). */
export function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += ch;
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  const [header, ...body] = rows;
  return body.filter((r) => r.length > 1).map((r) => Object.fromEntries(header.map((h, i) => [h, r[i] ?? ""])));
}

/** "Paris (Roissy-en-France, Val-d'Oise)" to "Paris", "Muscat/Seeb" to "Muscat", "Manchester, Greater Manchester" to "Manchester". */
export function cleanCity(municipality: string, fallback: string) {
  const city = municipality.replace(/\s*\(.*?\)\s*/g, " ").split(/[,/]/)[0].trim();
  return city || fallback;
}

function distanceKm(aLat: number, aLng: number, bLat: number, bLng: number) {
  const r = (d: number) => (d * Math.PI) / 180;
  const h = Math.sin(r(bLat - aLat) / 2) ** 2 + Math.cos(r(aLat)) * Math.cos(r(bLat)) * Math.sin(r(bLng - aLng) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

type TzEntry = { icao: string; iata: string; country: string; lat: number; lon: number; tz: string };

export function buildAirports(airportsCsv: string, countriesCsv: string, tzJson: Record<string, TzEntry> | null): AirportsFile {
  const countries: Record<string, string> = {};
  for (const c of parseCsv(countriesCsv)) if (c.code && c.name) countries[c.code] = c.name;

  const tzByIcao = new Map<string, string>();
  const tzByIata = new Map<string, string>();
  const tzPoints: TzEntry[] = [];
  for (const t of Object.values(tzJson ?? {})) {
    if (!t.tz) continue;
    tzByIcao.set(t.icao, t.tz);
    if (t.iata) tzByIata.set(t.iata, t.tz);
    tzPoints.push(t);
  }

  const hubBonus = new Map(HUB_RANK.map((code, i) => [code, Math.max(50, 1000 - i * 8)]));
  const seen = new Set<string>();
  const out: AirportTuple[] = [];

  for (const a of parseCsv(airportsCsv)) {
    const iata = a.iata_code?.trim().toUpperCase();
    if (!iata || !/^[A-Z]{3}$/.test(iata)) continue;
    if (a.scheduled_service !== "yes" || !(a.type in TYPE_WEIGHT)) continue;
    if (seen.has(iata)) continue;
    seen.add(iata);
    const lat = Number(a.latitude_deg);
    const lng = Number(a.longitude_deg);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;

    let tz = tzByIcao.get(a.icao_code) ?? tzByIcao.get(a.ident) ?? tzByIata.get(iata) ?? null;
    if (!tz && tzPoints.length) {
      let best: TzEntry | null = null;
      let bestKm = Infinity;
      for (const p of tzPoints) {
        if (p.country !== a.iso_country) continue;
        const km = distanceKm(lat, lng, p.lat, p.lon);
        if (km < bestKm) {
          bestKm = km;
          best = p;
        }
      }
      tz = best && bestKm < 500 ? best.tz : null;
    }

    // En and em dashes in official names become hyphens, matching the rest of our copy.
    const name = a.name.trim().replace(/\s*[\u2013\u2014]\s*/g, "-");
    const city = CITY_NAMES[iata] ?? cleanCity(a.municipality ?? "", name);
    const popularity = TYPE_WEIGHT[a.type] + (hubBonus.get(iata) ?? 0);
    out.push([iata, name, city, a.iso_country, Math.round(lat * 1e5) / 1e5, Math.round(lng * 1e5) / 1e5, tz, popularity]);
  }

  out.sort((x, y) => y[7] - x[7] || x[0].localeCompare(y[0]));
  // Every country, not only those with airports: passport issuing country pickers use this list too.
  const allCountries = Object.fromEntries(Object.keys(countries).sort().map((cc) => [cc, countries[cc]]));
  for (const a of out) if (!(a[3] in allCountries)) allCountries[a[3]] = a[3];
  return {
    source: "OurAirports (public domain), time zones from mwgg/Airports (MIT)",
    generatedAt: new Date().toISOString().slice(0, 10),
    countries: allCountries,
    airports: out,
  };
}

async function download(url: string) {
  const res = await fetch(url, { signal: AbortSignal.timeout(60_000) });
  if (!res.ok) throw new Error(`GET ${url} failed with ${res.status}`);
  return res.text();
}

/** Downloads fresh data and rewrites src/data/airports.json. Falls back to the committed file when offline. */
export async function loadAirports({ refresh = true }: { refresh?: boolean } = {}): Promise<AirportsFile> {
  if (refresh) {
    try {
      const [airportsCsv, countriesCsv, tzText] = await Promise.all([
        download(`${OURAIRPORTS}airports.csv`),
        download(`${OURAIRPORTS}countries.csv`),
        download(TIMEZONES).catch(() => null),
      ]);
      const file = buildAirports(airportsCsv, countriesCsv, tzText ? JSON.parse(tzText) : null);
      await writeFile(AIRPORTS_JSON_PATH, formatAirportsFile(file));
      return file;
    } catch (err) {
      console.warn(`Could not download airport data (${(err as Error).message}). Using the committed src/data/airports.json.`);
    }
  }
  return JSON.parse(await readFile(AIRPORTS_JSON_PATH, "utf8")) as AirportsFile;
}

/** One airport per line keeps diffs readable when the data is refreshed. */
export function formatAirportsFile(file: AirportsFile) {
  const lines = file.airports.map((a) => `    ${JSON.stringify(a)}`);
  return `{\n  "source": ${JSON.stringify(file.source)},\n  "generatedAt": ${JSON.stringify(file.generatedAt)},\n  "countries": ${JSON.stringify(
    file.countries,
  )},\n  "airports": [\n${lines.join(",\n")}\n  ]\n}\n`;
}

export async function seedAirports(db: SeedDb, opts: { refresh?: boolean } = {}) {
  const file = await loadAirports(opts);
  const rows = file.airports.map(([iata, name, city, countryCode, lat, lng, timeZone, popularity]) => ({
    iata,
    name,
    city,
    countryCode,
    countryName: file.countries[countryCode] ?? countryCode,
    lat,
    lng,
    timeZone,
    popularity,
  }));
  for (let i = 0; i < rows.length; i += 500) {
    await db
      .insert(airportsTable)
      .values(rows.slice(i, i + 500))
      .onConflictDoUpdate({
        target: airportsTable.iata,
        set: {
          name: sql`excluded.name`,
          city: sql`excluded.city`,
          countryCode: sql`excluded.country_code`,
          countryName: sql`excluded.country_name`,
          lat: sql`excluded.lat`,
          lng: sql`excluded.lng`,
          timeZone: sql`excluded.time_zone`,
          popularity: sql`excluded.popularity`,
        },
      });
  }
  console.log(`Airports: upserted ${rows.length}.`);
  return rows.length;
}

const isMain = /scripts[\\/]seed[\\/]airports\.ts$/.test(process.argv[1] ?? "");
if (isMain) {
  (async () => {
    const { drizzle } = await import("drizzle-orm/postgres-js");
    const postgres = (await import("postgres")).default;
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not set");
    const client = postgres(url, { prepare: false, max: 1 });
    try {
      await seedAirports(drizzle(client, { casing: "snake_case" }), { refresh: !process.argv.includes("--offline") });
    } finally {
      await client.end();
    }
  })().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
