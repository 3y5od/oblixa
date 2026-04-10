-- Per-organization V6 settings (autopilot gate, review notifications, etc.)
alter table public.organizations
  add column if not exists v6_org_settings_json jsonb not null default '{}'::jsonb;

comment on column public.organizations.v6_org_settings_json is
  'V6 org settings: autopilot_allow_execution (bool), review_board_notification_emails (string[]), etc.';
