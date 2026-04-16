## Summary

<!-- What changed, why now, and any user or operator impact (one short paragraph). -->

## Validation

- [ ] Tests added or updated where behavior changed
- [ ] Relevant local checks were run and noted in the PR body
- [ ] No new API `route.ts` without auth + org scope (see [`AGENTS.md`](../AGENTS.md))

## Refinement

PRs that touch **dashboard layout, primary navigation, command palette, workspace product mode, or home composition** should align with [docs/refinement.md](../docs/refinement.md):

- Prefer hide/gate over deleting schemas, API routes, migrations, or advanced code paths.
- Keep nav, command palette, dashboard composition, and outbound surfaces workspace-mode aware.
- Consider whether the change supports one or more `REFINEMENT_OBJECTIVES` in `src/lib/product-surface/refinement-trace.ts`.
- Run `npm run check:v8-suite` when the change affects governed surfaces, route eligibility, or discoverability.
