-- Idempotent Stripe webhook handling (dedupe by Stripe event id).

create table public.stripe_webhook_events (
  id text primary key,
  received_at timestamptz not null default now()
);

create index idx_stripe_webhook_events_received on public.stripe_webhook_events(received_at desc);

alter table public.stripe_webhook_events enable row level security;
