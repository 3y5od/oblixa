-- Scope external links to decision workspaces; optional passcode storage for external flows.

alter table public.external_action_links
  add column if not exists decision_workspace_id uuid references public.decision_workspaces(id) on delete set null,
  add column if not exists passcode_hash text;

create index if not exists idx_external_action_links_org_decision_workspace
  on public.external_action_links (organization_id, decision_workspace_id)
  where decision_workspace_id is not null;

update public.external_action_links e
set decision_workspace_id = (e.scope_json->>'decisionWorkspaceId')::uuid
where e.decision_workspace_id is null
  and e.scope_json ? 'decisionWorkspaceId'
  and (e.scope_json->>'decisionWorkspaceId') ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
