-- Defence in depth for Supabase: the app connects as the table owner, which bypasses RLS.
-- With RLS on and no policies, the anon and authenticated roles used by Supabase's REST API see nothing.
-- Scoped to the booking schema only: public belongs to another app sharing this database.
DO $$
DECLARE t record;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'booking' LOOP
    EXECUTE format('ALTER TABLE booking.%I ENABLE ROW LEVEL SECURITY', t.tablename);
  END LOOP;
END $$;
--> statement-breakpoint
-- Supabase roles only exist on Supabase; skip them on a plain local Postgres.
DO $$
DECLARE r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format('REVOKE ALL ON SCHEMA booking FROM %I', r);
    END IF;
  END LOOP;
END $$;
