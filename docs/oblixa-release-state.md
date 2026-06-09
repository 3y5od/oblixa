# Oblixa Release State

This document is the build contract for Oblixa's intended release state. It is
a technical product specification with plain-language product framing preserved
where that framing clarifies intent. It describes the release product, route
behavior, technical behavior, and acceptance requirements that implementation
must satisfy.

It is not runtime configuration. Product code, tests, scripts, and CI must not
read this document as configuration. Use it as the product and route-level
reference for release positioning, page contents, route visibility,
user-visible behavior, state transitions, permission boundaries, and surface
boundaries.

This document is descriptive where it explains product posture and normative
where it defines release behavior. It may define state machines, route
dispositions, guard order, role behavior, validation boundaries, provider
behavior, evidence requirements, and acceptance criteria. It does not define
non-product operating process.

Intended-state authority:

- This document defines the intended release state and technical behavior. It is
  not a passive as-built changelog, but it should be kept aligned with current
  implemented release behavior when that behavior is accepted as the product
  direction.
- When implementation, copy, route guards, or configuration fall short of this
  document, the gap is release work. The document should not be weakened merely
  to describe current implementation.
- Documentation remains documentation only. Product code, tests, scripts, and CI
  must continue to use code-owned configuration and artifacts rather than this
  file.
- Code-owned route, permission, validation, artifact, and provider configuration
  must be updated to match this document when implementation is intentionally
  moved toward the release state.

## Build Contract Semantics

This document is executable as a build contract when each requirement is
translated into code-owned implementation artifacts, tests, checks, generated
inventories, or named manual verification records. It must not be executed by
parsing this Markdown file at runtime, in tests, or in CI.

Technical precision and plain-language elements:

- Plain-language sections define positioning, user intent, route purpose, and
  acceptance summaries so implementation does not lose the product reason for a
  rule.
- Technical sections may use tables, enumerated states, route classifications,
  permission matrices, state-transition rules, validation contracts, provider
  contracts, evidence matrices, and explicit allowed/denied outcomes.
- If readability and implementation precision conflict, implementation precision
  wins. Keep a plain-language summary nearby when a technical rule would
  otherwise obscure product intent.
- The spec may prescribe technical outcomes when behaviorally material,
  including redirect behavior, status-code class or exact status when relevant,
  cache/download headers, query-parameter schemas, artifact fields, provider
  failure states, rate-limit behavior, idempotency requirements, and required
  test or manual-evidence coverage.
- The spec should avoid naming framework APIs, component names, helper names, or
  exact storage schema unless the naming itself is part of the intended product
  or compatibility contract.

Normative language:

- **Must** means release-blocking unless this document is intentionally changed.
- **Must not** means prohibited behavior; implementation should hide, deny,
  redirect, remove, or recover safely instead of exposing the behavior.
- **Should** means required intended behavior unless an explicitly named
  provider limitation, route state, unsupported configuration, or stronger
  product rule in this document prevents it.
- **May** means allowed behavior only when all route, role, entitlement, provider,
  security, privacy, and copy boundaries in this document are satisfied.
- **Where supported**, **when configured**, and **if implemented** mean the UI
  and API must expose the behavior only when a code-owned capability flag,
  provider state, entitlement, and permission path make the action real.

Build-contract units:

- A route contract defines disposition, direct access behavior, visible contents,
  primary actions, allowed states, role behavior, side effects, recovery states,
  and exclusions.
- A workflow contract defines valid inputs, permissions, state transitions,
  success behavior, recoverable failures, side effects, notifications, activity
  or audit, and sensitive-data redaction.
- An entity contract defines required fields, tenant scope, lifecycle states,
  ownership, relationships, retention, deletion, and export/report behavior.
- A provider contract defines when provider-backed actions appear, what happens
  when provider configuration is absent or unavailable, and which user-visible
  claims are supportable.
- A public-copy contract defines what the product may claim, what it must avoid,
  and which claims require legal, trust, billing, or provider evidence.

Implementation acceptance:

- Every shipped route must have code-owned evidence for route existence, route
  disposition, guard behavior, primary content, primary actions, denied state,
  recoverable failure state, and any provider-backed disabled state.
- Every shipped workflow must have code-owned evidence for success, validation
  rejection, permission denial, tenant isolation, stale-write or idempotency
  behavior when applicable, side effects, activity/audit, and safe recovery.
- Every public or auth route must have code-owned evidence that it does not
  expose internal routes, hidden modules, private workspace data, unsupported
  maturity claims, account enumeration, or raw provider/infrastructure errors.
- Every file, import, extraction, export, report, billing, external-token,
  notification, and destructive-action path must have evidence for both the
  happy path and at least one representative recoverable failure path.
- Manual verification is allowed only for behavior that cannot be fully proven
  repo-locally, such as provider dashboards, production secrets, legal approval,
  billing products, email sender domains, webhook endpoints, production smoke,
  and real-user onboarding. Manual verification must be named, dated,
  environment-scoped, repeatable, and tied to a specific route or workflow.

Implementation gap rule:

- If implementation cannot prove a required behavior, the correct state is an
  implementation gap, disabled route/action, omitted surface, or explicit spec
  revision. The product must not ship a stub, placeholder, unguarded route,
  unsupported public claim, or improvised behavior to fill the gap.

Minimum build evidence matrix:

| Contract area | Required evidence before release |
| --- | --- |
| Public positioning and copy | Static or manual proof that public pages use allowed claims, avoid Known Non-Claims, link only to supported routes, and publish the Core price where required. |
| Public forms | Tests or checks for validation, rate limits, non-enumerating responses, recoverable failures, and no account/workspace/billing creation unless specified. |
| Auth, signup, and grants | Tests for valid, invalid, missing, expired, revoked, used, wrong-email, existing-account, and no-workspace states. |
| Route guards | Generated route inventory or equivalent static/runtime tests proving each route disposition, auth boundary, role boundary, and omitted-route behavior. |
| Roles and permissions | Permission matrix tests or equivalent artifacts proving UI visibility and API enforcement for Owner, Admin, Member, Viewer, and Operator boundaries. |
| Workspace lifecycle and billing | Tests or provider/manual proof for setup, active, suspended, past-due, canceled, deleted, checkout, portal, provider-unavailable, and read-only/export recovery states. |
| Upload, import, and AI extraction | Tests for file limits, CSV validation, tenant scope, provider-disabled states, extraction handoff, review handoff, and sensitive-data redaction. |
| Core workflows | Tests for dashboard, contracts, review, work, renewals, evidence, reports, settings, and contract detail across empty, populated, denied, degraded, and recoverable failure states. |
| External tokens | Tests for scoped access, expiry, revocation, one successful submission, file and non-file modes, redaction, and no workspace browsing. |
| Reports and exports | Tests for filters, freshness/partial disclosure, row limits, tenant scope, CSV safety, download headers, and output retention. |
| Notifications | Tests or artifacts for recipient selection, dedupe, safe deep links, hidden-surface exclusion, delivery failure, and opt-out/preference behavior where surfaced. |
| Legal, trust, and policy pages | Manual/legal/provider proof for every security, privacy, AI-provider, retention, deletion, billing, and support claim. |
| Accessibility and responsive behavior | Automated and/or manual proof for keyboard access, focus, landmarks, form labels, table behavior, modal behavior, responsive fit, and reduced-motion behavior where relevant. |
| Background, API, and provider paths | Tests or checks for auth, tenant scope, validation, bounded runtime, idempotency, concurrency limits, webhook verification, redaction, and safe errors. |
| Hidden and contained surfaces | Tests or manual proof for allowed Dev/Test, Internal operator, or Contained workspace access; ordinary-user denial; non-discovery in Core navigation/search/email/public pages; and safe unavailable states when flags or provider configuration are absent. |

## Release Posture

Oblixa should release as a focused, paid-capable product for small teams
tracking what signed contracts require next after signature. Access is reviewed
as an operational control for sensitive contract data, not as the product's
identity.

Primary positioning:

> Track what signed contracts require next.

Primary subheadline:

> Upload agreements or import your tracker, confirm suggested contract details,
> and turn dates, owners, requirements, evidence, and problems into accountable
> tasks and exportable reports.

Release stance:

- The public hierarchy starts with signed-contract follow-up. Access review is a
  supporting control, not a second product promise.
- Oblixa is usable by approved workspaces.
- Workspace access is reviewed because contract data is sensitive and the first
  workspace should start with a clear owner, data boundary, and paid-continuation
  path.
- Access review should appear where it sets expectations: request access,
  signup recovery, pricing, billing, security, legal, and account states. It
  should not displace the signed-contract follow-up premise in homepage,
  product, navigation, or report/workflow copy.
- "Approved workspace" is an access-state phrase, not a brand phrase. It should
  appear sparingly and only where the route is explaining access, billing,
  security, legal, or account state.
- Signup is account creation after approval or invitation; it is not the main
  public conversion surface.
- The product should not present itself as experimental, a beta, a waitlist, a
  pilot, an early-access experiment, a free trial, or a broad public self-serve
  product.
- The canonical CTA is "Request access."
- Existing route names may remain for compatibility, but visible copy should say
  "request access" or "approved workspaces," not "early access",
  "founder-led," or "limited rollout" as the main message.
- Pricing surfaces publish the Core monthly price plainly while keeping account
  creation and checkout approval-gated. The pricing page says Core is paid,
  month-to-month, and charged only after access approval and explicit checkout.
- The public offer should feel decided. Do not hide price, soften it into
  "starting at," present it as a founding discount, or imply negotiation unless
  the pricing decision is intentionally changed.

Target user:

- Small teams with signed contracts already in use.
- Contract tracking currently happens in spreadsheets, folders, email,
  calendars, shared drives, or memory.
- The acute pains are unclear follow-up ownership, renewal and notice dates,
  contract requirements, contract problems, evidence, tasks, and operational
  reports.
- The first useful workspace can start with a bounded contract set, not a full
  migration.
- The replacement object is the live manual tracker and follow-up process, not
  the legal system of record.

Product boundary:

- Oblixa starts after signature.
- Oblixa tracks signed contracts, confirmed contract details, renewals, notice
  deadlines, owners, contract requirements, approvals, problems, evidence,
  tasks, reports, exports, imports, and accountable follow-up.
- Oblixa does not provide legal advice.
- Oblixa is not a CLM, e-signature tool, drafting tool, redlining tool, formal
  GRC platform, enterprise assurance product, or autonomous decision-maker.

AI boundary:

- AI is a support mechanism, not the headline category.
- Public and app copy should describe "source-backed suggestions" or
  "suggested contract details."
- "Source-backed" means the cited source text is present and locatable. A model
  suggestion with no located support is only a suggested value awaiting review.
- Important suggested contract details are not trusted operational data until
  confirmed or corrected.
- Model confidence is extraction metadata, not a trust state.
- Copy must not imply legal analysis, guaranteed extraction, autonomous
  decisions, risk authority, compliance decisions, or renewal guarantees.

Trust boundary:

- Security and legal pages should make concrete supportable claims.
- Trust copy must answer the practical upload questions: what kinds of customer
  data are processed, where files are stored at a category level, whether
  uploaded files or extracted text may be sent to an AI/provider, who can access
  workspace data, how export and deletion work, what account-security controls
  are available, and how to contact support.
- If a trust, AI, privacy, security, retention, deletion, authentication, or
  provider-training claim cannot be supported by the current provider contracts
  and implementation, omit the claim or phrase it conservatively.
- Boundaries belong in FAQ, legal, and security sections. They should not
  dominate the homepage hero or make the product feel unfinished.
- Formal enterprise procurement, certification, SLA, managed implementation, and
  legal-review promises are outside this release unless independently supported.

## Product Definition

Category:

- Oblixa is a post-signature signed-contract follow-up tracker.
- It is closer to a live operational tracker than a contract repository.
- It is narrower than CLM and broader than a renewal calendar.
- It should be described as tracking what signed contracts require next, not
  contract lifecycle management, legal AI, compliance automation, or enterprise
  governance.

Release maturity:

- The release should read as focused and usable, not tentative.
- Controlled access exists because workspace data and setup deserve review. It
  should not read as scarcity, beta status, founder involvement, or uncertainty.
- The product can be paid without implying broad self-serve account creation or
  public checkout.
- Public copy should not apologize for the product's narrowness; the narrowness
  is the positioning.

Intended audience:

- Small teams with real signed contracts and no reliable contract-operations
  system.
- Teams where ownership, dates, contract requirements, evidence, tasks, and
  reporting are handled manually.
- Primary operator: the person accountable for keeping signed-contract follow-up
  from slipping, usually an operations, finance, legal-adjacent, administrative,
  or team-lead owner.
- Primary buyer: the same operational owner or the small-team executive/finance
  owner who feels the cost of missed renewals, unclear ownership, and repeated
  manual reporting.
- Public and Core copy should speak first to the operational owner maintaining
  the tracker, not to enterprise legal leadership, procurement, or a generic
  "contract team."
- When multiple personas are present, prioritize the person accountable for
  follow-up, owner coverage, deadline confidence, evidence collection, and
  reporting.
- Secondary users: teammates who own specific contracts, confirm suggested
  contract details, complete tasks, provide evidence, or use reports.
- Teams that can start with a bounded set of signed agreements.

Non-audience:

- Teams primarily looking for drafting, negotiation, redlining, e-signature, or
  clause playbooks.
- Teams needing legal advice or legal review.
- Teams requiring formal procurement, security certification, implementation
  services, or SLAs before any limited workspace use.
- Enterprise legal-operations teams evaluating a full CLM replacement.
- Teams looking for autonomous decisions, risk scoring, compliance findings, or
  assurance programs.

Primary job-to-be-done:

> Know what each signed contract requires next when a spreadsheet, folder,
> inbox, or calendar is no longer enough.

Secondary jobs:

- Know which contracts exist and who owns them.
- See which contract details are confirmed, missing, or still suggested.
- Track renewal, notice, termination, effective, and end dates.
- Convert requirements, approvals, problems, and follow-up into accountable
  tasks.
- Request and collect evidence.
- Export reports without rebuilding a spreadsheet.

Product promise:

- Oblixa makes the next requirements in signed contracts visible, accountable,
  and exportable.
- Oblixa helps users operate on reviewed source-backed data.
- Oblixa makes next actions easier to find across contracts, dates, work,
  evidence, and reports.
- Oblixa replaces the operational follow-up tracker: the spreadsheet, calendar,
  folder, inbox, status thread, and memory loop used to keep signed contracts
  from slipping.
- The buyer-side outcomes are fewer missed renewal or notice follow-ups, clearer
  contract ownership, less tracker drift, easier evidence collection, and fewer
  manually rebuilt reports.

Product non-promise:

- Oblixa does not guarantee that every renewal, notice, or contract requirement
  will be found or acted on.
- Oblixa does not guarantee extraction accuracy.
- Oblixa does not interpret legal meaning or recommend legal action.
- Oblixa does not replace counsel, procurement, finance approval, or business
  judgment.
- Oblixa does not promise managed migration, custom implementation, or customer
  success coverage.

Positioning hierarchy:

1. Signed contracts have next requirements.
2. Confirmed contract details turn those requirements into accountable tasks.
3. Dates, owners, contract requirements, tasks, evidence, problems, and reports
   are the Core surfaces.
4. Spreadsheet, folder, inbox, calendar, and memory replacement is the migration
   pain.
5. AI is source-backed assistance, not the category.

AI should never move above the first three items in public or app hierarchy.

## Release State Description

The release is defined by what an approved workspace can do, not by how a
workspace receives access.

An approved workspace should be able to:

- Add signed agreements by upload or import.
- Confirm or correct suggested contract details.
- Maintain a contract inventory.
- Assign owners.
- Track critical dates.
- See open, past-due, cannot-proceed, and unassigned tasks.
- Track contract requirements, approvals, problems, and evidence requests.
- Use external token links for bounded evidence/follow-up collection.
- Use external token links for both file evidence upload and non-file
  response/reference submission when the workflow asks a non-workspace
  participant to act.
- Run or export operational reports.
- Manage team access, billing/access state, account security, and workspace
  settings.

The release should not require:

- A full migration before value is visible.
- Customer training material to complete basic workflows.
- A call before a user can understand the product.
- Advanced or Assurance modes.
- Product-mode selection.
- Legal, procurement, or security questionnaire completion as the normal path.

Activation state:

- A workspace is activated when at least one contract has been uploaded or
  imported, at least one suggested contract detail has been confirmed or
  corrected, and the workspace shows meaningful dashboard, task, renewal,
  evidence, or report state.
- Activation is a product-state concept, not an external status milestone.
- Activation evidence must record the first accepted upload or import, first
  confirmed or corrected contract detail, first owner assignment or confirmed
  owner, first visible renewal/notice/date or intentional missing-date state,
  first task or evidence item created/resolved when available, and first report
  preview or export. If a workspace cannot reach one of these events because the
  data does not support it, the activation evidence records the omission and
  recovery path.

First-use proof path:

- The intended first useful workspace starts with 20-50 signed contracts or a
  similarly bounded tracker import, not with a full-company migration.
- The user uploads or imports the bounded set, confirms the first important
  suggested contract details, confirms or assigns owners, sees upcoming renewals
  or notice dates, creates or resolves at least one task/evidence item, and
  previews or exports a report.
- The user should be able to understand value from that path without an
  onboarding call, custom implementation, spreadsheet cleanup by Oblixa, or
  legal review.
- Public and app proof should favor this concrete path over abstract module
  descriptions.
- Home, product, signup recovery, dashboard empty states, upload/import empty
  states, and onboarding should reinforce this bounded first-use path. They
  should not imply that the user must migrate every contract, complete every
  review, configure every report, or adopt every module before value is visible.
- Product proof should show suggested contract details becoming owners, dates,
  tasks, evidence, and reports. Screenshots or mock views that show disconnected
  module breadth are weaker than a visible end-to-end first path.

Release proof:

- The release should prove itself with the product surfaces: Dashboard, Review
  queue, Contracts, Tasks, Renewals, Evidence, Reports, Settings, and contextual
  upload/import/detail routes.
- Public pages should use product proof and precise boundaries.
- Documentation, private operating knowledge, or non-product context are not
  release proof.

## Operational Decisions

This section resolves judgement calls for the intended release. It controls
operational defaults wherever the rest of this document uses softer language
such as "where supported," "when configured," or "if implemented." Code-owned
configuration may store the actual constants, but implementation must encode
these decisions unless the product decision is explicitly changed here.

### Access Review And Grants

- Public acquisition is `/request-access`. Public navigation, public CTAs, and
  auth recovery point there rather than to `/signup`.
- Internal access review is `/operator/access-requests`. It is an operator-only
  route for reviewing public requests, issuing grants, revoking grants, and
  auditing access decisions. It is not a customer settings route and never
  appears in public pages, customer navigation, sitemap, email CTAs, search,
  command palette, onboarding, dashboard cards, or report catalogs.
- `/signup` is not a public conversion surface. It is used only to complete a
  signed access grant or workspace invite, or to recover safely when a user opens
  the route directly.
- Manual access-code entry is not part of the release user experience. If an
  access-code path remains for compatibility, it is hidden from normal public
  copy, treated as temporary recovery behavior, and never described as the
  intended access model.
- A shared environment access code, public signup flag, or reusable manual code
  is not a release access grant. It may remain only as local/test or temporary
  compatibility behavior, must not appear in public copy, and must not create a
  customer workspace unless it is backed by the grant states and audit behavior
  in this section.
- In production customer context, signup must validate a durable grant or invite
  record before user or workspace creation. An environment flag, shared code,
  local/test bypass, or manual support note can never be the only authorization
  source for creating a customer account or workspace.
- Local/test signup bypasses must be named as test fixtures, scoped to
  non-customer workspaces, auditable in test evidence when used, and excluded
  from production public copy, screenshots, and route acceptance.
- An access request creates only an access-request record with status `pending`.
  It does not create a user, workspace, billing customer, subscription, trial,
  invite, entitlement, or access grant.
- Contact messages and access requests are distinct record types. A general
  contact message may notify support, but a request-access submission with
  access intent must create or update an access-request record before it is
  considered received for release purposes.
- Duplicate access requests from the same email update the existing request's
  latest fit context and return the same neutral received state.
- Public users cannot query access-request status by email.
- Access-request statuses are `pending`, `approved`, `rejected`, and `closed`.
  Only `approved` can create a grant.
- Access-request submission must persist a durable access-request record before
  any email notification is treated as successful. Email-only logging, inbox-only
  review, or untracked form submission does not satisfy the release contract.
- Access-request records must include normalized email, requester name, company
  when supplied, request type or fit context, source route, status, duplicate
  history, timestamps, reviewer, decision reason, safe contact notes, and grant
  relationship when a grant exists.
- The public access-request API returns only a neutral received or recoverable
  validation state. It must not reveal whether the email already has an account,
  request, grant, invite, workspace, billing customer, or subscription.
- Operator/admin access-request APIs must expose list, detail, approve, reject,
  close, reopen when supported, create grant, resend grant, revoke grant, and
  safe contact-note actions with permission checks and audit.
- Access-review APIs and `/operator/access-requests` must share the same state
  machine. UI-only approval, email-only approval, spreadsheet-only approval, or
  provider-dashboard-only approval does not satisfy the release contract.
- A request is qualified when the requester has real signed contracts, a manual
  or unreliable follow-up system, a clear owner for the first workspace, a
  bounded starting set, and a plausible need for renewals, notice dates, owners,
  contract requirements, evidence, tasks, or reports.
- Strong positive fit means the team has roughly 20-500 signed contracts, one
  accountable workspace owner, a current tracker in a spreadsheet, folder,
  inbox, calendar, shared drive, or memory, a bounded first set to upload or
  import, willingness to use async support, willingness to pay the Core price,
  and no formal procurement dependency before first workspace use.
- A request is not qualified for the intended release when the team primarily
  needs drafting, negotiation, legal review, e-signature, enterprise procurement,
  formal security certification, managed migration, custom implementation,
  autonomous decisioning, GRC, Assurance, or a broad CLM replacement.
- Access review should reject or pause requests with no signed contracts, a
  primarily pre-signature workflow, unclear data ownership, prohibited-use risk,
  unsupported file/data expectations, unsupported volume, required onboarding
  calls or managed migration, required security questionnaire completion before
  upload, inability to identify a workspace owner, or no apparent
  paid-continuation fit.
- Rejected and closed requests do not send an automatic rejection message by
  default. The public form remains neutral and contact can happen manually.
- Internal approval tooling must show request status, requester identity, fit
  context, duplicate-request history, reviewer, timestamps, decision reason,
  grant state, resend/revoke controls, and safe contact notes without exposing
  secrets, raw uploaded contract content, or unrelated workspace data.
- Approval, rejection, closure, grant creation, grant resend, grant revocation,
  and invite creation must be operator/admin actions with actor attribution and
  audit/activity history.
- Approval creates exactly one workspace-creation grant unless the requester is
  being invited into an existing workspace.
- Workspace-creation grants and workspace-invite grants are email-bound,
  single-use, revocable, and expire after 14 days.
- Workspace-creation grants and workspace-invite grants are distinct grant
  types. Compatibility parameters named access code, invite, token, or similar
  must be normalized into one of those grant types before account or workspace
  creation proceeds.
- Manual access-code compatibility is local/test or temporary recovery behavior
  only unless it resolves to a durable, email-bound, expiring, revocable,
  single-use grant record with audit.
- If a compatibility parameter is accepted by `/signup`, the page must render
  the normalized grant state: workspace creation, workspace invite, missing,
  invalid, expired, revoked, already used, wrong email, or existing account. It
  must not treat every token-like parameter as a generic access code.
- Grant tokens are stored as hashes or otherwise non-recoverable token
  references. Raw grant tokens, signed links, or invite secrets must not appear
  in logs, telemetry, generated artifacts, access-request records, audit
  summaries, support notes, or admin tables.
- Resending a grant or invite creates a new valid token and invalidates the prior
  unused token for the same email and workspace context.
- Grant email sends only after approval or invite creation. It includes the
  account-creation or invite link, expiration window, support/contact path, and
  no raw token value beyond the signed link.
- A consumed grant cannot be reused. The recovery path is sign-in or contact.
- Wrong-email grant use never reveals the intended workspace beyond generic
  recovery copy.
- Reviewer mistakes recover by revoking unused grants, closing/reopening access
  requests, creating a replacement grant, or manually contacting the requester.
  A consumed grant cannot be silently transferred to another email.
- The first approved workspace user becomes Owner.
- Additional invited users receive the role selected by the inviter, bounded by
  seat and permission rules.

### Billing, Pricing, And Cancellation

- The release has one public Core paid offer: **$249/month per workspace**,
  month-to-month.
- `$249/month per workspace` is the intended release price and should be treated
  as a product-positioning decision. It is not evidence of validated
  market-clearing pricing; if pricing changes, this document and the code-owned
  billing/copy artifacts must change together.
- The public price is a concrete release offer, not a placeholder. Do not present
  it as "starting at," "introductory," "founding," "contact us for price," or
  public negotiation language.
- If customer response shows the price is mismatched, change the price
  intentionally and update this document, public copy, checkout, invoices, and
  billing tests together. Do not hide the price to avoid deciding.
- The public Core offer includes up to 500 active contracts and 10 active
  workspace users. Larger contract sets or teams can be reviewed before approval
  and granted through code-owned entitlements; they should not create public
  tiers in this release.
- Pricing is shown on `/pricing` and repeated during approval or checkout before
  the user is charged.
- There is no public free trial claim.
- There is no automatic charge on access request, account creation, upload,
  import, or workspace activation.
- Runtime billing states named free, trial, trialing, evaluation, comped, test,
  sandbox, or exempt must map to one of the access states in this document before
  customer-visible access decisions are made. They must not create a public
  trial, free plan, or unapproved customer workspace by label alone.
- Trial configuration must default to absent for the public Core offer. If a
  billing provider returns `trialing`, the UI must present it as provider-derived
  approved access or billing recovery, not as an advertised free trial. Trial
  countdowns, trial caps, trial CTAs, trial-ended banners, and trial-period
  checkout parameters are release-compliant only when translated into approved
  activation or recovery language and covered by billing/access evidence.
- Checkout must not add a trial period from environment configuration unless
  the resulting state is explicitly classified as approved unpaid activation,
  provider recovery, or test/operator exemption. It must not create a public
  free-trial offer by configuration accident.
- Code-owned billing catalogs may retain provider price ids, sandbox products,
  internal entitlement ids, or historical plan labels only as implementation
  mappings. Customer-visible pages, badges, emails, checkout copy, invoice
  context, and route guards must resolve them to the public Core offer,
  approved unpaid activation, past-due recovery, canceled retention,
  test/operator exemption, or an explicit contained-surface billing state.
- A billing state named free, trial, comped, evaluation, advanced, assurance, or
  enterprise is not a release product tier unless this document is revised to
  define its public offer, limits, access rules, support boundary, cancellation,
  refund behavior, and evidence requirements.
- Approved-but-unpaid workspaces may be created only when explicitly allowed by
  access/billing state. They remain upload/review capable only for the approved
  activation window or until checkout is required by code-owned billing state;
  public copy must not describe this as a free trial.
- If a billing implementation supports upload, import, CSV export, invites, or
  read-only access before payment, those capabilities are activation or recovery
  allowances, not a free plan. Public copy, badges, emails, and billing state
  labels must use approved-access or recovery language rather than trial
  positioning.
- Test, operator, seed, or sandbox workspaces are billing-exempt only when a
  code-owned non-customer billing state marks them as such. Billing exemptions
  must not apply to customer workspaces by default.
- Billing is month-to-month by default.
- Checkout is shown only after workspace access is approved and only to Owner or
  Admin users when provider-backed checkout is configured.
- Failed checkout returns to billing/access state with recoverable provider-safe
  copy, no duplicate subscription, and no hidden workspace mutation.
- The customer portal, invoices, cancellation, and payment-method actions are
  admin-only and provider-backed. If the provider is unavailable, those actions
  are hidden or disabled with contact recovery.
- Tax, invoice numbering, receipt delivery, payment-method collection, and
  dunning email behavior are provider-backed. The app must not claim tax,
  invoice, or receipt behavior that the billing provider/configuration does not
  support.
- Cancellation takes effect at the end of the current paid period unless the
  provider explicitly returns an earlier effective cancellation date.
- After cancellation, ordinary mutations stop at the effective date. Read-only
  access and export/contact recovery remain available for 30 days.
- Refunds are not promised in public copy or app UI. By default, there are no
  prorated refunds. Manual refunds are limited to duplicate charges, mistaken
  charges, or billing-provider errors.
- Past-due workspaces keep read-only access and export/contact recovery. New
  uploads, imports, review approvals, new evidence requests, new work creation,
  and new report sends are blocked until billing recovers.
- Billing emails are sent only for provider-backed billing events, access status
  changes that affect product use, and admin recovery. They do not market hidden
  products or imply public self-serve availability.
- Contained-surface billing treatment must be explicit before customer-facing
  access. The default is no separate public tier and no hidden upsell; any
  charge, no-charge evaluation, or entitlement-specific price must be recorded in
  billing/access state and support notes.

### Support And Activation Boundary

- Default support is async email or in-app/contact-form follow-up. Calls are not
  part of the default release experience.
- Activation support helps users understand upload/import, review, owners,
  work, evidence, reports, billing/access state, and safe recovery.
- Activation support does not include managed migration, spreadsheet cleanup,
  bulk data-entry services, legal review, procurement support, security
  questionnaire completion, custom implementation, custom reports, or dedicated
  customer-success management.
- Activation-blocking product issues should receive priority response because
  the release relies on a small first workspace proving value quickly.
- Optional escalation may be offered for blocked activation, billing recovery,
  access/grant recovery, upload/import failure, extraction failure,
  evidence-token failure, or suspected security/privacy issue. Escalation is
  support recovery, not default onboarding, managed migration, legal review, or a
  promised call.
- Activation-blocking email or in-app support should target same-business-day or
  next-business-day acknowledgement when practical, but public copy must not
  promise a fixed response time unless that support process is actually
  committed and supportable.
- Ordinary support copy should not imply SLA-backed response times unless an SLA
  is actually supported.

### Roles And Workspace Administration

- The release roles are Owner, Admin, Member, Viewer, and Operator.
- Code-owned legacy or provider roles must map into these canonical roles before
  route, navigation, mutation, export, billing, invite, and settings decisions
  are made. If no safe mapping exists, the user is denied or placed in the
  least-privilege recoverable state.
- Current implementation role aliases should map as follows unless code-owned
  policy intentionally changes the mapping: provider/account owner or explicit
  workspace-owner relation maps to Owner; admin maps to Admin unless an owner
  relation upgrades it for owner-only actions; editor, manager, ops_manager,
  legal_reviewer, finance_reviewer, and member map to Member with capability
  subsets; read-only/viewer maps to Viewer; service/operator/support identities
  map to Operator only through explicit internal authorization.
- Capability subsets may allow a Member alias to handle contracts, renewals,
  approvals, or maintenance work inside Core, but they must not make that alias
  an Admin for billing, team, workspace identity, security settings, ownership,
  destructive actions, hidden-surface access, or operator diagnostics.
- Unknown, deprecated, provider-specific, or migration-only roles must deny
  privileged actions and render the least revealing safe state until a code-owned
  alias mapping is added.
- Owner is required. A workspace must always have at least one active Owner.
- Only Owner can transfer ownership, delete the workspace, request full
  workspace data deletion, approve irreversible workspace export/deletion
  operations, and remove or downgrade another Owner.
- Admin can manage team members, roles, invites, workspace identity, security
  settings, billing recovery, uploads, imports, reviews, tasks, evidence,
  reports, and exports, except owner-only controls.
- Member can upload/import contracts, confirm suggested details, edit
  operational contract data, manage tasks/evidence, and view Core workspace
  data.
- Member cannot export reports or contract inventory by default. Member export
  becomes allowed only if a workspace Owner enables a specific export permission.
- Viewer is read-only. Viewer cannot upload, import, review, edit, request
  evidence, create tasks, manage billing, manage team access, or export by
  default.
- Viewer export becomes allowed only by explicit Owner-enabled workspace policy
  for a named export/report class.
- Operator is not a customer role. Operator access requires explicit internal
  authorization, is excluded from normal workspace role controls, and never
  appears in customer-facing role pickers.
- Removing a user immediately ends access, but preserves their historical
  activity, uploads, reviews, assignments, evidence submissions, audit
  references, and notes/comments if those records exist.

### Account Security And Step-Up

- Account email change, password change, MFA setup, MFA removal, ownership
  transfer, Owner removal or downgrade, workspace deletion, full workspace
  export, full workspace data deletion, billing cancellation, and payment-method
  changes require a fresh authentication step or provider-equivalent step-up.
- MFA controls appear only when backed by the authentication provider. If MFA is
  not provider-backed, no MFA setup/removal UI appears and public/security copy
  does not claim MFA.
- Session list and session revocation controls appear only when backed by the
  authentication provider. If provider-backed session controls are unavailable,
  `/settings/security` shows current account/security status and recovery
  contact, not placeholder controls.
- Step-up failure leaves the user on the same route with safe recovery copy and
  does not reveal raw provider errors.

### Data Retention And Deletion

- Active workspace data is retained while the workspace is active unless a user
  deletes, archives, or exports/deletes it through a supported flow.
- Contract archive is the default cleanup action. Hard delete is exceptional and
  requires Admin or Owner permission, typed confirmation, and a retained minimal
  audit tombstone.
- Uploaded contract files are retained until the file, contract, or workspace is
  deleted, subject to the deletion windows below.
- Evidence files are retained with their evidence request until the evidence,
  contract, or workspace is deleted, subject to the deletion windows below.
