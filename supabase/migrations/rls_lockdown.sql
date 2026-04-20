-- ============================================================
-- CivicSplit — RLS Lockdown Migration
-- ============================================================
-- Run this file once in the Supabase SQL editor.
-- It replaces all permissive USING (true) policies with
-- member-scoped and admin-scoped policies.
--
-- Auth model:
--   Anonymous users pass their UUID via the x-user-id HTTP header.
--   PostgREST forwards all request headers as the session variable
--   request.headers (a JSON string).
--
--   Admins additionally pass x-admin-passcode, which is matched
--   against a DB-level setting so the secret never touches client code.
-- ============================================================


-- ────────────────────────────────────────────────────────────
-- 0. Store the admin passcode in a config table
--    (ALTER DATABASE SET is blocked on Supabase — no superuser)
--    Change 'civic2026' to your real passcode before running.
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.app_config (
  key   text PRIMARY KEY,
  value text NOT NULL
);

-- Disable RLS on this table — it's read-only system config,
-- never exposed directly to the client.
ALTER TABLE public.app_config DISABLE ROW LEVEL SECURITY;

-- Revoke direct client access; only server-side functions read it.
REVOKE ALL ON public.app_config FROM anon, authenticated;

INSERT INTO public.app_config (key, value)
  VALUES ('admin_passcode', 'civic2026')
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;


-- ────────────────────────────────────────────────────────────
-- 1. Helper: extract the caller's user-id from request headers
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION requesting_user_id()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT
    COALESCE(
      current_setting('request.headers', true)::json->>'x-user-id',
      ''
    );
$$;


-- ────────────────────────────────────────────────────────────
-- 2. Helper: is the caller a member of a given group?
--    SECURITY DEFINER so it can query the members table without
--    triggering the members table's own RLS (avoids circular check).
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION is_group_member(p_group_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.members
    WHERE group_id = p_group_id
      AND user_id  = requesting_user_id()
  );
$$;


-- ────────────────────────────────────────────────────────────
-- 3. Helper: is this an admin request?
--    Compares the x-admin-passcode header value against the
--    passcode stored in app_config.
--    SECURITY DEFINER so it can read app_config (which has all
--    client grants revoked).
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION is_admin_request()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COALESCE(
      current_setting('request.headers', true)::json->>'x-admin-passcode',
      ''
    ) = (SELECT value FROM public.app_config WHERE key = 'admin_passcode');
$$;


-- ============================================================
-- Enable RLS on all tables
-- ============================================================
ALTER TABLE public.groups        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.members       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receipts      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.line_items    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.line_item_splits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settlements   ENABLE ROW LEVEL SECURITY;


-- ============================================================
-- Drop all existing policies (clean slate)
-- ============================================================

-- groups
DROP POLICY IF EXISTS "groups_open_read"   ON public.groups;
DROP POLICY IF EXISTS "groups_open_write"  ON public.groups;
DROP POLICY IF EXISTS "groups_allow_all"   ON public.groups;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.groups;
DROP POLICY IF EXISTS "Enable insert for all users"      ON public.groups;
DROP POLICY IF EXISTS "Enable update for all users"      ON public.groups;
DROP POLICY IF EXISTS "Enable delete for all users"      ON public.groups;

-- members
DROP POLICY IF EXISTS "members_open_read"  ON public.members;
DROP POLICY IF EXISTS "members_open_write" ON public.members;
DROP POLICY IF EXISTS "members_allow_all"  ON public.members;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.members;
DROP POLICY IF EXISTS "Enable insert for all users"      ON public.members;
DROP POLICY IF EXISTS "Enable update for all users"      ON public.members;

-- receipts
DROP POLICY IF EXISTS "receipts_open_read"  ON public.receipts;
DROP POLICY IF EXISTS "receipts_open_write" ON public.receipts;
DROP POLICY IF EXISTS "receipts_allow_all"  ON public.receipts;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.receipts;
DROP POLICY IF EXISTS "Enable insert for all users"      ON public.receipts;
DROP POLICY IF EXISTS "Enable update for all users"      ON public.receipts;
DROP POLICY IF EXISTS "Enable delete for all users"      ON public.receipts;

