-- Deepen Decision Packets 2.0 artifact linkage: JSON + PDF + report-pack relation.

alter table public.decision_packet_runs
  add column if not exists artifact_pdf_storage_path text,
  add column if not exists artifact_pdf_generated_at timestamptz,
  add column if not exists report_pack_id uuid references public.report_packs(id) on delete set null;

create index if not exists idx_decision_packet_runs_org_report_pack
  on public.decision_packet_runs (organization_id, report_pack_id);

comment on column public.decision_packet_runs.artifact_pdf_storage_path is 'Path within V5_DECISION_PACKET_BUCKET for generated PDF artifact.';
comment on column public.decision_packet_runs.artifact_pdf_generated_at is 'When the packet PDF artifact was generated and persisted.';
comment on column public.decision_packet_runs.report_pack_id is 'Optional report pack linkage for manager-grade review/audit bundles.';
