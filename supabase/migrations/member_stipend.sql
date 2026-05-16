-- Migration: per-member stipend amount
-- Run in Supabase SQL Editor.
-- Replaces the single group-wide stipend with individual amounts each member sets themselves.

ALTER TABLE public.members
  ADD COLUMN IF NOT EXISTS stipend_amount numeric(10,2) DEFAULT NULL;
