# Database performance and indexes

## Evidence-driven changes

Add or change indexes **only** when supported by:

- Supabase **Query Performance** / **Index Advisor** (or equivalent slow-query logs), or
- A reproduced slow path in staging with `EXPLAIN (ANALYZE, BUFFERS)` on the exact query shape.

Avoid “guess” indexes on every foreign key; they increase write cost and migration time.

## Tenancy and RLS

Application code using `createAdminClient()` must still **filter by `organization_id`** (or equivalent) on every query and mutation—indexes do not replace authorization. See [`AGENTS.md`](../AGENTS.md).

## Existing examples

Recent migrations follow the org- and time-scoped index pattern, e.g. [`supabase/migrations/052_v6_analytics_event_indexes.sql`](../supabase/migrations/052_v6_analytics_event_indexes.sql).

## Checklist before a new migration

1. Identify the **WHERE / ORDER BY** columns in production-like queries.
2. Confirm **cardinality** (selectivity) and **write rate** of the table.
3. For large tables, consider **concurrent** index creation and rollout in Supabase docs.
