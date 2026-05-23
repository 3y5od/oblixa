-- Keep code-owned storage buckets private and org-scoped.
insert into storage.buckets (id, name, public)
values
  ('contracts', 'contracts', false),
  ('decision-packets', 'decision-packets', false)
on conflict (id) do update set public = false;

drop policy if exists "Org members can read contract file objects" on storage.objects;
create policy "Org members can read contract file objects"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'contracts'
    and exists (
      select 1
      from public.contract_files cf
      join public.contracts c on c.id = cf.contract_id
      join public.organization_members om on om.organization_id = c.organization_id
      where cf.storage_path = storage.objects.name
        and om.user_id = auth.uid()
    )
  );

drop policy if exists "Org members can read decision packet objects" on storage.objects;
create policy "Org members can read decision packet objects"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'decision-packets'
    and exists (
      select 1
      from public.decision_packet_runs dpr
      join public.organization_members om on om.organization_id = dpr.organization_id
      where (dpr.artifact_storage_path = storage.objects.name or dpr.artifact_pdf_storage_path = storage.objects.name)
        and storage.objects.name like (dpr.organization_id::text || '/%')
        and om.user_id = auth.uid()
    )
  );
