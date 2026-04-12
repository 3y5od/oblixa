-- Refinement: workspace product mode and related keys live in organizations.v6_org_settings_json
-- (workspace_mode, default_landing_path, advanced_modules_hidden, etc.). No new columns required.

comment on column public.organizations.v6_org_settings_json is
  'V6 org settings: workspace_mode (core|advanced|assurance), default_landing_path (mode-validated), advanced_modules_hidden, advanced_nav_roles, assurance_nav_roles, assurance_nav_admin_testing, autopilot_allow_execution, review_board_notification_emails, home_hidden_sections, etc.';
