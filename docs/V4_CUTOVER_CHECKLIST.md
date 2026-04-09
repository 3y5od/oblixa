# Oblixa V4 Cutover Checklist

Use this checklist when you point production at Oblixa on `oblixa.io` (DNS, env, and third-party callbacks).

## 1) Domain and app URL

1. In Vercel project settings, add the production domain `oblixa.io`.
2. Point DNS for `oblixa.io` to Vercel as instructed in the Vercel UI.
3. Set `NEXT_PUBLIC_APP_URL=https://oblixa.io` in production environment variables.

## 2) Supabase redirects

1. Open Supabase Dashboard for this project.
2. Go to Authentication settings.
3. Add `https://oblixa.io/auth/callback` to allowed redirect URLs.
4. Add `https://oblixa.io/reset-password` if password reset flow is used.

## 3) Stripe and webhooks

1. In Stripe Dashboard, set production webhook endpoint to:
   - `https://oblixa.io/api/stripe/webhook`
2. Verify webhook signing secret is present as `STRIPE_WEBHOOK_SECRET`.

## 4) Resend sender domain

1. Verify the `oblixa.io` sending domain in Resend.
2. Set `EMAIL_FROM` to a verified sender such as:
   - `Oblixa <notifications@oblixa.io>`

## 5) Slack OAuth redirect URL

1. In Slack app settings, add this redirect URL:
   - `https://oblixa.io/api/integrations/oauth/callback`

## 6) Integration identifiers (current)

Downstream systems should use Oblixa-only integration metadata:

- **Outbound webhooks** verify and read `x-oblixa-signature`, `x-oblixa-event`, and `x-oblixa-schema-version`.
- **CRM sync** payloads include `source: "oblixa"` (no legacy alias field).
- **Calendar export** uses `UID:…@oblixa.io` for each event (no alternate legacy UID property).

## 7) V4 platform hardening status

Use this section to confirm post-cutover execution-system behavior:

- [x] Exception detection is idempotent with fingerprint-based dedup (`exceptions` unique fingerprint index).
- [x] V4 cron jobs emit durable automation audit events (`audit_events`) and casefile traces where applicable.
- [x] Approval SLA cron evaluates active `approval_slas` and records breach events.
- [x] Programs workspace supports publish + apply workflows from dashboard UI.
- [x] Exceptions page is driven by V4 exception ledger tables (`exceptions`, `exception_events`).
- [x] Contract detail page includes operational casefile timeline (`operational_casefile_events`).
- [x] Maintenance campaigns can be created/run from maintenance workspace UI.
- [x] Reports workspace supports V4 report pack creation and run history visibility.
- [x] Integrations callback supports approval/evidence/exception action acknowledgements.
- [x] Webhook dispatch supports diagnostics by event and replay trigger action.
