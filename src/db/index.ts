import "server-only";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const globalForDb = globalThis as unknown as { pg?: ReturnType<typeof postgres> };

function client() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  // The Supabase transaction pooler (port 6543) needs prepare: false, and it stalls on pipelined
  // queries, so max_pipeline: 0 sends one query per connection at a time. Transactions still
  // work because of patches/postgres@3.4.9.patch.
  return postgres(url, { prepare: false, max_pipeline: 0, max: process.env.NODE_ENV === "production" ? 5 : 10 });
}

const pg = globalForDb.pg ?? client();
if (process.env.NODE_ENV !== "production") globalForDb.pg = pg;

export const db = drizzle(pg, { schema, casing: "snake_case" });
export type DB = typeof db;
export { schema };
