create unique index if not exists idx_notification_deliveries_reminder_due_dedupe
  on public.notification_deliveries (
    organization_id,
    channel,
    notification_type,
    recipient,
    ((metadata->>'reminder_id'))
  )
  where channel = 'email'
    and notification_type = 'reminder_due'
    and recipient is not null
    and metadata ? 'reminder_id';

create unique index if not exists idx_contract_tasks_rule_active_dedupe
  on public.contract_tasks (organization_id, contract_id, title, created_via)
  where created_via = 'rule'
    and status in ('open', 'in_progress', 'blocked');