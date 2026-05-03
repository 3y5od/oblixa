# Load / soak smoke (Epic 8)

Staging-only smoke scripts live here. CI fails closed when `STAGING_BASE_URL`
is unset unless `ALLOW_LOAD_SMOKE_SKIP=true` or `ALLOW_SECRET_GATED_SKIP=true`
is explicitly configured.

## k6

```bash
# brew install k6  # or CI installer
export STAGING_BASE_URL="https://staging.example"
k6 run loadtests/k6-staging-smoke.js
```
