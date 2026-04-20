-- Migration: add stipend_amount to groups + delete policies
-- Run this in the Supabase SQL editor if you already ran the initial schema

alter table groups
  add column if not exists stipend_amount numeric(10,2) not null default 1200;

-- Allow deleting groups (cascades to members, receipts, etc.)
do $$ begin
  create policy "public delete groups" on groups for delete using (true);
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "public update groups" on groups for update using (true);
exception when duplicate_object then null;
end $$;
