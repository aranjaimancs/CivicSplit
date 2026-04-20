-- Migration: trip dates on groups + category on receipts
-- Run this in the Supabase SQL editor

alter table groups
  add column if not exists start_date date,
  add column if not exists end_date   date;

alter table receipts
  add column if not exists category text not null default 'Other';
