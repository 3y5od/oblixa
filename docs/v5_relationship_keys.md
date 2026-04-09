# V5 relationship keys: `account_key` and `counterparty_key`

The relationship layer (`ENABLE_V5_RELATIONSHIP_LAYER`) exposes summaries and timelines keyed by **string keys** on contracts, not by internal UUID alone.

## Schema

Migration `044_v5_control_plane_foundation.sql` adds to `public.contracts`:

- `account_key` — stable identifier for the customer/account side of the relationship (your org’s naming convention).
- `counterparty_key` — stable identifier for the external party (vendor, customer entity, etc.).

API routes:

- `GET /api/accounts/[key]/summary`
- `GET /api/counterparties/[key]/summary`

Dashboard pages: `/accounts/[key]`, `/counterparties/[key]`.

The `[key]` path segment must match the stored `account_key` or `counterparty_key` on contracts in the org.

## Why keys matter

If these columns are **NULL** for all contracts, relationship summaries will be empty or generic. Populating them unlocks:

- Grouped open exceptions and contract lists by account or counterparty
- Relationship timeline rollups (`/api/cron/v5/relationship-rollups`)
- Consistent linking from decision workspaces (`linked_account_key`, `linked_counterparty_key`)

## Population strategies

Choose one or combine:

1. **Ingestion / intake** — When contracts are created or imported, set `account_key` and `counterparty_key` from CRM, billing system, or normalized party names (e.g. slugified legal name + optional region).
2. **Bulk SQL backfill** — One-off update in Supabase SQL editor, for example from existing metadata JSON or a join to a staging mapping table (org-scoped).
3. **Admin UI or script** — Future maintenance surface; until then, prefer SQL or ETL with audit.

**Example pattern (illustrative only — adjust columns and org filter):**

```sql
-- Example: derive keys from existing title or external id; run per org after validation.
-- update public.contracts
-- set account_key = lower(regexp_replace(coalesce(metadata->>'accountName', ''), '[^a-zA-Z0-9]+', '-', 'g'))
-- where organization_id = '<org-uuid>' and account_key is null;
```

Always **validate** uniqueness expectations within an org before mass updates; keys do not have to be globally unique, only meaningful for grouping within your data model.

## Bootstrap behavior

[`src/lib/v5/relationship-bootstrap.ts`](../src/lib/v5/relationship-bootstrap.ts) ensures `account_workspaces` / `counterparty_workspaces` rows exist when summaries are read. Keys still must be present on contracts for meaningful membership lists.
