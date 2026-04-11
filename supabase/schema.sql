-- ============================================================
-- CivicSplit Supabase Schema
-- Run this in the Supabase SQL editor
-- ============================================================

-- Enable UUID extension
create extension if not exists "pgcrypto";

-- ============================================================
-- TABLES
-- ============================================================

create table if not exists groups (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  join_code   text not null unique,
  week_count  int  not null default 8,
  created_at  timestamptz not null default now()
);

create table if not exists members (
  id            uuid primary key default gen_random_uuid(),
  group_id      uuid not null references groups(id) on delete cascade,
  user_id       text not null,            -- client-generated anonymous ID stored in localStorage
  display_name  text not null,
  avatar_color  text not null default '#534AB7',
  venmo_handle  text,
  created_at    timestamptz not null default now(),
  unique(group_id, user_id)
);

create table if not exists receipts (
  id          uuid primary key default gen_random_uuid(),
  group_id    uuid not null references groups(id) on delete cascade,
  paid_by     uuid not null references members(id) on delete cascade,
  store_name  text not null,
  date        date not null default current_date,
  total       numeric(10,2) not null default 0,
  created_at  timestamptz not null default now()
);

create type split_type as enum ('shared', 'personal', 'custom');

create table if not exists line_items (
  id          uuid primary key default gen_random_uuid(),
  receipt_id  uuid not null references receipts(id) on delete cascade,
  name        text not null,
  price       numeric(10,2) not null,
  split_type  split_type not null default 'shared',
  created_at  timestamptz not null default now()
);

create table if not exists line_item_splits (
  id            uuid primary key default gen_random_uuid(),
  line_item_id  uuid not null references line_items(id) on delete cascade,
  member_id     uuid not null references members(id) on delete cascade,
  amount        numeric(10,2) not null,
  unique(line_item_id, member_id)
);

create table if not exists settlements (
  id           uuid primary key default gen_random_uuid(),
  group_id     uuid not null references groups(id) on delete cascade,
  from_member  uuid not null references members(id) on delete cascade,
  to_member    uuid not null references members(id) on delete cascade,
  amount       numeric(10,2) not null,
  is_settled   boolean not null default false,
  settled_at   timestamptz,
  created_at   timestamptz not null default now()
);

-- ============================================================
-- INDEXES
-- ============================================================

create index if not exists members_group_id_idx       on members(group_id);
create index if not exists receipts_group_id_idx      on receipts(group_id);
create index if not exists line_items_receipt_id_idx  on line_items(receipt_id);
create index if not exists settlements_group_id_idx   on settlements(group_id);

-- ============================================================
-- RLS (Row Level Security)
-- All tables are publicly readable/writable via join_code
-- gating — no Supabase auth required for MVP.
-- ============================================================

alter table groups          enable row level security;
alter table members         enable row level security;
alter table receipts        enable row level security;
alter table line_items      enable row level security;
alter table line_item_splits enable row level security;
alter table settlements     enable row level security;

-- Fully open policies (join_code acts as the access token for now)
-- You can tighten these later by checking the user's member row.

create policy "public read groups"
  on groups for select using (true);

create policy "public insert groups"
  on groups for insert with check (true);

create policy "public read members"
  on members for select using (true);

create policy "public insert members"
  on members for insert with check (true);

create policy "public update members"
  on members for update using (true);

create policy "public read receipts"
  on receipts for select using (true);

create policy "public insert receipts"
  on receipts for insert with check (true);

create policy "public update receipts"
  on receipts for update using (true);

create policy "public delete receipts"
  on receipts for delete using (true);

create policy "public read line_items"
  on line_items for select using (true);

create policy "public insert line_items"
  on line_items for insert with check (true);

create policy "public update line_items"
  on line_items for update using (true);

create policy "public delete line_items"
  on line_items for delete using (true);

create policy "public read line_item_splits"
  on line_item_splits for select using (true);

create policy "public insert line_item_splits"
  on line_item_splits for insert with check (true);

create policy "public update line_item_splits"
  on line_item_splits for update using (true);

create policy "public delete line_item_splits"
  on line_item_splits for delete using (true);

create policy "public read settlements"
  on settlements for select using (true);

create policy "public insert settlements"
  on settlements for insert with check (true);

create policy "public update settlements"
  on settlements for update using (true);

-- ============================================================
-- REALTIME
-- ============================================================

-- Enable realtime for live balance updates
alter publication supabase_realtime add table receipts;
alter publication supabase_realtime add table line_items;
alter publication supabase_realtime add table line_item_splits;
alter publication supabase_realtime add table members;
alter publication supabase_realtime add table settlements;