- Import source CSV files are retained for 30 days after job completion or
  failure. Accepted contract records and safe row-level diagnostics persist with
  the workspace.
- Report/export output files are retained for 7 days after generation, then the
  download link expires and the output is deleted or made unavailable.
- Contract file downloads and evidence file downloads require an authenticated,
  role-scoped request. They are never exposed as public durable URLs.
- External tokens expire 14 days after creation by default, or at the earlier
  explicit due date if the owning workflow sets one.
- Expired, revoked, and consumed external-token metadata is retained for 90 days
  for audit and troubleshooting, with token secrets redacted.
- Access-request records that do not become approved workspaces are retained for
  180 days after last update, then deleted or minimized.
- Approved access-request records that become workspaces are retained as part of
  workspace account history while the workspace remains active.
- Contact/support messages are retained for 180 days unless linked to an active
  workspace support issue.
- Workspace deletion immediately blocks ordinary workspace access. A 30-day
  export/contact recovery window remains for Owner/admin recovery unless the
  request is for immediate deletion.
- Tenant-scoped workspace data is deleted or made inaccessible within 30 days
  after the deletion window closes.
- Security/audit summaries needed to prove deletion, prevent abuse, or preserve
  billing/security history are retained for 1 year in minimized form.
- Billing-provider records are provider/legal records and are not deleted by
  ordinary workspace deletion inside Oblixa.
- Raw secrets, tokens, signed URLs, raw provider payloads, raw model responses,
  and full document text are not retained in logs or telemetry.

### Upload, Import, Export, And Rate Limits

These are intended release defaults:

| Limit | Default |
| --- | --- |
| Contract upload file types | PDF, DOCX |
| Evidence upload file types | PDF, DOCX, CSV, PNG, JPG |
| Import file type | UTF-8 CSV |
| Contract file size | 25 MB per file |
| Evidence file size | 25 MB per file |
| Import CSV size | 10 MB |
| Upload batch size | 50 files |
| Import row count | 5,000 rows |
| Import column count | 50 columns |
| Import cell length | 10,000 characters |
| File name length | 160 characters |
| Contract workspace soft limit | 2,000 contracts |
| Report preview | 100 rows |
| Export row count | 10,000 rows |
| Search query length | 120 characters |
| Contact/access notes | 2,000 characters |
| External non-file response | 2,000 characters |
| External token submissions | 1 successful submission |
| Report output retention | 7 days |

- User-visible upload/import/export UI must disclose the relevant limit before
  the user commits the action or in the recoverable error state.
- The 500-contract public Core inclusion is a billing/access limit. The
  2,000-contract workspace soft limit is a technical and operational ceiling for
  reviewed workspaces with entitlement approval.
- Limits can be made stricter by code-owned configuration for safety, but not
  broader without updating this section.
- Public forms are rate-limited by IP and email. Intended defaults are 5 access
  or contact submissions per IP per hour, 3 access requests per email per day,
  10 login attempts per IP per 10 minutes, and 5 password-recovery attempts per
  email per hour.
- Rate-limit responses are recoverable and do not reveal account, workspace,
  invite, token, or request existence.

### AI And Document Processing

- OpenAI API is the intended AI provider for release extraction unless the
  provider is explicitly changed in code-owned configuration and this document.
- When extraction is enabled, uploaded contract files or extracted text are
  permitted to be sent to the AI provider for extraction, classification,
  source-snippet location, and field suggestion.
- Public/privacy copy must say that uploaded files or extracted text may be sent
  to an AI provider for extraction.
- Public/privacy/security copy must not claim that customer files, extracted
  text, prompts, or model outputs are excluded from provider training,
  retention, review, or reuse unless provider configuration, terms, or a named
  manual verification record proves that claim for the release environment.
- Oblixa does not claim that AI output is complete, legally correct, or
  operationally trusted before review.
- Model output is never directly trusted as policy, SQL, HTML, executable code,
  legal advice, or final operational truth.
- The app stores structured extracted suggestions, confidence metadata, review
  state, and source citations/snippets needed for user review.
- The app does not persist raw model responses or full prompts unless a
  code-owned, redacted debug mode is explicitly enabled for operator-only
  troubleshooting.
- Logs, telemetry, generated artifacts, and routine diagnostics must not include
  raw document text, raw prompts, raw model responses, source files, signed URLs,
  or provider payloads.
- Re-extraction is triggered by new file upload, explicit retry, failed
  extraction recovery, changed extraction configuration, or operator-approved
  reprocessing. It does not silently overwrite confirmed details.
- Re-extraction can create new suggested values and mark existing confirmed
  values stale only when the source basis changed. Confirmed values remain
  visible with prior actor, timestamp, and source context.
- Confidence is displayed only as extraction metadata. It never replaces source
  citation or human review.
- Extraction-quality claims require a code-owned or manual evaluation record
  using representative signed-contract samples, expected field coverage,
  citation/source-snippet checks, error categories, reviewer correction notes,
  and the date and environment of evaluation. Without that evidence, the product
  may claim only that it produces reviewable suggestions, not that extraction is
  accurate, complete, or production-reliable at a quantified level.

### Dates, Deadlines, And Timezone

- Dates are stored as date-only values for contract dates unless a workflow
  explicitly needs a timestamp.
- Workspace timezone controls relative labels, reminder timing, and due/overdue
  boundaries.
- Workspace timezone is set during workspace creation from the user's browser
  timezone when available; otherwise it defaults to UTC. Admins can change
  workspace timezone from Settings.
- A due date becomes overdue after the end of that date in the workspace
  timezone.
- Accepted typed date formats are `YYYY-MM-DD`, `MM/DD/YYYY`, and month-name
  dates with a four-digit year such as `June 4, 2026`.
- Two-digit years are rejected.
- Ambiguous slash dates are interpreted as US `MM/DD/YYYY` only when month and
  day are valid under that interpretation; otherwise they are rejected.
- Imported dates are unverified until reviewed or explicitly marked unknown.
- Renewal windows default to 90 days.
- Notice windows default to 90 days.
- Due-soon tasks default to 7 days.
- Missing dates create data-gap/review tasks instead of silently disappearing
  from dashboards and reports.
- Calculated dates must disclose the source basis. Confirmed dates take
  precedence over calculated or suggested dates.

### Notifications And Reminders

- In-app notifications are enabled by default for operational events listed in
  the Notification Matrix.
- Email notifications are enabled by default for invites, evidence requested,
  task assigned, extraction ready or failed for the uploading user, upcoming
  renewal/notice reminders for the assigned owner, and billing recovery for
  admins.
- Weekly digest is off by default unless the user opts in.
- If digest is enabled, it sends Monday at 9:00 AM in the workspace timezone.
- Renewal reminders send at 90, 30, and 7 days before the renewal date.
- Notice-deadline reminders send at 60, 30, 14, and 7 days before the notice
  deadline.
- Task overdue reminders send once per day for the assignee until the item is
  completed, canceled, or unassigned.
- Evidence due-soon reminders send 3 days before due date; evidence overdue
  reminders send once per day to the requester and recipient until closed.
- Notification retry attempts are capped at 3 attempts per notification.
- Notification links must re-run auth, workspace, role, route-disposition, and
  token checks.
- Notification links must target canonical shipped, contextual, auth, or scoped
  external-token routes. A notification must not link to a route that does not
  exist in the route manifest, a Merge route when the canonical route can be
  used, an Omit route, an unauthorized Internal route, an ordinary-user
  Contained route, or a hidden Advanced/Assurance surface.
- If a canonical route is not implemented yet, notification sending for that
  route family must be disabled, redirected through an explicitly allowed Merge
  route, or marked as a release blocker. Broken or hidden-route deep links are
  not acceptable recovery behavior.
- Users can opt out of digest and non-critical reminders. Invite, password,
  billing recovery, security, and external-token transactional emails are not
  ordinary marketing preferences.

### Report Catalog And Freshness

- The release report catalog is:
  - Upcoming renewals.
  - Notice deadlines.
  - Overdue tasks.
  - Problems by owner.
  - Open requirements.
  - Evidence requests.
  - Missing owners.
  - Missing key details.
  - Contract inventory.
  - Review completeness.
- Upcoming renewals uses active or retained contracts with a renewal date inside
  the selected renewal window. Default window is 90 days.
- Notice deadlines uses contracts with a notice deadline inside the selected
  notice window, including calculated dates clearly labeled as Calculated.
- Overdue tasks use open or in-progress tasks whose due date is before today in
  the workspace timezone.
- Problems by owner groups open problems by operational owner.
- Open requirements includes active requirement tasks not completed, canceled, or
  archived.
- Evidence requests includes requested, overdue, received, reviewed, accepted,
  rejected, and closed evidence, with filters for open/default views.
- Missing owners includes contracts with no operational owner.
- Missing key details includes contracts missing configured Core details from
  the Core Detail Catalog.
- Contract inventory includes contract identity, counterparty, status, owner,
  confirmed dates, task/evidence signals, and update state.
- Review completeness includes reviewed, suggested, missing, unknown, skipped,
  and stale detail counts per contract.
- Report previews show 100 rows by default.
- Report exports allow up to 10,000 rows by default.
- A report is fresh when its read model or query source is less than 24 hours old
  or is computed directly from current source data.
- A report is partial when its source jobs are still processing, failed, stale,
  provider-unavailable, or missing permission-scoped data.
- Preview and export must disclose stale, partial, suggested, calculated,
  missing, and unverified data.

### Verification And Acceptance

- Every shipped route needs code-owned verification artifacts covering its route
  disposition, direct access behavior, authorization boundary, primary content,
  primary action, denied state, recoverable failure state, and provider-disabled
  state when relevant.
- Every Core workflow needs success-path, validation-failure,
  permission-failure, tenant-scope, recoverable-provider-failure, and
  sensitive-redaction evidence where those states can occur.
- Public pages require copy-boundary, route, no-private-link, and metadata
  verification.
- Auth/access routes require grant, invite, wrong-email, expired, revoked,
  already-used, missing, login, password recovery, and callback verification.
- Upload/import/extraction requires file validation, failure recovery,
  tenant-scope, review handoff, and no-sensitive-leakage verification.
- Billing requires provider-config, checkout/portal disabled-state, webhook,
  cancellation, past-due, provider-unavailable, and admin-only verification.
- Reports/exports require filter parity, row-limit, CSV-injection, tenant-scope,
  freshness, and download-retention verification.
- External-token workflows require expiry, revocation, one-submission,
  wrong-token, tenant-scope, redaction, and file/non-file mode verification.
- Manual verification is acceptable only for production secrets, provider
  dashboard settings, legal approval, pricing approval, and production smoke.
- Manual verification must record date, environment, verifier, route/workflow,
  expected result, actual result, and any remaining release blocker.
- A route is not release-accepted merely because it renders. It must satisfy its
  route disposition, access behavior, role behavior, primary actions, state
  handling, side effects, and recovery behavior.
- A workflow is not release-accepted merely because one manual happy-path demo
  succeeds. It must satisfy the state machine, validation, permission, tenant,
  recovery, and side-effect rules that apply to that workflow.
- If a route, workflow, object, or provider path lacks evidence, implementation
  must treat that absence as a release blocker, an intentionally disabled
  capability, or a spec change. It must not treat missing evidence as permission
  to ship unstated behavior.

## Release Behavior Model

This section defines intended cross-route product behavior. It describes what a
user should experience and what boundaries must hold. It is a build contract for
behavior and may define entity states, permission boundaries, provider behavior,
route outcomes, and verification requirements at the level needed to drive
implementation. It is not the runtime database schema, provider contract, or
test script. Implementation must encode it in code-owned artifacts, helpers,
tests, checks, and manual verification records where required.

### Access And Signup

- Public visitors request access through `/request-access`; that request does
  not create a user account, workspace, billing customer, subscription, or trial.
- Public positioning treats Oblixa as a focused tracker for what signed
  contracts require next. Access review is a supporting control for sensitive
  data and bounded setup; it should not become the product promise or sell
  scarcity, exclusivity, founder involvement, private-beta status, or a signup
  gate.
- Signup is a post-approval account-creation and invite-acceptance mechanism,
  not the public acquisition path.
- Public navigation and CTAs should prefer `/request-access`. `/signup` should
  appear only as an invite/grant completion path, an auth recovery path, or a
  direct URL with safe request-access guidance.
- Approval creates an access grant.
- Access grants have two release forms:
  - workspace-creation grant for the first approved user of a new workspace;
  - workspace-invite grant for joining an existing workspace.
- `/signup` validates an access grant or invite context before accepting
  password creation.
- Invalid, expired, revoked, already-used, missing, or wrong-email grants show a
  safe recovery state and do not create a user account or workspace.
- A new approved user can create an account and then either create the approved
  workspace or join the invited workspace.
- An existing user who follows a valid invite authenticates first, then joins the
  invited workspace.
- Authenticated users with an active workspace leave auth pages for the intended
  app route, setup route, or dashboard.
- A user with an account but no usable workspace sees a workspace-required state
  with request-access, contact, or sign-out recovery.
- Email verification is shown when required before sensitive workspace actions.
- Password reset and recovery flows avoid account-enumeration leakage.
- Signup copy must not imply public self-serve workspace creation, early product
  uncertainty, or founder-led access.

### Workspace Lifecycle

- A workspace can be setup incomplete, active, access suspended, billing past
  due, canceled, or deleted.
- Setup incomplete workspaces guide authorized users to onboarding, upload, or
  import; they do not expose product-mode selection.
- Active workspaces can use the Core product surfaces according to role.
- Access suspended workspaces retain safe account and contact recovery, and may
  retain read-only Core visibility when that helps the user recover.
- Billing past-due workspaces show clear admin billing recovery; mutation
  restrictions are acceptable, but export/contact paths remain visible.
- Canceled workspaces stop paid continuation and preserve export/contact paths
  for a clearly disclosed period.
- Deleted workspaces are not accessible to ordinary users except for safe account
  or support recovery.
- Multiple-workspace switching is not a release promise unless the UI provides a
  clear workspace switcher and route guard behavior.

### Roles And Permissions

Release roles:

- **Owner**: controls the workspace, team, billing, export/deletion requests, and
  ownership transfer.
- **Admin**: manages workspace settings, team access, upload/import, review,
  tasks, evidence, reports, and configured billing actions except owner-only
  controls.
- **Member**: performs operational contract tasks: upload/import, confirm
  suggested details, manage assigned tasks/evidence, and view Core data.
- **Viewer**: reads permitted workspace data and cannot mutate Core records
  unless a specific workflow explicitly grants a narrow action.
- **Operator**: internal support or maintenance role outside the workspace role
  hierarchy. Operator access must not appear as a customer-facing role.

Permission defaults:

| Behavior | Owner | Admin | Member | Viewer |
| --- | --- | --- | --- | --- |
| View Core workspace data | Yes | Yes | Yes | Yes, read-only |
| Upload or import contracts | Yes | Yes | Yes | No |
| Confirm or correct suggested details | Yes | Yes | Yes | No |
| Edit reviewed operational data | Yes | Yes | Yes | No |
| Create, assign, complete, mark needs response, or resolve tasks | Yes | Yes | Yes | No |
| Request, receive, review, accept, or reject evidence | Yes | Yes | Yes | No |
| Export reports or contract inventory | Yes | Yes | No by default; Owner can enable specific exports | No by default; Owner can enable specific exports |
| Manage team members and roles | Yes | Yes, except owner-only controls | No | No |
| Manage billing/access state | Yes | Yes when billing is admin-managed | No | No |
| Manage workspace security and settings | Yes | Yes | Own profile only | Own profile only |
| Delete workspace or approve irreversible export/deletion | Yes | No | No | No |

Role behavior rules:

- Contract owner is operational metadata, not an authorization role.
- Assigned work owner is operational metadata, not a workspace role.
- Non-admin users should not see unsupported admin controls as disabled clutter;
  hide them or show a read-only explanation when useful.
- Permission-denied states identify the missing permission category without
  leaking hidden routes, internal modules, or private workspace data.
- Historical attribution remains visible after a member is removed.
- The last owner cannot be removed or downgraded until another owner exists.

### Team Invitations

- Owners and admins can invite teammates when team management is supported.
- Invites specify workspace, invited email, role, sender, and expiry.
- Invite acceptance creates or connects the user account to the invited
  workspace after authentication.
- Wrong-email invite states require signing in with the invited email or
  requesting a new invite.
- Expired, revoked, already-used, inaccessible, or malformed invites show safe
  terminal or recovery states.
- Resending an invite preserves the intended workspace and role unless the admin
  changes them.
- Removing a member ends their access without erasing their historical activity,
  reviews, assignments, uploads, or evidence submissions.

### Billing And Paid Access

- Billing is a gated workspace-admin surface, not a public checkout promise.
- Public pricing explains the $249/month Core offer and included capabilities;
  it does not show public checkout in the intended release.
- `/settings/billing` is the canonical in-app billing/access page.
- Billing states are approved access, unpaid, active paid, past due, canceled,
  and provider unavailable. Trialing is not offered in the intended release.
- Checkout, customer portal, invoice, payment, and cancellation actions appear
  only when provider-backed and configured.
- Provider-unavailable state hides provider actions and shows safe contact or
  unavailable copy.
- Past-due state blocks new operational mutations while preserving read-only
  visibility, export where permitted, and admin recovery.
- Canceled state stops paid continuation while preserving export/contact paths
  for the 30-day recovery window defined in Operational Decisions.
- Refund and cancellation posture belongs in pricing, terms, billing FAQ, or
  contact copy; the app must not improvise unsupported refund promises.
- Billing lifecycle emails remain secondary until billing is active.

### Core Object Lifecycles

Contracts:

- A contract can be created by upload or import.
- Upload/import success should lead to extraction, review, contract detail, or a
  clear next step.
- Duplicate or already-uploaded states should be recoverable.
- Archive is preferred over hard delete for signed contract records.
- Hard delete exists as an Admin/Owner-only exceptional action, requires typed
  confirmation, hides the active record and source/evidence file access, and
  retains minimal audit references.
- File deletion must not erase historical activity references.

Contract detail review:

- Suggested contract details become trusted operational data only after
  confirmation, correction, or explicit unknown marking.
- Skipping a suggested detail keeps it out of trusted operational data.
- Editing a confirmed detail creates visible activity/history context where
  relevant.
- Source snippets remain available when the user is asked to confirm, correct,
  or reject a suggested value.

Tasks:

- Task items can be open, in progress, cannot proceed, overdue, completed,
  canceled, or unassigned.
- Task rows show owner, status, due date, contract context, and next action.
- Completing, assigning, marking as cannot proceed, or resolving a task is
  role-shaped and records activity.
- Internal keys such as `blocked`, `exception`, and `obligation` may remain for
  compatibility, but normal Core UI presents them as Cannot proceed, Problem,
  and Contract requirement.

Renewals and notice dates:

- Renewal and notice dates distinguish confirmed, suggested, calculated,
  missing, unknown, and stale states in user-facing Core UI.
- User-facing date provenance labels use Confirmed, Suggested, Calculated, and
  Missing. Internal `computed` state may remain, but visible Core UI says
  Calculated.
- Calculated deadlines explain their basis when that basis affects the next
  action.
- Reminder and report behavior should prefer reviewed or clearly labeled
  calculated data.

Evidence:

- Evidence requests can be requested, overdue, submitted, received, reviewed,
  accepted, rejected, or closed.
- Received evidence is not accepted evidence until reviewed or accepted.
- File-required and non-file response states are explicit.
- Evidence remains tied to contract, requirement, task, requester, recipient,
  due date, and review state. Requirement and task links are optional only when
  the request is contract-level rather than requirement- or task-level.

Imports and exports:

- Import jobs can be queued, processing, completed, failed, partially failed, or
  canceled.
- Partial import success shows accepted rows, rejected rows, reasons, and a path
  to correction.
- Exports use the same filters as the preview and disclose stale, partial,
  suggested, missing, or calculated data limitations.
- CSV exports guard spreadsheet formula injection and preserve user intent.

Reports:

- Report runs can be previewed, queued, complete, failed, expired, or unavailable.
- Failed reports show recoverable reasons without raw provider payloads.
- Report history appears only when report runs or send/export jobs are real.

### External Participant Behavior

- External-token routes are single-purpose, scoped, expiring, revocable, and
  non-browsable.
- External participants do not receive account access, workspace sessions,
  navigation, global search, reports, or settings.
- A token can submit successfully once. Corrections require the workspace user to
  issue a new token or reopen the evidence request through an authenticated
  workspace flow.
- Token states are valid, expired, revoked, already submitted, invalid, and
  inaccessible.
- Token pages expose only the requested action context and the minimum contract,
  requirement, requester, recipient, file, and due-date context needed to act.
- File evidence upload is the primary external use case.
- Structured non-file responses are allowed only when the owning workflow
  explicitly asks for them.

### Destructive And Irreversible Actions

- Destructive actions require clear confirmation.
- Irreversible actions require stronger confirmation than ordinary edits.
- Workspace deletion and account deletion are owner/account-level actions, not
  ordinary admin tasks.
- Member removal, invite revocation, token revocation, contract archive/delete,
  file delete, billing cancellation, and export/deletion requests preserve
  activity or audit context.
- Destructive action failures show safe recovery without raw provider details.

### Notifications And Time

- Notifications are limited to operational events: invite, first contract
  uploaded, import completed or needs correction, extraction ready, extraction
  failed or manual confirmation needed, detail-review reminder, renewal
  reminder, notice deadline reminder, task assigned, task overdue, evidence
  requested, evidence overdue, and user-initiated report/export completion or
  failure.
- Reminder timing uses the workspace timezone.
- Date displays must make due dates, overdue state, and relative timing clear.
- Users can opt out of digest and non-critical reminders. Transactional invite,
  password, security, billing recovery, and external-token emails remain
  transactional.
- Delivery failure does not block the workspace; it creates an actionable
  degraded or settings state for admins when a user-visible workflow depends on
  delivery.
- Emails must not reveal hidden, internal, Advanced, Assurance, or omitted
  routes to Core users.

### Degraded, Denied, And Recovery States

- Provider outages, disabled integrations, failed jobs, stale data, partial data,
  and missing configuration show workflow-specific degraded states.
- Extraction failure leads to retry, manual review, upload/import recovery, or
  support contact depending on context.
- Import partial failure preserves valid progress and gives correction paths for
  invalid rows.
- Billing-provider failure hides provider actions and shows safe contact or
  unavailable copy.
- File upload failure explains accepted types, size limits, and retry path.
- Search no-results states offer query/filter recovery without exposing hidden
  routes.
- Denied states explain the missing role or permission category without exposing
  private data.
- Loading states must preserve layout stability and not imply missing data.

## Technical Behavior Specification

This section is the implementation-driving behavior layer. It may use technical
contract language when precision matters. Code must not read this document as
configuration; instead, code-owned constants, route metadata, schemas, tests,
checks, generated inventories, and manual evidence artifacts must encode these
behaviors.

### Specification Precedence

When this document contains overlapping statements, use this order:

1. Known Non-Claims and release boundaries override all product enthusiasm.
2. Operational Decisions control concrete release defaults.
3. Technical Behavior Specification controls cross-route behavior.
4. Detailed route sections control route-specific behavior.
5. Release Behavior Model explains intent behind the technical rules.
6. Release Route Behavior Map is a summary and must not override detailed
   sections.
7. Public copy examples are copy direction, not a complete copy deck.

If code-owned configuration conflicts with this document, implementation should
move the code-owned configuration toward this document through normal code
changes. Product code, tests, scripts, and CI still must not parse this document
as runtime configuration.

### Specification Maintenance And Drift Control

This document is allowed to be implementation-driving and technical. It should
still remain maintainable enough that route, access, billing, evidence, and
hidden-surface decisions cannot drift silently.

- A product-positioning or route-disposition change must update the relevant
  Operational Decision, detailed route section, implementation matrix, release
  blocker, and Release Route Behavior Map row in the same spec revision.
- A workflow-state change must update the relevant state vocabulary, entity
  field catalog, API family, route section, notification rule, and evidence
  requirement when those areas are affected.
- A public claim change must update the public route section, Known Non-Claims
  when relevant, provider/manual evidence requirement, and public metadata or
  sitemap rule when relevant.
- A hidden-surface change must update the Route Status Terms, Hidden Surface
  Development And Test Access, Contained Surface Operability Matrix, affected
  route rows, and negative discovery/direct-access evidence requirements.
- A billing or access-state change must update Access Review And Grants,
  Billing, Pricing, And Cancellation, the Billing And Access State Matrix,
  affected auth/settings route sections, email rules, and blocker criteria.
- When two parts of this document appear to conflict, the stricter
  customer-safe and data-safe behavior applies until the spec is reconciled.
- The Release Route Behavior Map is a summary index. It must be kept complete,
  but it must not be used to weaken a detailed route or workflow contract.
- Code-owned artifacts can be generated, but their source rules must be
  explicit. Passing checks that encode older positioning are drift, not release
  evidence.
- The long-form Markdown contract is intentionally comprehensive, but it is not
  the preferred permanent representation for every executable rule. Route
  dispositions, sitemap rules, API schemas, role aliases, billing/access states,
  notification deep links, hidden-surface fixtures, and evidence coverage must
  be split into code-owned registries that can be diffed and checked without
  re-reading this whole document.
- The Markdown file should retain product posture, route intent, state
  vocabulary, and acceptance semantics. Highly repetitive executable details
  should move into aligned code-owned artifacts once those artifacts can prove
  they preserve the same behavior.
- The Route And Artifact Alignment Delta is a temporary drift-resolution section.
  It should shrink as implementation artifacts align. It must not become the
  primary long-term route manifest or a place to preserve obsolete as-built
  behavior.
- Generated checks must report which contract slice they enforce and which
  slice remains outside their scope. A green check is suboptimal evidence when
  it cannot say whether it covers the current route, sitemap, API, access,
  billing, notification, or hidden-surface contract.

### Exhaustiveness Rule

- Every shipped route needs an explicit route disposition, access behavior,
  primary content, primary actions, role behavior, recoverable failure behavior,
  and empty/loading/degraded/denied behavior where those states apply.
- Every shipped workflow needs explicit input validation, success behavior,
  recoverable failure behavior, side effects, activity or audit requirements,
  notification behavior where applicable, export/report behavior where
  applicable, and tenant-scope boundaries.
- Every shipped data object needs explicit lifecycle states, ownership rules,
  retention/deletion behavior, and relationship behavior to other Core objects.
- If a behavior, route, entity, report, setting, integration, notification,
  export, import field, role action, limit, retention window, billing rule, or
  public claim is not specified here or in a code-owned release artifact aligned
  to this document, it is not part of the intended release.
- Unspecified behavior should resolve by omission, hiding, denial, safe
  unavailability, or explicit reclassification in this document. It should not
  appear as a stub, placeholder, public promise, upgrade prompt, or improvised
  implementation detail.

### Required Code-Owned Contract Artifacts

Implementation must maintain code-owned artifacts that encode this specification
without parsing this Markdown file.

| Artifact | Required contract fields |
| --- | --- |
| Route manifest | Route path or pattern, canonical route, route status, owning surface, auth requirement, allowed roles, direct-access outcome, merge target when applicable, feature/entitlement requirement, provider requirement, and evidence identifiers. |
| Permission matrix | Role, action, route family, entity family, allowed/denied state, read/write/export/destructive classification, step-up requirement, and audit/activity requirement. |
| State-machine registry | Entity/workflow name, allowed states, allowed transitions, actor roles, side effects, terminal states, recovery states, and stale-write/idempotency behavior. |
| Validation and limit registry | Field or input name, type, parser, min/max, enum values, file constraints, accepted date formats, default value, rejection behavior, and user-visible recovery. |
| API contract inventory | Route handler pattern, method, auth boundary, request schema, query schema, response shape, error shape, cache/download headers, rate limit, timeout, idempotency/race-safety marker, and tenant-scope proof. |
| Public route, sitemap, and metadata registry | Public route set, canonical URL, sitemap inclusion, robots policy, noindex state, redirect/merge target, public CTA targets, and proof that auth-gated or compatibility-only routes are not promoted as public acquisition surfaces. |
| Notification and deep-link registry | Notification identifier, channel, recipient, dedupe key, canonical route target, route-disposition eligibility, token scope where relevant, provider dependency, retry behavior, and hidden-surface exclusion proof. |
| Provider capability registry | Provider capability, required environment/provider configuration, enabled state, disabled UI state, recoverable failure state, manual verification requirement, and public-claim dependency. |
| Role alias mapping | Provider, database, legacy, or implementation-specific role names mapped to Owner, Admin, Member, Viewer, or Operator, plus the denied fallback when no safe mapping exists. |
| Hidden-surface access fixture registry | Dev/Test, Internal operator, and Contained workspace access contexts, required flags/entitlements, role fixtures, positive access proof, ordinary Core non-discovery proof, and ordinary Core direct-access denial proof. |
| Evidence index | Evidence item id, contract area, artifact path or reference, command or manual procedure, environment scope, last verification date, owner/reviewer, current state, and blocker recovery owner. |

These artifacts may be generated or hand-authored, but they are the executable
implementation contracts. The Markdown document remains the source of intended
release behavior and must not become runtime input.

### Route Guard Precedence

Every page route and route handler should apply guards in this conceptual order:

1. **Route disposition**: Public, auth, Core, Contextual, Admin, Internal,
   Omit, Merge, Boundary, or Contained.
2. **Route visibility**: Omitted, Internal, and Contained routes resolve through
   the Direct Access Resolution rules before private module data is loaded.
3. **Session**: Routes that require a user session redirect unauthenticated
   users to login only when the route is a visible release-user destination.
   Hidden, Omitted, Internal, and Contained routes use the hidden-route outcome
   unless an authorized Dev/Test, Operator, or Contained workspace context is
   already established.
4. **Auth route relevance**: Authenticated users leave login, signup, forgot, and
   reset routes when the session makes those routes irrelevant.
5. **Workspace resolution**: Core routes resolve a workspace from the current
   session or route context before loading tenant data.
6. **Workspace lifecycle**: Setup incomplete, active, suspended, past due,
   canceled, and deleted workspaces shape access before entity data loads.
7. **Role and permission**: Owner, Admin, Member, Viewer, and Operator
   boundaries are checked before mutations and before privileged data appears.
8. **Entity scope**: Contract, import, report, token, file, invite, and work IDs
   are validated and scoped to the workspace or token before lookup results are
   revealed.
9. **Provider and feature availability**: Billing, email, file processing,
   report sending, extraction, and export actions require code-owned provider
   configuration. Missing provider configuration hides the action or renders an
   explicit unavailable/degraded state.
10. **Renderable state**: After guards pass, the route renders populated, empty,
    loading, degraded, denied, invalid, or recoverable error state.

Denied and not-found handling must not reveal whether a private workspace,
contract, file, invite, token, report, route, or internal module exists.

### Direct Access Resolution

When a route section names multiple safe outcomes, implementation must use the
specific resolution below unless that route section explicitly says it is an
exception.

| Route class or condition | Canonical direct-access outcome |
| --- | --- |
| Public route | Render the public page. |
| Auth route with relevant authenticated session | Leave the auth page for the user's requested destination, workspace setup, dashboard, or safe account recovery destination. |
| Core app route without session | Redirect to `/login` with a safe return target only if the route itself is a visible Core destination. |
| Core app route with no resolved workspace | Route to setup, safe no-workspace recovery, or request-access recovery without loading tenant data. |
| Contextual route with missing, invalid, or inaccessible object | Render Global not found or the route's invalid/recoverable state without confirming object existence. |
| Admin route for non-admin user | Render the allowed read-only settings state when specified; otherwise route to `/settings` or Global not found without privileged data. |
| Merge route | Redirect to the canonical route, preserving only validated parameters. Thin wrapping is allowed only under Canonical URL And Compatibility Behavior. |
| Omit route | Render Global not found for ordinary release users. |
| Contained route for ordinary Core user | Render Global not found. |
| Contained route for entitled workspace/user | Render only after entitlement, role, provider, support, and billing/no-charge treatment pass. |
| Internal route for unauthorized user | Render Global not found. |
| Internal route for authorized Operator | Render only inside the explicit operator scope with audit and redaction controls. |
| Boundary route | Render the route-specific safe terminal, recovery, callback, loading, or not-found state. |

Global not found means the Boundary route defined in Boundary, Loading, And
Error Routes. It may offer public home, login, dashboard, or contracts recovery
based on auth state, but it must not confirm that a hidden, contained, internal,
private, or inaccessible route exists.

### HTTP, Redirect, And Header Contract

Page routes and API handlers must use status, redirect, and header behavior that
matches the security boundary. Exact framework mechanics are implementation
owned; these observable outcomes are release contracts.

