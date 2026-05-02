# QA Maximal Sweep — track registry (P0–P210)

The plan defines **211** tracks. This repo keeps machine-checkable **evidence pointers** in:

- `config/qa-maximal-sweep-track-registry.json` — each `p0`…`p210` lists `npm` scripts that must exist and are used as the closure gate for that track.
- `scripts/check-qa-maximal-sweep-track-registry.mjs` — fails if any track is missing or references an unknown script.

Regenerate after changing tier scripts or plan phase wiring:

```bash
npm run gen:qa-maximal-sweep-registry
npm run check:qa-maximal-sweep-track-registry
```

**Scope note:** Tracks **P15–P209** map to a **rotating bundle** of existing maximal QA `npm` scripts (security, artifacts, API contracts, tier coverage, etc.). That keeps every track ID mechanically present and CI-verifiable; **product-specific depth** for each line item still lands via normal feature PRs + targeted checks as you tighten each area.
