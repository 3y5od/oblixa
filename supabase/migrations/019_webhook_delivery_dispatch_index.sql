-- Improve webhook dispatch scan for pending per-event deliveries.
create index if not exists idx_outbound_event_deliveries_event_pending_next
  on public.outbound_event_deliveries (outbound_event_id, delivered, next_attempt_at);