| Condition | Page outcome | API outcome |
| --- | --- | --- |
| Public page success | `200` render. | Public endpoint success response with no private data. |
| Authenticated Core page success | `200` render after session, workspace, lifecycle, role, and provider checks. | `2xx` success after auth, tenant, role, validation, and provider checks. |
| Unauthenticated visible Core route | `302` or `303` redirect to `/login` with a validated relative return target. | `401` with non-enumerating recovery shape. |
| Authenticated user on irrelevant auth route | `302` or `303` redirect to intended safe destination. | Not applicable unless the endpoint is an auth callback/recovery endpoint. |
| Visible Core route with insufficient role | `403`-equivalent denied state or route to allowed read-only surface when the route section specifies it. | `403` with non-enumerating permission reason. |
| Hidden, Omitted, unauthorized Internal, or ordinary-user Contained route | Global not found, normally `404`. | `404`; do not expose route, module, entitlement, or object existence. |
| Missing, invalid, or cross-workspace entity id | Global not found or route-specific invalid state without confirming existence. | `404` for missing/inaccessible entity or `400` when the identifier is syntactically invalid before lookup. |
| Invalid user input | Field-level recovery for pages. | `400` with safe validation details for submitted fields only. |
| Stale write, optimistic concurrency conflict, or duplicate idempotency conflict | Recoverable conflict state preserving safe user input. | `409` with safe recovery shape. |
| Rate limit exceeded | Recoverable rate-limit state with retry guidance and no enumeration. | `429` with bounded retry guidance and no account/token/workspace existence signal. |
| Provider unavailable or required configuration missing | Disabled action, degraded state, or provider-unavailable recovery. | `503` when the capability is temporarily unavailable; `424` or equivalent dependency-failure shape is allowed only when already used by code-owned API contracts. |
| Background job accepted | Progress, queued, or processing state. | `202` or existing code-owned accepted-job shape with idempotency/race-safety marker. |
| Destructive action confirmed and completed | Terminal success with preserved audit/activity context. | `2xx` success with audit/activity side effect; irreversible actions require prior confirmation proof. |

Header requirements:

- Authenticated app pages, external-token pages, auth callbacks, sensitive
  recoveries, and denied/error states that may contain private context use
  `no-store` or an equivalent no-cache policy.
- Public marketing and policy pages may use cache headers only when they do not
  contain request-specific state, access-request status, account state, or
  private workspace data.
- File downloads, report exports, contract exports, calendar exports, and
  evidence downloads set intentional `Content-Type`, `Content-Disposition`, and
  no-store/private cache behavior.
- CSV exports must use a CSV content type, safe filename, attachment disposition,
  and CSV formula-injection protection before download.
- JSON API responses that contain private workspace data must not be publicly
  cacheable and must not include raw provider, database, token, signed URL, file,
  prompt, model, secret, or stack-trace payloads.
- Redirect targets must be relative same-origin paths unless a route section
  explicitly allows a public external destination.

### Canonical States

Use these state names as the release vocabulary. Code may encode them with
code-owned enum names, but user-visible behavior should map back to these
states.

Access grants:

| State | Meaning | User-visible result |
| --- | --- | --- |
| `valid_workspace_creation` | Approved first user can create a workspace. | Signup can continue. |
| `valid_workspace_invite` | Invited user can join an existing workspace. | Signup or login can continue. |
| `missing` | No grant was provided. | Request access or sign in. |
| `invalid` | Grant is malformed or unknown. | Safe invalid-access state. |
| `expired` | Grant is past expiry. | Request a new grant. |
| `revoked` | Grant was canceled before use. | Contact or request access. |
| `already_used` | Grant has already been consumed. | Sign in or request help. |
| `wrong_email` | Authenticated email does not match the grant. | Use invited email or request a new invite. |

User and session states:

| State | Meaning | User-visible result |
| --- | --- | --- |
| `unauthenticated` | No valid session. | Public pages or login. |
| `authenticated_unverified` | Session exists but email verification is required for sensitive actions. | Limited access with verification prompt. |
| `authenticated_verified` | Session exists and account requirements are satisfied. | Continue to workspace guard. |
| `no_workspace` | User has no usable workspace membership. | Request access, accept invite, contact, or sign out. |
| `disabled_account` | Account access is disabled. | Safe unavailable/contact state. |

Workspace states:

| State | Meaning | Allowed behavior |
| --- | --- | --- |
| `setup_incomplete` | Workspace exists but first-use setup is unfinished. | Onboarding, upload/import handoff, limited Core visibility. |
| `active` | Workspace can use Core surfaces. | Normal role-shaped behavior. |
| `access_suspended` | Access is intentionally paused. | Read-only or recovery-only behavior. |
| `billing_past_due` | Billing needs admin recovery. | Read-only or restricted mutations, export/contact path. |
| `canceled` | Paid continuation ended. | Export/contact path for disclosed retention period. |
| `deleted` | Workspace is no longer available. | No ordinary access; safe account/contact recovery only. |

Roles:

| Role | Scope |
| --- | --- |
| `owner` | Workspace control, billing, team, ownership transfer, irreversible export/deletion approval. |
| `admin` | Workspace administration and Core operations except owner-only controls. |
| `member` | Core operational work. |
| `viewer` | Read-only Core visibility. |
| `operator` | Internal support or maintenance outside customer role hierarchy. |

Billing states:

| State | Meaning | User-visible result |
| --- | --- | --- |
| `approved_access` | Access approved before paid state is finalized. | Core access according to grant and workspace state. |
| `unpaid` | Paid continuation is not active. | Billing recovery or contact path. |
| `trialing` | Provider recovery state only; not offered or marketed. | Show provider-derived dates only if encountered. |
| `active_paid` | Billing is current. | Normal paid access. |
| `past_due` | Provider says payment needs attention. | Admin recovery; possible mutation restrictions. |
| `canceled` | Subscription/access is canceled. | Disclosed export/contact window. |
| `provider_unavailable` | Billing provider/configuration is unavailable. | Hide provider actions; show safe contact/unavailable copy. |

Contract states:

| State | Meaning |
| --- | --- |
| `active` | Contract participates in Core workflows. |
| `pending_review` | Contract has suggested or imported values awaiting review. |
| `missing_data` | Contract lacks expected operational fields. |
| `archived` | Contract is removed from active queues but retained for history/reporting where appropriate. |
| `deleted` | Contract is no longer available except preserved audit references. |

Source file states:

| State | Meaning |
| --- | --- |
| `uploaded` | File was accepted into storage. |
| `rejected` | File failed validation. |
| `processing` | File is being parsed or extracted. |
| `ready` | File can support source preview/review. |
| `failed` | File processing failed recoverably. |
| `deleted` | File is no longer available to users. |

Extraction states:

| State | Meaning |
| --- | --- |
| `not_started` | No extraction job exists. |
| `queued` | Extraction is waiting to run. |
| `processing` | Extraction is running. |
| `ready_for_review` | Suggestions are available. |
| `manual_review_needed` | Automated extraction is insufficient but workflow can continue. |
| `failed` | Extraction failed and needs retry, manual review, or support. |

Field states:

| State | Meaning |
| --- | --- |
| `suggested` | Extracted or imported value awaits review. |
| `source_backed` | Suggested or reviewed value has locatable source support. |
| `reviewed` | User accepted or corrected value. |
| `edited` | Reviewed value was changed manually. |
| `missing` | Expected value is absent. |
| `unknown` | User intentionally marked value unknown. |
| `computed` | Value was derived from other inputs. |
| `unverified` | Imported or inferred value has not been reviewed. |
| `stale` | Value depends on outdated source, job, or recompute state. |
| `skipped` | User deferred the field without making it trusted. |

Task states:

| State | Meaning |
| --- | --- |
| `open` | Action is not complete. |
| `in_progress` | Task is being handled. |
| `blocked` | Task cannot proceed without another action or input. |
| `overdue` | Due date has passed and task is not complete. |
| `due_soon` | Due date is within the configured due-soon window. |
| `unassigned` | No owner is assigned. |
| `completed` | Task is complete. |
| `canceled` | Task is intentionally closed without completion. |

Evidence states:

| State | Meaning |
| --- | --- |
| `requested` | Request has been created. |
| `overdue` | Due date has passed without required submission. |
| `submitted` | Recipient submitted response or file. |
| `received` | Workspace can see the submission. |
| `reviewed` | Authorized user reviewed the submission. |
| `accepted` | Evidence is accepted for operational use. |
| `rejected` | Submission did not satisfy the request. |
| `closed` | Request is no longer active. |

Import states:

| State | Meaning |
| --- | --- |
| `queued` | Import awaits processing. |
| `processing` | Import is running. |
| `completed` | All accepted rows processed successfully. |
| `partially_failed` | Some rows were accepted and some need correction. |
| `failed` | No usable import result was produced. |
| `canceled` | Import was intentionally stopped. |

External-token states:

| State | Meaning |
| --- | --- |
| `valid` | Token can complete the requested action. |
| `expired` | Token is past expiry. |
| `revoked` | Token was canceled. |
| `already_submitted` | Token has already been used. |
| `invalid` | Token is malformed or unknown. |
| `inaccessible` | Token cannot be used in the current context. |

Report and export states:

| State | Meaning |
| --- | --- |
| `preview` | User can inspect rows and filters before export. |
| `queued` | Report/export job awaits processing. |
| `processing` | Job is running. |
| `completed` | Output is ready or was delivered. |
| `failed` | Job failed with recoverable explanation. |
| `expired` | Output link or retained file is no longer available. |
| `unavailable` | Provider/configuration/state prevents the action. |

Provider states:

| State | Meaning |
| --- | --- |
| `configured` | Provider-backed action can be offered. |
| `missing_configuration` | Provider action is unavailable but recoverable by setup/contact. |
| `degraded` | Provider exists but is delayed or partially unavailable. |
| `failed` | Provider action failed. |

Notification states:

| State | Meaning |
| --- | --- |
| `pending` | Notification is ready to be sent. |
| `sent` | Notification was accepted by the delivery path. |
| `failed` | Notification failed and may be retried or surfaced as degraded state. |
| `suppressed` | Notification was intentionally not sent because of preferences, dedupe, missing recipient, or unsafe state. |

Team membership states:

| State | Meaning |
| --- | --- |
| `invited` | User has a pending invitation. |
| `active` | User can access the workspace according to role. |
| `removed` | User no longer has workspace access but keeps historical attribution. |
| `disabled` | User membership is blocked from access without deleting history. |

View states:

| State | Meaning |
| --- | --- |
| `empty` | No records exist for the current workflow. |
| `filtered_empty` | Records may exist, but none match current filters. |
| `loading` | Data is being fetched or work is pending. |
| `populated` | Data is available and current enough to use. |
| `partial` | Some data is available and some is delayed, stale, or unavailable. |
| `degraded` | Workflow is usable with explicit limitations. |
| `denied` | User lacks session, workspace, role, or permission. |
| `invalid` | User supplied invalid route, token, form, or entity context. |
| `unavailable` | Provider/configuration/state prevents the action. |

### Workspace Lifecycle Effects

Workspace state controls all Core routes:

| Workspace state | View Core data | Mutate Core data | Upload/import | Export | Billing/settings recovery |
| --- | --- | --- | --- | --- | --- |
| `setup_incomplete` | Limited | Limited | Yes, when setup allows | No, unless already available | Yes |
| `active` | Yes | Yes by role | Yes by role | Yes by role | Yes by role |
| `access_suspended` | Optional read-only | No | No | Optional export path | Yes |
| `billing_past_due` | Yes, read-only acceptable | Restricted | Restricted | Yes where permitted | Yes |
| `canceled` | Read-only during retention | No | No | Yes during retention | Contact/status only |
| `deleted` | No | No | No | No ordinary export | Contact/account recovery only |

If a route cannot safely determine the workspace state, it must render a
workspace-required or recoverable unavailable state rather than guessing.

### Role Permission Defaults

These defaults apply unless a route section narrows the behavior. The Canonical
Implementation Matrices section provides the detailed implementation matrix. A
workspace can make some Member exports or Viewer exports more restrictive, but
not broader than the role allows.

| Action | Owner | Admin | Member | Viewer | Operator |
| --- | --- | --- | --- | --- | --- |
| View dashboard, contracts, tasks, renewals, evidence, reports | Yes | Yes | Yes | Read-only | Support-only |
| Upload contract file | Yes | Yes | Yes | No | No ordinary action |
| Import tracker CSV | Yes | Yes | Yes | No | No ordinary action |
| Confirm suggested detail | Yes | Yes | Yes | No | No ordinary action |
| Edit confirmed detail | Yes | Yes | Yes | No | No ordinary action |
| Mark detail unknown | Yes | Yes | Yes | No | No ordinary action |
| Skip detail review | Yes | Yes | Yes | No | No ordinary action |
| Assign contract owner metadata | Yes | Yes | Yes | No | No ordinary action |
| Create task | Yes | Yes | Yes | No | No ordinary action |
| Assign or reassign task | Yes | Yes | Yes | No | No ordinary action |
| Complete, mark needs response, reopen, or cancel task | Yes | Yes | Yes | No | No ordinary action |
| Create evidence request | Yes | Yes | Yes | No | No ordinary action |
| Accept or reject evidence | Yes | Yes | Yes | No | No ordinary action |
| Create external token | Yes | Yes | Yes | No | No ordinary action |
| Revoke external token | Yes | Yes | Yes if creator or owner | No | Support-only |
| Run report preview | Yes | Yes | Yes | Read-only if enabled | Support-only |
| Export report or inventory | Yes | Yes | No by default; Owner can enable specific exports | No by default; Owner can enable specific exports | Support-only |
| Manage team invites and roles | Yes | Yes except owner-only changes | No | No | Support-only |
| Transfer ownership | Yes | No | No | No | No ordinary action |
| Remove last owner | No | No | No | No | No |
| Manage billing | Yes | Yes when billing is admin-managed | No | No | Support-only |
| Delete/archive contract | Yes | Yes | No unless explicitly enabled | No | Support-only |
| Delete workspace | Yes | No | No | No | No ordinary action |
| View internal diagnostics | No ordinary access | No ordinary access | No | No | Yes |

The UI must not show actions that the user cannot take unless the disabled or
read-only state gives useful context. API routes must enforce the same or
stricter permission boundary as the UI.

### Mutation Contract

Every mutation must follow this sequence unless the route is read-only or this
document defines a stricter route-specific sequence:

1. Validate request shape and bounded input values.
2. Validate session and route disposition.
3. Resolve workspace and check tenant scope.
4. Check workspace lifecycle state.
5. Check role and action permission.
6. Validate entity state and allowed transition.
7. Check provider configuration when the mutation uses a provider.
8. Apply idempotency or stale-write protection when the action can be repeated
   or submitted concurrently.
9. Persist the change with actor, workspace, entity, and timestamp attribution.
10. Record activity or audit history when the action changes operational state,
    permission, billing, security, files, external tokens, exports, or deletion.
11. Trigger bounded side effects such as recompute, notification, export job, or
    report job only after the primary mutation is valid.
12. Return the next user-visible state without raw provider, database, secret,
    token, file, or model payloads.

Repeated submissions must be safe. A user refreshing after a successful form
submit must see the completed state, not duplicate records or duplicate
notifications.

### Concurrency And Stale-Write Rules

- Mutations that update confirmed details, tasks, evidence requests,
  contracts, team roles, billing state, external tokens, imports, or reports
  must protect against stale writes or duplicate submissions.
- If another user changes the same entity first, the user sees a recoverable
  conflict or refreshed state rather than silently overwriting the newer change.
- Idempotent retry is required for external token submission, import retry,
  report/export creation, notification retry, webhook handling, and destructive
  confirmation submission.
- Background jobs must tolerate duplicate, delayed, or retried execution.
- Long-running provider work must be represented as queued, processing,
  completed, failed, or degraded state rather than blocking the page
  indefinitely.
- Fan-out work such as notifications, extraction, imports, exports, report
  generation, and recomputes must be bounded by code-owned concurrency limits.

### Route Parameter And Query Validation

- Dynamic route parameters must be validated before lookup. Syntactically invalid
  identifiers fail before data lookup. Syntactically valid but missing or
  cross-workspace identifiers follow Direct Access Resolution and do not confirm
  existence.
- Cross-workspace IDs return safe not-found or denied states without confirming
  existence. For API handlers, cross-workspace object lookup failures return the
  same object-not-found shape as same-workspace missing objects.
- Query filters must use bounded enums, normalized dates, explicit pagination,
  and safe defaults.
- Unknown filters are rejected on API routes and ignored only on page routes
  when ignoring them cannot broaden data access, change permissions, or hide a
  destructive/billing/provider action. Unknown filters are never passed through
  to provider or database queries.
- Search text, free-text form fields, filenames, CSV cells, and external
  responses are untrusted input.
- Redirect targets must be same-origin or explicitly allowed.
- Return-to paths must not bypass auth, workspace, role, or route-disposition
  guards.

Default query contract:

| Query field | Allowed form | Default / rejection behavior |
| --- | --- | --- |
| `q` | Trimmed string, 1-120 characters after trimming. | Empty string clears search; over-limit search is rejected with field-level recovery. |
| `page` | Positive integer when page pagination is used. | Defaults to `1`; values outside code-owned max page limits are rejected or clamped only when clamping cannot hide data. |
| `cursor` | Opaque code-owned cursor token when cursor pagination is used. | Invalid cursor renders safe recovery; cursors never encode unvalidated tenant or role scope. |
| `limit` | Integer within the code-owned per-surface range. | Defaults to the route's standard page size; cannot exceed the route maximum. |
| `sort` | Route-specific enum. | Unknown sort rejects on API and resets to default on page routes only when disclosed. |
| `dir` | `asc` or `desc`. | Defaults to the route's standard direction. |
| `status` | Route/entity-specific enum. | Unknown value rejects on API and resets to safe default on page routes only when disclosed. |
| `owner` | Current workspace user id, `unassigned`, or route-specific owner filter. | Cross-workspace owner ids are rejected as not found/inaccessible. |
| `contract` | Current workspace contract id. | Missing or cross-workspace ids use object-not-found behavior. |
| `dateFrom` / `dateTo` | ISO date-only `YYYY-MM-DD`. | Invalid or reversed ranges reject with field-level recovery. |
| `dueWithin` / `window` | Route-specific bounded enum, defaulting to `7`, `30`, `60`, or `90` days where used. | Unknown values reject on API and reset to route default on page routes only when disclosed. |
| `tab` / `view` | Route-specific enum for visible tabs/views. | Unknown values reset to the default visible tab only after route and role checks pass. |
| `returnTo` | Relative same-origin path with validated route disposition. | Invalid, external, hidden, contained, internal, or role-inaccessible targets are dropped. |

Route sections may define narrower query schemas. They may not broaden these
defaults without updating this section or a code-owned route contract aligned to
this document.

### Validation And Limits

Operational Decisions define intended default limits. Code-owned configuration
stores executable constants and user-visible UI copy discloses relevant limits.
The release must not have unbounded behavior for these areas:

- Public form submissions.
- Login, password reset, signup, invite acceptance, and external token attempts.
- File upload count, file size, file type, and filename length.
- CSV row count, column count, cell length, and invalid row reporting.
- Import and extraction job runtime.
- Search query length, result count, and pagination.
- Report preview rows, export rows, and download retention.
- Notification retries and digest generation.
- Background job retries, fan-out concurrency, and timeout budgets.
- External token expiry, submission count, and file upload limits.

Validation behavior:

- Empty required fields show field-level recovery.
- Invalid email formats show field-level recovery and do not reveal account
  existence.
- Password requirements are enforced before account creation and are consistent
  between signup and reset.
- File type validation must not trust browser-provided MIME type or filename
  alone.
- CSV import validation distinguishes rejected file, rejected row, rejected cell,
  duplicate row, duplicate contract, and partial success.
- Date parsing follows the accepted formats and ambiguous-date handling defined
  in Operational Decisions.
- Currency and numeric values should preserve the user's intent and avoid silent
  truncation.
- Provider errors are mapped to safe user-facing reasons.

### Entity Scope And Minimum Records

Every tenant-scoped entity must carry enough behavior-driving information to
enforce scope, display activity, recover from errors, and support export,
retention, audit, and reporting without relying on hidden client context. The
storage schema may differ from this table, but the behavior must be
representable and verifiable.

Common tenant entity requirements:

| Entity contract field | Requirement |
| --- | --- |
| Stable identifier | Internal identifier used for lookup; user-visible labels, route params, and browser state are not tenant proof. |
| Tenant scope | Workspace or external-token scope validated before lookup result disclosure. |
| Lifecycle state | Current state from the entity's allowed state machine. |
| Ownership/actor fields | Owner, assignee, requester, recipient, external participant, system job, provider webhook, or operator attribution where relevant. |
| Provenance | Uploaded, imported, extracted, computed, reviewed, manually edited, external-submitted, provider-created, or system-generated source where relevant. |
| Timestamps | Created, updated, state transition, review, due/deadline, expiry, retention, deletion, or provider-sync timestamp where relevant. |
| Trust state | Reviewed, suggested, source-backed, computed, missing, unknown, skipped, stale, or unverified where the record contains operational contract data. |
| Deletion/retention state | Active, archived, deleted, expired, retained, or tombstoned state where the entity can leave ordinary use. |
| Visibility class | Whether the entity appears in navigation, detail pages, tables, search, command palette, reports, exports, notifications, activity, and operator diagnostics. |
| Audit/activity reference | Required for changes affecting operational state, permissions, billing, security, files, external tokens, exports, or deletion. |
| Redaction class | Defines whether the entity can expose raw content, safe display metadata only, or no user-visible details in denied/not-found states. |

Minimum release records:

| Entity | Minimum behavior-driving fields |
| --- | --- |
| Access request | Email, name, company when provided, fit context, submission time, status, safe contact metadata. |
| Access grant | Grant type, status, target email, target workspace or workspace-creation context, expiry, consumed state. |
| Workspace membership | User, workspace, role, membership state, invitation source where relevant. |
| Invite | Workspace, invited email, role, sender, expiry, status, resend/revoke state. |
| Contract | Workspace, name, counterparty, type, owner metadata, lifecycle state, source/import context, review state, timestamps. |
| Source file | Workspace, contract, file state, safe display name, type, size, processing state, deletion state. |
| Confirmed detail | Contract, detail key, value, confidence metadata when shown, review state, source context, actor, timestamp. |
| Task | Workspace, contract when relevant, type, title, owner, status, due date, source trigger, activity. |
| Renewal/notice item | Contract, date type, date value, provenance, owner, next action, related task. |
| Evidence request | Workspace, contract/requirement/task context, requester, recipient, due date, file/non-file mode, state. |
| External token | Token scope, recipient context, requested action, expiry, status, redacted display metadata. |
| Import job | Workspace, source file, status, row counts, accepted/rejected counts, safe correction messages. |
| Report run/export | Workspace, report type, filters, row count, freshness state, status, initiator, download/send state. |
| Notification | Workspace, notification type, recipient, trigger entity, delivery state, dedupe key or equivalent. |
| Activity/audit event | Workspace, actor, event type, affected entity, timestamp, safe summary. |

Records must not store raw provider payloads or raw model responses unless there
is a specific product need, operator-only access boundary, retention rule,
redaction/minimization coverage, and release evidence for safe handling.

### Auth, Session, And Account Rules

- Login success returns the user to the originally requested safe app route when
  allowed; otherwise it goes to setup or dashboard.
- Login failure does not reveal whether the email exists.
- Forgot-password submission always shows neutral success.
- Reset-password requires a valid recovery context; invalid or expired contexts
  return to recovery.
- Signup requires a valid access grant before password creation.
- Approved first-workspace signup does not require a second confirmation email.
  The access-grant email establishes the mailbox context for this path; signup
  creates a confirmed account, creates the workspace, signs the user in, and
  routes to setup or dashboard.
- Email verification is required before sensitive actions when account security
  configuration requires it.
- Step-up authentication is required for sensitive account, billing, security,
  destructive, and ownership-transfer actions when step-up is implemented.
- Session revocation signs the session out and returns to login or a safe public
  route.
- Session lists, if shown, must not expose raw session tokens, cookies, provider
  payloads, IP-derived sensitive detail beyond supportable display, or device
  identifiers that are not intentionally captured.

### Access Request Rules

- Access request creates an access-request/contact record only.
- Access request does not create account, workspace, billing customer,
  subscription, trial, invite, or entitlement.
- Duplicate access requests by the same email should show a safe received state
  or update contact context without creating duplicate workspace grants.
- Access-request status is not publicly queryable by email.
- Request-access and contact submissions are rate-limited and recoverable.
- Approval, rejection, and grant creation are non-product operating actions, but
  the product must behave correctly once a grant exists.

### Public Form Rules

Public forms include request access, contact, security report intake when
present, password recovery, reset-password submission, signup grant validation,
and external-token submission.

- Public forms validate required fields before submission.
- Public forms preserve safe user-entered fields after recoverable validation
  errors.
- Public forms rate-limit or abuse-limit repeated submissions.
- Public form success states do not reveal private account, workspace, invite,
  token, or billing existence.
- Contact form submission creates a contact/support record or safe equivalent;
  it does not create workspace access.
- Contact form categories may include access, pricing, security, support, and
  fit questions.
- Security questions use the same contact form category as other public contact
  messages. The release does not expose a separate public vulnerability-report
  portal.
- Public form provider failures show recoverable copy and never raw provider
  payloads.

### Onboarding Rules

- Onboarding is a workspace setup helper, not a product-mode selector.
- Onboarding is required only when the workspace state requires it.
- Already-complete workspaces leave onboarding for dashboard, upload, import, or
  another safe Core destination.
- Non-admin users cannot change workspace setup defaults unless explicitly
  allowed by the setup flow.
- Onboarding questions may capture role, contract count, current tracking
  method, tracker availability, biggest tracking problem, important dates, owner
  assignment, reporting, and evidence needs.
- Onboarding answers can set defaults or guide empty states only when that
  behavior is implemented.
- Failed onboarding save preserves safe answers and offers retry or dashboard
  recovery when the workspace can continue.
- Onboarding copy must not use visible "calibration", Advanced, Assurance,
  Autopilot, governance, or product-mode language for Core users.

### Account Creation And Invite State Machine

Account creation after approval:

| Current state | Event | Next state | User-visible result |
| --- | --- | --- | --- |
| No grant | Open `/signup` | `missing` | Request access or sign in. |
| Invalid grant | Validate grant | `invalid` | Safe invalid-access state. |
| Expired grant | Validate grant | `expired` | Request a new invite/access grant. |
| Revoked grant | Validate grant | `revoked` | Contact or request access. |
| Used grant | Validate grant | `already_used` | Sign in or request help. |
| Wrong email | Authenticate | `wrong_email` | Use invited email or request a new invite. |
| Valid workspace creation | Submit valid account details | Confirmed account plus workspace setup | Signed in and routed to onboarding or dashboard. |
| Valid workspace invite | Submit valid account details | Account plus membership | Continue to workspace setup or dashboard. |
| Existing account invite | Authenticate | Membership | Join invited workspace after authentication; no additional email confirmation is required for an already-confirmed account. |

Invite rules:

- Invite acceptance consumes the invite only after account and membership creation
  succeed.
- Failed account creation does not consume the invite.
- Failed membership creation leaves a recoverable invite state.
- Resent invites invalidate or supersede prior invite links when that is the
  safest implementation; either way, the UI must make the current usable invite
  clear.
- Revoked invites cannot be restored by direct link.

### Billing State Machine

Billing state affects access but should not erase product data:

| Current state | Event | Next state | User-visible result |
| --- | --- | --- | --- |
| `approved_access` | Checkout configured and started | `unpaid` or `active_paid` | Continue or complete payment. |
| `unpaid` | Payment succeeds | `active_paid` | Normal paid access. |
| `active_paid` | Payment fails | `past_due` | Admin recovery and possible restrictions. |
| `past_due` | Payment succeeds | `active_paid` | Restrictions lifted. |
| `active_paid` | Cancellation requested | `canceled` at effective date | Disclose access/export window. |
| Any provider-backed state | Provider missing or unreachable | `provider_unavailable` | Hide provider actions; show contact/unavailable copy. |

Billing rules:

- Billing provider webhooks must be verified, idempotent, and tenant-scoped.
- Billing state shown in the app must come from code-owned billing/access state,
  not public pricing copy.
- Past-due and canceled states must not trigger data deletion by themselves.
- Provider-unavailable state must not claim that payment, cancellation, invoice,
  or portal actions succeeded.
- Invoices, checkout, portal, cancellation, and payment-method actions are
  available only to Owner and Admin roles.

### Contract Lifecycle

Contract flow:

| Current state | Event | Next state | Side effects |
| --- | --- | --- | --- |
| None | Upload accepted | `pending_review` or `missing_data` | File processing and extraction start. |
| None | Import row accepted | `pending_review`, `missing_data`, or `active` | Review queue and inventory update. |
| `pending_review` | Required fields reviewed | `active` or `missing_data` | Dashboard, work, renewals, evidence, reports refresh. |
| `missing_data` | Missing data supplied or marked unknown | `active` or `pending_review` | Data gaps refresh. |
| `active` | Archive | `archived` | Active queues exclude unless filters include archived. |
| `archived` | Restore | Previous active state when recoverable | Active queues refresh. |
| Any non-deleted | Hard delete | `deleted` | Active data hidden; audit references retained. |

Contract rules:

- A signed contract record must have identity, workspace, source/import
  context, owner metadata, lifecycle/status, review state, dates, task/evidence
  signals, timestamps, and activity.
- Contract names and counterparties can be imported, extracted, or edited, but
  reviewed values must be distinguishable from suggestions.
- Contract archive is the default destructive action for ordinary cleanup.
- Contract hard delete exists only for exceptional cleanup by Owner or Admin,
  requires typed confirmation, removes active visibility, and preserves minimal
  audit references to prior activity.
- Archived contracts must not create new routine reminders unless restored or
  explicitly included.

### Upload, File, And Extraction Lifecycle

Upload flow:

| Current state | Event | Next state | User-visible result |
| --- | --- | --- | --- |
| Select file | Validate file | `rejected` or `uploaded` | Show field/file errors or upload progress. |
| `uploaded` | Start processing | `processing` | Processing state and next step. |
| `processing` | Extraction succeeds | `ready_for_review` | Review queue CTA. |
| `processing` | Extraction insufficient | `manual_review_needed` | Manual review or edit path. |
| `processing` | Extraction fails | `failed` | Retry, manual review, or support recovery. |
| `ready_for_review` | Review completed | Contract state refresh | Dashboard/tasks/renewals/reports update. |

Upload rules:

- Accepted document uploads are signed contract files, not drafting/redlining
  documents.
- Upload UI shows supported file types and size limits from code-owned
  configuration.
- File validation covers type, size, tenant path safety, duplicate handling, and
  recoverable error copy.
- Extraction must not make suggested values trusted without review.
- Source previews must be available where field trust decisions are made when a
  cited source exists.
- Source preview unavailable state must not block manual correction.
- File deletion must not remove activity, reviewed value history, or audit
  evidence that a file once existed.

### Import Lifecycle

Import flow:

| Current state | Event | Next state | User-visible result |
| --- | --- | --- | --- |
| File selected | Validate CSV | `failed`, `queued`, or `processing` | File-level errors or job state. |
| `queued` | Job starts | `processing` | Processing state. |
| `processing` | All valid rows accepted | `completed` | Contracts/review links. |
| `processing` | Some rows accepted | `partially_failed` | Accepted rows plus correction table. |
| `processing` | No usable rows accepted | `failed` | Correction/retry path. |
| `queued` or `processing` | User/system cancels safely | `canceled` | No further processing. |

Import rules:

- CSV format expectations must be visible before upload or available as a
  template/example.
- Import must distinguish file-level errors from row-level errors.
- Partial failure is not a failed import when useful rows were created.
- Retry must avoid duplicating rows already accepted.
- Imported unreviewed values are `unverified` or `suggested`, not trusted.
- Import detail must not expose raw file blobs or unrelated workspace rows.

### Contract Detail Review State Machine

Contract detail review flow:

| Current state | User action | Next state | Operational effect |
| --- | --- | --- | --- |
| `suggested` with source | Confirm | `reviewed` and `source_backed` | Can drive queues/reports. |
| `suggested` without source | Confirm | `reviewed` | Can drive queues/reports, but not called source-backed. |
| `suggested` or `unverified` | Edit | `edited` and `reviewed` | Can drive queues/reports. |
| `suggested`, `missing`, or `unverified` | Mark unknown | `unknown` | Treated as intentionally unresolved. |
| `suggested` or `unverified` | Skip | `skipped` | Does not become trusted. |
| `reviewed` or `edited` | Edit again | `edited` and `reviewed` | Activity/history updated. |
| Source changes or recompute invalidates basis | System marks stale | `stale` | Requires review before trusted use where relevant. |

Contract detail review rules:

- Confirm, edit, mark unknown, and skip are separate actions with distinct
  user-visible results.
- Skipped details remain eligible for later review unless the route explicitly
  hides skipped items behind a filter.
- Mark unknown is an intentional data state, not an error.
- Edited reviewed values should preserve prior value, actor, timestamp, and
  source context where available.
- Model confidence can be displayed only as extraction metadata.
- User-facing Core copy should say detail, suggested detail, or contract detail
  instead of field or extracted field.

### Date And Deadline Rules

- Store and compare date-only contract deadlines as normalized date values.
- Display deadlines using workspace timezone for relative labels such as today,
  tomorrow, overdue, and due soon.
- Date parsing should reject ambiguous input unless the user confirms the
  intended date.
- Renewal date, notice date, effective date, end date, and termination date must
  keep independent review/provenance states.
- Calculated notice deadlines must disclose the source inputs and calculation
  basis.
- Confirmed dates take precedence over suggested dates for operational
  reports and reminders.
- Missing or unknown dates should create data-gap/review tasks, not silent
  reminders.
- Due-soon windows are code-owned configuration and must be consistent between
  Dashboard, Tasks, Renewals, Evidence, emails, and reports.
- Default due-soon, renewal-window, and notice-window values are defined in
  Operational Decisions.
- Reminder jobs must be idempotent across retries and delayed runs.

### Task Lifecycle

Task transition rules:

| Current state | Event | Next state |
| --- | --- | --- |
| `open` | Assign owner | `open` or `in_progress` |
| `open` | Mark in progress | `in_progress` |
| `open` or `in_progress` | Mark as needs response | `blocked` |
| `blocked` | Resolve needed response | `open` or `in_progress` |
| `open`, `in_progress`, or `blocked` | Due date passes | `overdue` display state |
| `open`, `in_progress`, `blocked`, or `overdue` | Complete | `completed` |
| Any active state | Cancel | `canceled` |
| `completed` or `canceled` | Reopen | `open` |

