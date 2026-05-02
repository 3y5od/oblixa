-- Maximal security program — phase5-timeouts-roles (documentation-only migration).
-- Apply statement_timeout / lock_timeout and least-privilege grants via Supabase dashboard,
-- pooler settings, or infrastructure-as-code outside raw SQL migrations (repo guard forbids altering database roles here).
select 1 as security_program_noop;
