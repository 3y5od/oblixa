drop index if exists public.idx_v10_job_visibility_org_source_upsert;

create unique index if not exists idx_v10_job_visibility_org_class_job_upsert
  on public.v10_job_run_visibility (organization_id, job_class, job_id);