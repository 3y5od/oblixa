-- Align task execution RLS roles with app-side editing roles.
-- Apply after 037_v3_task_dependency_scope_guard.sql

drop policy if exists "Editors can manage task dependencies in their org" on public.contract_task_dependencies;
create policy "Editors can manage task dependencies in their org"
  on public.contract_task_dependencies for all
  using (
    exists (
      select 1 from public.organization_members
      where user_id = auth.uid()
        and organization_id = contract_task_dependencies.organization_id
        and role in ('admin', 'editor', 'ops_manager', 'manager')
    )
  );

drop policy if exists "Editors can manage task checklist in their org" on public.contract_task_checklist_items;
create policy "Editors can manage task checklist in their org"
  on public.contract_task_checklist_items for all
  using (
    exists (
      select 1 from public.organization_members
      where user_id = auth.uid()
        and organization_id = contract_task_checklist_items.organization_id
        and role in ('admin', 'editor', 'ops_manager', 'manager')
    )
  );