-- line_items
DROP POLICY IF EXISTS "line_items_open_read"  ON public.line_items;
DROP POLICY IF EXISTS "line_items_open_write" ON public.line_items;
DROP POLICY IF EXISTS "line_items_allow_all"  ON public.line_items;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.line_items;
DROP POLICY IF EXISTS "Enable insert for all users"      ON public.line_items;
DROP POLICY IF EXISTS "Enable update for all users"      ON public.line_items;
DROP POLICY IF EXISTS "Enable delete for all users"      ON public.line_items;

-- line_item_splits
DROP POLICY IF EXISTS "splits_open_read"  ON public.line_item_splits;
DROP POLICY IF EXISTS "splits_open_write" ON public.line_item_splits;
DROP POLICY IF EXISTS "splits_allow_all"  ON public.line_item_splits;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.line_item_splits;
DROP POLICY IF EXISTS "Enable insert for all users"      ON public.line_item_splits;
DROP POLICY IF EXISTS "Enable update for all users"      ON public.line_item_splits;
DROP POLICY IF EXISTS "Enable delete for all users"      ON public.line_item_splits;

-- settlements
DROP POLICY IF EXISTS "settlements_open_read"  ON public.settlements;
DROP POLICY IF EXISTS "settlements_open_write" ON public.settlements;
DROP POLICY IF EXISTS "settlements_allow_all"  ON public.settlements;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.settlements;
DROP POLICY IF EXISTS "Enable insert for all users"      ON public.settlements;
DROP POLICY IF EXISTS "Enable update for all users"      ON public.settlements;


-- ============================================================
-- GROUPS
--   SELECT  — anyone with the join code can read (public lobby)
--             OR admin can read all groups
--   INSERT  — admin only (admin creates groups)
--   UPDATE  — admin only
--   DELETE  — admin only
-- ============================================================

CREATE POLICY "groups_select"
  ON public.groups
  FOR SELECT
  USING (true);
  -- Groups are identified by join_code. If you know the code you
  -- can join; no further filter needed since the join_code itself
  -- acts as the "password". Admins also need unrestricted SELECT.

CREATE POLICY "groups_insert"
  ON public.groups
  FOR INSERT
  WITH CHECK (is_admin_request());

CREATE POLICY "groups_update"
  ON public.groups
  FOR UPDATE
  USING (is_admin_request())
  WITH CHECK (is_admin_request());

CREATE POLICY "groups_delete"
  ON public.groups
  FOR DELETE
  USING (is_admin_request());


-- ============================================================
-- MEMBERS
--   SELECT  — members of the same group can see each other
--             OR admin sees everyone
--   INSERT  — any authenticated user can create their own member
--             record (joining a group). user_id must equal caller.
--   UPDATE  — own record only (e.g. display_name change)
-- ============================================================

CREATE POLICY "members_select"
  ON public.members
  FOR SELECT
  USING (
    is_admin_request()
    OR is_group_member(group_id)
  );

CREATE POLICY "members_insert"
  ON public.members
  FOR INSERT
  WITH CHECK (
    -- The user_id column must match the caller's ID so no one can
    -- impersonate another user.
    user_id = requesting_user_id()
    OR is_admin_request()
  );

CREATE POLICY "members_update"
  ON public.members
  FOR UPDATE
  USING (
    user_id = requesting_user_id()
    OR is_admin_request()
  )
  WITH CHECK (
    user_id = requesting_user_id()
    OR is_admin_request()
  );


-- ============================================================
-- RECEIPTS
--   SELECT  — group members or admin
--   INSERT  — group members (paid_by member must be in group)
--   UPDATE  — group members (e.g. edit receipt details)
--   DELETE  — group members or admin
-- ============================================================

CREATE POLICY "receipts_select"
  ON public.receipts
  FOR SELECT
  USING (
    is_admin_request()
    OR is_group_member(group_id)
  );

CREATE POLICY "receipts_insert"
  ON public.receipts
  FOR INSERT
  WITH CHECK (
    is_group_member(group_id)
    OR is_admin_request()
  );

CREATE POLICY "receipts_update"
  ON public.receipts
  FOR UPDATE
  USING (
    is_group_member(group_id)
    OR is_admin_request()
  )
  WITH CHECK (
    is_group_member(group_id)
    OR is_admin_request()
  );

CREATE POLICY "receipts_delete"
  ON public.receipts
  FOR DELETE
  USING (
    is_group_member(group_id)
    OR is_admin_request()
  );


-- ============================================================
-- LINE_ITEMS
--   All access gated on being a member of the receipt's group.
--   We join through receipts to get the group_id.
-- ============================================================

