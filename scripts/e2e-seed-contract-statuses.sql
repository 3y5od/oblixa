-- Optional manual seed: exercise contract list filters for review/rejected/archived/terminated.
-- Adjust org/tenant IDs to match your local DB before running.
--
-- Example (uncomment and replace placeholder UUIDs):
-- update contracts set status = 'in_review' where org_id = '00000000-0000-0000-0000-000000000000' and id in (select id from contracts limit 1);
-- update contracts set status = 'rejected' where org_id = '00000000-0000-0000-0000-000000000000' and id in (select id from contracts offset 1 limit 1);
-- update contracts set status = 'archived' where org_id = '00000000-0000-0000-0000-000000000000' and id in (select id from contracts offset 2 limit 1);
-- update contracts set status = 'terminated' where org_id = '00000000-0000-0000-0000-000000000000' and id in (select id from contracts offset 3 limit 1);

select 1;