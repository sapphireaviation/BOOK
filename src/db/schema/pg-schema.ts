import { pgSchema } from "drizzle-orm/pg-core";

/**
 * Every table and enum lives in the `booking` Postgres schema, not `public`.
 * The database is shared with another app whose tables sit in `public`
 * (some with the same names, such as payments and email_log), so nothing here may touch `public`.
 */
export const booking = pgSchema("booking");