Task rules:

- `overdue`, `due_soon`, and `unassigned` can be derived display states, but the
  user must see them consistently.
- Task item type should be one of task, approval, contract requirement, problem,
  renewal follow-up, evidence follow-up, or manually created task.
- Task creation requires title, contract context, owner or unassigned state,
  status, due date, and type.
- Auto-created tasks must identify their source trigger, such as confirmed
  contract detail, renewal date, evidence request, problem, or import/review
  state.
- Manual tasks must not imply legal approval or legal advice.
- Completing or canceling tasks should record actor and timestamp.
- Internal compatibility values may remain `work`, `blocked`, `obligation`, and
  `exception`; ordinary Core UI must translate those values to Tasks, Cannot
  proceed, Contract requirement, and Problem.

### Renewal And Notice Lifecycle

- Renewal rows appear when a contract has confirmed, calculated, suggested, missing,
  or imported renewal/notice context inside the selected window or data-gap
  filter.
- Suggested renewal or notice dates are visible but not trusted until confirmed.
- Calculated notice deadlines can drive reports only when their source inputs are
  reviewed or clearly labeled.
- Mark reviewed, create task, complete task, assign owner, and export actions
  are role-shaped.
- Changing a renewal, notice, end, or effective date should recompute affected
  deadlines and refresh dashboard, tasks, reports, and reminders.
- Renewal copy must avoid guarantees that Oblixa will prevent missed renewals.

### Evidence Lifecycle

Evidence transition rules:

| Current state | Event | Next state |
| --- | --- | --- |
| None | Create request | `requested` |
| `requested` | Due date passes | `overdue` display state |
| `requested` or `overdue` | External/internal submission | `submitted` or `received` |
| `received` | Review submission | `reviewed` |
| `reviewed` | Accept | `accepted` |
| `reviewed` | Reject | `rejected` |
| `rejected` | Request correction | `requested` |
| Any active state | Close | `closed` |

Evidence rules:

- Evidence request requires title, requester, recipient or owner, due date,
  file-required or non-file response mode, and contract context. Requirement or
  task context is included when the request is created from a requirement or
  task.
- External evidence links expose only the minimum context needed to act.
- Received evidence is not accepted evidence.
- Rejected evidence should support correction or closure.
- Evidence files follow the same file validation, redaction, and retention
  boundaries as contract files.
- Evidence tied to archived or deleted contracts remains visible only where
  retention and permissions allow.

### External Token Lifecycle

External token transition rules:

| Current state | Event | Next state | User-visible result |
| --- | --- | --- | --- |
| `valid` | Open link | `valid` | Show requested action. |
| `valid` | Submit once | `already_submitted` | Show success or submitted state. |
| `valid` | Revoke | `revoked` | Recipient sees revoked state. |
| `valid` | Expiry passes | `expired` | Recipient sees expired state. |
| Any | Malformed token | `invalid` | Recipient sees invalid-link state. |
| Any | Scope mismatch | `inaccessible` | Recipient sees unavailable state. |

External token rules:

- Tokens must be scoped to one requested action.
- Tokens must have expiry.
- Tokens must be redacted from logs, telemetry, errors, and UI after creation.
- Raw token values are shown only at creation if unavoidable, never in lists.
- Token status can be shown to workspace users without exposing the raw token.
- Token submission is idempotent for duplicate browser submits.
- Token resubmission or replacement is allowed only when the owning workflow
  explicitly supports correction.
- Token pages must not use the authenticated app shell.

### Report And Export Lifecycle

Report/export flow:

| Current state | Event | Next state | User-visible result |
| --- | --- | --- | --- |
| Select report and filters | Preview | `preview` | Rows, filters, freshness, and limitations shown. |
| `preview` | Export/run | `queued` or `processing` | Job state shown. |
| `processing` | Success | `completed` | Download result and send result when the selected report action includes delivery. |
| `processing` | Failure | `failed` | Recoverable reason and retry when safe. |
| `completed` | Retention expires | `expired` | Re-run or unavailable state. |
| Any | Provider/config missing | `unavailable` | Hide unsupported action. |

Report/export rules:

- Preview and export use the same filters.
- Export filenames, headers, and CSV cells must be safe for spreadsheet opening.
- Export rows must be tenant-scoped and permission-scoped.
- Exports disclose stale, partial, suggested, calculated, missing, or unreviewed
  data limitations.
- Large exports should run as jobs rather than blocking page render.
- Report-send actions appear only when delivery provider and permissions are
  configured.
- Expired downloads should not reveal whether a private file still exists in
  storage.

### Search And Command Behavior

- Search indexes only accessible Core pages, contracts, queues, reports, and
  tools.
- Search must not index omitted, internal, Advanced, Assurance, decision,
  campaign, relationship, account-workspace, or counterparty-workspace surfaces
  for Core users.
- Search results are scoped by workspace, role, route disposition, feature
  availability, and entity permission.
- Empty query behavior should show recent destinations or guidance, not private
  global data.
- No-results behavior should offer spelling/filter recovery.
- Search should not search raw document text unless explicitly supported and
  permission-scoped.
- Command palette actions must enforce the same permissions as the destination
  route or mutation.

### Notification Matrix

Notifications should be emitted only for operational state changes.

| Notification | Primary recipients | Trigger | Link destination |
| --- | --- | --- | --- |
| Invite teammate | Invited email | Invite created or resent | Signup/login invite flow |
| First contract uploaded | Uploading user or workspace admins | First accepted upload | Contract, review, or dashboard |
| Import completed | Importing user | Import completed or partially failed | Import detail |
| Extraction ready | Uploading user or reviewers | Suggested details are ready for confirmation | Review queue |
| Extraction failed/manual confirmation needed | Uploading user or admins | Extraction failed or needs manual confirmation | Upload/import or review recovery |
| Detail review reminder | Review-capable users | Pending review remains | Review queue |
| Upcoming renewal reminder | Contract/task owner | Confirmed/calculated deadline enters window | Renewal or task |
| Notice deadline reminder | Contract/task owner | Confirmed/calculated notice deadline enters window | Renewal or task |
| Task assigned | Assignee | Task assignment created/changed | Task or Tasks queue |
| Task overdue | Assignee and relevant owner/admin | Task passes due date | Task or Tasks queue |
| Evidence requested | Recipient | Evidence request created | External token or Evidence route |
| Evidence overdue | Recipient/requester | Evidence request passes due date | External token or Evidence route |
| Report/export completed or failed | Initiating user | User-initiated job completes/fails | Report/export result |
| Weekly digest | Opted-in users | Digest job runs and is configured | Dashboard or relevant queue |

Notification rules:

- Recipient selection must be tenant-scoped.
- Links must be safe deep links that re-run auth, workspace, role, and token
  guards.
- Notifications should be deduplicated across retries.
- Delivery failure creates degraded state or retry activity; it does not mark
  the underlying task complete.
- Emails and notifications contain minimum necessary context and no raw document
  text, provider payloads, tokens, signed URLs, hidden module names, or internal
  diagnostics.

### Activity And Audit Requirements

Activity visible to ordinary workspace users should include operational events:

- Contract uploaded, imported, archived, restored, or deleted.
- Field approved, edited, marked unknown, skipped, or stale.
- Owner assigned or changed.
- Task created, assigned, marked needs response, completed, canceled, reopened.
- Evidence requested, submitted, reviewed, accepted, rejected, closed.
- Report/export run, completed, failed, downloaded when tracked.
- Invite sent, accepted, revoked, resent.

Audit or admin/security history should include sensitive events:

- Role changed.
- Member removed.
- Ownership transferred.
- Billing state changed.
- Security setting changed.
- Session revoked when shown.
- External token created or revoked.
- Workspace export/deletion requested or completed.
- Operator/internal access where applicable.

Activity and audit entries should include actor, workspace, affected entity,
event type, timestamp, and safe summary. They must not include raw secrets,
tokens, full document text, provider payloads, or cross-tenant identifiers.

### Privacy, Retention, And Deletion Behavior

- Uploaded files, extracted text, source snippets, AI prompts, model outputs,
  evidence files, CSV imports, report exports, and notifications are sensitive.
- Sensitive payloads must be tenant-scoped and minimized in logs, telemetry,
  errors, notifications, and generated artifacts.
- User export and deletion paths must be recoverable and tenant-scoped.
- Account deletion must distinguish deleting a user account from deleting a
  workspace.
- Workspace deletion is owner-only and requires stronger confirmation.
- Deleted or removed users keep historical attribution by stable display name or
  redacted former-user label.
- Retention windows for canceled workspaces, deleted files, report downloads,
  external tokens, notifications, and audit records must be code-owned and
  supportable.
- Public privacy/security pages must describe provider and file handling that
  actually matches implementation.

### API And Route Handler Conventions

Every route handler that supports this release must have:

- Explicit auth boundary or documented public boundary.
- Tenant scope validation before data access.
- Role/action check for mutations and privileged reads.
- Bounded input validation for route params, query params, and body.
- Bounded runtime behavior with timeout, pagination, and concurrency limits.
- Idempotency, stale-write, or race-safety for repeated or concurrent mutations.
- Safe cache and download headers for sensitive responses.
- Redacted recoverable error shape.
- No raw provider, database, token, signed URL, file, prompt, model, or secret
  payload in user-visible response.
- Audit/activity side effects where the route changes release state.

Public route handlers must also have rate limiting or abuse controls where
appropriate. Background and cron handlers should be idempotent, retry-safe, and
protected by route auth or a code-owned equivalent.

API response contract:

- JSON success responses include only fields needed by the owning route or
  workflow. They must not leak unrelated workspace data, hidden-surface state,
  provider payloads, raw model output, or internal diagnostics.
- JSON error responses use a code-owned safe error shape with, at minimum, a
  stable error code, safe user-facing message, optional field-level validation
  details, and optional retry/recovery metadata.
- Error codes are stable contract values. Visible copy may change, but tests and
  clients should not depend on raw provider/database exception text.
- Mutating handlers return enough state for the UI to update or revalidate the
  affected object, but not broad unrelated lists unless the route contract
  explicitly requires it.
- File, export, and report-download handlers return bytes only after auth,
  tenant, role, filter, retention, and CSV/download-safety checks pass.
- Handlers that start asynchronous work return a job/run identifier scoped to the
  workspace or token, current job state, and a bounded polling or recovery path.
- Webhook handlers return provider-compatible success/failure responses while
  preserving internal idempotency, signature verification, and redaction.
- Route handlers that intentionally expose stable request/response shapes must
  have an API contract artifact and focused tests for success, validation
  failure, auth failure, tenant failure, role failure, provider failure, and
  redaction.

### Error And Recovery Copy Rules

- Public auth and recovery errors avoid account, invite, token, or workspace
  enumeration.
- Denied states say what broad permission is missing, not what hidden data
  exists.
- Not-found states avoid confirming cross-workspace objects.
- Provider failures are translated into action-specific recovery.
- Validation failures preserve user-entered safe form data where appropriate.
- Error boundaries never show raw exception names, stack traces, provider
  payloads, database messages, tokens, filenames with sensitive context, or raw
  document text.
- Loading, empty, degraded, denied, invalid, and error states must be accessible
  and must not trap keyboard focus.

### Feature Availability And Entitlements

- A feature or provider-backed action can appear only when route disposition,
  workspace state, role permission, entitlement, configuration, and provider
  state all allow it.
- Entitlements are code-owned. Public pricing copy and this document do not grant
  runtime access by themselves.
- Hidden, omitted, internal, Advanced, Assurance, decision, campaign,
  relationship, account-workspace, and counterparty-workspace features must stay
  absent from Core navigation, command palette, search, dashboard, empty states,
  pricing, onboarding, emails, and upgrade prompts.
- If a feature is unavailable because of configuration, the UI shows contact,
  setup, or unavailable copy rather than a dead control.
- If a feature is unavailable because of role, the UI hides it or shows a
  read-only explanation.
- If a feature is unavailable because of billing/access state, the UI points
  admins to billing recovery and avoids upgrade pressure for non-admin users.
- Feature gates and entitlements must be enforced server-side for mutations and
  privileged reads.

### Navigation, Layout, And URL State

- Primary navigation contains only Dashboard, Contracts, Tasks, Renewals,
  Evidence, Reports, and Settings.
- Contextual routes can be reached from workflow CTAs, table rows, details,
  notifications, search, command palette, and direct links.
- Merge routes redirect or wrap into their parent Core surface while preserving
  useful context such as tab, filter, report type, or task type.
- Query parameters can encode filters, tabs, sort, pagination, selected window,
  and search query only when values are bounded and safe.
- Back/forward navigation should preserve user context after filters, tabs,
  search, detail navigation, and modal exits where practical.
- A route should not require hidden local state to recover after refresh.
- Navigation should not expose inaccessible destinations as disabled clutter.
- Breadcrumbs or back links should return to the owning workflow when a
  contextual route is reached from a queue, table, search result, or email link.

### Tables, Filters, Pagination, Saved Views, And Bulk Actions

- Tables and lists must have stable columns, accessible row labels, predictable
  sort behavior, and recoverable empty states.
- Filters should preserve selected values across loading, refresh, and
  recoverable errors.
- Filter chips and quick filters should map to visible data states such as open,
  overdue, needs response, missing, pending review, due soon, active, received,
  or accepted.
- Filtered-empty state differs from empty state and must offer clear-filter
  recovery.
- Pagination or incremental loading is required for lists that can grow beyond a
  small workspace.
- Sorting must be deterministic. Ties should fall back to a stable field such as
  updated time, due date, name, or creation time.
- Saved views are release-safe only when create, rename, update, delete,
  permission, and empty-state behavior are complete. Otherwise filters are
  temporary route/UI state.
- Bulk actions are release-safe only when preview, permission check, partial
  failure handling, audit/activity, and rollback or recovery behavior are
  complete.
- Bulk selection must not cross hidden, inaccessible, archived, deleted,
  cross-workspace, or unsupported records.
- Bulk destructive actions require stronger confirmation than ordinary edits.

### Core Detail Catalog

Core contract details should be grouped consistently across upload/import,
review, contract detail, renewals, tasks, reports, and exports.

Contract identity:

- Contract name.
- Counterparty.
- Contract type.
- Workspace owner metadata.
- Status/lifecycle.
- Source file or import source.

Date fields:

- Effective date.
- End date.
- Renewal date.
- Notice date.
- Termination date as an optional field.
- Notice window when extracted or imported.

Operational fields:

- Contract value as an optional field.
- Currency as an optional field tied to contract value.
- Payment/renewal cadence as an optional field.
- Contract requirements.
- Approvals.
- Problems.
- Evidence requirements.
- Related tasks.

Detail behavior:

- Every detail used for operational queues, reports, reminders, or exports must
  expose reviewed/confirmed, suggested, source-backed, calculated, missing,
  unknown, unverified, stale, or skipped state as applicable.
- Required fields are workflow-specific. Missing owner, missing renewal/notice
  date, missing key detail, and missing evidence state should surface in owning
  workflows rather than blocking all contract use.
- Contract type should be a bounded set or safe free-text value with clear
  display behavior. It must not imply legal classification certainty.
- Contract value and currency are operational metadata, not financial advice.

### Detail Pages, Drawers, Modals, And Notes

- Detail pages should provide stable identity, source context, state, primary
  next action, related records, and activity.
- Drawers and modals can support focused edits or previews, but direct links must
  remain recoverable without requiring an open modal.
- Closing a modal or drawer should return to the owning list/detail context
  without losing filters or selection.
- Notes and comments are included only when create, edit, delete, permission,
  activity/audit, empty, and denied states are complete.
- Notes and comments must not become a broad collaboration center or imply legal
  review.
- Attachments outside contract/evidence files are included only when upload,
  validation, permission, retention, deletion, and source/context behavior are
  complete.
- Activity history is preferred over comments for system-generated events.

### AI And Document Processing

- AI extraction is an assistive processing path for source-backed suggestions.
- AI output is never trusted operational data until confirmed, corrected, or
  explicitly marked unknown by an authorized user.
- Prompts, extracted text, source snippets, embeddings, model responses, and
  document-processing metadata are sensitive.
- AI provider use must stay tenant-scoped and minimized to the data needed for
  extraction or source preview.
- AI provider errors, prompts, raw responses, and internal scoring must not
  appear in user-visible errors, telemetry, logs, report exports, or public
  pages.
- Source citations must remain attached to suggested values when the user is
  asked to review the value.
- A value without located source support may be shown as suggested, but must not
  be called source-backed.
- Model confidence is extraction metadata only and cannot decide trust state,
  risk, legal meaning, or business action.
- Manual review remains available when extraction fails, source preview is
  delayed, or the source snippet cannot be located.
- Re-extraction or recompute should preserve reviewed user decisions unless the
  user explicitly chooses to replace or revisit them.
- AI copy must avoid legal advice, legal interpretation, autonomous decisions,
  risk authority, compliance findings, guaranteed extraction, or renewal
  guarantees.

### Data Freshness And Read Models

- Dashboard, Tasks, Renewals, Evidence, Reports, and Search may rely on derived
  counts or read models, but stale or partial states must be visible when they
  affect user decisions.
- Derived counts should link to the underlying queue, filtered view, or detail
  that explains the count.
- Refresh/recompute actions appear only when safe and useful to the user.
- Stale data should not silently drive reminders, exports, billing decisions, or
  trusted operational state.
- Report previews and exports disclose freshness and partial-data limitations.
- Background read-model refresh should be idempotent and tenant-scoped.
- If freshness cannot be determined, the UI should show partial/degraded state
  rather than false certainty.

### Calendar, Reminder, And Digest Behavior

- Calendar export is a Core support feature only when it exports confirmed or
  clearly labeled calculated renewal/notice/task dates.
- Calendar exports are generated files, not persistent public calendar-feed
  links. Regeneration creates a new guarded download subject to report/export
  retention.
- Reminder schedules use workspace timezone and code-owned due-soon/overdue
  windows.
- Reminder jobs dedupe by workspace, recipient, entity, reminder type, and
  window or equivalent code-owned key.
- Delayed reminders should not send misleading stale deadlines.
- Weekly digest appears only when preferences, recipient selection, dedupe, and
  delivery failure states are complete.
- Digest content should summarize Core operational state and link back through
  guarded routes.

### Browser, Client Storage, Cache, And Download Behavior

- Sensitive workspace data should not be persisted in arbitrary client storage.
- If preferences or UI state are persisted client-side, they must avoid raw
  document text, tokens, signed URLs, provider payloads, and sensitive free text.
- Browser cache behavior for authenticated pages, downloads, external tokens,
  source previews, and report exports must avoid unintended public persistence.
- Download responses should use intentional filenames, content type,
  content-disposition, and cache headers.
- Report output download links expire after 7 days. Contract and evidence file
  downloads require a fresh authenticated, role-scoped request and are not public
  durable links.
- Client-side fetches should use same-origin or explicitly approved destinations.
- Local UI state should not bypass server-side permission, entitlement,
  workspace, or token checks.

### Accessibility, Responsive, And Interaction Behavior

- Core routes should remain usable by keyboard.
- Interactive controls require accessible names and visible focus states.
- Loading, empty, degraded, denied, invalid, and error states must be announced
  or structured so assistive technology can understand the state.
- Icon-only actions require accessible labels and tooltips where helpful.
- Tables and dense lists need readable headers, row actions, and responsive
  behavior without overlapping text.
- Mobile layouts should preserve primary actions, filters, status labels, and
  row context without hiding critical state.
- Destructive confirmation flows must be reachable by keyboard and screen
  reader users.
- Motion or animation should not be required to understand state.
- Public accessibility page claims must match actual behavior and known
  limitations.

### Telemetry, Analytics, And Event Behavior

- Telemetry is not a release proof substitute; it supports observability.
- Telemetry events should be minimized, tenant-scoped where applicable, and avoid
  raw document text, source snippets, prompts, tokens, signed URLs, provider
  payloads, and sensitive free text.
- Event names and payload shapes are code-owned contracts.
- Important product events include access request submitted, signup grant state,
  first upload/import, extraction ready/failed, detail confirmed, task created
  or completed, evidence requested/received/accepted, report/export run, billing
  state change, invite lifecycle, external token lifecycle, and degraded state.
- Telemetry must not expose hidden, internal, Advanced, Assurance, decision,
  campaign, relationship, account-workspace, or counterparty-workspace surfaces
  to Core users.
- Analytics cookies or marketing tracking are used only if reflected in cookies
  and privacy surfaces.

### Health, Diagnostics, And Operator Behavior

- `/settings/health` is a user-facing admin readiness surface, not an internal
  provider console.
- Health should describe Core workflow states: upload/import, extraction, review,
  renewals, work, evidence, reports, exports, reminders, billing/access, and
  delivery when surfaced.
- Health states are healthy, degraded, blocked, configuration-needed, waiting,
  and unavailable.
- Health actions should open the affected workflow, retry safe user-recoverable
  work, adjust settings, or contact support.
- Internal diagnostics require explicit operator authorization and do not appear
  in public pages, Core navigation, command palette, emails, onboarding, pricing,
  reports, or empty states.
- Operator actions should be audited and minimized.
- Operator access must not bypass tenant scope, token redaction, file privacy, or
  destructive-action confirmation.
- Operator impersonation is outside the release unless explicitly implemented
  with visible audit, tenant scope, and safe exit behavior.

### Integrations, Webhooks, And Provider Boundaries

- Integrations appear only where surfaced and supported by provider
  configuration.
- Billing webhooks, email delivery callbacks, report/export jobs, AI/document
  processing, storage, and notification providers are implementation providers,
  not public product categories.
- Webhooks must verify signatures or equivalent authenticity, be idempotent, and
  avoid raw provider payload exposure.
- Provider identifiers, event IDs, and webhook replay behavior should be stored
  only as needed for idempotency, reconciliation, and support.
- Missing provider configuration hides or disables the affected action with safe
  unavailable copy.
- Provider outages create degraded states in owning workflows.
- No integration should expose Advanced, Assurance, decision, campaign,
  relationship, account-workspace, or counterparty-workspace surfaces to Core
  users.

### Public Legal, Trust, And Policy Behavior

- Public legal/trust pages are product surfaces and should match actual runtime
  behavior.
- Privacy, security, cookies, acceptable-use, accessibility, terms, contact, and
  pricing pages must not claim unsupported certification, procurement readiness,
  formal SLA, managed implementation, legal advice, guaranteed extraction, or
  guaranteed renewal capture.
- Privacy must describe categories of data processed, AI-provider use,
  retention/export/deletion paths, and contact paths.
- Security must describe supportable account, workspace, file, AI, role,
  session, audit, export/deletion, and contact boundaries.
- Legal and trust pages must explicitly cover uploaded contract files, extracted
  text, source snippets, evidence files, report/export outputs, access-request
  data, support/contact messages, billing records, AI-provider processing, and
  deletion/export recovery at the level of detail a cautious small-team buyer
  needs before uploading sensitive contracts.
- If provider-training, file-storage location, encryption, access-control,
  logging, session, MFA, deletion, or retention behavior is unknown or not
  provider-backed, the page must use conservative copy or omit the claim. It
  must not fill gaps with generic SaaS trust language.
- Trust/legal claim evidence must be maintained as a code-owned or manual claim
  matrix. Each material claim needs claim text or claim key, route/page, claim
  category, evidence type, evidence source, owner/reviewer, last verified date,
  environment/provider scope, customer-visible wording, and blocker state.
- Required claim categories are file storage, uploaded file access, AI-provider
  processing, provider-training posture when claimed, retention, export,
  deletion, account security, sessions, MFA when claimed, roles/permissions,
  billing, support/contact, cookies/browser storage, subprocessors/providers,
  and no-legal-advice boundary.
- Terms must describe approved access, paid use when billing is enabled,
  termination/suspension, user responsibilities, and no legal-review obligation.
- Acceptable use must cover unauthorized uploads, abuse, scraping, disruption,
  illegal use, and external-token misuse.
- Cookies must match actual authentication, preference, analytics, and marketing
  cookie behavior.
- Accessibility must provide a real contact path and avoid overstating
  compliance.

### Report Catalog Detail

Core reports should be available as preview/export surfaces when data and
permissions support them.

| Report | Required row context | Required state disclosure |
| --- | --- | --- |
| Upcoming renewals | Contract, counterparty, renewal date, owner, status, next action. | Confirmed/suggested/calculated/missing/stale date state. |
| Notice deadlines | Contract, counterparty, notice deadline, renewal/end context, owner, next action. | Calculation basis and date provenance. |
| Missing owners | Contract, counterparty, current owner state, last updated. | Missing/unassigned state and correction path. |
| Missing key details | Contract, counterparty, missing details, review state. | Missing/unknown/skipped distinction. |
| Open requirements | Contract, requirement title, owner, due date, status, evidence state. | Reviewed/source state, or missing-source label when no source state exists. |
| Overdue tasks | Task item, contract, owner, due date, status, cannot-proceed state. | Overdue basis and source trigger. |
| Problems by owner | Owner, problem count, contracts, severity/status. | Problem state and non-compliance-framing. |
| Evidence requests | Request, contract/requirement, recipient, due date, file state, review state. | Requested/received/reviewed/accepted distinction. |
| Contract inventory | Contract, counterparty, type, owner, status, dates, review state. | Reviewed/suggested/missing data disclosure. |
| Review completeness | Contract, details to confirm, confirmed details, missing/unknown/skipped details. | Trust-state disclosure. |

Reports should not introduce Assurance scorecards, risk findings, legal advice,
decision intelligence, portfolio analytics as primary content, or Autopilot
results.

### Import Schema Detail

CSV/import behavior should support a practical contract-tracker migration without
promising managed spreadsheet cleanup.

Expected import categories:

- Contract name.
- Counterparty.
- Contract type.
- Owner.
- Status/lifecycle.
- Effective date.
- End date.
- Renewal date.
- Notice date or notice window.
- Optional contract value and currency columns.
- Notes and tags/labels are not required release import columns. If an uploaded
  CSV includes them before the corresponding note or tag behavior is complete,
  the import rejects those columns with clear unsupported-column feedback rather
  than silently storing them.

Import rules:

- Required columns must be visible before import.
- Optional columns must be identified as optional.
- Unknown columns are ignored with disclosure or shown as unmapped, not silently
  converted to trusted data.
- Column aliases are code-owned and should be visible when import guidance is
  shown.
- Imported date and currency values are unverified until reviewed or explicitly
  accepted by workflow rules.
- Import cannot create unsupported Advanced, Assurance, decision, campaign,
  relationship, account-workspace, or counterparty-workspace records for Core
  users.

### Contract Detail Relationship Rules

- Contract detail is the only Core surface where all related contract objects can
  appear together.
- Related tasks, requirements, approvals, problems, evidence, renewals, source
  files, confirmed details, and activity should link back to their owning queue
  when a broader workflow exists.
- Detail pages must not create separate product categories for requirements,
  approvals, reports, collaboration, programs, analytics, or assurance.
- Related records hidden by role or route disposition should not appear as
  empty inaccessible modules.
- If a relation is not implemented completely, omit it rather than showing a
  stub.

### Unsupported Surface Handling

- Unsupported does not mean advertised as "coming soon" inside Core.
- Omitted, Contained, Internal, Advanced, Assurance, decision, campaign,
  relationship, account-workspace, counterparty-workspace, collaboration center,
  program, data-quality, watchlist, execution-graph, SLA-simulator, and broad
  analytics surfaces remain hidden unless the document explicitly reclassifies
  them.
- Direct access to unsupported routes follows Direct Access Resolution without
  loading private module data.
- Empty states, upgrade prompts, emails, search, command palette, report catalog,
  pricing, public pages, onboarding, and dashboard cards must not promote
  unsupported routes.
- Compatibility URLs can remain only when they redirect or wrap into supported
  Core behavior.

### Hidden Surface Development And Test Access

Hidden, omitted, contained, Advanced, Assurance, Internal, and compatibility
surfaces may be operable without becoming Core release promises. Access must be
classified as one of these contexts.

Dev/Test access:

- Purpose: local development, QA, visual review, automated tests, route-state
  tests, accessibility checks, and future-surface iteration.
- Allowed environments: local development, automated test runners, and staging
  or preview environments using seeded, synthetic, or explicitly approved test
  data.
- Required gates: code-owned test fixture or development flag, authenticated
  test/developer identity where auth is relevant, explicit workspace mode or
  route-state fixture, role fixture, entitlement/feature-flag fixture when the
  surface depends on one, and provider-disabled fallback when providers are not
  configured.
- Dev/Test access must not depend on public query parameters, guessed URLs,
  disabled auth, broad middleware bypass, production customer data, or the fact
  that the environment is non-production.
- Dev/Test-only affordances may appear to testers through test metadata,
  environment labels, route-state labels, or local-only fixtures. They must not
  appear as public product copy or ordinary Core navigation.

Internal operator access:

- Purpose: production-safe support, diagnostics, recovery, maintenance, or
  release-readiness inspection.
- Allowed environments: staging, preview, and production only when the route is
  classified Internal or explicitly operator-authorized.
- Required gates: explicit operator identity, tenant/workspace scope, least
  privilege, role/authorization check close to the route or action, reason or
  support context for sensitive inspection, step-up or equivalent proof for
  sensitive actions where supported, audit/activity record, and safe redaction.
- Operator access must not expose raw provider payloads, raw document text, raw
  prompts, raw model responses, tokens, signed URLs, secrets, stack traces, or
  cross-tenant data.
- Operator access must not create public discoverability, customer-facing
  upgrade prompts, hidden product promises, or broad product-mode switching for
  ordinary users.

Contained workspace access:

- Purpose: deliberately enabling an operable non-Core surface for a specific
  workspace, customer, internal evaluation, or future module validation without
  changing Core release positioning.
- Required gates: explicit workspace entitlement or workspace mode, role
  permission, feature flag where relevant, provider dependency check, support
  boundary, billing/contract treatment when customer-facing, and clear evidence
  that ordinary Core users cannot discover or access the surface.
- Contained access must be intentional and reversible. It must not arise from an
  accidental flag default, route existence, guessed URL, unscoped entitlement, or
  public signup path.
- Contained customer-facing access must define support expectations, data
  handling, billing or no-charge treatment, and whether the surface is excluded
  from Core documentation, pricing, onboarding, and release claims.
- A contained surface that becomes part of the intended Core release must be
  reclassified in this document and added to route, workflow, evidence, billing,
  support, and trust requirements before ordinary release use.

Universal hidden-surface controls:

- Customer role alone is insufficient for hidden access. Owner or Admin status
  in a Core customer workspace does not authorize Omit routes, unauthorized
  Internal routes, or non-entitled Contained routes.
- A broad admin bypass, environment-wide bypass, middleware skip, route-group
  allowlist, or feature-registry default is not valid hidden-surface access for
  release. It is an implementation gap unless it is explicitly scoped to
  Dev/Test fixtures, an authorized Operator context, or a contained workspace
  entitlement.
- Tests that assert "admin support bypass", `admin_bypass`, or
  `admin_hidden_bypass` for ordinary Core customer admins are stale against this
  release contract. They should be replaced by tests proving ordinary Core admin
  denial plus separate positive tests for Dev/Test, Operator, or entitled
  Contained access.
- Hidden-surface flags must be denied by default for ordinary Core workspaces.
  Enabling a hidden surface must require an explicit code-owned entitlement,
  workspace mode, or operator authorization, not merely the existence of the
  route, page component, API handler, seed data, or customer Admin role.
- Ordinary Core users must not discover hidden surfaces through primary
  navigation, secondary navigation, `/more`, global search, command palette,
  onboarding, empty states, dashboard cards, pricing, public pages, email,
  report catalogs, upgrade prompts, sitemap, or metadata.
- Hidden-surface feature registry fields such as searchable, notifiable,
  dashboard-promotable, report-catalog-visible, command-palette-visible, or
  navigation-visible must evaluate false for ordinary Core workspaces. They may
  evaluate true only inside the allowed Dev/Test, Operator, or entitled
  Contained context and only for recipients who pass the same route guard.
- Autopilot, Assurance, scorecards, control policies, findings, playbooks,
  review boards, health graph, decisions, campaigns, programs, relationship
  workspaces, account workspaces, and counterparty workspaces must not appear in
  Core dashboard blocks, Core settings copy, Core health summaries, Core search,
  Core command palette, Core billing, Core notifications, public pages, or
  release screenshots. They may appear only in allowed Dev/Test, Operator, or
  entitled Contained contexts.
- Direct access by ordinary Core users must follow Direct Access Resolution:
  hidden, omitted, unauthorized Internal, and ordinary-user Contained routes
  render Global not found unless a route section explicitly defines a narrower
  Core-safe recovery.
- Hidden-surface access must preserve tenant isolation, role checks,
  provider-disabled states, sensitive-data redaction, cache/download headers,
  activity/audit where required, and safe recoverable errors.
- Hidden-surface development must not block, redefine, or dilute the Core release
  unless the relevant route is intentionally reclassified in this document.

Required proof:

- Positive proof that each intentionally operable hidden surface can be reached
  in its allowed Dev/Test, Internal operator, or Contained workspace context.
- Negative proof that ordinary Core users cannot discover the surface.
- Negative proof that ordinary Core users cannot direct-access the surface.
- Proof that missing provider configuration or disabled feature flags produce
  safe unavailable states rather than broken screens or leaked internals.
- Visual, accessibility, and interaction proof when the hidden surface is being
  actively developed as an operable future or contained surface.

