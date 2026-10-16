# 0005: All tables live in the `booking` Postgres schema

Date: 2026-10-16. Status: accepted.

## Context

At launch the platform shares a Supabase project with another app (the student portal). That app owns the `public` schema, and two of its tables have the same names as ours: `payments` and `email_log`. Its records must be retained, so our migrations may never create, alter or enable anything in `public`.

## Decision

- Every table and enum is declared on `booking = pgSchema("booking")` in `src/db/schema/pg-schema.ts`.
- `drizzle.config.ts` sets `schemaFilter: ["booking"]` and keeps the migrations journal in `booking.__drizzle_migrations`.
- Raw SQL names tables as `booking.<table>`. A new raw query must do the same; unqualified names fail with "relation does not exist".
- Migration `0001` enables RLS on `booking` tables only and revokes the schema from Supabase's `anon` and `authenticated` roles. The `booking` schema is not exposed through Supabase's REST API.
- The earlier migrations were never applied to a shared database, so they were regenerated as a single `0000_init` rather than layered.

## Consequences

The app can share a database without touching its neighbour, and can move to its own project later with `pg_dump -n booking`. Any local database migrated before this change must be recreated.
