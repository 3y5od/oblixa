# Contract Operations Tracker — App Specification (As-Built)

This document describes the application **as implemented in the codebase**, for post-MVP planning. It is not the PRD.

---

## 1. Identity & Stack

| | |
|---|---|
| **Name** | ContractOps — Contract Operations Tracker |
| **Version** | 0.1.0 (pre-launch, not deployed) |
| **Framework** | Next.js 16.2.2 (App Router, Turbopack dev) |
| **React** | 19.2.4 |
| **TypeScript** | 5.x, strict mode, `@/*` path alias to `src/` |
| **Styling** | Tailwind CSS v4 via `@tailwindcss/postcss`; no `tailwind.config`; `@import "tailwindcss"` in `globals.css`. Geist + Geist Mono fonts. |
| **Database / Auth / Storage** | Supabase (`@supabase/ssr` 0.10, `supabase-js` 2.101). Hosted Postgres + Auth + Storage bucket `contracts`. |
| **Payments** | Stripe 22 (Checkout Sessions for subscription, Customer Portal, Webhooks) |
| **Email** | Resend 6.10 — reminder emails only |
| **AI** | OpenAI SDK 6.33 — `gpt-4o-mini`, temperature 0, `json_object` response format |
| **Document parsing** | `pdf-parse` 2.4.5 (PDF→text), `mammoth` 1.12 (DOCX→text). No OCR. |
| **Icons** | `lucide-react` 1.7 |
| **Date** | `date-fns` 4.1 |
| **Utility** | `clsx` 2.1 |

---

## 2. Environment Variables

**Required:**

- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_ID` (single price)
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- `RESEND_API_KEY`
- `OPENAI_API_KEY`
- `NEXT_PUBLIC_APP_URL` (base URL for links/redirects)

**Optional behavioral flags:**

- `REQUIRE_ACTIVE_SUBSCRIPTION` — when `"true"`, mutations require `stripe_subscription_id` on org
- `ENABLE_DEMO_SEED` — when `"true"`, admin “Load demo contracts” button works
- `CRON_SECRET` — Bearer token for `GET /api/reminders/send`
- `EMAIL_FROM` — sender address (defaults to `onboarding@resend.dev`)
- `STRIPE_TRIAL_PERIOD_DAYS` — integer days; when set, Stripe Checkout creates trial subscriptions

---

## 3. Database Schema (Postgres via Supabase)

**Migrations:** `001_initial_schema.sql`, `002_add_stripe_columns.sql`, `002_prd_enhancements.sql` (apply all in order for full schema).

### Tables

**`organizations`** — `id` (uuid PK), `name`, `stripe_customer_id` (unique, nullable), `stripe_subscription_id` (unique, nullable), `created_at`, `updated_at`. Auto-`updated_at` trigger.

**`profiles`** — `id` (uuid PK → `auth.users`), `full_name`, `email`, `avatar_url`, `onboarding_completed_at` (timestamptz, nullable — from `002_prd_enhancements`), `created_at`, `updated_at`. Auto-created via trigger on `auth.users` insert. Auto-`updated_at` trigger.

**`organization_members`** — `id` (uuid PK), `organization_id` (FK→orgs), `user_id` (FK→auth.users), `role` (check: admin/editor/viewer, default editor), `created_at`. Unique on `(organization_id, user_id)`.

**`contracts`** — `id` (uuid PK), `organization_id` (FK→orgs), `title`, `counterparty`, `contract_type`, `status` (check: draft/pending_review/active/expired/terminated, default pending_review), `owner_id` (FK→auth.users), `created_by` (FK→auth.users), `search_document` (text, nullable — extracted plaintext up to ~120k chars), `created_at`, `updated_at`. Auto-`updated_at` trigger.

**`contract_files`** — `id` (uuid PK), `contract_id` (FK→contracts, cascade delete), `file_name`, `file_type`, `file_size` (int), `storage_path`, `uploaded_by` (FK→auth.users), `created_at`.

**`extracted_fields`** — `id` (uuid PK), `contract_id` (FK→contracts, cascade delete), `field_name`, `field_value` (nullable text), `source_snippet` (nullable text), `confidence` (real, nullable), `status` (check: pending/approved/rejected/edited, default pending), `source` (check: ai/human, default ai), `reviewed_by` (FK→auth.users), `reviewed_at`, `created_at`, `updated_at`. Auto-`updated_at` trigger.

**`reminders`** — `id` (uuid PK), `contract_id` (FK→contracts, cascade delete), `field_id` (FK→extracted_fields, set null on delete), `reminder_type`, `reminder_date` (date), `sent_at` (timestamptz, nullable), `recipient_id` (FK→auth.users), `created_at`.

**`audit_events`** — `id` (uuid PK), `organization_id` (FK→orgs, cascade delete), `contract_id` (FK→contracts, set null on delete), `user_id` (FK→auth.users), `action` (text), `details` (jsonb), `created_at`.

### Indexes

`idx_contracts_org`, `idx_contracts_status`, `idx_contracts_owner`, `idx_contract_files_contract`, `idx_extracted_fields_contract`, `idx_extracted_fields_status`, `idx_reminders_contract`, `idx_reminders_date`, `idx_audit_events_org`, `idx_audit_events_contract`, `idx_org_members_org`, `idx_org_members_user`.

### RLS

Enabled on all 8 tables with policies based on `auth.uid()` and org membership. **The application bypasses RLS** by using `SUPABASE_SERVICE_ROLE_KEY` for data queries (admin client). RLS matters only if you move to anon-key PostgREST with JWT propagation.

### Storage

Bucket `contracts` (private). Files at `{orgId}/{contractId}/{uuid}-{filename}`.

### SQL helpers

- `handle_new_user()` — on `auth.users` insert → `profiles` row.
- `update_updated_at()` — triggers on orgs, profiles, contracts, extracted_fields.
- `create_user_org` RPC exists in migration but app uses `ensureUserOrg` in TypeScript.

---

## 4. Architecture Pattern

### Auth

- **Anon client** (`createClient()`) — cookies + anon key; `getUser()` for verification.
- **Admin client** (`createAdminClient()`) — service role, no cookies; all DB/storage reads/writes.

### `getAuthContext()`

Returns `{ user, orgId, role, admin }` or `null`. Resolves first `organization_members` row for the user (`limit(1).single()`).

### `src/proxy.ts`

Middleware: session refresh, redirect unauthenticated users to `/login` (except public routes, `/auth/callback`, `/api/*`), redirect logged-in users away from auth pages to `/dashboard`.

### Server actions

Pattern: anon `getUser()` → membership check on admin → `requireWriteAccess` where needed → mutate via admin → `audit_events`.

---

## 5. Field Schema (Fixed, 11 Fields)

```
counterparty, contract_type, effective_date, start_date, end_date,
renewal_date, notice_window, term, fee_reference, payment_cadence, auto_renewal
```

`FIELD_NAMES` in `src/lib/types/index.ts`. Not user-configurable.

---

## 6. Extraction Pipeline

1. Upload → Storage + `contract_files`.
2. On create (if `OPENAI_API_KEY` set and not placeholder), `triggerExtraction` POSTs to `/api/extract` with cookies.
3. `/api/extract`: download files → `extractTextFromBuffer` (PDF/DOCX) → concatenate → update `contracts.search_document` (cap 120k) → `extractFieldsFromText` (first 30k chars to LLM) → insert new `extracted_fields` (pending, ai), skip existing `field_name` → audit `extraction.completed`.

**LLM:** `gpt-4o-mini`, JSON object/array parsing with fallbacks. Prompt requires source snippet when value non-null.

**Manual:** “Extract fields with AI” → `runExtraction` → same route.

---

## 7. Review Workflow

**UI:** `FieldReview` table — Field, Value, Confidence %, Source, Status, Actions.

**Statuses:** pending → approved | rejected | edited.

**Confidence:** Color bands (e.g. green ≥75%, amber ≥45%, red &lt;45%).

**Gate:** AI rows with value but no `source_snippet` cannot be approved (UI + server). User edits (becomes human) or rejects.

**Manual add:** `AddFieldForm` — missing `FIELD_NAMES` only; inserts approved human row; date fields schedule reminders.

**Audit:** `field.approved`, `field.edited`, `field.rejected`, `field.added`.

---

## 8. Reminder System

**DATE_FIELDS** (for scheduling): `end_date`, `renewal_date`, `notice_window`, `effective_date`, `start_date`.

**Offsets:** 30, 14, 7, 1 days before parsed date. Deletes prior rows for that `field_id`, inserts future-only. `recipient_id` = contract `owner_id`.

**Send:** `GET /api/reminders/send` + `Authorization: Bearer CRON_SECRET`. Vercel cron daily 09:00 UTC (`vercel.json`). Resend HTML: urgency, days-until, optional source block, link `.../contracts/{id}#field-{fieldId}`.

**Note:** Changing owner does not update existing `reminders.recipient_id`.

---

## 9. Permissions & Plan Gating

- **Editors/admins:** writes; **viewers:** read-only UI (`canEdit` false).
- **`requireWriteAccess`:** editor/admin + if `REQUIRE_ACTIVE_SUBSCRIPTION=true`, `orgHasActivePlan` = `stripe_subscription_id` present (not live Stripe status).

---

## 10. Billing (Stripe)

- **Checkout** `POST /api/stripe/checkout` — admin, creates customer, session, optional `STRIPE_TRIAL_PERIOD_DAYS`.
- **Portal** `POST /api/stripe/portal` — admin, needs `stripe_customer_id`.
- **Webhook** — `checkout.session.completed` sets IDs; subscription updated/deleted clears `stripe_subscription_id` when canceled/unpaid; `invoice.payment_failed` logs only.
- **Billing page** — live `subscriptions.retrieve` for display; marketing list; Subscribe / Manage.

---

## 11. Search & Filtering (`/contracts`)

- **Search:** `title`, `counterparty`, `contract_type`, `search_document`, OR contract ids from `extracted_fields` ilike on `field_value` (non-rejected).
- **Status / owner** link filters.
- **Deadline presets:** renewal/end windows; notice deadlines via `renewal_date` + parsed `notice_window`.
- **Sanitize:** strips `%_\\()"',.*` from search term.

---

## 12. Dashboard

Stats (5), Usage (monthly audit aggregates), Missing critical dates section, Upcoming actions (90d, approved date fields), Needs review (5), Recent contracts (5), plan banner, onboarding banner (`onboarding_completed_at`).

---

## 13. Contract Detail

Extracted fields (`#extracted-fields`, row `#field-{id}`), documents + download (signed URL), upload more, status transitions, reminders, owner reassignment, activity (audit, 20).

---

## 14. New Contract / Upload

Form + drag-drop; email tip; recent uploads; plan/role gating; `pending_review`; auto-extract; redirect to detail.

---

## 15. Settings

Profile, org name (admin), members table, invite (admin, `inviteUserByEmail` + metadata), demo seed (`ENABLE_DEMO_SEED`).

---

## 16. Auth

`AuthForm` modes: login, signup, forgot, reset. Callback: invite metadata → upsert member; else `ensureUserOrg`. Signup may email-confirm before session.

---

## 17. Layout

Sidebar (collapsible), header, main, `LegalFooter` disclaimer.

---

## 18. Status Machine

`draft` → `pending_review` → `active` → `expired` | `terminated`; reactivation from expired/terminated to active. Enforced in `updateContractStatus`.

---

## 19. Audit

Actions include `contract.*`, `field.*`, `files.uploaded`, `extraction.completed`, `member.invited`. JSON `details`. Usage stats count selected actions in current month.

---

## 20. Deployment

- `vercel.json` — cron `/api/reminders/send` `0 9 * * *`.
- `next.config.ts` — `serverExternalPackages: ["pdf-parse"]`.

---

## 21. Known Limitations & Technical Debt

1. No OCR — scanned PDFs produce no text.
2. RLS not used at runtime — service role for data.
3. Plan gate = stored `stripe_subscription_id`, not live Stripe in `orgHasActivePlan`.
4. Fixed 11 fields — no custom schema.
5. No bulk contract import — one contract create per flow.
6. No CSV/API export.
7. Extraction — HTTP trigger, no durable queue or row-level job status.
8. LLM input truncated at 30k chars; `search_document` up to 120k.
9. Owner change does not retarget reminders.
10. Demo seed — no files attached.
11. Invites — Supabase email config required; duplicate users may error.
12. Single org in `getAuthContext` (first membership).
13. No pagination on lists.
14. No Supabase Realtime — `router.refresh()` after mutations.
15. No test suite in repo.
16. Search uses `ilike`, not FTS/trigram at scale.
17. No error tracking (Sentry, etc.).

---

## 22. Source file inventory

Roughly **70+** application source files under `src/`:

| Area | Paths |
|------|--------|
| Actions | `src/actions/auth.ts`, `contracts.ts`, `demo.ts`, `settings.ts` |
| App routes | `src/app/page.tsx`, `layout.tsx`, `not-found.tsx`, `globals.css` |
| Dashboard | `src/app/(dashboard)/layout.tsx`, `error.tsx`, `dashboard/page.tsx`, `contracts/**`, `settings/**` |
| Auth pages | `src/app/(auth)/*` |
| API | `src/app/api/extract/route.ts`, `reminders/send/route.ts`, `stripe/*/route.ts` |
| Auth callback | `src/app/auth/callback/route.ts` |
| Components | `src/components/auth/`, `contracts/` (11), `dashboard/` (6), `layout/` (3), `settings/` (6) |
| Lib | `src/lib/types/index.ts`, `supabase/{server,client}.ts`, `contracts.ts`, `email.ts`, `stripe.ts`, `plan.ts`, `permissions.ts`, `contract-filters.ts`, `missing-critical-fields.ts`, `usage-stats.ts`, `extraction/extract-fields.ts`, `extraction/parse-document.ts` |
| Middleware | `src/proxy.ts` |
| Migrations | `supabase/migrations/001_initial_schema.sql`, `002_add_stripe_columns.sql`, `002_prd_enhancements.sql` |

`public/` may be empty (static assets optional). `node_modules/`, `.next/` excluded.

---

*Generated from codebase review. Update this file when the product changes.*