Advanced and Assurance routes may therefore remain operable behind Dev/Test,
Internal operator, or Contained workspace controls while staying hidden from the
Core release. Their operability is not a Core release blocker unless this
document reclassifies a specific route as Ship, Ship gated, Contextual, Admin,
or required contained-workspace behavior.

### Development And Test Workspace Model

Development and test workspaces must be clearly separated from customer
workspaces.

- Test workspaces use seeded, synthetic, or explicitly approved test data by
  default.
- Test users cover at least Owner, Admin, Member, Viewer, and Operator contexts
  where those roles affect route behavior.
- Test workspaces may include Core, Advanced, Assurance, Internal, and Contained
  surface fixtures, but those fixtures must not make hidden surfaces discoverable
  to ordinary Core users.
- Billing sandbox state must be explicit: exempt, unpaid, paid sandbox, past due
  sandbox, canceled sandbox, provider unavailable, and checkout/portal sandbox
  where provider-backed billing is tested.
- Email delivery in local/test environments should default to capture, mock, or
  non-production recipients. Tests must not send real customer emails unless a
  named manual verification explicitly requires it.
- AI/document-processing tests use mocked provider responses, synthetic files,
  or explicitly approved provider sandbox calls. Production customer contracts
  must not be used for exploratory extraction testing.
- Test external tokens use synthetic recipients and must exercise valid,
  expired, revoked, already-submitted, wrong-token, file-required, and non-file
  response states.
- Test data reset, seeded-user lifecycle, and fixture ownership are code-owned
  artifacts. This document defines the required behavior, not seed scripts.

### Canonical URL And Compatibility Behavior

- Canonical app URLs for the release are the URLs in the Release Route Behavior
  Map with status Ship, Ship gated, Ship simplify, Contextual, Admin, Internal,
  Boundary, or Contained, excluding Merge compatibility rows.
- Public sitemap and indexable metadata include public marketing and policy
  routes only: `/`, `/product`, `/request-access`, `/pricing`, `/contact`,
  `/security`, `/privacy`, `/terms`, `/acceptable-use`, `/accessibility`, and
  `/cookies`, unless this document explicitly adds another public route.
- Auth, signup, password recovery, callback, external-token, app, admin,
  internal, omitted, contained, and Merge routes are reachable only by their
  route contract. They are not public sitemap entries and should be noindex or
  otherwise excluded from public acquisition metadata.
- `/early-access` is compatibility-only. Its canonical metadata target is
  `/request-access`, and it must not appear as a separate sitemap route, public
  acquisition CTA, structured-data offer, public route proof target, or visual
  proof of the release offer.
- `/signup` is grant/invite completion and safe recovery only. It must not be
  indexable public acquisition content, a primary CTA destination, or sitemap
  evidence for public self-serve signup.
- Code-owned sitemap, public-route inventory, structured-data inventory,
  metadata registry, launch checks, and public-proof screenshots must use this
  public route set. A check that requires `/login`, `/signup`,
  `/forgot-password`, `/reset-password`, `/auth/callback`, `/external`,
  `/early-access`, app routes, hidden routes, or Merge routes in the public
  sitemap is enforcing stale positioning.
- Public SEO and launch-positioning checks must assert the exact sitemap set
  above, or a code-owned equivalent that excludes the same auth, recovery,
  callback, compatibility, app, hidden, internal, contained, and Merge routes.
  A public SEO check that passes while those routes remain in the sitemap is
  insufficient evidence for this release contract.
- Public route metadata must not create duplicate canonical identities for
  compatibility routes. Compatibility pages may keep redirects, but canonical
  URL, Open Graph URL, structured-data URL, and public proof target must point
  to the canonical route.
- Merge routes preserve compatibility only. When directly reached, they redirect
  or thin-wrap into the canonical surface named by the route section.
- Redirect is preferred when preserving state is straightforward. Thin wrapper is
  allowed only when needed to preserve existing deep links, route parameters,
  filters, selected tabs, source objects, or back-link behavior.
- If a Merge route thin-wraps instead of redirecting, visible page identity,
  navigation state, breadcrumbs, search result label, report catalog label, and
  canonical link metadata must identify the canonical surface.
- Merge routes must not appear in public pages, sitemap, primary navigation,
  search, command palette, onboarding, dashboard cards, empty states, emails,
  report catalogs, pricing, or upgrade prompts unless the route section
  explicitly allows a compatibility link.
- Query parameters and filters preserved across Merge routes must be validated
  using the canonical route's validation rules.

### Environment, Secrets, And Configuration Behavior

- Environment variables, provider configuration, secrets, webhook endpoints,
  storage buckets, billing products, email sender domains, OAuth apps, and
  scheduled jobs are code-owned or provider-owned artifacts. This document
  describes intended behavior; it does not configure them.
- Missing optional provider configuration should produce a safe unavailable
  state, a disabled action, or an operator-facing diagnostic. It must not
  produce a broken primary workflow, an exposed raw provider error, or an
  implied promise that the action was completed.
- Missing required production configuration is a release blocker for any route,
  action, background job, webhook, billing flow, notification, upload, export,
  AI call, or public form that depends on it.
- Secrets, API keys, cookies, tokens, signed URLs, provider payloads, raw
  document text, SQL, and stack traces must never appear in the UI, telemetry,
  logs intended for routine inspection, exports, reports, email bodies, public
  pages, or generated implementation artifacts.
- Public and Core pages may reference configured capabilities only when the
  runtime can actually complete the action. For example, signup may complete a
  signed grant or invite only if grant validation exists; manual access-code
  entry is a compatibility or recovery fallback, not the intended positioning.
  Billing may show checkout or portal actions only if provider-backed actions
  are configured.
- Feature flags and entitlement flags should default to the safer state:
  unavailable features hidden or disabled, restricted features denied, and
  Core workflows available only when their dependencies are configured.
- Configuration errors should be diagnosable by the operator through logs,
  health checks, or admin-only diagnostics without revealing sensitive details
  to end users.

### Release Verification And Acceptance Behavior

- Every route and behavior in this document needs implementation proof before
  release. Proof can be a code-owned artifact, automated test, static check,
  manual verification artifact, production smoke check, or provider-dashboard
  confirmation.
- Route proof must cover route disposition, direct access behavior, guard
  behavior, role behavior, primary content, primary actions, empty/loading
  behavior where relevant, denied state, recoverable failure state,
  provider-disabled state where relevant, and directly related side effects.
- Workflow proof must cover success, validation rejection, permission denial,
  tenant-scope rejection, stale-write or idempotency behavior where applicable,
  recoverable provider failure where applicable, activity/audit where required,
  notification/export side effects where required, and sensitive-data redaction.
- A green automated check proves only the behavior it explicitly covers. It is
  not evidence for pricing, legal readiness, production provider configuration,
  security-questionnaire completeness, real extraction quality, or any route
  that the check does not inspect.
- Manual verification remains acceptable for provider dashboards, legal copy,
  production secrets, billing products, email sender domains, webhook endpoints,
  and real-user onboarding only when the verification is named and repeatable.
- Manual verification items must be explicit when automated checks cannot
  inspect the behavior. At minimum, manual evidence is required for production
  provider configuration, billing product and webhook configuration, email sender
  and delivery configuration, uploaded-file storage and deletion behavior, AI
  provider data-handling posture, legal/trust copy approval, production smoke
  behavior, real extraction-quality review, and live customer onboarding when
  those claims or workflows are in release scope.
- Manual evidence must state scope, environment, date, reviewer, procedure,
  result, and residual uncertainty. A screenshot, memory, chat note, or passing
  static check is insufficient unless it is tied to a named evidence item.
- A generic manual-boundary sentence in a generated artifact is not manual
  evidence. Each external verification item needs its own evidence record:
  provider dashboard or configuration reference, exact procedure, expected
  result, actual result, reviewer, date, environment, and remaining uncertainty.
- If the current state of production configuration, extraction quality,
  uploaded-file provider handling, legal approval, security-questionnaire
  readiness, or live onboarding cannot be inspected, the release evidence state
  is `missing` or `manual verification required`, not presumed passing.
- Release acceptance for a route requires the route to have the specified
  disposition, guard behavior, empty/loading/error/degraded states, primary
  workflow behavior, role behavior, tenant isolation, and directly related
  side effects.
- Release acceptance for a workflow requires successful completion, recoverable
  failure handling, no raw sensitive leakage, activity/audit where required,
  notification/export side effects where required, and clear user recovery.
- If implementation cannot yet prove a specified behavior, the behavior remains
  intended release work. The document should not be weakened to match an
  incomplete implementation unless the product decision itself changes.
- A route or workflow with no evidence is not release-accepted even when it is
  visually polished, manually operable, or reachable in production.

### Implementation Artifact Alignment

Because this document is not runtime configuration, implementation-driving
artifacts must encode the same behavior in code-owned places:

- Route universe and route disposition artifacts.
- Permission helpers and role tests.
- Auth, invite, and access-grant helpers.
- Workspace lifecycle and billing entitlement helpers.
- Validation constants for files, CSV imports, forms, dates, search, exports,
  and external tokens.
- Notification identifiers, templates, recipient selection, and deep-link guards.
- API contract artifacts where route handlers expose stable request or response
  shapes.
- Security, privacy, upload, export, route, and tenant-isolation checks.
- Accessibility, responsive interaction, browser-storage, cache/header, telemetry,
  health, diagnostics, integration, webhook, report catalog, and import-schema
  checks where those behaviors are implemented.
- Environment, secret, provider-configuration, feature-flag, entitlement, and
  release-verification artifacts where those behaviors are implemented.
- Hidden-surface development access fixtures, operator-authorization checks,
  workspace-mode/entitlement fixtures, and negative discovery/direct-access
  tests where hidden or contained surfaces remain operable.

Implementation must maintain a code-owned release evidence index or equivalent
set of generated/manual artifacts that maps each shipped route, workflow, public
claim, provider-backed capability, and omitted route family to its verification
evidence. The evidence index is a build artifact; this Markdown document is the
contract it must satisfy.

The release evidence index must include, at minimum:

- Evidence item identifier.
- Contract area: route, workflow, entity, public claim, provider capability,
  hidden/contained surface, API family, background job, email/notification, or
  manual verification item.
- Canonical route or route family when applicable.
- Route status or behavior status.
- Required proof category: success, denied, direct-access, non-discovery,
  empty/loading/degraded, validation failure, provider unavailable,
  tenant-scope, role/permission, side effect, redaction, accessibility, visual,
  policy/legal, or manual/provider proof.
- Artifact type: automated test, static check, generated inventory, manual
  verification, provider-dashboard confirmation, production smoke, or legal
  review.
- Artifact path, command, dashboard reference, or manual evidence reference.
- Environment scope: local, test, staging/preview, production, provider
  sandbox, or provider production.
- Owner or reviewer.
- Last verified date.
- Current state: passing, failing, missing, blocked, manually verified, not
  applicable, or intentionally disabled.
- Blocker reason and recovery owner when not passing.
- Notes about provider configuration, seeded/test data, or manual prerequisites.

When those artifacts conflict with this document, the conflict is release work.
Do not make product code read this document to resolve the conflict.

### Implementation Alignment Obligations

Before this specification can fully drive implementation, code-owned artifacts
must encode these alignment rules. These are release-contract requirements, not
notes about current implementation convenience.

- Route disposition artifacts must use the route statuses in this document or
  carry an explicit one-to-one mapping to them. A route cannot be simultaneously
  treated as Ship in one artifact, Omit in another, and Admin/Internal in a third
  without a named compatibility or environment-specific rule.
- The generated route universe must inherit layout, auth, workspace, role,
  route-disposition, and workspace-mode boundaries correctly. No page,
  layout-owned child route, or contained app route may be classified as public
  merely because a parent layout or generator fallback was public.
- The route manifest must include every substantive page route and every
  compatibility route named in this document. It must also identify routes that
  exist in implementation but are Omit, Internal, Merge, Boundary, or Contained,
  so omission and denial are proven rather than accidental.
- Canonical links, primary navigation, secondary navigation, command palette,
  global search, dashboard cards, report catalog entries, email links,
  onboarding links, empty-state CTAs, sitemap entries, and public metadata must
  agree on the canonical release route for each surface.
- Renewals and Evidence are intended top-level Core surfaces at `/renewals` and
  `/evidence`. Existing nested routes such as `/contracts/renewals` and
  `/contracts/evidence-studio` are Merge compatibility routes unless this
  document is changed.
- No notification, email template, report export, CTA, or generated public route
  inventory may point to a route that is missing from the route manifest,
  hidden from the recipient, or compatibility-only when a canonical route is
  available.
- Access-request, access-grant, signup, and invite implementation must be
  backed by code-owned state, validation, expiration, revocation, consumption,
  wrong-email handling, duplicate handling, and audit. A shared access code,
  boolean public-signup flag, or untracked email thread does not satisfy the
  release access model.
- Billing implementation must map free, trial, evaluation, sandbox, exempt,
  unpaid, active, past-due, canceled, paused, and provider-unavailable provider
  states into the Billing And Access State Matrix before route guards, UI copy,
  entitlements, emails, checkout, portal, invoices, exports, or mutation gates
  use them.
- Role helpers must normalize provider or implementation roles into Owner,
  Admin, Member, Viewer, and Operator before navigation, route guards, UI
  affordances, API handlers, exports, billing actions, team management, and
  hidden-surface access decisions run.
- Hidden-surface access must be implemented through Dev/Test fixtures, explicit
  operator authorization, or contained-workspace entitlement. Broad customer
  Admin bypass is not sufficient evidence and must not expose hidden routes in
  Core.
- API contract artifacts must describe real request schemas, query schemas,
  response shapes, error shapes, auth boundaries, tenant-scope checks, rate
  limits, timeouts, idempotency/race-safety, cache/download headers, and side
  effects. A status-only route listing is inventory evidence, not a complete API
  contract.
- API checks must fail when the OpenAPI or equivalent contract has no request
  bodies, no query schemas, no response schemas, no error schemas, or no schema
  references for routes that accept or return structured data. A green route
  coverage check proves only path/method coverage unless it validates those
  schemas.
- Public API documentation, if exposed outside the team, must exclude or mark
  unavailable hidden, omitted, internal, contained, Advanced, Assurance,
  diagnostic, cron, webhook, and operator endpoints unless a separate external
  API product decision is made.
- Public legal, trust, privacy, security, AI, billing, retention, deletion, and
  support claims must have claim-level evidence. A passing copy scanner is not
  enough when the claim depends on provider settings, legal approval, production
  configuration, or manual verification.
- Numbered implementation identifiers in scripts, route checks, telemetry,
  generated artifacts, SQL aliases, environment aliases, or compatibility queues
  are compatibility debt unless they are required by an external provider or
  standard. New implementation contracts should use stable descriptive names,
  and retained numbered aliases need owner, reason, equivalence proof, and
  removal criteria in code-owned compatibility artifacts.
- Extraction-quality proof must be separate from extraction operability proof.
  Operability proves files can be uploaded, processed, reviewed, and corrected;
  quality proof requires representative samples, expected fields, source/citation
  checks, error categories, and reviewer evidence.
- Release checks must fail when code-owned artifacts drift from these rules.
  Checks that enforce an older product state are implementation debt even when
  they pass.
- The release evidence index must be the authoritative proof map for shipped,
  omitted, internal, contained, public, auth, API, background, provider-backed,
  and manual-verification behavior. This Markdown document defines the target;
  the evidence index proves whether implementation satisfies it.

### Route And Artifact Alignment Delta

Code-owned route artifacts must be reconciled to the following release
dispositions before they can be treated as implementation evidence. This section
is a drift-resolution contract, not runtime configuration.

Required route-manifest rows:

| Route | Required status | Required canonical behavior |
| --- | --- | --- |
| `/auth/callback` | Boundary | Callback-only auth handoff with safe success and failure recovery. |
| `/external` | Boundary | Missing or invalid external-link recovery with no workspace data. |
| `/operator/access-requests` | Internal | Operator-only access-request review, grant issuance, grant revocation, safe contact notes, and audit. |
| `/renewals` | Ship | Top-level Core renewal and notice-deadline surface. |
| `/evidence` | Ship | Top-level Core evidence request, receipt, and review surface. |
| `/contracts/imports/[jobId]` | Contextual | Workspace-scoped import-job detail and recovery. |
| `/accounts` | Boundary | Safe account-workspace boundary, not a Core workspace module. |
| `/counterparties` | Boundary | Safe counterparty-workspace boundary, not a Core workspace module. |

Required disposition corrections:

| Route | Required release disposition |
| --- | --- |
| `/early-access` | Merge into `/request-access`; no separate public positioning. |
| `/contracts/renewals` | Merge into `/renewals`. |
| `/contracts/evidence-studio` | Merge into `/evidence`. |
| `/contracts/exceptions` | Merge or contextualize into Tasks and contract detail; no standalone Core module. |
| `/settings/operations` | Omit for ordinary release users unless reclassified. |
| `/settings/health` | Internal operator surface. |
| `/settings/product` | Internal operator surface. |
| `/settings/policy` | Omit for ordinary release users unless reclassified. |
| `/more` | Omit; it must not become a catch-all public or Core discovery surface. |

Generated route-universe and feature-registry obligations:

- `/renewals` and `/evidence` must exist as page routes or equivalent canonical
  page entries before nested renewal/evidence compatibility routes are treated
  as compliant.
- `/more` must not be classified as public, Core, sitemap-eligible, searchable,
  command-palette-visible, or navigation-visible.
- `/dashboard/persona` is Contained unless this document reclassifies it. It is
  not ordinary Core dashboard behavior.
- `/settings/operations` is Omit, `/settings/product` is Internal, and
  `/settings/health` is Internal unless detailed route sections are changed.
- `/decisions` is Contained, not public, not external, and not ordinary Core.
- Layout inheritance, route-group defaults, generated fallbacks, and feature
  registry defaults must not override the route disposition above.

Code-owned checks must fail on these deltas until the artifacts are aligned.
Updating this Markdown without updating the executable route and feature
artifacts is not release completion.

The route manifest must include every row in the Release Route Behavior Map.
After adding the operator access-review route, the expected page-route contract
count is 87 unless this document intentionally adds, removes, or merges a route.
Implementation artifacts that still count 79 release routes are stale.

### Check Calibration Requirements

The release checks must be calibrated to this document, not to older route,
marketing, billing, API, notification, or hidden-surface assumptions.

- Route-universe checks must fail when a route in the Release Route Behavior Map
  is missing, has the wrong status, inherits public/external mode incorrectly, or
  allows ordinary Core Admin access to Omit, unauthorized Internal, or
  non-entitled Contained routes.
- Release-state implementation-objective checks must fail when the route count,
  route set, or route dispositions differ from this document unless a named
  code-owned compatibility mapping preserves the same behavior.
- Public SEO checks must fail when the sitemap or public metadata includes auth,
  signup, recovery, callback, external-token, early-access compatibility, app,
  hidden, Internal, Contained, Omit, or Merge routes outside the public set in
  Canonical URL And Compatibility Behavior.
- OpenAPI checks must distinguish route coverage from schema coverage. Passing
  path/method parity is not enough for release API contract acceptance.
- Billing checks must fail when trial/free/evaluation/sandbox/provider labels
  appear in customer-visible copy, CTAs, badges, checkout behavior, or emails
  without mapping to this document's billing/access states.
- Notification checks must fail on generated artifact drift, unclassified runtime
  templates, missing canonical route targets, hidden-route deep links, and
  recipient/route eligibility mismatches.
- Hidden-surface checks must fail when broad admin bypasses, feature-registry
  defaults, route-group inheritance, search rows, command-palette rows, `/more`,
  report catalogs, or email links make hidden surfaces discoverable to ordinary
  Core users.
- Manual-boundary checks must fail or mark missing when they contain only a
  generic statement instead of itemized manual evidence for each external
  provider, legal, production, extraction-quality, or onboarding claim.

## Canonical Implementation Matrices

These matrices resolve the remaining implementation-driving ambiguity. They are
not runtime configuration, but code-owned route manifests, permission helpers,
tests, and evidence artifacts must be able to represent them.

### Release Verification Ladder

Release evidence must be sequenced so foundational safety is proven before broad
workflow polish.

| Tier | Release gate | Required before |
| --- | --- | --- |
| 0 | Route inventory, route dispositions, omitted/contained/internal direct-access behavior, auth boundary, and Global not found behavior. | Any external test user uses production. |
| 1 | Tenant isolation, role permission matrix, session/auth recovery, access grant validation, signup/invite state machine, and no account/workspace enumeration. | Any customer contract is uploaded. |
| 2 | Upload, import, extraction handoff, detail review, contract inventory/detail, dashboard, tasks, renewals, evidence, reports, and settings happy paths with recoverable failure states. | Any workspace is considered activated. |
| 3 | Billing/access states, checkout/portal/invoice provider proof, cancellation/past-due/read-only/export recovery, notification delivery/dedupe, external-token submission, report export/download safety. | Any user is charged. |
| 4 | Public legal/trust claim evidence, provider dashboard verification, production smoke, accessibility/responsive proof, hidden-surface positive/negative proof, and release evidence index completeness. | General release readiness is declared. |

Tier 0 and Tier 1 are non-negotiable safety gates. Tier 2 is the product-value
gate. Tier 3 is the paid-use gate. Tier 4 is the readiness and trust gate.

### Evidence Priority Tiers

| Priority | Evidence class | Missing evidence means |
| --- | --- | --- |
| P0 | Auth, route guards, tenant isolation, hidden-route denial, token secrecy, billing-charge safety, file/download access, destructive-action confirmation. | Release blocker. Disable route/action if not proven. |
| P1 | Core workflow success/failure, role-shaped UI/API behavior, upload/import/extraction/review, reports/exports, external tokens, notifications, billing state recovery. | Release blocker for paid customer use. |
| P2 | Accessibility, responsive behavior, visual polish, operator diagnostics, public proof screenshots, support recovery artifacts. | Release blocker only when the affected route is customer-visible and materially impaired. |
| P3 | Future contained-surface visual polish, non-Core internal convenience tools, optional diagnostics, non-critical telemetry. | Not a Core blocker unless the contained route is intentionally enabled for a customer/workspace. |

Evidence priority does not weaken the behavioral contract. It defines sequencing
and release gating.

### Action Permission Matrix

| Action | Owner | Admin | Member | Viewer | Operator |
| --- | --- | --- | --- | --- | --- |
| View Core workspace data | Yes | Yes | Yes | Yes | Support-scoped only |
| Upload contract | Yes | Yes | Yes | No | Support-scoped only |
| Import contracts | Yes | Yes | Yes | No | Support-scoped only |
| Confirm/edit contract details | Yes | Yes | Yes | No | Support-scoped only |
| Mark detail unknown/skip | Yes | Yes | Yes | No | Support-scoped only |
| Archive contract | Yes | Yes | No by default; explicit Owner-enabled policy only | No | Support-scoped only |
| Hard-delete contract/file | Yes | Yes | No | No | Support-scoped only |
| Create/edit task | Yes | Yes | Yes | No | Support-scoped only |
| Complete/cancel task | Yes | Yes | Yes | No | Support-scoped only |
| Create evidence request | Yes | Yes | Yes | No | Support-scoped only |
| Review/accept/reject evidence | Yes | Yes | Yes | No | Support-scoped only |
| Upload evidence through workspace | Yes | Yes | Yes | No | Support-scoped only |
| Use external evidence token | Token-scoped | Token-scoped | Token-scoped | Token-scoped | Token-scoped |
| Preview reports | Yes | Yes | Yes | Yes | Support-scoped only |
| Export reports/inventory | Yes | Yes | No by default | No by default | Support-scoped only |
| Send reports by email | Yes | Yes | No by default | No | Support-scoped only |
| Invite users | Yes | Yes | No | No | No customer-facing action |
| Change member roles | Yes | Yes, except Owner controls | No | No | No customer-facing action |
| Remove users | Yes | Yes, except Owner controls | No | No | No customer-facing action |
| Transfer ownership | Yes | No | No | No | No customer-facing action |
| Manage billing/checkout/portal/cancel | Yes | Yes | No | No | No customer-facing action |
| Manage workspace security settings | Yes | Yes | No | No | Support-scoped only |
| Full workspace export/delete | Yes | No | No | No | Support-scoped only with owner authorization |
| Access Internal routes | No | No | No | No | Yes, with explicit operator authorization |
| Access Contained routes | Only if entitled and role-allowed | Only if entitled and role-allowed | Only if entitled and role-allowed | Read-only if explicitly entitled | Support-scoped only |

"Support-scoped only" means explicit operator authorization, tenant scope,
redaction, reason/support context where required, audit, and no ordinary
customer role picker.

### Billing And Access State Matrix

| Workspace/access state | Visible product access | Mutations | Billing actions | Export/recovery | Notes |
| --- | --- | --- | --- | --- | --- |
| `access_requested` | No workspace access. | None. | None. | Contact/request received state only. | Request creates no account, workspace, subscription, trial, or grant. |
| `grant_issued` | Signup/invite completion only. | Account/workspace creation or membership acceptance only. | None. | Grant resend/revoke by operator/admin. | Email-bound, single-use, revocable, expires after 14 days. |
| `setup_incomplete` | Setup and upload/import/review path for authorized admins. | Setup, upload/import, review actions allowed according to role and billing state. | Checkout only if provider-backed and required. | Contact recovery. | First approved user is Owner. |
| `approved_unpaid_activation` | Core access for bounded activation only. | Upload/review capable during code-owned activation window. | Owner/Admin checkout when configured. | Export/contact recovery. | Not marketed as a free trial. |
| `active_paid` | Full Core access within limits and entitlements. | Allowed by role. | Portal, invoice, cancel, payment update for Owner/Admin. | Export by role. | Default paid state. |
| `past_due` | Read-only Core access. | New uploads/imports/reviews/work/evidence/report sends blocked. | Billing recovery for Owner/Admin. | Export/contact recovery. | No data deletion solely because payment is past due. |
| `canceled_retention` | Read-only Core access during retention window. | Ordinary mutations blocked. | Reactivation/recovery only when provider-backed. | 30-day export/contact recovery. | Cancellation effective at provider period end unless provider returns earlier date. |
| `suspended` | Read-only or denied depending on reason. | Blocked except recovery actions. | Recovery/contact. | Export/contact unless prohibited-use/security issue prevents it. | Suspension reason must be safe and non-leaking. |
| `deleted` | No ordinary workspace access. | None. | None. | Owner/admin recovery only during explicit deletion window when supported. | Minimal audit tombstone retained. |
| `test_or_operator_exempt` | Test/operator access only. | Allowed only in non-customer or operator-scoped contexts. | No customer billing. | Test/operator evidence only. | Must be code-owned and not apply to customer workspaces by default. |

The approved unpaid activation window must be code-owned. If no activation-window
constant exists, approved unpaid workspaces must require checkout before customer
contract upload.

### Canonical Entity Field Catalog

| Entity | Required behavior-driving fields |
| --- | --- |
| Access request | id, email, normalized email, name, company, fit answers/context, status, duplicate/request history, submitted at, latest update at, reviewer, decision reason, safe contact notes. |
| Access grant | id, type, target email, workspace creation or existing workspace scope, role when invite, status, token hash/reference, issued at, expires at, revoked at, consumed at, issuer, resend lineage. |
| Workspace | id, name, owner, lifecycle/access state, billing state, timezone, active-contract count, seat count, entitlement set, setup state, created at, updated at, deletion/retention state. |
| Membership | id, workspace, user, canonical role, provider/legacy role mapping, membership state, invited by, joined at, removed/disabled at, historical attribution label. |
| Contract | id, workspace, title/name, counterparty, type, owner state, lifecycle state, source/import context, review summary, key dates, task/evidence signals, created/updated timestamps, archive/delete state. |
| Contract file | id, workspace, contract, safe display name, file type, size, storage reference, upload actor, processing state, extraction state, retention/delete state, created/updated timestamps. |
| Confirmed detail | id, contract, detail key, value, value type, source snippet/citation when available, confidence metadata when shown, review/trust state, actor, reviewed/updated timestamps, stale reason. |
| Task | id, workspace, contract/object link, type, title, description/notes when supported, owner/assignee, status, priority/urgency, due date, source trigger, created/updated/completed timestamps. |
| Renewal/notice item | id, contract, date type, date value, provenance, reviewed/calculated state, notice basis when calculated, owner, next action, related task, reminder state. |
| Evidence request | id, workspace, contract/requirement/task context, requester, recipient, file/non-file mode, title, due date, status, token scope, received files/responses, review outcome, closure state. |
| External token | id/reference, token hash, workspace/object scope, recipient context, requested action, permissions, expiry, status, submission count, redacted display metadata, audit/activity links. |
| Import job | id, workspace, source file reference, status, row/column counts, accepted/rejected/duplicate counts, diagnostics, initiator, started/completed timestamps, retry lineage. |
| Report run/export | id, workspace, report type, filters, freshness state, row count, status, initiator, output reference, expiry, download/send state, CSV safety marker. |
| Notification | id, workspace, type, trigger entity, recipient, channel, dedupe key, status, attempts, sent/failed timestamps, safe deep link, suppression reason. |
| Activity/audit event | id, workspace, actor type/id, event type, affected entity, timestamp, safe user summary, operator/audit details when authorized, redaction class. |
| Billing/access state | workspace, provider customer/subscription references when configured, plan/price, state, current period dates, checkout/portal availability, invoice/payment state, dunning/recovery state. |

### API Endpoint Contract Matrix

The code-owned API contract inventory must map actual handlers to these families
and fill exact method/path/request/response details.

| API family | Required endpoint contracts |
| --- | --- |
| Public forms | Access request create/update duplicate, contact create, security/report intake if present, telemetry intake if present; each with validation, rate limit, non-enumeration, safe success/failure. |
| Auth/signup | Login callback, signup grant validation, signup completion, password recovery request, password reset completion, invite acceptance; each with invalid/expired/revoked/used/wrong-email/existing-account states. |
| Workspace setup | Setup read/update, timezone/defaults update, first upload/import handoff, setup completion/skip when allowed. |
| Contracts | List/search/filter, create/upload, detail read, update confirmed data, archive/restore/delete, file download/delete, activity read. |
| Imports | CSV validate/start, job status/detail, row diagnostics, retry/cancel where supported. |
| Extraction/review | Extraction status/retry, review queue, confirm/edit/mark-unknown/skip, source preview access. |
| Tasks/renewals/evidence | Task CRUD/state transitions, renewal/notice actions, evidence request create/update, evidence upload/receive/review/close. |
| External tokens | Token status, token submit file, token submit non-file response, token terminal state. |
| Reports/exports | Report preview, report run/export start, report job status, download, send if supported, calendar export if supported. |
| Settings/team/security | Workspace settings, profile/security controls, team invite/resend/revoke/role/remove, notification preferences, import/export settings. |
| Billing | Checkout start, portal start, invoice list/download, cancellation, billing webhook, billing sync/recovery state. |
| Operator/internal | Access-request review, grant issue/resend/revoke, health/readiness, diagnostics, maintenance actions, contained-surface support; all with operator auth, audit, redaction, no ordinary discovery. |
| Background/cron | Import cleanup, extraction/read-model refresh, renewal recompute, reminders, evidence follow-up, report generation, notification retry, billing sync, retention cleanup. |

Every endpoint contract must specify auth boundary, tenant scope, input schema,
output shape, error shape, idempotency/race-safety behavior, timeout/concurrency
limits, cache/download headers, side effects, and evidence identifiers.

An OpenAPI file, route handler inventory, or generated API list is complete only
when it contains the actual method/path contracts above. An inventory with
generic descriptions, missing request bodies, missing query schemas, missing
response schemas, missing error shapes, or no schema references is route
inventory evidence, not a release API contract.

If API documentation is exposed outside the implementation team, it must be
generated from an explicit public API allowlist. Internal, operator,
diagnostic, webhook, cron, omitted, contained, Advanced, Assurance, and
compatibility-only endpoints must be excluded or marked unavailable unless a
separate external API product decision is added to this document.

### Route Contract Depth Matrix

| Route class | Required route-section depth |
| --- | --- |
| Public marketing/legal | Purpose, allowed claims, CTA/link targets, form behavior if present, non-claims, success/failure states, trust/legal evidence. |
| Auth/signup/recovery | Grant/session context, validation states, non-enumeration, redirects, recovery states, provider-disabled states, evidence. |
| Core primary app | Auth/workspace/role, table/list/card contents, filters/query schema, primary actions, mutations, empty/loading/degraded/denied states, side effects, evidence. |
| Core contextual/detail | Owning workflow, entity params, object-not-found behavior, role/tenant checks, state transitions, source/activity context, recovery, evidence. |
| Merge route | Canonical target, preserved params, redirect/thin-wrap rule, hidden discovery exclusions, evidence. |
| Admin/settings | Role boundary, read-only fallback, sensitive action step-up, provider-disabled states, audit/activity, evidence. |
| Operator | Operator auth, global or tenant support scope, safe queue/detail content, decision actions, audit/activity, redaction, no ordinary discovery/direct access, manual/provider recovery where relevant, evidence. |
| Internal | Operator auth, support scope, redaction, audit, no ordinary discovery/direct access, evidence. |
| Contained | Entitlement/mode, role boundary, support and billing/no-charge treatment, ordinary-user Global not found, non-discovery, positive/negative evidence. |
| Boundary/error/loading | Trigger, safe copy, recovery links, no sensitive leakage, cache behavior, accessibility evidence. |

### Contained Surface Operability Matrix

