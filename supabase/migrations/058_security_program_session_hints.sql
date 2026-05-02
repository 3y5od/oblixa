-- Security program marker: prefer bounded statement timeouts at the pooler for
-- long-running reports. Managed Supabase: configure via dashboard / support.
-- No DDL here to avoid privilege failures on hosted roles.
select 1 as oblixa_security_program_session_hints_ok;
