-- V9 performance sweep foundations: bounded snapshot RPCs + hot-path indexes.
-- Additive only; UI callers can adopt these route-by-route.

create index if not exists idx_contracts_org_updated_desc
  on public.contracts (organization_id, updated_at desc);

create index if not exists idx_contracts_org_status_updated_desc
  on public.contracts (organization_id, status, updated_at desc);

create index if not exists idx_contract_tasks_org_assignee_status_due
  on public.contract_tasks (organization_id, assignee_id, status, due_date);

create index if not exists idx_contract_approvals_org_approver_status_due
  on public.contract_approvals (organization_id, approver_id, status, due_at);

create index if not exists idx_contract_obligations_org_owner_status_due
  on public.contract_obligations (organization_id, owner_id, status, due_date);

create index if not exists idx_exceptions_org_owner_status_due
  on public.exceptions (organization_id, owner_id, status, due_date);

create index if not exists idx_evidence_requirements_org_status_due
  on public.evidence_requirements (organization_id, status, due_at);

create index if not exists idx_extracted_fields_contract_status_name
  on public.extracted_fields (contract_id, status, field_name);

create or replace view public.contract_operational_dates as
select
  c.id as contract_id,
  c.organization_id,
  max(ef.field_value) filter (
    where ef.status = 'approved' and ef.field_name = 'renewal_date'
  ) as renewal_date_raw,
  max(ef.field_value) filter (
    where ef.status = 'approved' and ef.field_name = 'end_date'
  ) as end_date_raw,
  max(ef.field_value) filter (
    where ef.status = 'approved' and ef.field_name = 'notice_window'
  ) as notice_window_raw
from public.contracts c
left join public.extracted_fields ef on ef.contract_id = c.id
group by c.id, c.organization_id;

create or replace function public.contracts_page_snapshot(
  p_org_id uuid,
  p_limit integer default 25,
  p_offset integer default 0,
  p_search text default null,
  p_status text default null,
  p_owner_id uuid default null,
  p_region text default null,
  p_sort text default 'activity'
)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with bounded as (
    select
      greatest(1, least(coalesce(p_limit, 25), 100)) as lim,
      greatest(0, coalesce(p_offset, 0)) as off,
      nullif(btrim(coalesce(p_search, '')), '') as q
  ),
  filtered as (
    select
      c.id,
      c.organization_id,
      c.title,
      c.counterparty,
      c.contract_type,
      c.status,
      c.region,
      c.owner_id,
      c.created_by,
      c.created_at,
      c.updated_at
    from public.contracts c, bounded b
    where c.organization_id = p_org_id
      and (p_status is null or p_status = '' or c.status = p_status)
      and (p_owner_id is null or c.owner_id = p_owner_id)
      and (p_region is null or p_region = '' or c.region = p_region)
      and (
        b.q is null
        or c.title ilike '%' || b.q || '%'
        or c.counterparty ilike '%' || b.q || '%'
        or c.contract_type ilike '%' || b.q || '%'
        or c.search_document ilike '%' || b.q || '%'
      )
  ),
  page_rows as (
    select f.*
    from filtered f, bounded b
    order by
      case when p_sort = 'created' then f.created_at else f.updated_at end desc,
      f.id desc
    limit (select lim from bounded)
    offset (select off from bounded)
  ),
  enriched as (
    select
      p.*,
      coalesce(ex.open_exception_count, 0)::integer as open_exception_count,
      coalesce(ev.outstanding_evidence_count, 0)::integer as outstanding_evidence_count,
      cod.renewal_date_raw,
      cod.end_date_raw,
      cod.notice_window_raw
    from page_rows p
    left join lateral (
      select count(*) as open_exception_count
      from public.exceptions e
      where e.organization_id = p_org_id
        and e.contract_id = p.id
        and e.status in ('open', 'in_progress')
    ) ex on true
    left join lateral (
      select count(*) as outstanding_evidence_count
      from public.evidence_requirements er
      where er.organization_id = p_org_id
        and er.contract_id = p.id
        and er.status in ('required', 'rejected', 'overdue')
    ) ev on true
    left join public.contract_operational_dates cod on cod.contract_id = p.id
  )
  select jsonb_build_object(
    'rows', coalesce((select jsonb_agg(to_jsonb(enriched)) from enriched), '[]'::jsonb),
    'total', (select count(*) from filtered),
    'limit', (select lim from bounded),
    'offset', (select off from bounded)
  );
$$;