| Contained family | Core release state | Operability allowed when | Core-user outcome |
| --- | --- | --- | --- |
| Advanced contract intelligence | Not Core narrative, nav, search, pricing, onboarding, dashboard, reports, or email. | Dev/Test, Operator support, or explicit contained workspace entitlement. | Global not found and no discovery. |
| Decisions/campaigns/relationship workspaces | Not Core release product category. | Explicit contained entitlement and support/billing treatment. | Global not found and no discovery. |
| Account/counterparty workspaces | Counterparty context stays inside contract inventory/detail for Core. | Explicit contained entitlement or future reclassification. | Global not found for detail roots; safe boundary for root routes. |
| Assurance/control/risk surfaces | Not Core release positioning. | Explicit contained entitlement, trust boundary, support/billing treatment, and no public compliance claim. | Global not found and no discovery. |
| Advanced/Assurance APIs/background jobs | Not Core user-facing behavior. | Code-owned contained/Dev/Test/Operator context with tenant, role, provider, and audit checks. | `404` or Global not found API shape. |

Contained operability is not evidence of Core readiness. A contained family
becomes Core only by explicit reclassification plus route, API, permission,
billing, support, trust, and evidence updates.

## Surface Vocabulary

Preferred public and Core terms:

- signed contract requirements
- what signed contracts require next
- accountable contract tasks
- contract tracking
- signed agreements
- contract tracker
- spreadsheet
- suggested contract details
- confirmed contract details
- contract details to confirm
- source-backed suggestions
- owners
- renewal dates
- notice deadlines
- contract requirements
- approvals
- problems
- evidence
- tasks
- reports
- export

Use carefully:

- AI, only as source-backed suggestions reviewed by the user.
- Evaluation, only when it describes a real access or billing state. Do not use
  it as a synonym for beta, trial, pilot, or uncertain product maturity.
- Approved access, only to describe access control on request-access, signup
  recovery, pricing, billing, security, legal, and account state surfaces.
  Reviewed access may appear only when the review step itself is the subject.
  Neither phrase is the homepage or product headline, and neither should become
  a repeated brand phrase in ordinary product copy.

Avoid in public and Core release surfaces:

- beta
- waitlist
- early access
- founder-led access
- pilot
- autonomous
- legal AI
- legal advice
- CLM replacement
- governance
- controls
- compliance automation
- Assurance
- Autopilot
- platform, unless immediately narrowed to tracking what signed contracts
  require next
- enterprise-ready
- guaranteed
- SLA
- dedicated success team
- introductory pricing
- founding customer pricing
- contact us for price, unless a later pricing decision explicitly removes the
  public Core price

Presentation translations:

- Internal `field`/`extracted field` concepts render as contract detail,
  suggested detail, or detail to confirm in normal Core UI.
- Internal `work` route and work-item concepts render as Tasks except where a
  developer-facing route, artifact, or compatibility note must name `/work`.
- Internal `obligation` renders as Contract requirement.
- Internal `exception` renders as Problem.
- Internal `blocked` or generic `waiting` renders as Cannot proceed when shown
  to ordinary Core users.
- Internal `computed` date state renders as Calculated when shown to ordinary
  Core users.

## Known Non-Claims

Oblixa must not claim or imply:

- Legal advice, legal review, legal interpretation, or recommended legal action.
- Guaranteed extraction accuracy.
- Guaranteed renewal, notice, contract requirement, or evidence capture.
- Autonomous decisions, autonomous execution, or risk authority.
- Compliance findings, certification, control effectiveness, or assurance
  conclusions.
- Formal enterprise security certification, SLA, procurement readiness, or
  managed implementation unless separately supported.
- Full CLM replacement, drafting, negotiation, redlining, or e-signature.
- Managed migration, spreadsheet cleanup, or dedicated customer-success coverage.
- Fixed support response times, security-questionnaire completion, or formal
  onboarding calls as default release promises.

## Route Status Terms

- **Ship**: visible release surface.
- **Ship gated**: visible only to approved, signed-in, or invited users.
  This is a route-access classification, not public product positioning.
- **Ship simplify**: visible or reachable release surface with intentionally
  narrow, production-quality content. It never means stub, placeholder, or
  unfinished.
- **Contextual**: reachable from a relevant workflow or direct link, not primary
  navigation.
- **Admin**: workspace-admin surface.
- **Internal**: operator-only surface. Unauthorized direct access renders Global
  not found.
- **Merge**: substantive content belongs in another release surface.
- **Omit**: hidden from ordinary release users. Direct access by ordinary
  release users renders Global not found. Omit is a release-user classification,
  not proof that implementation cannot exist for development, QA, or explicitly
  authorized operator access.
- Use **Omit** when the route is not intended to be operable for any
  customer/workspace context in the Core release.
- **Boundary**: error, not-found, loading, auth-callback, or layout boundary.
- **Contained**: implementation can exist for contained workspaces or future
  modules, and can be accessed for development/QA under explicit controls, but
  is not a release promise for Core users. Ordinary Core direct access renders
  Global not found.
- Use **Contained** instead of **Omit** when a non-Core surface is intentionally
  operable for a specific entitled workspace, workspace mode, customer context,
  or future module validation.

Status vocabulary rules:

- Code-owned artifacts may retain older or implementation-specific labels only
  when those labels map unambiguously to the statuses above.
- `hide_for_release`, `hidden_for_release`, `future`, or similar labels map to
  **Contained** only when Dev/Test, Internal operator, or explicit contained
  workspace access is intentionally supported. Otherwise they map to **Omit**.
- `admin_only` maps to **Admin** only for customer workspace-admin surfaces. It
  maps to **Internal** when the route is for operator diagnostics, maintenance,
  product configuration, policy registry, or support-only access.
- `internal_only` maps to **Internal** only when unauthorized users receive
  Global not found and ordinary customer Admin cannot bypass the route.
- `redirect_or_merge` maps to **Merge** only when the route has a named
  canonical target, preserves only validated route/query state, and is excluded
  from sitemap, public metadata, navigation, search, command palette, onboarding,
  dashboard cards, emails, and report catalogs unless the detailed route section
  explicitly allows a compatibility link.
- `edge`, `experimental`, `preview`, `advanced`, `assurance`, and
  `workspace_mode_only` are not route statuses. They must be translated into
  Ship, Ship gated, Contextual, Admin, Internal, Omit, Merge, Boundary, or
  Contained before route guards, navigation, sitemap, search, emails, or tests
  use them.
- Customer Admin is not a hidden-route bypass status. A customer Admin remains
  an ordinary Core user for Omit, unauthorized Internal, and non-entitled
  Contained routes unless an explicit contained-workspace entitlement or
  operator authorization applies.

Substantive routes are routes that let a user, operator, external participant,
or system create, view, mutate, export, notify, bill, authenticate, administer,
or shape the public promise. This document covers substantive page families in
detail and route-handler families by release boundary.

## Route Entry Schema

Each substantive page route must be implemented against these contract fields:

- Status.
- Release role.
- Direct access behavior.
- Auth/session requirement.
- Workspace requirement and workspace lifecycle behavior.
- Required roles and permission checks.
- Entity parameters and query schema.
- Provider or entitlement dependencies.
- Visible contents.
- Primary actions.
- Relevant canonical states, transitions, permissions, validation boundaries, and
  side effects when the route owns them.
- Empty, loading, degraded, invalid, or denied states where relevant.
- HTTP/redirect/header behavior where relevant.
- API/background jobs or provider calls triggered by the route.
- Activity/audit, notification, export, billing, or destructive side effects.
- Exclusions.
- Acceptance condition.
- Required verification evidence, either in the route section, the cross-route
  Technical Behavior Specification, or a code-owned evidence index aligned to
  this document.

Route sections may remain readable, but implementation evidence must be able to
answer every field above. If a route section omits a field, the global Technical
Behavior Specification supplies the default. If neither the route section nor the
global contract supplies the behavior, the behavior is out of release scope until
specified.

Route behavior language describes the intended user-visible and technical
outcome. It may prescribe guards, canonical state names, redirects, safe terminal
states, status-code class or exact status when behaviorally material, cache and
download headers, query validation, provider-disabled behavior, and verification
evidence. It should avoid prescribing framework APIs, component names, exact
database schema, or test assertion syntax unless the exact detail is part of the
intended product, compatibility, security, or evidence contract.

Every route with status **Ship**, **Ship gated**, **Ship simplify**,
**Contextual**, or **Admin** must define usable empty, loading, recoverable
error, unauthorized/denied, and no-data states when those states can occur.

If a route entry omits direct access behavior, use these defaults:

- Public marketing and legal pages are directly accessible.
- Auth pages redirect authenticated users when a session makes the page
  irrelevant.
- Core app pages require an authenticated workspace and role authorization.
- Contextual routes are reachable from owning workflows or direct links only.
- Admin routes require workspace-admin authorization.
- Internal routes require explicit operator authorization.
- Omitted routes are hidden from ordinary users and render Global not found
  without leaking private module data.
- Contained routes render Global not found for ordinary Core users and render
  only for explicitly entitled workspaces/users.
- Boundary routes render only safe recovery states.

## Global Release Rules

- Primary public promise: tracking what signed contracts require next.
- Primary app promise: every visible surface helps a user answer what exists,
  what is trusted, who owns it, what is due, what needs response, what proof
  exists, and what can be exported.
- Primary navigation contains exactly Dashboard, Contracts, Tasks, Renewals,
  Evidence, Reports, and Settings.
- Search and command palette may expose Core pages, Core queues, Core reports,
  and Core tools only when the user can access them.
- Hidden routes must not appear in primary navigation, global search, command
  palette, onboarding, pricing, public pages, email, dashboard cards, empty
  states, or upgrade prompts.
- Advanced and Assurance implementation can exist, but it must not define the
  public release narrative.
- Hidden, contained, Advanced, Assurance, and Internal surfaces may be accessed
  only through the Dev/Test, Internal operator, or Contained workspace contexts
  defined by the Hidden Surface Development And Test Access rules.
- Spreadsheet replacement is the migration wedge, not the whole product
  category.
- Public pages should use actual product proof where possible. Dashboard, Review
  queue, Contracts, Tasks, Renewals, Evidence, and Reports screenshots are
  stronger than abstract diagrams.
- Product copy should avoid "platform" unless the surrounding text immediately
  narrows it to tracking what signed contracts require next.
- Documentation is not proof of release readiness. Current runtime behavior,
  route guards, tests, rendered UI, and production configuration are the
  authoritative proof.

## Data Confidence States

Any page showing extracted or imported contract data should distinguish:

- **Reviewed**: accepted or corrected by an authorized user; can drive
  operational queues, reports, reminders, and exports.
- **Suggested**: extracted or imported value awaiting review; may appear in
  review surfaces and detail context, but should not be presented as trusted
  data.
- **Source-backed**: a suggested or reviewed value with a cited source snippet
  that is present and locatable in the source material.
- **Missing**: expected field absent or not found.
- **Unknown**: user intentionally marked the value unknown.
- **Calculated**: derived from reviewed or imported inputs; must label the
  source of calculation when it affects deadlines or reports. Internal
  `computed` state may remain, but ordinary Core UI presents the label as
  Calculated.
- **Unverified**: imported or inferred value that has not been reviewed.
- **Model confidence**: extraction metadata only. It is never equivalent to
  reviewed, source-backed, or operationally trusted.

Display rules:

- Reports, renewals, dashboard cards, task queues, and evidence workflows should
  prefer reviewed data.
- Suggested or unverified values need visible state labels before they influence
  next actions.
- Suggested values without located source support must not be called
  source-backed.
- Source snippets or source-preview links should be available where the user is
  asked to approve or correct a value.
- Missing and unknown states should be actionable when the user has permission to
  edit or review.

## Public Routes

### `/`

Status: Ship.

Release role:

- First impression.
- Makes the "what signed contracts require next" premise obvious.
- Uses spreadsheets, folders, inboxes, and memory as the concrete migration
  pain.
- Sends qualified users to request access without implying the product is a
  prototype.

Direct access behavior:

- Publicly accessible.
- Primary CTA goes to the request-access route.
- Secondary CTA goes to the product tour.

Contains:

- H1: "Track what signed contracts require next."
- Subheadline matching the primary subheadline above.
- Primary CTA: "Request access."
- Secondary CTA: "View product tour."
- Risk reducer: access is reviewed for teams replacing manual contract
  follow-up; export anytime; no annual commitment unless billing actually
  requires one.
- Product proof showing the real workflow or faithful mock views.
- Problem section: renewal and notice dates in spreadsheets, contract
  requirements buried in PDFs, unclear owners, follow-up in email, evidence hard
  to collect, reports rebuilt by hand.
- Workflow section: upload/import, confirm suggested contract details, assign
  owners and dates, turn requirements into tasks, request evidence,
  report/export.
- Outcome section: contracts needing review, upcoming renewals and notices,
  owned work, evidence status, exportable reports.
- Buyer-outcome section or equivalent proof: avoid missed renewal or notice
  follow-up, assign owners, prove follow-up, collect evidence, and stop
  rebuilding reports from scratch.
- Best-fit section: signed contracts already exist; manual tracker is becoming
  unreliable; the first useful workspace can start small.
- FAQ covering CLM boundary, no legal advice, starting small, file types, AI
  review, AI-provider/file handling, export, deletion/contact recovery, and paid
  continuation.

Excludes:

- Free-trial claim.
- Guaranteed workspace access for every request.
- Enterprise procurement, formal compliance, Autopilot, Assurance, GRC, or
  autonomous-agent claims.

Acceptance:

- A qualified visitor understands the product without reading another page.
- The page feels like a focused product, not a beta invitation.
- CTAs lead to the access request and product tour.

### `/product`

Status: Ship.

Release role:

- Demonstrates that Oblixa is an operational product, not only a promise.
- Reduces ambiguity before access request.

Direct access behavior:

- Publicly accessible.
- CTAs return to request access or relevant public trust pages.

Contains:

- Product-tour H1 focused on what signed contracts require next.
- Phase 1: bring contracts out of spreadsheets, folders, inboxes, and memory.
- Phase 2: upload signed PDFs/DOCX files and import CSV tracker rows.
- Phase 3: confirm source-backed suggested contract details.
- Phase 4: track renewal, notice, termination, effective, and end dates.
- Phase 5: assign tasks across follow-up, approvals, contract requirements, and
  problems.
- Phase 6: request and track evidence tied to contracts or requirements.
- Phase 7: run and export operational reports.
- Product visuals or mockups that match the actual Core product.
- A visible first-use path from bounded upload/import to confirmed details,
  owners, dates, tasks or evidence, and report/export.
- CTA to request access.

Excludes:

- Repeating the homepage H1 as the page H1.
- Pre-signature contracting, drafting, redlining, e-signature, legal advice,
  GRC, or enterprise assurance.
- Abstract AI positioning disconnected from the review workflow.

Acceptance:

- A visitor can describe how a contract moves from file or CSV row to reviewed
  record, owned work, evidence, and report.

### `/request-access`

Status: Ship simplify.

Release role:

- Canonical public access-request route.
- Captures enough fit information for asynchronous access review.
- Keeps access requests separate from account creation.

Direct access behavior:

- Publicly accessible.
- Authenticated users with workspace access continue to their workspace.
- Submission creates an access request or contact record, not a user account,
  workspace, or billing object.

Contains:

- H1: "Request access."
- Fit framing: Oblixa is for teams replacing manual signed-contract follow-up;
  access is reviewed because contract data is sensitive and the first workspace
  should start bounded.
- Form fields sufficient to judge fit:
  - name, work email, company, role;
  - number of signed contracts;
  - current tracking method;
  - top pain: renewals, owners, requirements, evidence, reporting, or tasks;
  - whether a small contract set can be used first;
  - whether the requester can be the accountable workspace owner or name that
    owner;
  - whether the team can use async email/in-app support for activation;
  - whether a formal procurement or security questionnaire is required before
    first upload;
  - optional notes.
- Qualification copy that favors teams with real signed agreements, manual
  follow-up pain, a clear workspace owner, and a bounded first set.
- Boundary copy that excludes drafting, e-signature, legal review, managed
  migration, enterprise procurement, and formal security-certification needs.
- Pricing expectation copy that makes paid Core continuation clear without
  charging, creating checkout, or presenting price negotiation during request.
- Post-submit success state saying the request was received.
- Post-submit failure state without infrastructure details.
- Clear expectation that access is reviewed and not automatic.

Excludes:

- Password creation before access is approved.
- Promise of workspace access for every requester.
- Operational instructions about how requests are reviewed.
- Enterprise procurement intake.
- Managed migration or spreadsheet cleanup promises.

Acceptance:

- Users see an access request for a serious paid product, not a waitlist, beta,
  scarcity funnel, or public signup flow.
- The form captures enough information for asynchronous access review.

### `/early-access`

Status: Merge.

Release state:

- Compatibility URL only.
- Redirects to `/request-access`.
- Does not render a separate public surface.
- Does not accept a form submission directly.

Direct access behavior:

- Publicly reachable only as a compatibility URL.
- Redirects to `/request-access` before rendering page content.
- Uses `/request-access` as the canonical metadata target.
- Is excluded from sitemap, structured-data offers, primary CTAs, and public
  route inventories that represent the intended acquisition surface.
- Authenticated users with workspace access follow the `/request-access`
  authenticated-user behavior after redirect.

Excludes:

- Page-specific content.
- Form handling.
- Visible "early access" or "founder-led" positioning.

Acceptance:

- Users reaching the compatibility URL land on the canonical request-access
  surface without seeing early-access positioning.

### `/pricing`

Status: Ship simplify.

Release role:

- Makes paid use credible.
- Reduces uncertainty without inventing unsupported enterprise packaging.

Direct access behavior:

- Publicly accessible.
- CTAs go to request access or contact.
- No direct checkout is exposed unless checkout is configured and intentionally
  public.

Contains:

- H1: "Simple pricing for contract follow-up."
- Statement that approved access can start with a bounded workspace and Core is
  paid monthly when Oblixa becomes part of the workflow.
- One Core paid offer: $249/month per workspace.
- Included public limits: up to 500 active contracts and 10 active workspace
  users.
- Note that this is the intended release price and may change only through an
  explicit pricing decision reflected in product copy and billing artifacts.
- No "starting at," "founding customer," "introductory," "pricing being
  finalized," or "contact us for price" framing.
- Larger contract sets or teams handled during access review without creating a
  public enterprise tier.
- Price and included limits are visible before requesters submit payment
  information; no charge occurs before approval and explicit checkout.
- Included Core capabilities: upload/import, source-backed review, renewals,
  notices, owners, requirements, evidence, tasks, reports, CSV export, support
  during approved access.
- Not included: legal review, drafting/redlining, e-signature, managed migration,
  spreadsheet cleanup, enterprise procurement, formal SLA, Advanced, Assurance.
- CTA to request access and secondary link to contact.

Excludes:

- "Pricing is being finalized" as the main message.
- Three-tier public matrix unless all tiers are real and supported.
- Annual default, procurement workflow, custom enterprise support, or non-Core
  upsells.

Acceptance:

- An appropriate workspace requester understands the product is paid-capable.
- The requester knows the Core price before applying or checking out.
- No plan sells a hidden or unsupported surface.

### `/contact`

Status: Ship simplify.

Release role:

- Handles narrow access, pricing, security, support, and general questions.
- Gives users a simple async contact path.

Direct access behavior:

- Publicly accessible.
- Submission creates a contact record only.
- Success and failure states stay on the page.

Contains:

- H1: "Contact Oblixa" or "Ask about Oblixa."
- Short statement that contact is asynchronous.
- Name, work email, company, and message fields.
- Optional contract-count, current-tracker, current pain, or follow-up
  preference fields when the page is used for access-fit context.
- Link to request access for users ready to apply.
- Links to product, pricing, and security pages for users who need page-level
  context before writing.
- Success state.
- Failure state without provider details.

Excludes:

- Enterprise procurement promise.
- Full duplication of the request-access page.
- Mandatory call scheduling.

Acceptance:

- User can submit a narrow question or fit note without being forced into a
  procurement or call-scheduling flow.

### `/security`

Status: Ship.

Release role:

- Establishes enough trust for small-team contract-content upload and use.
- Sets supported security expectations without implying formal certification.

Direct access behavior:

- Publicly accessible.
- Security contact path is visible.
- No authenticated workspace data appears on the public page.

Contains:

- H1: "Security basics for contract records."
- Access and role model.
- Workspace scoping.
- Account security and sessions.
- Audit history.
- Export and deletion path.
- AI review boundary and AI-provider use for extraction.
- Data handling basics.
- Uploaded-file handling, retention, deletion, and export boundaries.
- Malware-scanning language only when scanning is actually configured for the
  release.
- Security contact path.
- Plain statement that the current release is not positioned for formal
  enterprise security review unless separately agreed.

Excludes:

- H1 language that foregrounds product immaturity.
- SOC, ISO, HIPAA, or certification claims unless actually supported.
- Assurance module promotion.

Acceptance:

- Claims are concrete, supportable, and not broader than the implementation.

### `/privacy`

Status: Ship.

Release role:

- Makes data handling clear enough for contract-content uploads.

Direct access behavior:

- Publicly accessible.
- No authenticated workspace data appears on the public page.
- Contact path for privacy, export, deletion, and data-handling questions is
  visible.

Contains:

- Data categories: account, workspace, uploaded files, contract records, usage,
  billing, contact/support data.
- Processing purposes.
- Providers/subprocessor posture.
- AI-provider use for extraction, including whether uploaded files or extracted
  text may be sent to a provider.
- Retention, export, deletion, and contact paths.
- User responsibility to upload only data they are authorized to process.
- Conservative wording for any provider, retention, deletion, storage,
  training-use, or security behavior that is not fully verified.

Excludes:

- Unsupported legal guarantees.
- Certification claims.
- Generic privacy claims disconnected from actual runtime/provider behavior.

Acceptance:

- A user can identify what data is processed and how to request export or
  deletion.
- Every substantive data-handling claim is supported by implementation,
  provider, legal, or named manual evidence.

### `/terms`

Status: Ship.

Release role:

- Defines the service relationship before account creation or paid use.

Direct access behavior:

- Publicly accessible.
- No authenticated workspace data appears on the public page.
- Contact path is visible.

Contains:

- Service use.
- Account and workspace responsibility.
- Customer-content responsibility.
- No legal advice.
- Approved-access, account-creation, paid-use, suspension, and availability
  boundaries.
- Payment terms if billing is enabled.
- Termination, suspension, disclaimers, liability limits, and contact.

Excludes:

- Enterprise SLA terms.
- Oblixa legal-review obligations.

Acceptance:

- Terms match the actual release scope and do not promise unsupported service
  levels.
- Terms do not describe the product as limited rollout, early access, beta,
  pilot, or founder-led access.

### `/acceptable-use`

Status: Ship.

Release role:

- Protects the service from abuse.
- Sets upload and usage boundaries.

Direct access behavior:

- Publicly accessible.
- No authenticated workspace data appears on the public page.
- Abuse/contact path is visible.

Contains:

- Prohibited illegal, harmful, abusive, infringing, or unauthorized use.
- No bypassing, scraping, overloading, or disrupting the service.
- No uploading data without the right to process it.
- Suspension/removal rights.
- Abuse contact path.

Excludes:

- Moderation operations detail that implies enterprise support.

Acceptance:

- A user can identify prohibited use and the reporting path.
- The page does not imply enterprise moderation, compliance review, or legal
  review by Oblixa.

### `/accessibility`

Status: Ship.

Release role:

- Supports trust and usability expectations.

Direct access behavior:

- Publicly accessible.
- No authenticated workspace data appears on the public page.
- Accessibility contact path is visible.

Contains:

- Accessibility commitment.
- Known limitations only if accurate.
- Contact path.
- Information requested to reproduce an access barrier.

Excludes:

- Formal conformance claim unless verified.

Acceptance:

- Page gives a concrete reporting path without overstating compliance.
- Any accessibility conformance claim is supported by manual or automated
  evidence.

### `/cookies`

Status: Ship.

Release role:

- Supports privacy transparency for public and authenticated surfaces.

Direct access behavior:

- Publicly accessible.
- No authenticated workspace data appears on the public page.
- Contact path is visible.

Contains:

- Essential cookies.
- Authentication/session cookies.
- Preferences, analytics, or marketing cookies only if actually used.
- Browser-management guidance.
- Contact path.
- Conservative wording for browser storage, analytics, or tracking behavior that
  is not verified.

Excludes:

- Cookie categories not used by the product.
- Vendor claims not reflected in implementation.

Acceptance:

- Cookie categories match runtime behavior.
- Preference controls appear only when backed by implementation.

## Auth And Account Routes

### `/login`

Status: Ship.

Release role:

- Returns approved users to the workspace quickly.

Direct access behavior:

- Publicly accessible when unauthenticated.
- Authenticated users redirect to dashboard or the originally requested
  workspace route.

Contains:

- Email/password sign-in.
- Forgot-password link.
- Request-access link.
- Returning-user copy focused on contract deadlines, owners, work, evidence, and
  reports.
- Redirect for authenticated users.

Excludes:

- Free-trial language.
- Product marketing that slows sign-in.

Acceptance:

- Existing user can sign in with minimal friction.

### `/signup`

Status: Ship gated.

Release role:

- Lets approved users or invited teammates complete account creation after
  workspace access has already been reviewed.
- Prevents unsupported self-serve workspace creation.
- Keeps signup secondary to request-access positioning.

Direct access behavior:

- Public URL, but not a public acquisition surface.
- Excluded from sitemap and public acquisition metadata.
- Requires a valid workspace-creation grant or workspace-invite grant before
  password creation is accepted.
- Without a valid grant, the route shows denial/request-access guidance and does
  not create a user account or workspace.
- Authenticated users redirect to dashboard or onboarding.
- Authenticated users with a valid workspace invite join the invited workspace
  after authentication, then proceed to setup or dashboard. Already-confirmed
  accounts do not receive a second confirmation email for this step.
- Approved first-workspace users proceed to Core setup or dashboard after the
  workspace is created.
- Approved first-workspace signup does not send or require a separate Supabase
  confirmation email. The grant link is single-use, email-bound, and consumed
  only for the account that receives the workspace.

Contains:

- Title: "Create your workspace account" or equivalent reviewed-access language.
- Signed access-grant or invite validation.
- No manual access-code field in the intended release UI. If a retained
  compatibility path exists, it is hidden from ordinary public users and never
  becomes visible product positioning.
- Email/password signup.
- Full name and company fields only when needed for account creation.
- Denied-access state with link to `/request-access`.
- Existing-account sign-in path when an invite targets an already registered
  email.
- Limited-access notice.

States:

- Valid workspace-creation grant.
- Valid workspace-invite grant.
- Invalid, expired, revoked, already-used, missing, or wrong-email grant.
- Existing account with valid invite.
- Account created but workspace setup incomplete.

Excludes:

- Promise that public signup creates a workspace.
- Signup as a top-level public CTA.
- Founder-led, early-access, beta, scarcity, or private-club framing.
- Access-request questionnaire content.
- Password creation for users whose access has not been approved.
- Product-mode picker.

Acceptance:

- Unapproved user is routed to request access.
- Approved user can create a confirmed account, enter Core setup, or enter the
  invited workspace.
- Invalid grant states do not create accounts or workspaces.

### `/forgot-password`

Status: Ship.

Release role:

- Reduces avoidable churn from account access loss.

Direct access behavior:

- Publicly accessible when unauthenticated.
- Authenticated users redirect to dashboard.
- Submission response is neutral whether or not an account exists.

Contains:

- Email field.
- Submit action.
- Neutral success state that does not reveal account existence.
- Login link.

Acceptance:

- Recovery flow avoids account-enumeration leakage.

### `/reset-password`

Status: Ship.

Release role:

- Completes account recovery.

Direct access behavior:

- Publicly accessible only with a valid recovery token/session.
- Invalid or expired access renders a recoverable state with a path back to
  forgot password or login.

Contains:

- New-password and confirm-password fields.
- Client-side mismatch handling.
- Completion state.
- Invalid/expired link state.
- Login link.

Acceptance:

- Valid reset completes and returns user to the workspace or sign-in.

### `/auth/callback`

Status: Boundary.

Release role:

- Completes provider/email auth handoff.

Direct access behavior:

- Token/callback-only route.
- Never appears in navigation, sitemap, command palette, or marketing content.
- Success redirects to the intended app destination; failure redirects to a safe
  auth recovery state.

Contains:

- Token/session processing.
- Safe redirect to dashboard, onboarding, or login.
- Recoverable failure redirect without raw provider errors.

Excludes:

- Visible marketing content.
- Raw error details.

## External Participant Routes

### `/external/[token]`

Status: Contextual.

Release role:

- Lets non-workspace participants complete requested evidence or follow-up
  without becoming workspace users.

Direct access behavior:

- Direct-link only through a scoped token.
- No app shell, workspace navigation, global search, settings, reports, or
  account creation.
- Expired, revoked, invalid, already-submitted, and inaccessible tokens show
  safe terminal states.

Contains:

- Token validation.
- Requested-action summary.
- Requested action mode:
  - file evidence upload as the primary external evidence use case;
  - structured non-file response or reference submission only when the owning
    workflow explicitly requests it;
  - status confirmation only when tied to the specific requested step.
- Due date, requester name/team, and minimal contract or requirement context when
  needed for the recipient to act.
- Contract/request/workflow context limited to recipient need.
- Participant fields only when needed.
- Submission form.
- Upload control with file requirement, accepted file types, size validation,
  progress, success, and recoverable failure states when file evidence is
  requested.
- Response/review controls when the token asks for a non-file answer.
- Confirmation screen after submission.
- Expired, invalid, already-submitted, revoked, and success states.

Excludes:

- App navigation.
- Unrelated workspace data.
- Marketing hero.
- Account-creation pressure.

Acceptance:

- Token recipient can complete the intended action and cannot browse workspace
  data.

### `/external`

Status: Boundary.

Release state:

- No standalone destination.
- Redirect to home or show a safe invalid-link state.
- No marketing, workspace, or account-creation content beyond safe recovery.

## Onboarding Routes

### `/onboarding/calibration`

Status: Ship simplify.

Release role:

- Gets a new workspace to useful defaults without exposing internal product
  architecture.
- Runs only for authorized workspace setup contexts.

Direct access behavior:

- Authenticated admin route.
- Non-admin users redirect to dashboard.
- Unauthenticated users redirect to login.
- Already-complete workspaces show a ready state with upload/import and
  dashboard links.

Contains:

- Visible title: "Set up your contract follow-up workspace."
- Questions for role, contract count, current tracking method, tracker
  availability, biggest tracking problem, important dates, owner assignment,
  reporting, and evidence needs.
- Save/continue state.
- Blocking state if setup is required before product use.
- Already-complete state that points to upload/import or dashboard.
- Recoverable save failure state without provider details.

Excludes:

- Visible "calibration" language in ordinary user-facing setup copy.
- Product-mode picker.
- Autopilot controls.
- Governance or assurance vocabulary.

Acceptance:

- User can complete setup quickly and proceed to upload/import.

## Core Primary Application Routes

### `/dashboard`

Status: Ship.

Release role:

- Primary retention surface.
- Shows immediate operational value after contracts are added.

Direct access behavior:

- Authenticated workspace route.
- Users without a workspace see a workspace-required state.
- Users blocked by required setup go to onboarding calibration.

Contains:

- Page identity: Contract tracking.
- Upload contract action.
- Import contracts action.
- Import-processing notice when relevant.
- Top cards in this order: Contracts needing review, Dates coming up, Tasks
  awaiting response, Contracts missing an owner, Contract problems, Evidence
  requests.
- Each top card has a count, icon, concise title, and explanatory sentence. The
  count must identify the represented object class in copy or tooltip rather
  than forcing users to infer whether it counts contracts, tasks, dates, or
  requests.
- Main sections: Details to Confirm, Dates Coming Up, Tasks Needing Action,
  Missing Details, and Recent Activity.
- Details to Confirm lists contracts whose suggested dates, owners, and terms
  still need confirmation before reminders and reports rely on them.
- Dates Coming Up lists approved or calculated renewal, notice, end, or
  effective dates that may need action soon.
- Tasks Needing Action lists tasks that need response, decision, approval, file,
  or owner.
- Missing Details groups missing owners, dates, or counterparties that weaken
  routing and reports.
- Recent activity.
- Empty state leading to upload/import and the review queue.

States:

- Empty: first contract upload/import CTA, explanation of confirmed contract
  details, no fake metrics.
- Populated: operational counts, queues, dates, tasks, missing details, and
  recent activity reflect workspace data.
- Metric cards link to the corresponding actionable surface, queue, or filtered
  view.
- Degraded: partial-data notice when imports, extraction, or report data is
  delayed.
- Loading: skeleton structure preserves card and queue layout.

Excludes:

- Advanced, Assurance, private-module cards.
- Product-mode badge or switch.
- Decorative analytics unrelated to next action.
- Decorative metrics that do not lead to a useful workflow.

Acceptance:

- Empty workspace points to first activation.
- Populated workspace shows next actions without requiring another page.

### `/contracts`

Status: Ship.

Release role:

- Primary working record.
- Replaces the spreadsheet inventory.

Direct access behavior:

- Authenticated workspace route.
- Row actions and export controls are role-gated.

Contains:

- Contract inventory table/list.
- Contract name, counterparty, type, owner, lifecycle/status, next date, review
  state, open task count, problem/evidence signals, updated time.
- Search across contracts, counterparties, owners, and tags.
- Date, status, owner, counterparty, type, renewal window, review state, missing
  data, open tasks, evidence, and health filters.
- Shortcut row labeled Contract shortcuts. The helper text states that each
  count is a contract count and that selecting a shortcut filters the table to
  contracts with that condition.
- Shortcuts: Open problems, Details to review, Missing dates, Evidence due, Open
  tasks, Renewal within 90 days, and Active. Shortcut counts count matching
  contracts across the inventory, not page-local rows and not related item
  totals.
