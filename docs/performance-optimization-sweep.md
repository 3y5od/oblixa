# Performance Optimization Sweep

This note documents the implemented performance guardrails and the first snapshot data paths. It is intentionally separate from the plan file so it can evolve with the code.

## Baseline Commands

- `npm run report:performance-baseline` prints a JSON snapshot of source-level performance signals: route counts, loading/error coverage, client component footprint, exact count usage, router refresh calls, and largest client files.
- `npm run check:performance-static:grep` runs warning-only static checks for common performance footguns.
- `npm run check:performance-static:strict` fails on warning patterns and should be used when tightening the ratchet.
- `npm run check:bundle-budget` validates bundle-budget configuration and, when analyzer artifacts exist, checks client bundle budgets.
- `npm run analyze` produces Next analyzer artifacts for bundle-size enrichment.

## Snapshot RPCs

The V9 performance snapshot migration adds bounded, additive RPCs that can be adopted route by route:

- `contracts_page_snapshot` returns a paginated contracts page plus lightweight row signals.
- `work_hub_snapshot` returns the default assigned work queues in one bounded payload.
- `dashboard_home_snapshot` combines dashboard metrics and nav badge counts.
- `reports_control_room_snapshot` returns recent report/export state for the reports hub.
- `assurance_hub_snapshot` returns assurance hub headline state.

All snapshot RPCs are `security definer`, set `search_path = public`, revoke public access, and grant execution to `service_role`. UI callers should continue to enforce application-level auth, org scope, role, and product-surface eligibility before calling them.

## Cache And Freshness Rules

- Dashboard shell render should not block on optional command-palette contract rows.
- Nav badges are non-critical shell data and load after the shell frame through `/api/workspace/nav-badges`.
- Page-load telemetry is passive and uses beacon/keepalive POST to `/api/product-telemetry/page-load`.
- Focus refresh is route-aware and requires a meaningful background interval before refreshing server state.
- Snapshot RPCs may use exact counts internally today; if they become hot at scale, replace exact counts with summary tables or deferred exact count paths.

## Client Boundary Rules

- Default to server components for static UI and use client components only for interaction.
- Keep server-only packages out of client files: `@react-pdf/renderer`, `mammoth`, `openai`, `pdf-parse`, `resend`, and `stripe`.
- Prefer intent-loaded dynamic imports for hidden UI such as command palettes, advanced diagnostics, graph widgets, report controls, and mutation panels.
- Avoid passing large arrays into client components when server-rendered markup or a narrow API fetch is enough.

## Validation Expectations

Run at least:

```shell
npm run report:performance-baseline
npm run check:performance-static:grep
npm run typecheck
```

For broader verification, run:

```shell
npm run lint
npm run test
npm run check:bundle-budget
```
