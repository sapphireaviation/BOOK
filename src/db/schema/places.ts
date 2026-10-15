import { doublePrecision, index, integer, jsonb, pgTable, text, timestamp, boolean } from "drizzle-orm/pg-core";

/** Seeded from OurAirports (public domain). Only airports with an IATA code and scheduled service. */
export const airports = pgTable(
  "airports",
  {
    iata: text("iata").primaryKey(),
    name: text("name").notNull(),
    city: text("city").notNull(),
    countryCode: text("country_code").notNull(),
    countryName: text("country_name").notNull(),
    lat: doublePrecision("lat").notNull(),
    lng: doublePrecision("lng").notNull(),
    timeZone: text("time_zone"),
    /** Larger number ranks higher in autocomplete. */
    popularity: integer("popularity").notNull().default(0),
  },
  (t) => [index("airports_city_idx").on(t.city), index("airports_country_idx").on(t.countryCode)],
);

/** Curated places used for stay search and destination SEO pages. */
export const destinations = pgTable(
  "destinations",
  {
    slug: text("slug").primaryKey(),
    name: text("name").notNull(),
    region: text("region"),
    countryCode: text("country_code").notNull(),
    countryName: text("country_name").notNull(),
    lat: doublePrecision("lat").notNull(),
    lng: doublePrecision("lng").notNull(),
    /** Search radius in km used to match listings to this destination. */
    radiusKm: integer("radius_km").notNull().default(30),
    nearestAirports: text("nearest_airports").array().notNull().default([]),
    summary: text("summary"),
    body: text("body"),
    heroImage: text("hero_image"),
    faqs: jsonb("faqs").$type<{ q: string; a: string }[]>().notNull().default([]),
    featured: boolean("featured").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("destinations_country_idx").on(t.countryCode)],
);

/** Popular flight routes that get an SEO page. */
export const routes = pgTable("flight_routes", {
  slug: text("slug").primaryKey(), // e.g. "delhi-to-goa"
  origin: text("origin")
    .notNull()
    .references(() => airports.iata),
  destination: text("destination")
    .notNull()
    .references(() => airports.iata),
  summary: text("summary"),
  facts: jsonb("facts").$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
