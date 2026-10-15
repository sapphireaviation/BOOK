import { date, index, integer, jsonb, pgEnum, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { user } from "./auth";
import { listings, listingUnits } from "./listings";

export const bookingKind = pgEnum("booking_kind", ["stay", "flight"]);
export const bookingStatus = pgEnum("booking_status", [
  "draft",
  "pending_payment",
  "confirmed",
  "completed",
  "cancelled",
  "refunded",
  "expired",
  "failed",
]);
export const paymentProvider = pgEnum("payment_provider", ["razorpay", "stripe", "manual"]);
export const paymentStatus = pgEnum("payment_status", ["created", "authorized", "captured", "failed", "refunded", "partially_refunded"]);

/** Price lines shown to the traveler. The fee line is always present and always 0. */
export type PriceLine = { label: string; amount: number; kind: "base" | "tax" | "fee" | "discount" | "other" };

export const bookings = pgTable(
  "bookings",
  {
    id: text("id").primaryKey(),
    /** Human friendly reference shown to travelers, e.g. "K7Q-4MZ2". */
    reference: text("reference").notNull().unique(),
    kind: bookingKind("kind").notNull(),
    status: bookingStatus("status").notNull().default("draft"),
    /** Null for guest checkout. */
    userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
    contactName: text("contact_name").notNull(),
    contactEmail: text("contact_email").notNull(),
    contactPhone: text("contact_phone"),
    currency: text("currency").notNull(),
    /** Total charged to the traveler in minor units. */
    total: integer("total").notNull(),
    priceLines: jsonb("price_lines").$type<PriceLine[]>().notNull().default([]),
    /** Draft and pending bookings release their hold after this time. */
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    cancelReason: text("cancel_reason"),
    /** Secret token so guest bookings can be viewed from the confirmation email link. */
    accessToken: text("access_token").notNull(),
    meta: jsonb("meta").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("bookings_user_idx").on(t.userId, t.createdAt),
    index("bookings_status_idx").on(t.status, t.expiresAt),
    index("bookings_email_idx").on(t.contactEmail),
  ],
);

export const stayBookings = pgTable(
  "stay_bookings",
  {
    bookingId: text("booking_id")
      .primaryKey()
      .references(() => bookings.id, { onDelete: "cascade" }),
    listingId: text("listing_id")
      .notNull()
      .references(() => listings.id, { onDelete: "restrict" }),
    unitId: text("unit_id")
      .notNull()
      .references(() => listingUnits.id, { onDelete: "restrict" }),
    hostId: text("host_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    checkIn: date("check_in").notNull(),
    checkOut: date("check_out").notNull(),
    nights: integer("nights").notNull(),
    units: integer("units").notNull().default(1),
    adults: integer("adults").notNull(),
    children: integer("children").notNull().default(0),
    guestNote: text("guest_note"),
    /** Snapshot of the cancellation policy at booking time. */
    cancellationPolicy: text("cancellation_policy").notNull(),
  },
  (t) => [
    index("stay_bookings_listing_idx").on(t.listingId, t.checkIn),
    index("stay_bookings_host_idx").on(t.hostId, t.checkIn),
  ],
);

export type Passenger = {
  id?: string;
  type: "adult" | "child" | "infant_without_seat";
  title: "mr" | "ms" | "mrs" | "miss" | "dr";
  givenName: string;
  familyName: string;
  bornOn: string;
  gender: "m" | "f";
  email: string;
  phone: string;
};

export const flightBookings = pgTable(
  "flight_bookings",
  {
    bookingId: text("booking_id")
      .primaryKey()
      .references(() => bookings.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(),
    offerId: text("offer_id").notNull(),
    providerOrderId: text("provider_order_id"),
    /** Airline booking reference (PNR) once ticketed. */
    airlineReference: text("airline_reference"),
    origin: text("origin").notNull(),
    destination: text("destination").notNull(),
    departAt: timestamp("depart_at", { withTimezone: true }).notNull(),
    returnAt: timestamp("return_at", { withTimezone: true }),
    /** Snapshot of the offer slices shown to the traveler. */
    slices: jsonb("slices").$type<unknown[]>().notNull().default([]),
    passengers: jsonb("passengers").$type<Passenger[]>().notNull().default([]),
    conditions: jsonb("conditions").$type<Record<string, unknown>>().notNull().default({}),
    /** Amount we pay the airline, in the offer's currency and minor units. */
    providerTotal: integer("provider_total").notNull(),
    providerCurrency: text("provider_currency").notNull(),
  },
  (t) => [index("flight_bookings_order_idx").on(t.providerOrderId)],
);

export const payments = pgTable(
  "payments",
  {
    id: text("id").primaryKey(),
    bookingId: text("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "cascade" }),
    provider: paymentProvider("provider").notNull(),
    status: paymentStatus("status").notNull().default("created"),
    amount: integer("amount").notNull(),
    currency: text("currency").notNull(),
    /** Razorpay order id or Stripe checkout session / payment intent id. */
    providerOrderId: text("provider_order_id"),
    providerPaymentId: text("provider_payment_id"),
    method: text("method"),
    failureReason: text("failure_reason"),
    raw: jsonb("raw").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("payments_booking_idx").on(t.bookingId),
    uniqueIndex("payments_provider_order_idx").on(t.provider, t.providerOrderId),
  ],
);

/** Webhook idempotency log. */
export const paymentEvents = pgTable("payment_events", {
  id: text("id").primaryKey(), // provider event id, prefixed with provider name
  provider: paymentProvider("provider").notNull(),
  type: text("type").notNull(),
  payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
  processedAt: timestamp("processed_at", { withTimezone: true }).notNull().defaultNow(),
});

export const refunds = pgTable(
  "refunds",
  {
    id: text("id").primaryKey(),
    paymentId: text("payment_id")
      .notNull()
      .references(() => payments.id, { onDelete: "cascade" }),
    bookingId: text("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "cascade" }),
    amount: integer("amount").notNull(),
    currency: text("currency").notNull(),
    providerRefundId: text("provider_refund_id"),
    status: text("status").notNull().default("pending"),
    reason: text("reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("refunds_booking_idx").on(t.bookingId)],
);

export const payoutStatus = pgEnum("payout_status", ["owed", "scheduled", "paid", "cancelled"]);

/** What we owe a host for a stay booking. 100% of the room total and taxes; we keep nothing. */
export const payouts = pgTable(
  "payouts",
  {
    id: text("id").primaryKey(),
    bookingId: text("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "cascade" }),
    hostId: text("host_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    amount: integer("amount").notNull(),
    currency: text("currency").notNull(),
    status: payoutStatus("status").notNull().default("owed"),
    /** Earliest date the payout can be released (usually the day after check in). */
    releaseOn: date("release_on").notNull(),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    providerTransferId: text("provider_transfer_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("payouts_host_idx").on(t.hostId, t.status), uniqueIndex("payouts_booking_idx").on(t.bookingId)],
);
