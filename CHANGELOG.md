# Changelog

All notable changes to this project are documented here. The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added

- Release-process documentation: CI gates, optional staging comprehensive pass, and fork/PR E2E expectations (see [docs/V5_RELEASE_RUNBOOK.md](docs/V5_RELEASE_RUNBOOK.md)).
- Coverage thresholds extended to `src/lib/observability/**` and `src/lib/stripe.ts` (alongside existing `v5` and `security` libraries).
- Scripts: `npm run audit:moderate` (full `npm audit` for periodic moderate/low review) and `npm run sbom` (CycloneDX SBOM from the lockfile with `--ignore-npm-errors` so peer-resolution noise does not block output; artifact `cyclonedx-sbom.json`, gitignored).