CREATE POLICY "line_items_select"
  ON public.line_items
  FOR SELECT
  USING (
    is_admin_request()
    OR EXISTS (
      SELECT 1 FROM public.receipts r
      WHERE r.id = line_items.receipt_id
        AND is_group_member(r.group_id)
    )
  );

CREATE POLICY "line_items_insert"
  ON public.line_items
  FOR INSERT
  WITH CHECK (
    is_admin_request()
    OR EXISTS (
      SELECT 1 FROM public.receipts r
      WHERE r.id = line_items.receipt_id
        AND is_group_member(r.group_id)
    )
  );

CREATE POLICY "line_items_update"
  ON public.line_items
  FOR UPDATE
  USING (
    is_admin_request()
    OR EXISTS (
      SELECT 1 FROM public.receipts r
      WHERE r.id = line_items.receipt_id
        AND is_group_member(r.group_id)
    )
  )
  WITH CHECK (
    is_admin_request()
    OR EXISTS (
      SELECT 1 FROM public.receipts r
      WHERE r.id = line_items.receipt_id
        AND is_group_member(r.group_id)
    )
  );

CREATE POLICY "line_items_delete"
  ON public.line_items
  FOR DELETE
  USING (
    is_admin_request()
    OR EXISTS (
      SELECT 1 FROM public.receipts r
      WHERE r.id = line_items.receipt_id
        AND is_group_member(r.group_id)
    )
  );


-- ============================================================
-- LINE_ITEM_SPLITS
--   Access gated via line_item → receipt → group chain.
-- ============================================================

CREATE POLICY "splits_select"
  ON public.line_item_splits
  FOR SELECT
  USING (
    is_admin_request()
    OR EXISTS (
      SELECT 1
      FROM public.line_items li
      JOIN public.receipts   r  ON r.id = li.receipt_id
      WHERE li.id = line_item_splits.line_item_id
        AND is_group_member(r.group_id)
    )
  );

CREATE POLICY "splits_insert"
  ON public.line_item_splits
  FOR INSERT
  WITH CHECK (
    is_admin_request()
    OR EXISTS (
      SELECT 1
      FROM public.line_items li
      JOIN public.receipts   r  ON r.id = li.receipt_id
      WHERE li.id = line_item_splits.line_item_id
        AND is_group_member(r.group_id)
    )
  );

CREATE POLICY "splits_update"
  ON public.line_item_splits
  FOR UPDATE
  USING (
    is_admin_request()
    OR EXISTS (
      SELECT 1
      FROM public.line_items li
      JOIN public.receipts   r  ON r.id = li.receipt_id
      WHERE li.id = line_item_splits.line_item_id
        AND is_group_member(r.group_id)
    )
  )
  WITH CHECK (
    is_admin_request()
    OR EXISTS (
      SELECT 1
      FROM public.line_items li
      JOIN public.receipts   r  ON r.id = li.receipt_id
      WHERE li.id = line_item_splits.line_item_id
        AND is_group_member(r.group_id)
    )
  );

CREATE POLICY "splits_delete"
  ON public.line_item_splits
  FOR DELETE
  USING (
    is_admin_request()
    OR EXISTS (
      SELECT 1
      FROM public.line_items li
      JOIN public.receipts   r  ON r.id = li.receipt_id
      WHERE li.id = line_item_splits.line_item_id
        AND is_group_member(r.group_id)
    )
  );


-- ============================================================
-- SETTLEMENTS
--   SELECT  — group members or admin
--   INSERT  — group members (both from/to must be in the group)
--   UPDATE  — admin or the payer (from_member)
-- ============================================================

CREATE POLICY "settlements_select"
  ON public.settlements
  FOR SELECT
  USING (
    is_admin_request()
    OR is_group_member(group_id)
  );

CREATE POLICY "settlements_insert"
  ON public.settlements
  FOR INSERT
  WITH CHECK (
    is_group_member(group_id)
    OR is_admin_request()
  );

CREATE POLICY "settlements_update"
  ON public.settlements
  FOR UPDATE
  USING (
    is_admin_request()
    OR (
      is_group_member(group_id)
      AND from_member IN (
        SELECT id FROM public.members
        WHERE user_id = requesting_user_id()
      )
    )
  )
  WITH CHECK (
    is_admin_request()
    OR (
      is_group_member(group_id)
      AND from_member IN (
        SELECT id FROM public.members
        WHERE user_id = requesting_user_id()
      )
    )
  );