- Shortcut definitions are visible near the chips:
  - Open problems: unresolved problems linked to the contract.
  - Details to review: suggested dates, owners, or terms awaiting confirmation.
  - Missing dates: required renewal, notice, end, or effective dates are absent.
  - Evidence due: open evidence request linked to the contract.
  - Open tasks: active follow-up tasks linked to the contract.
  - Renewal within 90 days: renewal date inside the next 90 days.
  - Active: contract status is active.
- Upload, import, export, and saved-view actions when complete.
- Empty state for adding signed contracts.

States:

- Empty: upload/import CTAs and no placeholder rows.
- Filtered empty: clear-filter action and retained filter context.
- Loading: stable table skeleton.
- Error/degraded: recoverable message without raw query/provider details.

Excludes:

- Passive repository framing where files matter more than tracked requirements,
  dates, owners, and tasks.

Acceptance:

- User can answer what contracts exist, who owns them, what needs review, and
  which dates matter.

### `/work`

Status: Ship.

Release role:

- Route path for the Core Tasks surface.
- Turns contract records into accountable action.
- Consolidates follow-up tasks, approvals, contract requirements, problems, and
  evidence requests.

Direct access behavior:

- Authenticated workspace route.
- Create/update actions require role authorization.

Contains:

- Eyebrow: Contract follow-up.
- Header: Tasks.
- Lead: Tasks are follow-up actions from signed contracts: approvals, evidence
  requests, contract requirements, and problems to resolve.
- Primary action to create a task if the workflow is complete.
- Summary band: Active tasks plus non-zero condition filters for Cannot proceed,
  Past due, Due within 7 days, and Unassigned.
- The summary copy states that active tasks are open follow-up items linked to
  signed contracts, and that condition filters show matching task counts and
  narrow the table when selected.
- Condition-filter definitions are visible:
  - Cannot proceed: answer, approval, file, or owner is missing.
  - Past due: due date has passed.
  - Due within 7 days: due today or this week.
  - Unassigned: no owner is assigned.
- Tabs: All active, Assigned to me, Past due, Cannot proceed, Approvals,
  Contract requirements, Problems to resolve.
- Filters for owner, due date, contract, status, and type.
- Sort by urgency and other implemented sort options.
- Rows with task title, contract, owner, due date, status, updated time, type,
  and primary action.
- Type labels: Task, Contract requirement, Approval, Problem, Evidence request,
  Renewal task, and Unassigned task.
- Status labels present `blocked` or `waiting` internal states as Cannot
  proceed.
- Presentation-only task-title cleanup avoids old extraction/blocker wording.
  Examples: "Approve extracted fields for X" becomes "Review contract details
  for X"; "blocked evidence" becomes "evidence request"; "blocker" becomes
  "hold."
- Actions for review, complete, assign, update, mark cannot proceed, resolve,
  and more menu only where backed by working mutations.
- Empty and filtered-empty states.

States:

- Empty: Create a task for a contract date, requirement, approval, problem, or
  evidence request.
- Filtered empty: clear filters without leaving the page.
- Degraded: counts may show partial-data state when work aggregation is delayed.

Excludes:

- Decision-intelligence, compliance, or risk-verdict framing.
- Autonomous prioritization claims.

Absorbs:

- `/contracts/tasks`.
- `/contracts/obligations`.
- `/contracts/approvals`.
- `/contracts/exceptions`.

Acceptance:

- User can identify past-due, cannot-proceed, assigned, and unassigned tasks in
  one place.

### `/renewals`

Status: Ship.

Release role:

- High-value Core use case.
- Reduces missed renewal/notice risk without claiming guarantees.

Direct access behavior:

- Authenticated workspace route.
- Export and task creation are role-gated.
- Existing `/contracts/renewals` URLs redirect or wrap into this route without
  creating a second Renewals product surface.
- If `/renewals` is not implemented as the canonical route, using
  `/contracts/renewals` as the primary destination is a temporary
  implementation gap, not a competing intended release URL.

Contains:

- Header: Renewals.
- Export renewal report action.
- Create renewal task action.
- Summary band eyebrow: Renewal and notice dates.
- Count label reads as dates in view, not abstract deadlines.
- Summary metrics render only non-zero action states such as Needs confirmation,
  Missing owner, and Notice window open.
- Summary definitions are visible:
  - Dates in view: renewal and notice deadlines inside the selected window.
  - Needs confirmation: renewal or notice date is missing, suggested, or
    calculated and still needs confirmation.
  - Missing owner: no person is assigned to the contract.
  - Notice open: notice period is currently open.
- Upcoming renewals table.
- Filters for due window, owner, counterparty, status, and Date status.
- Date status options: Confirmed, Suggested, Calculated, and Missing.
- Renewal date, notice deadline, owner, status, next action, and related
  tasks/evidence context.
- Confirmed, suggested, calculated, and missing provenance anywhere renewal or
  notice dates appear.
- Calculated date chips explain that the value is derived from the renewal date
  and notice window.
- Related chips are de-duplicated so the same row does not show the same related
  type twice.
- Long owner/email values truncate within stable table columns.
- Links to contracts and tasks.
- Empty state prompting date review or upload.

States:

- Empty: upload/import and review-date CTAs.
- Missing dates: show which contracts need renewal or notice review.
- Suggested dates: clearly marked as unreviewed and not operationally trusted.
- Calculated dates: clearly marked as derived and not equivalent to confirmed
  dates.
- Partial data: visible warning when date freshness or recompute state is
  degraded.
- Filtered empty: clear filters and preserve selected window.

Excludes:

- Guarantee that renewals cannot be missed.
- Decision-intelligence or legal recommendation framing.

Acceptance:

- User can see upcoming dates, source/review status, owner, and next action.

### `/evidence`

Status: Ship.

Release role:

- Supports proof collection for contract requirements and follow-up tasks.
- Differentiates Oblixa from a static tracker without becoming compliance
  automation.

Direct access behavior:

- Authenticated workspace route.
- Request, upload, review, and close actions are role-gated.
- Existing `/contracts/evidence-studio` URLs redirect or wrap into this route
  without creating a second Evidence product surface.
- If `/evidence` is not implemented as the canonical route, using
  `/contracts/evidence-studio` as the primary destination is a temporary
  implementation gap, not a competing intended release URL.

Contains:

- Header: Evidence.
- Request evidence action.
- Summary band: Evidence requests and total visible count.
- Tabs: Open, Overdue, Received, Linked requirements.
- Tab definitions are visible:
  - Open: requests not completed or accepted.
  - Overdue: open requests with a past due date.
  - Received: evidence has been submitted and may need review.
  - Linked requirements: requests tied to a contract requirement.
- Filters for owner, status, contract, requirement, due date, and file state.
- Optional Attention row for due-soon and missing-file shortcuts only when
  non-zero or active; there is no duplicated Quick filters presentation.
- Attention-filter definitions are visible when the Attention row appears:
  - Due soon: request is due within 7 days.
  - Missing file: no evidence file is attached.
- Rows with request, requirement, owner, due date, status, files, updated time,
  upload/review action, and more menu.
- Empty state for creating the first request.

States:

- Empty: Request evidence when a contract requirement or follow-up task needs
  proof.
- Requested: show owner, due date, recipient, linked requirement or contract, and
  whether a file or non-file response is required.
- Missing file: explicit file-needed state and upload action.
- Received: distinguish submitted proof from reviewed proof.
- Reviewed/accepted: clearly separate accepted evidence from merely received or
  uploaded evidence.
- External participant: link status is shown without exposing the raw token.

Terminology:

- Use "Evidence."
- The route path must not appear in visible product copy.
- Do not use "Assurance" for Core users.

Acceptance:

- User can request, track, receive, and review evidence tied to a contract or
  requirement.

### `/reports`

Status: Ship.

Release role:

- Converts tracked work into shareable outputs.
- Makes contract follow-up defensible to leadership, finance,
  operations, or legal-adjacent stakeholders.

Direct access behavior:

- Authenticated workspace route.
- Run/export/send actions are role-gated and provider-config gated.

Contains:

- Header: Reports.
- Export upcoming renewals action.
- Recoverable partial-data state when data freshness is degraded.
- Report catalog.
- Report catalog count shows the number of reports; rail counts are matching
  rows available in each report.
- Report filters/parameters.
- Preview table.
- Active report header explains:
  - Window: selected reporting period.
  - Rows: previewed rows over matching rows.
  - Last export: most recent export for this report.
- Run, export, download, retry, or send actions only when backed by working
  permissions and job states.
- Report history when report runs can be created or sent. Recent export history
  explains that its Rows column is the number of records included in that export
  run.

Report preview requirements:

- Preview identifies report type, selected filters, visible row count, partial
  data state, and export availability.
- Preview identifies source and freshness limits for the selected report,
  including whether rows depend on reviewed, suggested, calculated, missing,
  partial, or stale data.
- Tables show contract, counterparty, owner, status, date, next action, or
  request fields appropriate to the selected report.
- Exports use the same filters as preview and disclose partial-data limitations.

Core reports:

- Upcoming renewals.
- Notice deadlines.
- Missing owners.
- Missing key details.
- Open requirements.
- Overdue tasks.
- Problems by owner.
- Evidence requests.
- Contract inventory.
- Review completeness.

Excludes:

- Assurance scorecards.
- Health graph.
- Outcome intelligence.
- Autopilot results.
- Portfolio analytics as primary content.

Acceptance:

- User can produce at least one useful operational report without rebuilding a
  spreadsheet.

### `/settings`

Status: Ship.

Release role:

- Provides basic administration without surfacing product complexity.

Direct access behavior:

- Authenticated workspace route.
- Admin-only panels are hidden or read-only for non-admin roles.

Contains:

- Header: Settings.
- Workspace/account attention summary.
- Directory linking to Profile, Workspace identity, Team, Billing, Security,
  Notifications, and Imports/exports.
- Profile settings.
- Workspace identity.
- Team members, roles, pending invites, and invite action when authorized.
- Invite resend, revoke, remove-member, and role-change controls for Owner and
  Admin roles, with Owner-preservation rules enforced before mutation.
- Owner-preservation behavior for ownership transfer, downgrade, or removal.
- Billing/access status entry.
- Security entry.
- Export/deletion entry for Owner and Admin roles; full workspace deletion and
  irreversible export/deletion operations are Owner-only.

States:

- Non-admin: read-only or limited settings view.
- Missing workspace: workspace-required state.
- Pending invite list empty state.
- Last-owner protection state.
- Save failure: recoverable message without provider details.
- Disabled provider: billing, email, or integration panels show safe
  unavailable states instead of dead controls.

Excludes:

- Product-mode switch.
- Advanced/Assurance upgrade tiles.
- Inaccessible settings entries.
- Policy/governance controls for ordinary Core users.

Acceptance:

- Workspace admin can manage team, access, billing status, security, and
  workspace identity without encountering private product modes.
- Role and team changes follow the release behavior model.

## Core Contextual Routes

### `/contracts/new`

Status: Contextual.

Release role:

- Fastest path from signed agreement to tracked record.

Direct access behavior:

- Authenticated contextual route.
- Reachable from dashboard, contracts, empty states, and upload CTAs.
- Direct access without upload permission shows a denied or read-only recovery
  state.

Contains:

- Supported file upload.
- Accepted file types and size limits.
- Required metadata.
- File validation messages.
- Upload progress and success/failure states.
- Duplicate or already-uploaded handling where available.
- Recent upload or next-step state.
- Link to the review queue after extraction begins or completes.

Excludes:

- Full contract-profile questionnaire before upload.

Acceptance:

- User can upload a signed contract and know the next step.

### `/contracts/bulk`

Status: Contextual.

Release role:

- Helps users move from a spreadsheet tracker to Oblixa.

Direct access behavior:

- Authenticated contextual route.
- Reachable from contracts, dashboard import notice, and empty states.
- Direct access without import permission shows denied or recovery copy.

Contains:

- CSV/import entry.
- Format expectations.
- Visible CSV column expectations and a downloadable CSV template.
- File validation.
- Queued, processing, failed, partial, and completed states.
- Duplicate row and invalid row handling.
- Recent import jobs.
- Links back to contracts and review queue.

Excludes:

- Manual spreadsheet-cleanup promise.
- Full migration-center framing.

Acceptance:

- User can import tracker rows and inspect import results.

### `/contracts/imports/[jobId]`

Status: Contextual.

Release role:

- Makes import failures recoverable.
- Reduces support burden from CSV/import issues.

Direct access behavior:

- Authenticated contextual detail route.
- Only accessible for jobs in the current workspace.
- Invalid, missing, or cross-workspace job IDs render safe not-found or
  inaccessible states.

Contains:

- Import status and clear headline.
- Row totals, created rows, rows needing correction.
- Safe per-row correction messages.
- Retry action when safe.
- Link back to `/contracts/bulk`.
- Link to `/contracts` when imported rows were created.
- Not-found state for invalid, missing, or inaccessible jobs.

Excludes:

- Raw row blobs.
- Provider internals.
- General import operations center.

Acceptance:

- User can see which rows worked, which need correction, and what to do next.

### `/contracts/[id]`

Status: Ship.

Release role:

- Contract-level source of truth.
- Proves Oblixa is more than a list of files.

Direct access behavior:

- Authenticated detail route.
- Only accessible for contracts in the current workspace.
- Missing or inaccessible IDs render a safe not-found state without confirming
  cross-workspace existence.

Contains:

- Contract identity, counterparty, type, status, owner, and current next action.
- Uploaded file/source context.
- Confirmed key details and missing/unreviewed detail states.
- Renewal and notice checkpoints.
- Owner assignment.
- Contract requirements.
- Tasks.
- Approvals.
- Problems.
- Evidence requirements and submissions.
- Activity/audit history.
- Notes only when create, edit, delete, permission, and audit states are
  complete.
- Download/export actions when authorized.
- Not-found/inaccessible state without cross-workspace disclosure.

Excludes:

- Legal-advice summary.
- Autonomous risk verdict.
- Unimplemented collaboration surfaces.

Acceptance:

- User can determine trusted data, source context, owner, dates, evidence, and
  next work from the page.

### `/contracts/review`

Status: Contextual.

Release role:

- Trust conversion surface.
- Turns suggested contract details into confirmed operational data.

Direct access behavior:

- Authenticated contextual route.
- Reachable from dashboard, contracts, contract detail, import/upload completion,
  and review CTAs.
- Review actions require review/edit permission.

Contains:

- Sidebar/nav child label: Review queue.
- Page title: Contract Review Queue.
- Page lead: Review suggested contract dates, owners, and terms against source
  text before Oblixa uses them in reminders, tasks, and reports.
- Header meta: Details to review and Contracts needing review.
- Progress indicator for the active contract and active detail.
- Left rail title: Contracts needing review.
- Rail filters: All, Mine, Important; source filters grouped under Source with
  No preview and Source needed.
- Decision pane label: Detail to review.
- Suggested value, current confirmed value, source snippet, source preview, and
  contract context.
- `Where this is used` block explaining the operational consequence of
  confirming the active detail.
- Right rail sections: Where Oblixa found it, Source preview, Contract context.
- Source badges: Source found, Source not found, Source preview unavailable,
  Needs source, Manual entry.
- Confidence hint only when it is clearly labeled as extraction metadata, not a
  trust state.
- Actions: Confirm, Edit, Mark unknown, Skip.
- Link to source and contract.
- Empty state when no details need confirmation.
- Recoverable state when source text or preview is temporarily unavailable.

`Where this is used` copy:

| Detail type | User-facing explanation |
| --- | --- |
| Auto-renewal | Shows whether the contract renews automatically, so renewal tasks and reports can flag contracts that continue unless cancelled. |
| Notice deadline | Records the last day to send notice, so Oblixa can warn before that deadline passes. |
| Notice window | Records the amount of advance notice required, so Oblixa can calculate the last day to send notice. |
| Renewal date | Sets the date used for renewal reminders, renewal lists, and reports. |
| Owner | Assigns the responsible person for reminders, tasks, evidence requests, and reports. |
| Counterparty | Identifies the other organization or person on the contract for search, grouping, and reports. |
| Payment terms | Records payment timing and billing terms for contract tracking, tasks, and reports. |
| Contract value | Records contract value for inventory, prioritization, and reports. |
| Effective/start date | Sets when the contract starts, so status, reminders, and reports use the correct date. |
| Termination/end/expiration date | Sets when the contract ends or terminates, so status, renewal timing, and reports use the correct date. |
| Contract requirement | Records a contract requirement that may need a task, evidence request, or owner. |
| Governing law/jurisdiction | Records the law or jurisdiction that applies, so legal and contract questions can be routed correctly. |
| Other suggested detail | After confirmation, this detail can appear in contract views, tasks, reminders, and reports. |

Acceptance:

- User can confirm or correct suggested values with source context visible.

### `/search`

Status: Contextual.

Release role:

- Reduces navigation friction as the workspace grows.

Direct access behavior:

- Authenticated contextual route.
- No primary navigation entry.
- Search results are filtered by workspace, role, product mode, feature flags,
  and hidden-module settings.

Contains:

- Search input.
- Results grouped as Pages, Queues, Reports, and Tools.
- Accessible result rows.
- Recent destinations.
- Empty, no-results, and recoverable error states.
- Recovery suggestions for likely misses.

Excludes:

- Private routes the user cannot access.
- `/search` as a search result.
- Destination indexing for omitted, internal, Advanced, or Assurance routes.

Acceptance:

- Search returns only accessible destinations and records.

## Merged Core Routes

### `/contracts/renewals`

Status: Merge.

Release state:

- Redirect or thin wrapper to `/renewals`.
- No separate Renewals product.
- No separate primary nav, public copy, dashboard promotion, or report catalog
  entry.

### `/contracts/evidence-studio`

Status: Merge.

Release state:

- Redirect or thin wrapper to `/evidence`.
- Visible product language is Evidence, not Evidence Studio.
- No separate primary nav, public copy, dashboard promotion, or report catalog
  entry.

### `/contracts/tasks`

Status: Merge.

Release state:

- Redirect or thin wrapper to `/work` with task context.
- No separate primary nav, public copy, or dashboard promotion.
- Task rows live in Tasks with owner, status, due date, contract, and action.

### `/contracts/obligations`

Status: Merge.

Release state:

- Redirect or thin wrapper to `/work` with requirement context.
- Contract requirement detail belongs on contract detail.
- Requirement rows include owner, contract, due date, status, evidence state,
  and source/review state.

### `/contracts/approvals`

Status: Merge.

Release state:

- Redirect or thin wrapper to `/work` with approvals context.
- Approval rows include requester, owner, status, due state, contract, and
  action.
- No SLA-simulator promotion for Core users.

### `/contracts/exceptions`

Status: Merge.

Release state:

- Redirect or thin wrapper to `/work` with problem context.
- Problem rows live in Tasks with severity, owner, contract, status, due state,
  and next action.
- Contract detail may show contract-specific problems when the relation is
  complete.
- No separate Exceptions product surface appears in primary navigation,
  dashboard promotion, search, command palette, onboarding, or public copy.
- Problems are tracking issues, not compliance findings.

### `/contracts/reports`

Status: Merge.

Release state:

- Redirect or thin wrapper to `/reports` or a report-history section.
- Run history includes report type, status, created time, delivery/export state,
  retry, and download actions.
- No second Reports product.

## Admin And Settings Routes

### `/settings/security`

Status: Ship.

Release role:

- Supports account and workspace trust after signup.

Direct access behavior:

- Authenticated settings route.
- Sensitive actions require the step-up behavior defined in Operational
  Decisions.
- Non-admin users see only account-level controls they are allowed to manage.

Contains:

- Account security header.
- MFA status and setup/removal flows only when backed by the authentication
  provider; otherwise MFA controls are omitted.
- Session list and session controls only when backed by the authentication
  provider; otherwise session controls are omitted.
- Step-up state for sensitive actions.
- Account and workspace context.
- Email verification state.
- Role and team-management link.
- Audit-history link.
- Legal/security contact.
- No raw provider errors.

Excludes:

- Enterprise-security theater.
- Raw session secrets or provider payloads.

Acceptance:

- User can inspect account/workspace security state and manage every
  provider-backed security control shown on the page.

### `/settings/billing`

Status: Admin.

Release role:

- Supports paid conversion and billing transparency.

Direct access behavior:

- Admin route.
- Provider-backed actions appear only when billing is configured.
- If billing is unavailable, the page shows access status and safe contact or
  unavailable-state copy.

Contains:

- Current access/plan/subscription status.
- Approved-access, unpaid, paid, past-due, canceled, and provider-unavailable
  states. Trialing appears only as a provider recovery state if encountered; it
  is not marketed or offered.
- Included Core capabilities.
- Checkout, portal, invoice, and payment actions only when provider-backed and
  configured.
- Past-due recovery state with clear restrictions and admin recovery path.
- Canceled state with disclosed export/contact path when retained data remains
  available.
- Billing FAQ.
- Billing contact path.
- Disabled/unconfigured state.
- Admin-only diagnostic utilities hidden behind role and environment boundaries.

Excludes:

- Advanced/Assurance upsell.
- Public enterprise procurement language.
- Unsupported annual commitment.
- Unsupported refund promises.

Acceptance:

- Admin can understand billing/access status and reach billing actions only when
  configured.
- Billing state never implies public self-serve checkout unless checkout is
  actually available.

### `/settings/operations`

Status: Omit.

Release state:

- Not a separate Core release destination.
- Simple operational defaults are omitted until the setting is complete,
  understandable, and user-actionable; once complete, they belong in `/settings`
  or the owning Core surface.
- Direct access by ordinary Core users renders Global not found.

Belongs elsewhere:

- Notification/reminder defaults belong in the relevant notification, renewal,
  work, evidence, or settings section once the setting has a complete user-facing
  lifecycle.
- Import/export defaults belong in import/export settings or the owning
  workflow once the setting has a complete user-facing lifecycle.

Excludes:

- Separate operations console.
- Controls requiring internal knowledge.
- Policy language that implies automation beyond simple settings.
- Advanced/Assurance operational modes.

Acceptance:

- Ordinary Core users do not encounter an Operations settings route.
- Any operational default that ships is reachable only from the owning Core
  surface or a settings section listed in `/settings`.

### `/settings/health`

Status: Internal.

Release role:

- Operator-only release readiness and support diagnostics.
- Customer-facing health, degraded, provider-unavailable, or blocked states live
  in the affected workflow, `/settings/billing`, `/settings/security`, or
  route-level recovery state instead of a standalone customer health console.

Direct access behavior:

- Explicit operator authorization required.
- Ordinary users, including workspace admins, receive Global not found without
  internal diagnostics.

Contains:

- Operator-scoped readiness summary.
- Health states for upload/import, extraction, review, renewals, work, evidence,
  reports, exports, reminders, billing/access configuration, and provider
  configuration where those workflows are surfaced.
- Clear labels for healthy, degraded, blocked, configuration-needed, and waiting
  states.
- Links to affected workflow recovery states only when the operator is allowed
  to view them.
- Last-known freshness or sync state when relevant to reports, exports, imports,
  extraction, reminders, or evidence.
- No secrets, raw provider payloads, raw document text, raw prompts, raw model
  responses, tokens, signed URLs, or tenant data outside explicit support scope.

Excludes:

- Customer-facing readiness console.
- Provider internals, job queues, raw payloads, worker names, secrets, and
  diagnostic logs for ordinary users.
- Advanced/Assurance health items for Core workspaces unless the explicitly
  authorized operator context permits them.
- Product-mode controls.

Acceptance:

- Operators can distinguish healthy, degraded, blocked, and
  configuration-needed Core workflow states without exposing internal
  diagnostics to ordinary users.

### `/settings/health/diagnostics`

Status: Internal.

Release state:

- Operator troubleshooting only.
- Hidden from ordinary workspace admins unless explicitly authorized.
- No secrets.
- No ordinary navigation, search, dashboard, email, or onboarding link.
- Direct access by unauthorized users renders Global not found.

### `/settings/product`

Status: Internal.

Release state:

- Hidden from ordinary Core users.
- No Core/Advanced/Assurance switch in the release.
- No private module enablement for ordinary users.
- If retained, it is operator configuration or a non-editable access-state view,
  not a primary release surface.
- Direct access by unauthorized users renders Global not found. Authorized
  Operators may reach the route only inside explicit operator scope.

### `/settings/policy`

Status: Omit.

Release state:

- Hidden from ordinary Core users.
- Simple workflow defaults belong in owning Core surfaces or clear implemented
  settings sections when fully supported.
- No governance, policy-registry, or simulation vocabulary in Core release.
- Direct access by ordinary Core users renders Global not found.

### `/settings/policy/registry`

Status: Internal.

Release state:

- Operator/admin-only registry surface.
- No public or ordinary workspace discovery.
- Unauthorized direct access renders Global not found. Authorized Operators may
  reach the route only inside explicit operator scope.

### `/settings/policy/diagnostics`

Status: Internal.

Release state:

- Operator diagnostics only.
- No ordinary workspace discovery.
- Unauthorized direct access renders Global not found. Authorized Operators may
  reach the route only inside explicit operator scope.

### `/more`

Status: Omit.

Release state:

- Not part of Core primary navigation.
- Omitted by default for the optimal Core release.
- May ship later only if every linked item is a real, complete, Core-safe
  destination.
- Never lists Advanced, Assurance, unavailable, placeholder, or future routes
  for Core users.
- No stub cards.

Direct access behavior:

- Authenticated route.
- Hidden from Core primary navigation, command palette, onboarding, empty
  states, and emails.
- Direct access by ordinary Core users renders Global not found unless the route
  has complete Core-safe destinations explicitly specified in this document.

## Operator Routes

Operator routes are internal support and release-control surfaces. They are not
customer settings, public acquisition, onboarding, or Core product routes.
Unauthorized direct access renders Global not found.

### `/operator/access-requests`

Status: Internal.

Release role:

- Provides the operator workflow required by Access Review And Grants.
- Converts public access requests into approved, rejected, closed, or pending
  records and, when approved, into email-bound workspace-creation or invite
  grants.
- Keeps signup gated by durable grant state rather than shared codes, inbox
  memory, or manual notes.

Direct access behavior:

- Requires explicit Operator authorization.
- Ordinary public users, authenticated customers, workspace Owners, workspace
  Admins, Members, and Viewers receive Global not found.
- The route is excluded from sitemap, public metadata, public pages, customer
  navigation, search, command palette, onboarding, dashboard cards, reports,
  emails, and ordinary settings.

Contains:

- Access-request queue with pending, approved, rejected, and closed filters.
- Requester identity, normalized email, company, fit context, requested access
  type, source route, duplicate history, timestamps, and safe contact notes.
- Qualification context needed to decide fit: signed-contract count band,
  current tracking method, tracker presence, redacted-sample willingness,
  follow-up preference, pain summary, and any public-form message.
- Detail view with decision reason, reviewer, decision timestamps, grant state,
  grant type, grant email target, expiration, consumed/revoked state, resend
  lineage, and related workspace or invite context when one exists.
- Actions: approve, reject, close, reopen when supported, create
  workspace-creation grant, create existing-workspace invite grant, resend
  unused grant, revoke unused grant, and add safe contact note.
- Audit/activity history for request submission, duplicate update, decision,
  grant creation, grant resend, grant revocation, invite creation, and contact
  note creation.
- Safe degraded state when email, billing, or provider configuration needed for
  follow-up is unavailable.

Excludes:

- Raw uploaded contract content.
- Raw grant tokens or invite secrets.
- Secrets, provider payloads, raw email-provider responses, stack traces, raw
  model output, or unrelated workspace data.
- Customer-facing rejection messages by default.
- Public conversion analytics that identify unapproved users beyond safe,
  aggregate release evidence.

Acceptance:

- Operator can review a pending request and approve it into exactly one valid
  workspace-creation grant or existing-workspace invite grant.
- Operator can reject or close a request without creating a user, workspace,
  billing customer, subscription, trial, entitlement, invite, or grant.
- Operator can revoke or resend an unused grant with audit and without exposing
  the raw token.
- Signup can complete only from a valid grant or invite produced by this state
  machine.
- Ordinary customers and public users cannot discover or access the route.

## Advanced Routes Contained From Core Release

These routes can represent substantive implementation work, but they do not help
the optimal release positioning. They must not shape public copy, pricing,
onboarding, Core navigation, Core search, dashboard cards, or emails.
They may remain operable through Dev/Test, Internal operator, or Contained
workspace access under the Hidden Surface Development And Test Access rules.
That access does not make them Core release surfaces.

### `/dashboard/persona`

Status: Contained.

Reason:

- Duplicates Dashboard and implies role-program complexity.

Release state:

- Hide from Core users.
- If retained later, make it a preference or role-specific view rather than a
  separate release promise.

### `/contracts/intake`

Status: Contained.

Reason:

- Implies pre-contract or queue-management scope beyond signed-contract
  tracking.

Release state:

- Import work stays in `/contracts/bulk`.

### `/contracts/data-quality`

Status: Contained.

Reason:

- Data quality matters, but a separate page adds conceptual load.

Release state:

- Missing fields and unreviewed suggestions surface in Dashboard, Contracts, and
  `/contracts/review`.

### `/contracts/review-cadence`

Status: Contained.

Reason:

- Review rituals are process-heavy for launch positioning.

Release state:

- Review work stays in Dashboard and `/contracts/review`.

### `/contracts/watchlists`

Status: Contained.

Reason:

- Watchlists are secondary; filters and saved views cover the initial need.

Release state:

- Monitoring signals stay in Contracts and Dashboard.

### `/contracts/execution-graph`

Status: Contained.

Reason:

- Dependency graphs imply advanced orchestration.

Release state:

- Cannot-proceed tasks remain visible in Tasks and Dashboard.

### `/contracts/approvals/workload`

Status: Contained.

Reason:

- Workload analysis implies mature approval operations.

Release state:

- Approval counts and owner filters live in `/work`.

### `/contracts/approvals/sla-simulator`

Status: Contained.

Reason:

- SLA simulation conflicts with the no-enterprise-SLA release boundary.

Release state:

- No Core link or promotion.

### `/contracts/analytics`

Status: Contained.

Reason:

- Analytics distract from operational reports and imply intelligence beyond the
  release proof.

Release state:

- Core metrics live in Dashboard and Reports.

### `/contracts/collaboration`

Status: Contained.

Reason:

- A collaboration center increases permission and support surface.

Release state:

- Contract-specific notes/comments belong on contract detail only when complete.

### `/contracts/programs`

Status: Contained.

Reason:

- Program management is outside tracking what signed contracts require next.

Release state:

- No Core nav, search, pricing, email, or public copy references.

### `/contracts/maintenance`

Status: Internal.

Reason:

- Operator or admin utility, not user value positioning.

Release state:

- Ordinary users cannot access maintenance actions.
- Unauthorized direct access renders Global not found. Authorized Operators may
  reach the route only inside explicit operator scope.
- Any destructive or bulk action requires preview, audit, and rollback.

### `/decisions`

Status: Contained.

Reason:

- Decision workspace positioning broadens the product beyond tracking.

Release state:

- Renewal and problem decisions remain tasks or contract context.

### `/decisions/[id]`

Status: Contained.

Release state:

- Guard or redirect for ordinary Core users.

### `/decisions/review`

Status: Contained.

Release state:

- No manager-review queue in Core release.

### `/decisions/compare`

Status: Contained.

Release state:

- No comparison workflow in Core release.

### `/campaigns`

Status: Contained.

Reason:

- Campaigns imply scale and change management beyond Core release.

Release state:

- No nav, search, dashboard, email, or public promotion.

### `/campaigns/[id]`

Status: Contained.

Release state:

- Guard or redirect for ordinary Core users.

### `/campaigns/compare`

Status: Contained.

Release state:

- No campaign comparison in Core release.

### `/relationship-workspaces`

Status: Contained.

Reason:

- Relationship intelligence broadens the product beyond tracking what signed
  contracts require next.

Release state:

- Counterparty visibility stays inside contract inventory/detail.

### `/accounts/[key]`

Status: Contained.

Release state:

- Account workspace links do not appear in Core navigation, search, command
  palette, reports, dashboard, or emails.

### `/accounts`

Status: Boundary.

Release state:

- No standalone Core destination.
- Direct access renders Global not found unless a future Core-safe account root
  is explicitly specified.

### `/counterparties/[key]`

Status: Contained.

Release state:

- Counterparty workspace links do not appear in Core navigation, search, command
  palette, reports, dashboard, or emails.

### `/counterparties`

Status: Boundary.

Release state:

- No standalone Core destination.
- Direct access renders Global not found unless a future Core-safe counterparty
  root is explicitly specified.

## Assurance Routes Contained From Core Release

Assurance pages are not part of the optimal Core release positioning. They
reframe Oblixa as compliance, controls, or risk governance, which weakens the
contract-tracking wedge.
They may remain operable through Dev/Test, Internal operator, or Contained
workspace access under the Hidden Surface Development And Test Access rules.
That access does not make Assurance part of the Core release narrative,
navigation, pricing, onboarding, search, dashboard, reports, or emails.

### `/assurance`

Status: Contained.

Release state:

- Hidden from Core users.
- No public, nav, search, pricing, email, report, or dashboard references.

### `/assurance/findings`

Status: Contained.

Reason:

- Findings imply risk/compliance determinations.

### `/assurance/findings/[id]`

Status: Contained.

Release state:

- Finding detail links unavailable to ordinary Core users.

### `/assurance/control-policies`

Status: Contained.

Reason:

- Control policies are outside contract-tracking release.

### `/assurance/control-policies/[id]`

Status: Contained.

Release state:

