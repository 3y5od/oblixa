-- Add Stripe billing columns to organizations
-- Run this in Supabase Dashboard → SQL Editor

alter table public.organizations
  add column if not exists stripe_customer_id text unique,
  add column if not exists stripe_subscription_id text unique;
