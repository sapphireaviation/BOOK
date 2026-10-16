import { index, integer, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { booking } from "./pg-schema";
import { user } from "./auth";
import { bookings } from "./bookings";
import { listings } from "./listings";

/** One review per completed stay booking, so every review is from a real guest. */
export const reviews = booking.table(
  "reviews",
  {
    id: text("id").primaryKey(),
    bookingId: text("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "cascade" }),
    listingId: text("listing_id")
      .notNull()
      .references(() => listings.id, { onDelete: "cascade" }),
    userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
    authorName: text("author_name").notNull(),
    rating: integer("rating").notNull(), // 1 to 5
    cleanliness: integer("cleanliness"),
    accuracy: integer("accuracy"),
    location: integer("location"),
    value: integer("value"),
    body: text("body").notNull().default(""),
    hostReply: text("host_reply"),
    stayMonth: text("stay_month"), // "2026-10"
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("reviews_booking_idx").on(t.bookingId), index("reviews_listing_idx").on(t.listingId, t.createdAt)],
);
