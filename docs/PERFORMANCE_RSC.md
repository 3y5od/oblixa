# RSC and data-fetch performance notes

## Patterns to prefer

1. **Parallel independent reads:** Use `Promise.all([...])` when queries do not depend on each other’s results (same `organization_id` / request context).
2. **Hard caps:** List and dashboard pages should use `.limit(...)` consistent with UI needs (avoid unbounded `.select()` on large tables).
3. **Dependent reads:** Keep a second round-trip when the second query needs IDs from the first (e.g. execution graph edges → contract titles).

## Recent fix

- [`contracts/reports/page.tsx`](../src/app/(dashboard)/contracts/reports/page.tsx): digest runs, report packs, subscriptions, and pack runs now load in one `Promise.all` instead of four sequential awaits.

## Heavy pages (review when changing)

- **Contract detail** [`contracts/[id]/page.tsx`](../src/app/(dashboard)/contracts/[id]/page.tsx): one large `Promise.all` of many contract-scoped queries; prefer extending that pattern over adding new sequential awaits.
- **Execution graph** [`contracts/execution-graph/page.tsx`](../src/app/(dashboard)/contracts/execution-graph/page.tsx): edges query then contracts by derived IDs; timeline queries are inherently sequential on `selectedContractId`.

When adding new server data to these pages, extend existing `Promise.all` batches where possible.
