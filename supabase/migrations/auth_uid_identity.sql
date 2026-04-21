-- ============================================================
-- CivicSplit — bind RLS identity to Supabase Auth (auth.uid)
-- ============================================================
-- Run in Supabase SQL editor if you already applied rls_lockdown.sql
-- with the older x-user-id header-based requesting_user_id().
--
-- After this: enable Email (magic link) and/or Google in
-- Authentication → Providers; remove x-user-id from the client.
-- ============================================================

CREATE OR REPLACE FUNCTION requesting_user_id()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(auth.uid()::text, '');
$$;
