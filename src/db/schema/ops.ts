import { index, integer, jsonb, text, timestamp } from "drizzle-orm/pg-core";
import { booking } from "./pg-schema";

/** Token bucket rate limiting, keyed by route and client. */
export const rateLimits = booking.table("rate_limits", {
  key: text("key").primaryKey(),
  tokens: integer("tokens").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Anonymous search log. Feeds route facts (cheapest month, popular routes) and demand insight. */
export const searchLog = booking.table(
  "search_log",
  {
    id: text("id").primaryKey(),
    kind: text("kind").notNull(), // "flight" | "stay"
    source: text("source").notNull().default("web"), // "web" | "api" | "mcp"
    query: jsonb("query").$type<Record<string, unknown>>().notNull(),
    resultCount: integer("result_count").notNull().default(0),
    /** Cheapest result in minor units, with currency in query. */
    cheapest: integer("cheapest"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("search_log_kind_created_idx").on(t.kind, t.createdAt)],
);

/** Outgoing email log, so a failed send can be retried and support can see what was sent. */
export const emailLog = booking.table("email_log", {
  id: text("id").primaryKey(),
  to: text("to").notNull(),
  template: text("template").notNull(),
  subject: text("subject").notNull(),
  status: text("status").notNull(),
  providerId: text("provider_id"),
  error: text("error"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
