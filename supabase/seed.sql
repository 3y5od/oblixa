insert into storage.buckets (id, name, public, file_size_limit)
values ('contracts', 'contracts', false, 52428800)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit;

insert into public.organizations (id, name, v6_org_settings_json)
values (
  '00000000-0000-4000-8000-000000000101',
  'Oblixa Local Dev',
  '{
    "workspace_mode": "core",
    "autopilot_allow_execution": false,
    "search_scope": "match_mode",
    "advanced_modules_hidden": [],
    "assurance_modules_hidden": [],
    "onboarding_calibration": {
      "version": 2,
      "blocking_required": false,
      "status": "completed"
    }
  }'::jsonb
)
on conflict (id) do update
set name = excluded.name,
    v6_org_settings_json = excluded.v6_org_settings_json;
