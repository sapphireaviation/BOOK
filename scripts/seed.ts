/**
 * Seeds reference data: airports, flight routes and destinations.
 * Pass --demo to also add sample listings (development only; refused in production).
 * Pass --offline to build airports from the committed src/data/airports.json instead of downloading.
 *
 *   pnpm db:seed
 *   pnpm db:seed --demo
 */
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../src/db/schema";
import { seedAirports } from "./seed/airports";
import { seedRoutes } from "./seed/routes";
import { seedDestinations } from "./seed/destinations";
import { seedDemoListings } from "./seed/demo-listings";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  const demo = process.argv.includes("--demo");
  if (demo && process.env.NODE_ENV === "production") throw new Error("Refusing to seed demo listings in production.");

  const client = postgres(url, { prepare: false, max: 1 });
  const db = drizzle(client, { schema, casing: "snake_case" });
  try {
    await seedAirports(db, { refresh: !process.argv.includes("--offline") });
    await seedRoutes(db);
    await seedDestinations(db);
    if (demo) await seedDemoListings(db);
    console.log(demo ? "Seeded reference data and demo listings." : "Seeded reference data.");
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
