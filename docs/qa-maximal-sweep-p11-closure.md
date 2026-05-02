# P11 / P35 — Universe closure (manual)

When merging to `main`:

1. `git checkout main && git pull`
2. `QA_UNIVERSE_FULL=1 npm run qa:sweep:universe` (long-running; use CI or a dedicated runner).
3. Commit refreshed artifacts (SBOM, coverage reports, attestation) as required by `check:qa-maximal-bundle`.
4. `npm run write:qa-universe-attestation` then review `artifacts/qa-universe-attestation.json`.
5. Remove the temporary `pr_maximal_dev` tier from `config/qa-tier-manifest.json` and delete `npm run qa:sweep:ultimate:pr-maximal-dev` once the team no longer needs that escape hatch.
