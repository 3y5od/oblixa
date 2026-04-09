<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Security checklist for new API routes

- **Auth:** `src/proxy.ts` does not protect `/api/*`. Every `route.ts` must authenticate (session, cron secret, capability token, etc.) and return 401/403 when appropriate.
- **Service role:** `createAdminClient()` bypasses RLS. Every query/mutation must filter by `organization_id` (or equivalent tenancy) from server-derived context—never trust client-supplied org IDs for authorization.
- **Inbound automation:** Use `isInboundAutomationAuthorized` from `src/lib/security/inbound-automation-token.ts` for Slack/email/integration callback routes; optional per-route env vars are documented in `.env.example`.
- **Regression tests:** Add or extend route tests for auth failures and, for org-scoped handlers, consider assertions in `src/app/api/security-org-scope-queries.test.ts` (or route-local tests) so IDOR-style regressions are caught in CI. New `route.ts` files should have a colocated `route.test.ts` or an entry in `scripts/api-route-test-allowlist.txt` if covered by a bundled test file.
