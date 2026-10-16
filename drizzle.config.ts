import "dotenv/config";
import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

config({ path: ".env.local" });

export default defineConfig({
  schema: "./src/db/schema/index.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url: process.env.DATABASE_URL! },
  strict: true,
  // Only the booking schema belongs to this app. The shared database keeps another app in public.
  schemaFilter: ["booking"],
  migrations: { schema: "booking", table: "__drizzle_migrations" },
});
