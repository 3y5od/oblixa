-- Single round-trip metrics for dashboard + nav badges; supporting indexes for hot paths.

create or replace function public.dashboard_org_metrics(p_org_id uuid)
returns table (
  total_contracts bigint,
  pending_review bigint,
  active_contracts bigint,
  at_risk bigint,
  open_tasks bigint,
  open_obligations bigint,
  extracted_fields_total bigint,
  approved_operational_date_fields bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    (select count(*)::bigint from public.contracts c where c.organization_id = p_org_id),
    (select count(*)::bigint from public.contracts c where c.organization_id = p_org_id and c.status = 'pending_review'),
    (select count(*)::bigint from public.contracts c where c.organization_id = p_org_id and c.status = 'active'),
    (select count(*)::bigint from public.contracts c where c.organization_id = p_org_id and c.health_status = 'at_risk'),
    (select count(*)::bigint from public.contract_tasks t where t.organization_id = p_org_id and t.status in ('open', 'in_progress', 'blocked')),
    (select count(*)::bigint from public.contract_obligations o where o.organization_id = p_org_id and o.status in ('open', 'in_progress')),
    (select count(*)::bigint
       from public.extracted_fields ef
       inner join public.contracts c on c.id = ef.contract_id
      where c.organization_id = p_org_id),
    (select count(*)::bigint
       from public.extracted_fields ef
       inner join public.contracts c on c.id = ef.contract_id
      where c.organization_id = p_org_id
        and ef.status = 'approved'
        and ef.field_name in (
          'end_date', 'renewal_date', 'notice_window', 'effective_date', 'start_date'
        ));
$$;

revoke all on function public.dashboard_org_metrics(uuid) from public;
grant execute on function public.dashboard_org_metrics(uuid) to service_role;

create or replace function public.org_nav_badge_counts(p_org_id uuid, p_user_id uuid)
returns table (
  review_queue bigint,
  approvals_pending bigint,
  obligations_open bigint,
  watchlists bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    (select count(*)::bigint from public.contracts c where c.organization_id = p_org_id and c.status = 'pending_review'),
    (select count(*)::bigint from public.contract_approvals a where a.organization_id = p_org_id and a.status = 'pending'),
    (select count(*)::bigint from public.contract_obligations o where o.organization_id = p_org_id and o.status in ('open', 'in_progress')),
    (select count(*)::bigint from public.contract_watchlists w where w.organization_id = p_org_id and w.user_id = p_user_id);
$$;

revoke all on function public.org_nav_badge_counts(uuid, uuid) from public;
grant execute on function public.org_nav_badge_counts(uuid, uuid) to service_role;

-- Reminder cron: due unsent rows
create index if not exists idx_reminders_due_unsent
  on public.reminders (reminder_date)
  where sent_at is null;

-- Dedup lookups for reminder deliveries (org + type + status)
create index if not exists idx_notification_deliveries_org_type_status_created
  on public.notification_deliveries (organization_id, notification_type, status, created_at desc);
