-- Defence in depth for Supabase: the app connects as the table owner, which bypasses RLS.
-- With RLS on and no policies, the anon and authenticated roles used by Supabase's REST API see nothing.
DO $$
DECLARE t record;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.tablename);
  END LOOP;
END $$;
