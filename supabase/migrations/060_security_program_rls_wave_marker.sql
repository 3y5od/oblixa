-- Maximal security program — RLS / policy symmetry tracking (documentation-only).
-- FORCE ROW LEVEL SECURITY and view policies are rolled out per-table in dedicated migrations after review.
-- Matrix control: force_rls_owner_tables_wave (config/maximal-security-closure-register.json non_code_controls).
select 1 as security_program_rls_wave_marker;
