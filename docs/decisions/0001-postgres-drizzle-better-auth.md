# 0001: Plain Postgres with Drizzle and Better Auth

Status: accepted, 2026-10-15

## Context

Production runs on Supabase, but the Supabase projects available tonight were either in use by other products or paused, and the free plan allows two active projects. We need a database layer that works on any Postgres so the app can be developed locally and moved between providers.

## Decision

Talk to Postgres directly through `DATABASE_URL` with Drizzle ORM and the `postgres` driver. Use Better Auth for authentication, storing its tables in the same database. Do not use Supabase client libraries, Supabase Auth or Row Level Security as the primary access control.

## Consequences

- Any Postgres works: Supabase, Neon, RDS, local.
- Access control lives in the service layer (`src/server/**`). RLS is enabled with no policies on all tables as a defence in depth, so the public Supabase REST API exposes nothing.
- On Supabase use the transaction pooler URL (port 6543) and set `prepare: false` in the driver, which `src/db/index.ts` does.