- Control policy detail links unavailable to ordinary Core users.

### `/assurance/scorecards`

Status: Contained.

Reason:

- Scorecards imply formal assurance measurement.

### `/assurance/playbooks`

Status: Contained.

Reason:

- Playbooks imply managed assurance operations.

### `/assurance/review-boards`

Status: Contained.

Reason:

- Review boards imply enterprise governance.

### `/assurance/segments`

Status: Contained.

Reason:

- Segmentation is assurance infrastructure.

### `/assurance/program-evolution`

Status: Contained.

Reason:

- Program evolution is outside Core value.

### `/assurance/health-graph`

Status: Contained.

Reason:

- Health graph implies authoritative controls modeling.

### `/assurance/autopilot`

Status: Contained.

Reason:

- Autopilot conflicts with the non-autonomous release boundary.

Release state:

- No execution controls, dry-run links, or autonomous-action copy in Core
  surfaces.

## Boundary, Loading, And Error Routes

### Global not found

Status: Boundary.

Direct access behavior:

- Directly renderable for unknown public paths.
- Authenticated app paths may offer dashboard/contracts recovery.

Contains:

- Clear not-found message.
- Safe link to home or dashboard depending on auth state.
- No stack traces, raw route details, or implementation details.
- No confirmation that an inaccessible private route exists.

### Marketing not found

Status: Boundary.

Direct access behavior:

- Rendered for missing marketing routes.
- Does not enter the authenticated app shell.

Contains:

- Missing-page state.
- Links to home, product, request access, and contact.
- Marketing chrome parity.

### Contract not found

Status: Boundary.

Direct access behavior:

- Rendered for missing or inaccessible contract detail routes.
- Must not disclose cross-workspace existence.

Contains:

- Missing or inaccessible contract message.
- Link back to contracts.
- No disclosure of whether the contract exists in another workspace.

### Global error and app error boundaries

Status: Boundary.

Direct access behavior:

- Rendered only when an error reaches the relevant app or marketing boundary.
- Retry and navigation actions must stay within the user's auth context.

Contains:

- Recovery message.
- Retry or safe navigation action.
- Sanitized diagnostic reference for server-side errors; client-only recoverable
  errors may omit a reference.

Excludes:

- Secrets, stack traces, SQL, provider IDs, raw exception details, document text,
  tokens, or signed URLs.

### Loading routes

Status: Boundary.

Direct access behavior:

- Rendered only as route loading states.
- Must preserve the owning page's information architecture.

Contains:

- Stable skeletons or loading panels matching the owning page structure.
- No layout shift that changes page hierarchy after load.
- Accessible busy state where appropriate.

## API And Background Route Boundaries

API routes are not public positioning surfaces. They must support the release
without expanding what users are promised.

### Public and auth API families

Status: Ship.

Families:

- Contact submission.
- Auth callback and post-sign-out.
- Health endpoint.
- Security report intake.
- Product telemetry.

Release rules:

- Public routes validate input, rate-limit where needed, avoid enumeration, and
  never leak provider errors.
- Contact flows support async access, pricing, security, support, and general
  questions.

### Core operational API families

Status: Ship gated.

Families:

- Contracts and command-palette contract search.
- Upload, import, import-job detail, extraction, and recompute signals.
- Contract detail review.
- Tasks, approvals, requirements, problems, renewals, reminders, evidence.
- Reports, report packs, report runs, calendar export, contract export, renewal
  export, review-packet export.
- Workspace settings, account export, account data, notification preferences,
  templates, events, integrations only where surfaced.

Release rules:

- Every route is tenant-scoped.
- Mutations require authorization and role checks.
- Upload/import/export routes validate file types, identifiers, filters, sizes,
  and tenant ownership.
- Export routes guard CSV formula injection and set intentional download
  headers.
- AI/document-processing routes keep source citations, output validation, and
  redaction boundaries.
- Recoverable failures return safe user-facing reasons, not raw provider
  payloads.

### External-token API families

Status: Contextual.

Families:

- Create external link from Core evidence or follow-up workflows.
- Token status.
- Token submit.
- Token workflow step and participant workflow step.

Release rules:

- Tokens are scoped, expiring, non-browsable, and redacted from logs.
- Token routes expose only the requested action context.
- Already-submitted, expired, invalid, and revoked states are safe and
  non-enumerating.
- Core evidence and follow-up workflows may create scoped external-token links
  without exposing a broader collaboration center.
- External-token APIs must not imply general collaboration, account portals, or
  workspace access for non-workspace participants.

### Billing API families

Status: Admin.

Families:

- Checkout.
- Customer portal.
- Invoices.
- Webhook.

Release rules:

- Billing routes are disabled safely when provider configuration is absent.
- Provider errors are redacted.
- Webhooks verify signatures and remain idempotent.
- Billing copy must not promise public checkout unless checkout is enabled.

### Advanced and Assurance API families

Status: Contained.

Families:

- Decisions, campaigns, simulations, intelligence, capacity, programs,
  relationship summaries, maintenance.
- Assurance findings, checks, control policies, scorecards, playbooks, review
  boards, segments, program evolution, health graph, autopilot, outcomes.

Release rules:

- These APIs may exist for contained workspaces or future modules.
- They must not be discoverable from Core public pages, Core nav, Core search,
  Core reports, Core emails, or Core onboarding.
- If directly reached by an ordinary Core user, they return `404` or the
  code-owned Global not found API shape without exposing route, module,
  entitlement, or cross-surface data.

### Cron and background route families

Status: Internal.

Families:

- Contract import/export cleanup.
- Extraction and read-model refresh.
- Renewal recompute and reminders.
- Evidence follow-up.
- Exceptions detection.
- Report generation.
- Notification retry.
- Billing sync.
- Security retention cleanup.
- Advanced and Assurance background jobs.
- Legacy compatibility cron aliases.

Release rules:

- Background routes are not user-facing.
- Jobs are idempotent, bounded, retry-safe, and protected by route auth.
- Compatibility aliases are implementation details only and must not appear in
  user-facing documentation or product copy.

### Internal/debug/maintenance API families

Status: Internal.

Release rules:

- Operator-only.
- No public route discovery.
- No secrets, raw documents, tokens, or provider payloads in responses.
- Any destructive action requires preview, audit, and rollback or explicit
  one-way confirmation.

## Email And Notification Content

Contains:

- Invite teammate.
- First contract uploaded.
- Import completed or needs correction.
- Extraction ready.
- Extraction failed or manual confirmation needed.
- Detail review reminder.
- Upcoming renewal reminder.
- Notice deadline reminder.
- Task assigned.
- Task overdue.
- Evidence requested.
- Evidence overdue.
- Report/export completed or failed when the user initiated it.
- Weekly digest only when digest generation, preferences, and delivery failure
  states are complete.

Rules:

- Every runtime email, in-app notification, digest item, and provider-triggered
  billing email must be classified in the notification registry as required
  release, secondary billing/recovery, optional disabled, internal/operator, or
  out of release scope.
- Runtime templates that are not classified must not send in production.
- Required notification inventories, runtime templates, email fixtures, provider
  templates, and generated checks must agree on identifier, recipient type,
  route target, dedupe key, provider dependency, and disabled-state behavior.
- Artifact drift in the notification registry is a release blocker until the
  owning generated artifact is refreshed by its write/generate command and the
  read-only check passes. Do not treat stale generated notification artifacts as
  evidence merely because runtime templates exist.
- If the required-email count, runtime template count, billing template count,
  or in-app taxonomy count differs across config, generated artifact, and
  runtime code, every extra or missing template must be explicitly classified
  before release.
- Notification checks must verify that every deep link resolves to a canonical
  shipped or contextual route that exists in the route manifest and is accessible
  to the recipient. Links to missing routes, hidden routes, ordinary-user
  Contained routes, Internal routes, Omit routes, or Merge routes with an
  available canonical target are release blockers.
- Welcome copy focuses on first product action.
- Extraction emails require review of source-backed suggestions before reliance.
- Renewal emails avoid guarantee language.
- Evidence emails name requested proof and due date.
- Billing lifecycle emails stay secondary until billing is active.
- Emails do not promote Advanced, Assurance, Autopilot, campaigns, decisions,
  relationship workspaces, control policies, scorecards, playbooks, or omitted
  routes to Core users.

## Release State Invariants

- Public routes state the product boundary: tracking what signed contracts
  require next after signature.
- Public routes position Oblixa as a focused signed-contract follow-up product.
  Access review is framed as a data-sensitivity and setup-boundary control, not
  as gated signup, founder scarcity, or product immaturity.
- Public and auth copy says "request access" or "approved workspaces" when
  describing access control; it does not use beta-like, pilot, founder-led,
  limited-rollout, or early-access positioning.
- Public pricing states the Core monthly offer and included limits plainly, while
  account creation and checkout remain approval-gated.
- Primary app navigation contains only Dashboard, Contracts, Tasks, Renewals,
  Evidence, Reports, and Settings.
- Signup, workspace access, billing, role, invite, token, and destructive-action
  behavior follows the Technical Behavior Specification.
- Access review is backed by durable request/grant state and an internal
  operator route; shared signup codes, public-signup flags, and inbox-only
  approval are not release-compliant customer access.
- Operational defaults follow Operational Decisions unless this document is
  intentionally revised.
- Route guards, canonical states, mutation side effects, permissions, validation,
  notifications, API behavior, and recovery states follow the Technical Behavior
  Specification.
- Core pages expose upload/import, review, ownership, dates, tasks, evidence,
  reporting, and export paths.
- Merged routes resolve into their parent Core surfaces.
- Contextual routes are reachable from owning workflows or direct links, not
  primary Core navigation.
- Admin routes require admin authorization and do not become public product
  promises.
- Internal routes require operator authorization and never appear in public,
  email, navigation, command palette, onboarding, pricing, empty states,
  dashboard cards, sitemap, or reports.
- Omitted routes do not appear in Core navigation, search, command palette,
  onboarding, pricing, email, empty states, dashboard cards, sitemap, marketing
  pages, or upgrade prompts unless explicitly allowed by this document.
- Legal, security, pricing, billing, and contact surfaces avoid unsupported
  maturity, support, legal, compliance, procurement, Assurance, and Autopilot
  claims.
- External-token routes are scoped, expiring, non-browsable, and limited to the
  requested action.
- External-token routes support file evidence upload when evidence requires a
  file and structured non-file responses when the requested action does not.
- API routes enforce auth, tenant scope, validation, redaction, rate limits, and
  recoverable errors according to their family.
- Code-owned checks and generated artifacts are evidence only when calibrated to
  this document's current route, sitemap, API, billing, notification, role,
  hidden-surface, and manual-evidence requirements.
- Background and internal routes are not public positioning surfaces.
- Documentation remains documentation only; no runtime or implementation code
  depends on this file.

## Release Blocker Criteria

The intended release is not complete until these product flows are implemented,
guarded, and proven in the deployed release environment for an approved
workspace:

- Access request, invited signup, login, password recovery, and authenticated
  redirect behavior.
- Operator access-review route and APIs for pending/approved/rejected/closed
  requests, approval, rejection, closure, reopen when supported, grant creation,
  grant resend, grant revocation, safe contact notes, and audit.
- Access-grant validation for workspace creation and workspace invite flows,
  including invalid, expired, revoked, used, missing, wrong-email, and existing
  account states.
- Operational Decisions defaults for access review, grants, billing, roles,
  retention, limits, AI/document processing, dates, notifications, reports, and
  verification.
- Route guard precedence across public, auth, Core, Contextual, Admin, Internal,
  Omit, Merge, Boundary, and Contained routes.
- Role-shaped behavior for Owner, Admin, Member, Viewer, and Operator access.
- Role alias normalization maps implementation/provider roles into Owner,
  Admin, Member, Viewer, and Operator before any route, UI, API, billing,
  export, team, or hidden-surface decision.
- Workspace lifecycle behavior for setup incomplete, active, suspended, past
  due, canceled, and deleted states.
- Team invitation acceptance, resend, revoke, wrong-email, removal, role-change,
  and last-owner protection behavior.
- Mutation behavior for validation, tenant scope, permission checks,
  idempotency/stale-write safety, activity/audit, side effects, and safe
  recoverable responses.
- Entity scope and minimum record behavior for access requests, grants,
  memberships, invites, contracts, files, fields, work, renewals, evidence,
  tokens, imports, reports, notifications, and activity/audit events.
- Public form behavior for request access, contact, password recovery,
  reset-password, signup grant validation, security intake when present, and
  external-token submission.
- Onboarding behavior for required setup, skipped/complete setup, save failure,
  and first Core action handoff.
- Feature availability, entitlement, provider-configuration, and unsupported
  surface handling across UI, API, search, command palette, emails, and direct
  access.
- Environment, secret, provider dashboard, storage, billing, email, webhook,
  feature-flag, and scheduled-job configuration required by any shipped
  behavior.
- Release-verification evidence for every shipped route and workflow through
  code-owned artifacts, automated checks, manual verification, production smoke,
  or provider-dashboard confirmation as applicable.
- Navigation, URL state, contextual route recovery, table/list sorting,
  filtering, pagination, saved-view, and bulk-action behavior where surfaced.
- Core field catalog, import schema, report catalog, and contract-detail
  relationship behavior across review, detail, reports, exports, and queues.
- Notes, comments, and non-contract/evidence attachments omitted unless full
  create, edit, delete, permission, retention, and audit behavior is complete.
- AI/document-processing behavior for prompts, extracted text, source snippets,
  model output, source citations, re-extraction, manual review, and redaction.
- Data freshness, read-model, calendar export, reminder, digest, browser cache,
  client storage, telemetry, health, diagnostics, integration, webhook, and
  provider-boundary behavior where surfaced.
- Accessibility, responsive layout, keyboard, focus, table, modal, destructive
  confirmation, and assistive-technology behavior for shipped surfaces.
- First signed-contract upload and first CSV/import workflow, including
  recoverable validation errors.
- Extraction, source preview, detail confirmation, edit, mark-unknown, and skip
  workflow.
- Contract, source-file, extraction, detail, task, renewal, evidence, import,
  external-token, report, and export lifecycle states.
- Dashboard, Contracts, Tasks, Renewals, Evidence, Reports, Settings, and
  contract-detail surfaces with real empty, loading, denied, degraded, and
  populated states.
- Renewal date and notice-date review/provenance, including confirmed,
  suggested, calculated, and missing states.
- Evidence request, external-token file upload, external-token non-file
  response, receipt, review, and closure workflow.
- Report preview and export with source/freshness disclosure and CSV export
  safety.
- Billing/access-state page and provider-backed checkout, portal, or invoice
  actions with explicit unavailable/contact recovery when provider configuration
  is missing.
- Public sitemap, canonical metadata, robots/noindex behavior, structured data,
  and generated public route inventories exclude auth-gated, compatibility-only,
  omitted, internal, contained, and hidden routes according to Canonical URL And
  Compatibility Behavior.
- Access-grant implementation is stateful, email-bound, expiring, revocable,
  single-use, token-secret-safe, and auditable. Shared access codes,
  public-signup flags, or manual email approval without grant state do not
  satisfy this blocker.
- Public request-access submissions persist durable access-request records.
  Contact-only email delivery, logs, or inbox review do not satisfy this blocker.
- Billing state mapping covers provider free/trial/evaluation/exempt/unpaid,
  active, past-due, canceled, paused, and unavailable states without creating a
  public trial or unsupported checkout path.
- Trialing, trial-period checkout parameters, trial CTAs, trial caps, and
  trial-ended UI are either absent from customer-visible release behavior or
  mapped to approved activation, recovery, provider-derived, or test/operator
  states with evidence.
- Destructive actions that are visible in the release require confirmation and
  preserve historical attribution where relevant.
- Notification recipient selection, deep-link safety, dedupe, delivery failure,
  and hidden-surface exclusion behavior.
- Notification registry, runtime templates, provider templates, and generated
  checks agree on which notifications are required release, secondary billing or
  recovery, optional disabled, internal/operator, or out of release scope.
- API and route-handler behavior for auth, tenant scope, validation, bounded
  runtime, idempotency/race safety, redaction, cache/download headers, and
  safe errors.
- API contract artifacts contain request/query/response/error schemas and
  side-effect contracts for shipped API families. A route list or status-only
  OpenAPI inventory is not sufficient.
- Public API documentation, if exposed, is generated from an explicit allowlist
  and excludes internal, diagnostic, webhook, cron, omitted, contained,
  Advanced, Assurance, and compatibility-only endpoints unless this document
  defines a public API product.
- Release checks are calibrated to this document: route-universe,
  implementation-objective, public SEO, OpenAPI, billing, notification,
  hidden-surface, and manual-boundary checks fail on the stale states named in
  Check Calibration Requirements.
- Security/privacy/trust pages with only supportable claims.
- Claim-level evidence for AI-provider handling, retention, deletion, billing,
  security, privacy, support, and extraction-quality claims where any such claim
  is public or user-facing.
- Manual evidence exists for production provider configuration, billing product
  and webhook setup, email sender setup, uploaded-file storage/deletion
  behavior, AI-provider data-handling posture, legal/trust copy approval, live
  extraction-quality review, and production smoke behavior when those workflows
  or claims are in release scope.
- Omitted, Contained, Internal, Advanced, and Assurance routes hidden from
  ordinary Core users across navigation, search, command palette, onboarding,
  emails, dashboard cards, reports, public pages, and direct access.
- Hidden and contained surface access follows the Dev/Test, Internal operator,
  and Contained workspace rules in Hidden Surface Development And Test Access,
  including positive authorized-access proof and negative ordinary-user
  discovery/direct-access proof.
- A release evidence index or equivalent artifacts map every shipped route,
  workflow, provider-backed capability, public claim, omitted-route family, and
  manual verification item above to code-owned proof or named manual proof.

Any unmet item above is a release blocker unless this document explicitly
reclassifies it as omitted, contained, unavailable, or out of release scope.

## Release Route Behavior Map

This map summarizes intended user-visible behavior for page routes. It is a
build-orientation checklist, but the detailed route sections and Technical
Behavior Specification remain authoritative when the summary is less specific.
It is not runtime router configuration.
Direct access behavior in this map describes ordinary release-user behavior
unless the route is Internal or the Hidden Surface Development And Test Access
rules explicitly allow a Dev/Test, Internal operator, or Contained workspace
context.

| Route | Status | Intended behavior | Direct access behavior |
| --- | --- | --- | --- |
| `/` | Ship | Present Oblixa as the product for tracking what signed contracts require next and route qualified visitors toward access. | Public route; primary action is request access; authenticated users may continue to the workspace. |
| `/product` | Ship | Show the Core product loop from upload/import through review, work, evidence, and reports. | Public route; calls to action return to request access or public trust pages. |
| `/request-access` | Ship simplify | Collect enough fit context to review access for a real signed-contract follow-up product without creating an account or workspace. | Public route; submission records an access request or contact; approved signed-in users continue to their workspace. |
| `/early-access` | Merge | Compatibility URL for the request-access surface only. | Redirects to `/request-access`; no early-access positioning or separate form handling. |
| `/pricing` | Ship simplify | Explain the $249/month Core offer, included limits, paid continuation, and Core capabilities without selling unsupported packages. | Public route; no checkout appears in the intended release. |
| `/contact` | Ship simplify | Let visitors ask access, pricing, security, support, or fit questions asynchronously. | Public route; submission records a contact message and stays in a safe success or failure state. |
| `/security` | Ship | State supportable security and data-handling boundaries for contract-content use. | Public route; no workspace data or authenticated controls appear. |
| `/privacy` | Ship | Explain data categories, provider posture, AI-provider use, retention, export, deletion, and contact paths. | Public route; provides policy content and support/contact paths only. |
| `/terms` | Ship | Define the service relationship and user responsibilities for account creation and paid use. | Public route; provides terms content only. |
| `/acceptable-use` | Ship | Define unacceptable use for uploaded contracts, AI processing, accounts, and external requests. | Public route; provides policy content only. |
| `/accessibility` | Ship | Provide accessibility posture and a contact path for accessibility issues. | Public route; no workspace or account state required. |
| `/cookies` | Ship | Explain cookie/session/storage use in plain language. | Public route; includes contact path and, if non-essential cookies are used, preference controls. |
| `/login` | Ship | Let existing users sign in with minimal friction. | Unauthenticated users see sign-in and recovery links; authenticated users leave this route for their workspace or requested destination. |
| `/signup` | Ship gated | Let approved or invited users complete account creation from a validated workspace-creation or workspace-invite grant without making signup the public conversion surface. | Public URL for grant completion and recovery only; invalid or missing grants recover safely, unapproved users are sent to request access, and approved users continue to setup or dashboard. |
| `/forgot-password` | Ship | Start account recovery without revealing whether an account exists. | Public route; submission always lands in a neutral recovery state. |
| `/reset-password` | Ship | Complete password recovery for a valid recovery context. | Valid recovery context shows password reset; invalid or expired context shows a safe path back to recovery or login. |
| `/auth/callback` | Boundary | Complete provider or email authentication handoff. | Token/callback-only route; success continues to the intended app destination, failure returns to safe auth recovery. |
| `/external/[token]` | Contextual | Let a non-workspace participant complete exactly one requested evidence or follow-up action without workspace access. | Scoped token route only; invalid, expired, revoked, inaccessible, or completed tokens show safe terminal states. |
| `/external` | Boundary | Handle missing or invalid external-link entry. | Shows a safe invalid-link state or sends users to a public recovery route; no workspace data appears. |
| `/onboarding/calibration` | Ship simplify | Set workspace defaults and guide the first useful action without exposing product architecture. | Authenticated admin setup route; non-admins or already-complete workspaces leave setup for dashboard or upload/import. |
| `/dashboard` | Ship | Show the workspace's operational next actions across details to confirm, dates, tasks, evidence, missing details, and recent activity. | Authenticated workspace route; empty workspaces point to upload/import and review, while required setup goes to setup. |
| `/contracts` | Ship | Serve as the signed-contract inventory and primary table for owners, status, review, dates, tasks, problems, and evidence signals. | Authenticated workspace route; actions are shaped by role and available data. |
| `/work` | Ship | Serve the user-facing Tasks surface, consolidating follow-up tasks, approvals, contract requirements, problems, and evidence requests. | Authenticated workspace route; creation and mutation actions appear according to role, entitlement, billing, and object state. |
| `/renewals` | Ship | Track upcoming renewal and notice requirements with confirmed, suggested, calculated, and missing provenance. | Authenticated workspace route; export and task actions are role-shaped. |
| `/evidence` | Ship | Request, receive, review, and close evidence tied to contracts, requirements, or tasks under the visible product label Evidence. | Authenticated workspace route; file and non-file evidence actions appear only when relevant and allowed. |
| `/reports` | Ship | Preview and export operational reports with filter, freshness, and source-state context. | Authenticated workspace route; export or send actions appear only when backed by permissions and provider state. |
| `/settings` | Ship | Let users manage profile, workspace identity, team, roles, invites, billing/access status, security, notifications, and imports/exports. | Authenticated workspace route; non-admins see only allowed or read-only settings. |
| `/contracts/new` | Contextual | Add a signed agreement and guide the user to extraction/review next steps. | Authenticated contextual route; users without upload permission see a denied or read-only recovery state. |
| `/contracts/bulk` | Contextual | Import tracker rows and recover from CSV/import issues. | Authenticated contextual route; users without import permission see denied or recovery copy. |
| `/contracts/imports/[jobId]` | Contextual | Show a single import job's result, errors, and next actions. | Workspace-scoped detail route; missing, invalid, or inaccessible jobs show safe not-found or inaccessible states. |
| `/contracts/[id]` | Ship | Show contract-level confirmed data, source context, files, dates, owners, tasks, evidence, problems, and activity. | Workspace-scoped detail route; missing or inaccessible contracts show safe not-found or denied states. |
| `/contracts/review` | Contextual | Present the Contract Review Queue and turn suggested contract details into confirmed operational data. | Authenticated contextual route from review CTAs; users without review permission see denied or read-only recovery. |
| `/search` | Contextual | Help users find accessible Core pages, contracts, queues, reports, and tools without becoming a primary destination. | Authenticated contextual route; results only include destinations the user can access. |
| `/contracts/renewals` | Merge | Preserve renewal-route compatibility while making Renewals the real renewal surface. | Direct access redirects or wraps into `/renewals` with renewal context. |
| `/contracts/evidence-studio` | Merge | Preserve evidence-route compatibility while making Evidence the real evidence surface. | Direct access redirects or wraps into `/evidence` with evidence context. |
| `/contracts/tasks` | Merge | Preserve task-route compatibility while making Tasks at `/work` the real task surface. | Direct access redirects or wraps into `/work` with task context. |
| `/contracts/obligations` | Merge | Preserve obligation-route compatibility while making Tasks at `/work` the real requirement surface. | Direct access redirects or wraps into `/work` with requirement context. |
| `/contracts/approvals` | Merge | Preserve approval-route compatibility while making Tasks at `/work` the real approval surface. | Direct access redirects or wraps into `/work` with approval context. |
| `/contracts/exceptions` | Merge | Preserve exception-route compatibility while making Tasks at `/work` the real problem surface. | Direct access redirects or wraps into `/work` with problem context. |
| `/contracts/reports` | Merge | Preserve contract-report context while making Reports the real reporting surface. | Direct access redirects or wraps into `/reports` with contract/report context. |
| `/settings/security` | Ship | Let users inspect security state and manage provider-backed account/workspace security controls. | Authenticated settings route; sensitive actions require the step-up behavior defined in Operational Decisions. |
| `/settings/billing` | Admin | Show billing/access state, paid-continuation status, restrictions, and provider-backed billing actions. | Admin route; non-admins leave or see read-only access status; unavailable billing shows safe contact/unavailable copy. |
| `/settings/operations` | Omit | Keep operational defaults in owning Core surfaces or implemented settings sections rather than a separate operations console. | Hidden from Core; ordinary Core users receive Global not found. |
| `/settings/health` | Internal | Support operator readiness and support diagnostics without creating a customer health console. | Authorized Operators only; ordinary users and workspace admins receive Global not found. |
| `/settings/health/diagnostics` | Internal | Support operator troubleshooting without exposing secrets or ordinary product controls. | Authorized Operators only; ordinary users receive Global not found. |
| `/settings/product` | Internal | Operator configuration or non-editable access-state view, not a product-mode picker. | Authorized Operators only; ordinary Core users receive Global not found. |
| `/settings/policy` | Omit | Keep policy/governance defaults out of the Core release. | Hidden from Core; ordinary Core users receive Global not found. |
| `/settings/policy/registry` | Internal | Operator registry surface only. | Authorized Operators only; ordinary users receive Global not found. |
| `/settings/policy/diagnostics` | Internal | Operator diagnostics for policy internals only. | Authorized Operators only; ordinary users receive Global not found. |
| `/more` | Omit | Avoid a tools index unless every destination is complete and Core-safe. | Hidden from Core; ordinary Core users receive Global not found unless complete Core-safe destinations are explicitly specified. |
| `/operator/access-requests` | Internal | Let authorized Operators review access requests, issue/revoke/resend grants, and audit access decisions. | Authorized Operators only; public users and ordinary workspace users receive Global not found. |
| `/dashboard/persona` | Contained | Do not split Dashboard by persona in the Core release; allow contained development/testing only. | Ordinary Core users receive Global not found; authorized contained access follows hidden-surface rules. |
| `/contracts/intake` | Contained | Do not imply pre-signature intake in Core; allow contained development/testing only. | Ordinary Core users receive Global not found; authorized contained access follows hidden-surface rules. |
| `/contracts/data-quality` | Contained | Keep data gaps inside Dashboard, Contracts, and Review for Core; allow contained development/testing only. | Ordinary Core users receive Global not found; authorized contained access follows hidden-surface rules. |
| `/contracts/review-cadence` | Contained | Keep review work tactical in Core; allow contained development/testing only. | Ordinary Core users receive Global not found; authorized contained access follows hidden-surface rules. |
| `/contracts/watchlists` | Contained | Use filters and saved views in Core; allow contained development/testing only. | Ordinary Core users receive Global not found; authorized contained access follows hidden-surface rules. |
| `/contracts/execution-graph` | Contained | Avoid advanced dependency-graph framing in Core; allow contained development/testing only. | Ordinary Core users receive Global not found; authorized contained access follows hidden-surface rules. |
| `/contracts/approvals/workload` | Contained | Keep approval workload signals in Tasks for Core; allow contained development/testing only. | Ordinary Core users receive Global not found; authorized contained access follows hidden-surface rules. |
| `/contracts/approvals/sla-simulator` | Contained | Avoid SLA simulation and enterprise-SLA framing in Core; allow contained development/testing only. | Ordinary Core users receive Global not found; authorized contained access follows hidden-surface rules. |
| `/contracts/analytics` | Contained | Keep analytics subordinate to Dashboard and Reports in Core; allow contained development/testing only. | Ordinary Core users receive Global not found; authorized contained access follows hidden-surface rules. |
| `/contracts/collaboration` | Contained | Avoid a broad collaboration center in Core; allow contained development/testing only. | Ordinary Core users receive Global not found; authorized contained access follows hidden-surface rules. |
| `/contracts/programs` | Contained | Keep program management outside Core; allow contained development/testing only. | Ordinary Core users receive Global not found; authorized contained access follows hidden-surface rules. |
| `/contracts/maintenance` | Internal | Provide operator/admin maintenance only when explicitly authorized. | Authorized Operators only; ordinary users receive Global not found. |
| `/decisions` | Contained | Keep decision intelligence outside Core; allow contained development/testing only. | Ordinary Core users receive Global not found; authorized contained access follows hidden-surface rules. |
| `/decisions/[id]` | Contained | Keep decision detail outside Core; allow contained development/testing only. | Ordinary Core users receive Global not found; authorized contained access follows hidden-surface rules. |
| `/decisions/review` | Contained | Keep decision review outside Core; allow contained development/testing only. | Ordinary Core users receive Global not found; authorized contained access follows hidden-surface rules. |
| `/decisions/compare` | Contained | Keep decision comparison outside Core; allow contained development/testing only. | Ordinary Core users receive Global not found; authorized contained access follows hidden-surface rules. |
| `/campaigns` | Contained | Keep campaign management outside Core; allow contained development/testing only. | Ordinary Core users receive Global not found; authorized contained access follows hidden-surface rules. |
| `/campaigns/[id]` | Contained | Keep campaign detail outside Core; allow contained development/testing only. | Ordinary Core users receive Global not found; authorized contained access follows hidden-surface rules. |
| `/campaigns/compare` | Contained | Keep campaign comparison outside Core; allow contained development/testing only. | Ordinary Core users receive Global not found; authorized contained access follows hidden-surface rules. |
| `/relationship-workspaces` | Contained | Keep relationship intelligence outside Core; allow contained development/testing only. | Ordinary Core users receive Global not found; authorized contained access follows hidden-surface rules. |
| `/accounts/[key]` | Contained | Keep account workspaces outside Core; allow contained development/testing only. | Ordinary Core users receive Global not found; authorized contained access follows hidden-surface rules. |
| `/accounts` | Boundary | Avoid a root account workspace destination. | Direct access shows a safe unavailable state or routes to a valid Core destination. |
| `/counterparties/[key]` | Contained | Keep counterparty workspaces outside Core; allow contained development/testing only. | Ordinary Core users receive Global not found; authorized contained access follows hidden-surface rules. |
| `/counterparties` | Boundary | Avoid a root counterparty workspace destination. | Direct access shows a safe unavailable state or routes to a valid Core destination. |
| `/assurance` | Contained | Keep Assurance outside Core; allow contained development/testing only. | Ordinary Core users receive Global not found; authorized contained access follows hidden-surface rules. |
| `/assurance/findings` | Contained | Keep findings outside Core; allow contained development/testing only. | Ordinary Core users receive Global not found; authorized contained access follows hidden-surface rules. |
| `/assurance/findings/[id]` | Contained | Keep finding detail outside Core; allow contained development/testing only. | Ordinary Core users receive Global not found; authorized contained access follows hidden-surface rules. |
| `/assurance/control-policies` | Contained | Keep control policies outside Core; allow contained development/testing only. | Ordinary Core users receive Global not found; authorized contained access follows hidden-surface rules. |
| `/assurance/control-policies/[id]` | Contained | Keep control-policy detail outside Core; allow contained development/testing only. | Ordinary Core users receive Global not found; authorized contained access follows hidden-surface rules. |
| `/assurance/scorecards` | Contained | Keep scorecards outside Core; allow contained development/testing only. | Ordinary Core users receive Global not found; authorized contained access follows hidden-surface rules. |
| `/assurance/playbooks` | Contained | Keep playbooks outside Core; allow contained development/testing only. | Ordinary Core users receive Global not found; authorized contained access follows hidden-surface rules. |
| `/assurance/review-boards` | Contained | Keep review boards outside Core; allow contained development/testing only. | Ordinary Core users receive Global not found; authorized contained access follows hidden-surface rules. |
| `/assurance/segments` | Contained | Keep segments outside Core; allow contained development/testing only. | Ordinary Core users receive Global not found; authorized contained access follows hidden-surface rules. |
| `/assurance/program-evolution` | Contained | Keep program evolution outside Core; allow contained development/testing only. | Ordinary Core users receive Global not found; authorized contained access follows hidden-surface rules. |
| `/assurance/health-graph` | Contained | Keep health graph outside Core; allow contained development/testing only. | Ordinary Core users receive Global not found; authorized contained access follows hidden-surface rules. |
| `/assurance/autopilot` | Contained | Keep autonomous/Autopilot positioning outside Core; allow contained development/testing only. | Ordinary Core users receive Global not found; authorized contained access follows hidden-surface rules. |
