-- Optional Supabase Storage linkage for decision packet JSON artifacts (V5 §9.7).

alter table public.decision_packet_runs
  add column if not exists artifact_storage_path text,
  add column if not exists artifact_content_type text,
  add column if not exists artifact_generated_at timestamptz;

comment on column public.decision_packet_runs.artifact_storage_path is 'Path within V5_DECISION_PACKET_BUCKET after successful upload.';
comment on column public.decision_packet_runs.artifact_content_type is 'MIME type of stored artifact (e.g. application/json).';
comment on column public.decision_packet_runs.artifact_generated_at is 'When the artifact was written to object storage.';
