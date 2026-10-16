import {
  boolean,
  date,
  doublePrecision,
  index,
  integer,
  jsonb,
  primaryKey,
  real,
  text,
  time,
  timestamp,
} from "drizzle-orm/pg-core";
import { booking } from "./pg-schema";
import { user } from "./auth";

export const listingKind = booking.enum("listing_kind", ["stay", "experience", "transport"]);
export const listingStatus = booking.enum("listing_status", ["draft", "published", "suspended", "archived"]);
export const propertyType = booking.enum("property_type", [
  "hotel",
  "guesthouse",
  "homestay",
  "apartment",
  "house",
  "villa",
  "hostel",
  "resort",
  "cabin",
  "other",
]);
export const cancellationPolicy = booking.enum("cancellation_policy", ["flexible", "moderate", "strict", "non_refundable"]);

export const listings = booking.table(
  "listings",
  {
    id: text("id").primaryKey(),
    hostId: text("host_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    kind: listingKind("kind").notNull().default("stay"),
    status: listingStatus("status").notNull().default("draft"),
    slug: text("slug").notNull().unique(),
    title: text("title").notNull(),
    summary: text("summary").notNull().default(""),
    description: text("description").notNull().default(""),
    propertyType: propertyType("property_type").notNull().default("homestay"),

    addressLine: text("address_line"),
    locality: text("locality"),
    city: text("city").notNull(),
    region: text("region"),
    postalCode: text("postal_code"),
    countryCode: text("country_code").notNull(),
    lat: doublePrecision("lat").notNull(),
    lng: doublePrecision("lng").notNull(),
    /** Destination slug this listing is grouped under for SEO pages. */
    destinationSlug: text("destination_slug"),

    maxGuests: integer("max_guests").notNull().default(2),
    bedrooms: integer("bedrooms").notNull().default(1),
    beds: integer("beds").notNull().default(1),
    bathrooms: real("bathrooms").notNull().default(1),
    amenities: text("amenities").array().notNull().default([]),
    houseRules: text("house_rules").notNull().default(""),
    checkInFrom: time("check_in_from").notNull().default("14:00"),
    checkOutUntil: time("check_out_until").notNull().default("11:00"),

    currency: text("currency").notNull().default("INR"),
    /** Lowest nightly price across units in minor units, kept in sync for sorting and SEO. */
    fromPrice: integer("from_price").notNull().default(0),
    cleaningFee: integer("cleaning_fee").notNull().default(0),
    /** Taxes as basis points of the room total (1200 = 12%). Collected for the host. */
    taxBps: integer("tax_bps").notNull().default(0),
    minNights: integer("min_nights").notNull().default(1),
    maxNights: integer("max_nights").notNull().default(30),
    instantBook: boolean("instant_book").notNull().default(true),
    cancellationPolicy: cancellationPolicy("cancellation_policy").notNull().default("moderate"),

    contactPhone: text("contact_phone"),
    contactEmail: text("contact_email"),

    ratingAvg: real("rating_avg").notNull().default(0),
    ratingCount: integer("rating_count").notNull().default(0),
    verified: boolean("verified").notNull().default(false),
    /** Sample data created by the demo seed. Shown with a "Sample listing" badge and never bookable in production. */
    isDemo: boolean("is_demo").notNull().default(false),

    publishedAt: timestamp("published_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("listings_host_idx").on(t.hostId),
    index("listings_status_city_idx").on(t.status, t.city),
    index("listings_destination_idx").on(t.destinationSlug),
    index("listings_geo_idx").on(t.lat, t.lng),
  ],
);

export const listingPhotos = booking.table(
  "listing_photos",
  {
    id: text("id").primaryKey(),
    listingId: text("listing_id")
      .notNull()
      .references(() => listings.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    alt: text("alt").notNull().default(""),
    width: integer("width"),
    height: integer("height"),
    position: integer("position").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("listing_photos_listing_idx").on(t.listingId, t.position)],
);

/** A bookable unit: a room type in a hotel, or the whole place for a home. */
export const listingUnits = booking.table(
  "listing_units",
  {
    id: text("id").primaryKey(),
    listingId: text("listing_id")
      .notNull()
      .references(() => listings.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    maxGuests: integer("max_guests").notNull().default(2),
    beds: text("beds").notNull().default(""),
    /** Default nightly price in minor units. */
    basePrice: integer("base_price").notNull(),
    /** Extra price for each guest above `includedGuests`, per night. */
    extraGuestPrice: integer("extra_guest_price").notNull().default(0),
    includedGuests: integer("included_guests").notNull().default(2),
    /** How many identical units exist (rooms of this type). */
    quantity: integer("quantity").notNull().default(1),
    amenities: text("amenities").array().notNull().default([]),
    active: boolean("active").notNull().default(true),
    position: integer("position").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("listing_units_listing_idx").on(t.listingId)],
);

/**
 * Per-date overrides and bookings. A missing row means: available, full quantity, base price.
 * `booked` is incremented inside a transaction with a row lock when a booking is held.
 */
export const unitInventory = booking.table(
  "unit_inventory",
  {
    unitId: text("unit_id")
      .notNull()
      .references(() => listingUnits.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    booked: integer("booked").notNull().default(0),
    /** Overrides unit quantity for this date when set. */
    total: integer("total"),
    /** Overrides base price for this date when set. */
    price: integer("price"),
    closed: boolean("closed").notNull().default(false),
  },
  (t) => [primaryKey({ columns: [t.unitId, t.date] })],
);

export const wishlists = booking.table(
  "wishlists",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    listingId: text("listing_id")
      .notNull()
      .references(() => listings.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.listingId] })],
);

export const hostProfiles = booking.table(
  "host_profiles",
  {
    userId: text("user_id")
      .primaryKey()
      .references(() => user.id, { onDelete: "cascade" }),
    displayName: text("display_name").notNull(),
    about: text("about").notNull().default(""),
    languages: text("languages").array().notNull().default([]),
    /** Payout details are stored by the payment provider; we keep a reference only. */
    payoutReference: text("payout_reference"),
    payoutMethod: text("payout_method"),
    taxId: text("tax_id"),
    verified: boolean("verified").notNull().default(false),
    responseMinutes: integer("response_minutes"),
    meta: jsonb("meta").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
);
