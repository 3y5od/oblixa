drop policy if exists "Deny direct access to workspace access requests" on public.workspace_access_requests;
create policy "Deny direct access to workspace access requests"
  on public.workspace_access_requests
  for all
  using (false)
  with check (false);

drop policy if exists "Deny direct access to workspace access grants" on public.workspace_access_grants;
create policy "Deny direct access to workspace access grants"
  on public.workspace_access_grants
  for all
  using (false)
  with check (false);

drop policy if exists "Deny direct access to workspace access request events" on public.workspace_access_request_events;
create policy "Deny direct access to workspace access request events"
  on public.workspace_access_request_events
  for all
  using (false)
  with check (false);