create or replace function public.work_hub_snapshot(
  p_org_id uuid,
  p_user_id uuid,
  p_limit integer default 12
)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with bounded as (
    select greatest(1, least(coalesce(p_limit, 12), 50)) as lim
  ),
  tasks as (
    select id, title, status, due_date, contract_id, blocked_reason, updated_at
    from public.contract_tasks, bounded
    where organization_id = p_org_id
      and assignee_id = p_user_id
      and status in ('open', 'in_progress', 'blocked')
    order by due_date asc nulls last, updated_at desc
    limit (select lim from bounded)
  ),
  approvals as (
    select id, approval_type, status, due_at, contract_id, updated_at
    from public.contract_approvals, bounded
    where organization_id = p_org_id
      and approver_id = p_user_id
      and status = 'pending'
    order by due_at asc nulls last, updated_at desc
    limit (select lim from bounded)
  ),
  obligations as (
    select id, title, status, due_date, contract_id, updated_at
    from public.contract_obligations, bounded
    where organization_id = p_org_id
      and owner_id = p_user_id
      and status in ('open', 'in_progress')
    order by due_date asc nulls last, updated_at desc
    limit (select lim from bounded)
  ),
  exceptions as (
    select id, title, severity, status, contract_id, owner_id, due_date, updated_at
    from public.exceptions, bounded
    where organization_id = p_org_id
      and (owner_id = p_user_id or owner_id is null)
      and status in ('open', 'in_progress')
    order by
      case severity
        when 'critical' then 0
        when 'high' then 1
        when 'medium' then 2
        when 'low' then 3
        else 4
      end,
      due_date asc nulls last,
      updated_at desc
    limit (select lim * 2 from bounded)
  )
  select jsonb_build_object(
    'tasks', coalesce((select jsonb_agg(to_jsonb(tasks)) from tasks), '[]'::jsonb),
    'approvals', coalesce((select jsonb_agg(to_jsonb(approvals)) from approvals), '[]'::jsonb),
    'obligations', coalesce((select jsonb_agg(to_jsonb(obligations)) from obligations), '[]'::jsonb),
    'exceptions', coalesce((select jsonb_agg(to_jsonb(exceptions)) from exceptions), '[]'::jsonb)
  );
$$;

create or replace function public.dashboard_home_snapshot(p_org_id uuid, p_user_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'metrics', coalesce((select to_jsonb(m) from public.dashboard_org_metrics(p_org_id) m), '{}'::jsonb),
    'navBadges', coalesce((select to_jsonb(n) from public.org_nav_badge_counts(p_org_id, p_user_id) n), '{}'::jsonb)
  );
$$;

create or replace function public.reports_control_room_snapshot(p_org_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'recentReportRuns',
      coalesce((
        select jsonb_agg(to_jsonb(r))
        from (
          select status, started_at
          from public.report_runs
          where organization_id = p_org_id
          order by started_at desc
          limit 20
        ) r
      ), '[]'::jsonb),
    'recentExportJobs',
      coalesce((
        select jsonb_agg(to_jsonb(e))
        from (
          select id, status, selected_contract_count, exported_rows, truncated, error_message, created_at
          from public.contract_export_jobs
          where organization_id = p_org_id
          order by created_at desc
          limit 5
        ) e
      ), '[]'::jsonb)
  );
$$;

create or replace function public.assurance_hub_snapshot(p_org_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'openFindings',
      (select count(*)::bigint
       from public.assurance_findings
       where organization_id = p_org_id
         and status in ('open', 'in_review')),
    'lastRun',
      coalesce((
        select to_jsonb(r)
        from (
          select id, check_type, trigger_type, completed_at, watch_signals_json, recommended_interventions_json
          from public.assurance_check_runs
          where organization_id = p_org_id
          order by created_at desc
          limit 1
        ) r
      ), '{}'::jsonb)
  );
$$;

revoke all on function public.contracts_page_snapshot(uuid, integer, integer, text, text, uuid, text, text) from public;
revoke all on function public.work_hub_snapshot(uuid, uuid, integer) from public;
revoke all on function public.dashboard_home_snapshot(uuid, uuid) from public;
revoke all on function public.reports_control_room_snapshot(uuid) from public;
revoke all on function public.assurance_hub_snapshot(uuid) from public;

grant execute on function public.contracts_page_snapshot(uuid, integer, integer, text, text, uuid, text, text) to service_role;
grant execute on function public.work_hub_snapshot(uuid, uuid, integer) to service_role;
grant execute on function public.dashboard_home_snapshot(uuid, uuid) to service_role;
grant execute on function public.reports_control_room_snapshot(uuid) to service_role;
grant execute on function public.assurance_hub_snapshot(uuid) to service_role;
