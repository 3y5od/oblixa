## Summary

<!-- What changed and why (one short paragraph). -->

## Refinement (docs/refinement.md)

PRs that touch **dashboard layout, primary navigation, command palette, workspace product mode, or home composition** should align with [docs/refinement.md](docs/refinement.md):

- **§1 / §4.1 / §23:** Prefer hide/gate over deleting schemas, API routes, or advanced code paths.
- **§3 priorities:** Consider whether the change supports: clearer primary surface, progressive disclosure, stronger hierarchy, fewer top-level concepts, consistent naming, better defaults, or polish on visible surfaces (see `REFINEMENT_OBJECTIVES` in `src/lib/product-surface/refinement-trace.ts`).

## Checklist

- [ ] Tests added or updated where behavior changed
- [ ] No new API `route.ts` without auth + org scope (see `AGENTS.md`)
