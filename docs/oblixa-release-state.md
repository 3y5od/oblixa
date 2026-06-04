# Oblixa Release State

This document describes the intended release state for Oblixa.

It is not runtime configuration. Product code, tests, scripts, and CI must not
read this document as configuration. Use it as the product and route-level
reference for release positioning, page contents, route visibility, and surface
boundaries.

This document is descriptive. It defines product shape, page contents, route
visibility, and release boundaries. It does not define non-product operating
process.

## Release Posture

Oblixa should release as a serious, gated, paid-capable product for small teams
replacing manual post-signature contract tracking.

Primary positioning:

> Replace your contract-tracking spreadsheet.

Primary subheadline:

> Track renewals, owners, obligations, evidence, work, and reports from signed
> agreements, with source-backed field suggestions your team reviews.

Release stance:

- Oblixa is usable by approved workspaces.
- Access is gated to keep onboarding focused on teams with the right workflow.
- The product should not present itself as experimental, a beta, a waitlist, a
  free trial, or a broad public self-serve product.
- The canonical CTA is "Request access."
- Existing route names may remain for compatibility, but visible copy should say
  "request access" or "limited rollout," not "early access" as the main message.
- Pricing surfaces should describe paid-use state plainly. If no public number is
  shown, the pricing page should still say continued use is paid after fit is
  confirmed.

Target user:

- Small teams with signed contracts already in use.
- Contract tracking currently happens in spreadsheets, folders, email,
  calendars, shared drives, or memory.
- The acute pains are renewals, notice dates, owners, obligations, exceptions,
  evidence, and operational reports.
- The first useful workspace can start with a bounded contract set, not a full
  migration.

Product boundary:

- Oblixa starts after signature.
- Oblixa tracks signed contracts, reviewed fields, renewals, notice deadlines,
  owners, obligations, approvals, exceptions, evidence, work, reports, exports,
  imports, and accountable follow-up.
- Oblixa does not provide legal advice.
- Oblixa is not a CLM, e-signature tool, drafting tool, redlining tool, formal
  GRC platform, enterprise assurance product, or autonomous decision-maker.

AI boundary:

- AI is a support mechanism, not the headline category.
- Public and app copy should describe "source-backed suggestions" or
  "suggested fields."
- Important suggested fields are not trusted operational data until reviewed.
- Copy must not imply legal analysis, guaranteed extraction, autonomous
  decisions, risk authority, compliance decisions, or renewal guarantees.

Trust boundary:

- Security and legal pages should make concrete supportable claims.
- Boundaries belong in FAQ, legal, and security sections. They should not
  dominate the homepage hero or make the product feel unfinished.
- Formal enterprise procurement, certification, SLA, managed implementation, and
  legal-review promises are outside this release unless independently supported.

## Product Definition

Category:

- Oblixa is a post-signature contract tracking workspace.
- It is closer to a live operational tracker than a contract repository.
- It is narrower than CLM and broader than a renewal calendar.
- It should be described as contract tracking, not contract lifecycle
  management, legal AI, compliance automation, or enterprise governance.

Release maturity:

- The release should read as focused and usable, not tentative.
- The gate exists because access is controlled, not because the product is only a
  concept.
- The product can be paid without implying broad self-serve availability.
- Public copy should not apologize for the product's narrowness; the narrowness
  is the positioning.

Intended audience:

- Small teams with real signed contracts and no reliable contract-operations
  system.
- Teams where ownership, dates, obligations, evidence, and reporting are handled
  manually.
- Operators, finance owners, legal-adjacent owners, administrators,
  and team leads who are accountable for follow-up after contracts are signed.
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

> Keep signed-contract follow-up reliable when a spreadsheet, folder, inbox, or
> calendar is no longer enough.

Secondary jobs:

- Know which contracts exist and who owns them.
- See which fields are reviewed, missing, or still suggested.
- Track renewal, notice, termination, effective, and end dates.
- Convert obligations, approvals, exceptions, and follow-up into owned work.
- Request and collect evidence.
- Export reports without rebuilding a spreadsheet.

Product promise:

- Oblixa makes contract tracking more visible, accountable, and exportable.
- Oblixa helps users operate on reviewed source-backed data.
- Oblixa makes next actions easier to find across contracts, dates, work,
  evidence, and reports.

Product non-promise:

- Oblixa does not guarantee that every renewal, notice, or obligation will be
  found or acted on.
- Oblixa does not guarantee extraction accuracy.
- Oblixa does not interpret legal meaning or recommend legal action.
- Oblixa does not replace counsel, procurement, finance approval, or business
  judgment.
- Oblixa does not promise managed migration, custom implementation, or customer
  success coverage.

Positioning hierarchy:

1. Spreadsheet replacement for signed-contract tracking.
2. Reviewed operational data.
3. Dates, owners, work, evidence, and reports.
4. Source-backed AI suggestions as an input to review.
5. Controlled access and paid continuation.

AI should never move above the first three items in public or app hierarchy.

## Release State Description

The release is defined by what an approved workspace can do, not by how a
workspace receives access.

An approved workspace should be able to:

- Add signed agreements by upload or import.
- Review source-backed suggested fields.
- Maintain a contract inventory.
- Assign owners.
- Track critical dates.
- See open, overdue, blocked, and unassigned work.
- Track obligations, approvals, exceptions, and evidence requests.
- Use external token links for bounded evidence/follow-up collection.
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
  imported, at least one suggested field has been reviewed or corrected, and the
  workspace shows meaningful dashboard, work, renewal, evidence, or report state.
- Activation is a product-state concept, not an external status milestone.

Release proof:

- The release should prove itself with the product surfaces: Dashboard, Review
  fields, Contracts, Work, Renewals, Evidence, Reports, Settings, and contextual
  upload/import/detail routes.
- Public pages should use product proof and precise boundaries.
- Documentation, private operating knowledge, or non-product context are not
  release proof.

## Surface Vocabulary

Preferred public and Core terms:

- contract tracking
- signed agreements
- contract tracker
- spreadsheet
- reviewed fields
- source-backed suggestions
- owners
- renewal dates
- notice deadlines
- obligations
- approvals
- exceptions
- evidence
- work
- reports
- export

Use carefully:

- AI, only as source-backed suggestions reviewed by the user.
- Evaluation, only to describe a bounded product workspace or access review, not
  a beta program.
- Limited rollout, only to describe access control.

Avoid in public and Core release surfaces:

- beta
- waitlist
- autonomous
- legal AI
- legal advice
- CLM replacement
- governance
- controls
- compliance automation
- Assurance
- Autopilot
- platform, unless immediately narrowed to contract tracking
- enterprise-ready
- guaranteed
- SLA
- dedicated success team

## Known Non-Claims

Oblixa must not claim or imply:

- Legal advice, legal review, legal interpretation, or recommended legal action.
- Guaranteed extraction accuracy.
- Guaranteed renewal, notice, obligation, or evidence capture.
- Autonomous decisions, autonomous execution, or risk authority.
- Compliance findings, certification, control effectiveness, or assurance
  conclusions.
- Formal enterprise security certification, SLA, procurement readiness, or
  managed implementation unless separately supported.
- Full CLM replacement, drafting, negotiation, redlining, or e-signature.
- Managed migration, spreadsheet cleanup, or dedicated customer-success coverage.

## Route Status Terms

- **Ship**: visible release surface.
- **Ship gated**: visible only to approved, signed-in, or invited users.
- **Ship simplify**: visible or reachable release surface with intentionally
  narrower content than the current route may contain.
- **Contextual**: reachable from a relevant workflow or direct link, not primary
  navigation.
- **Admin**: workspace-admin surface.
- **Internal**: operator-only surface.
- **Merge**: substantive content belongs in another release surface.
- **Omit**: hide, guard, redirect, or return not found for ordinary release
  users.
- **Boundary**: error, not-found, loading, auth-callback, or layout boundary.
- **Contained**: implementation can exist for contained workspaces or future
  modules, but is not a release promise for Core users.

Substantive routes are routes that let a user, operator, external participant,
or system create, view, mutate, export, notify, bill, authenticate, administer,
or shape the public promise. This document covers substantive page families in
detail and route-handler families by release boundary.

## Route Entry Schema

Each substantive page route should be described with:

- Status.
- Release role.
- Direct access behavior.
- Visible contents.
- Primary actions.
- Empty, loading, degraded, invalid, or denied states where relevant.
- Exclusions.
- Acceptance condition.

If a route entry omits direct access behavior, use these defaults:

- Public marketing and legal pages are directly accessible.
- Auth pages redirect authenticated users when a session makes the page
  irrelevant.
- Core app pages require an authenticated workspace and role authorization.
- Contextual routes are reachable from owning workflows or direct links only.
- Admin routes require workspace-admin authorization.
- Internal routes require explicit operator authorization.
- Omitted routes are hidden from ordinary users and must redirect, deny, or
  return not found without leaking private module data.
- Boundary routes render only safe recovery states.

## Global Release Rules

- Primary public promise: spreadsheet replacement for signed-contract tracking.
- Primary app promise: every visible surface helps a user answer what exists,
  what is trusted, who owns it, what is due, what is blocked, what proof exists,
  and what can be exported.
- Primary navigation contains exactly Dashboard, Contracts, Work, Renewals,
  Evidence, Reports, and Settings.
- Search and command palette may expose Core pages, Core queues, Core reports,
  and Core tools only when the user can access them.
- Hidden routes must not appear in primary navigation, global search, command
  palette, onboarding, pricing, public pages, email, dashboard cards, empty
  states, or upgrade prompts.
- Advanced and Assurance implementation can exist, but it must not define the
  public release narrative.
- Public pages should use actual product proof where possible. Dashboard, Review
  Fields, Contracts, Work, Renewals, Evidence, and Reports screenshots are
  stronger than abstract diagrams.
- Product copy should avoid "platform" unless the surrounding text immediately
  narrows it to post-signature contract tracking.
- Documentation is not proof of release readiness. Current runtime behavior,
  route guards, tests, rendered UI, and production configuration are the
  authoritative proof.

## Data Confidence States

Any page showing extracted or imported contract data should distinguish:

- **Reviewed**: accepted or corrected by an authorized user; can drive
  operational queues, reports, reminders, and exports.
- **Suggested**: source-backed but not yet approved; may appear in review
  surfaces and detail context, but should not be presented as trusted data.
- **Missing**: expected field absent or not found.
- **Unknown**: user intentionally marked the value unknown.
- **Computed**: derived from reviewed or imported inputs; must label the source
  of computation when it affects deadlines or reports.
- **Unverified**: imported or inferred value that has not been reviewed.

Display rules:

- Reports, renewals, dashboard cards, work queues, and evidence workflows should
  prefer reviewed data.
- Suggested or unverified values need visible state labels before they influence
  next actions.
- Source snippets or source-preview links should be available where the user is
  asked to approve or correct a value.
- Missing and unknown states should be actionable when the user has permission to
  edit or review.

## Public Routes

### `/`

Status: Ship.

Release role:

- First impression.
- Makes the spreadsheet-replacement wedge obvious.
- Sends qualified users to request access without implying the product is a
  prototype.

Direct access behavior:

- Publicly accessible.
- Primary CTA goes to the request-access route.
- Secondary CTA goes to the product tour.

Contains:

- H1: "Replace your contract-tracking spreadsheet."
- Subheadline matching the primary subheadline above.
- Primary CTA: "Request access."
- Secondary CTA: "View product tour."
- Risk reducer: limited rollout for teams replacing manual contract trackers;
  export anytime; no annual commitment unless billing actually requires one.
- Product proof showing the real workflow or faithful mock views.
- Problem section: renewal and notice dates in spreadsheets, obligations buried
  in PDFs, unclear owners, follow-up in email, evidence hard to collect, reports
  rebuilt by hand.
- Workflow section: upload/import, review fields, assign owners and dates, track
  work, request evidence, report/export.
- Outcome section: contracts needing review, upcoming renewals and notices,
  owned work, evidence status, exportable reports.
- Best-fit section: signed contracts already exist; manual tracker is becoming
  unreliable; first evaluation can start small.
- FAQ covering CLM boundary, no legal advice, starting small, file types, AI
  review, export, and paid continuation.

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

- Product-tour H1 focused on signed-contract tracking.
- Phase 1: replace the spreadsheet.
- Phase 2: upload signed PDFs/DOCX files and import CSV tracker rows.
- Phase 3: review source-backed suggested fields.
- Phase 4: track renewal, notice, termination, effective, and end dates.
- Phase 5: assign work across tasks, approvals, obligations, and exceptions.
- Phase 6: request and track evidence tied to contracts or obligations.
- Phase 7: run and export operational reports.
- Product visuals or mockups that match the actual Core product.
- CTA to request access.

Excludes:

- Repeating the homepage H1 as the page H1.
- Pre-signature contracting, drafting, redlining, e-signature, legal advice,
  GRC, or enterprise assurance.
- Abstract AI positioning disconnected from the review workflow.

Acceptance:

- A visitor can describe how a contract moves from file or CSV row to reviewed
  record, owned work, evidence, and report.

### `/early-access`

Status: Ship simplify.

Release role:

- Current access-request route.
- Should behave as the request-access page even if the URL remains unchanged for
  compatibility.

Direct access behavior:

- Publicly accessible.
- Authenticated users may continue to their workspace when they already have
  access.
- Submission creates an access request or contact record, not a workspace.

Contains:

- H1: "Request access."
- Fit framing: limited rollout for teams replacing a manual tracker.
- Form fields sufficient to judge fit:
  - name, work email, company, role;
  - number of signed contracts;
  - current tracking method;
  - top pain: renewals, owners, obligations, evidence, reporting, or work;
  - whether a small contract set can be used first;
  - optional notes.
- Post-submit success state saying the request was received.
- Post-submit failure state without infrastructure details.
- Clear expectation that access is reviewed and not automatic.

Excludes:

- Promise of workspace access for every requester.
- Operational instructions about how requests are reviewed.
- Enterprise procurement intake.
- Managed migration or spreadsheet cleanup promises.

Acceptance:

- Users see a serious access gate, not a waitlist or beta program.
- The form captures enough information for asynchronous access review.

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

- H1: "Simple pricing for contract tracking."
- Statement that access starts with a bounded workspace evaluation and continued
  use moves to a paid monthly plan if Oblixa becomes part of the workflow.
- If public price is available: one simple monthly Core plan and clear included
  limits.
- If public price is not available: no fake tier matrix; say pricing is disclosed
  after access is approved and continued use is paid monthly.
- Included Core capabilities: upload/import, source-backed review, renewals,
  notices, owners, obligations, evidence, work, reports, CSV export, support
  during evaluation.
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

- Establishes enough trust for small-team contract-content evaluation.
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
- AI review boundary.
- Data handling basics.
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

Contains:

- Data categories: account, workspace, uploaded files, contract records, usage,
  billing, contact/support data.
- Processing purposes.
- Providers/subprocessor posture.
- Retention, export, deletion, and contact paths.
- User responsibility to upload only data they are authorized to process.

Excludes:

- Unsupported legal guarantees.
- Certification claims.

Acceptance:

- A user can identify what data is processed and how to request export or
  deletion.

### `/terms`

Status: Ship.

Release role:

- Defines the service relationship before account creation or paid use.

Contains:

- Service use.
- Account and workspace responsibility.
- Customer-content responsibility.
- No legal advice.
- Limited-rollout and availability limits.
- Payment terms if billing is enabled.
- Termination, suspension, disclaimers, liability limits, and contact.

Excludes:

- Enterprise SLA terms.
- Oblixa legal-review obligations.

Acceptance:

- Terms match the actual release scope and do not promise unsupported service
  levels.

### `/acceptable-use`

Status: Ship.

Release role:

- Protects the service from abuse.
- Sets upload and usage boundaries.

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

### `/accessibility`

Status: Ship.

Release role:

- Supports trust and usability expectations.

Contains:

- Accessibility commitment.
- Known limitations only if accurate.
- Contact path.
- Information requested to reproduce an access barrier.

Excludes:

- Formal conformance claim unless verified.

Acceptance:

- Page gives a concrete reporting path without overstating compliance.

### `/cookies`

Status: Ship.

Release role:

- Supports privacy transparency for public and authenticated surfaces.

Contains:

- Essential cookies.
- Authentication/session cookies.
- Preferences, analytics, or marketing cookies only if actually used.
- Browser-management guidance.
- Contact path.

Excludes:

- Cookie categories not used by the product.

Acceptance:

- Cookie categories match runtime behavior.

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

- Allows approved users to create accounts.
- Prevents unsupported self-serve workspace creation.

Direct access behavior:

- Publicly accessible as a gated account-creation route.
- Without valid access state, the route shows denial/request-access guidance and
  does not create a workspace.
- Authenticated users redirect to dashboard or onboarding.

Contains:

- Title: "Create your workspace account" or equivalent gated-access language.
- Access-code or invite validation when signup is gated.
- Email/password signup.
- Full name and company fields when needed.
- Denied-access state with link to `/early-access`.
- Limited-access notice.

Excludes:

- Promise that public signup creates a workspace.
- Product-mode picker.

Direct access behavior:

- Without valid access code or public-signup flag, no workspace is created.
- Approved user proceeds to Core setup or dashboard.

Acceptance:

- Unapproved user is routed to request access.
- Approved user can create an account and enter Core setup.

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
- Requested action type: upload evidence, answer follow-up, confirm status, or
  complete the specific workflow step.
- Due date, requester name/team, and minimal contract or obligation context when
  needed for the recipient to act.
- Contract/request/workflow context limited to recipient need.
- Participant fields only when needed.
- Submission form.
- Upload control with file requirement, size/type validation, progress, success,
  and recoverable failure states when evidence is requested.
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

- Title: "Set up your contract tracking workspace."
- Questions for role, contract count, current tracking method, tracker
  availability, biggest tracking problem, important dates, owner assignment,
  reporting, and evidence needs.
- Save/continue state.
- Blocking state if setup is required before product use.
- Already-complete state that points to upload/import or dashboard.
- Recoverable save failure state without provider details.

Excludes:

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
- Top cards: Needs review, Upcoming deadlines, Blocked work, Missing owners,
  Open exceptions, Evidence requested.
- Review queue with fields/contracts needing review.
- Upcoming deadlines with renewal/notice context.
- Work needing action.
- Data gaps.
- Recent activity.
- Empty state leading to upload/import and field review.

States:

- Empty: first contract upload/import CTA, explanation of reviewed fields, no
  fake metrics.
- Populated: operational counts, queues, deadlines, work, data gaps, and recent
  activity reflect workspace data.
- Degraded: partial-data notice when imports, extraction, or report data is
  delayed.
- Loading: skeleton structure preserves card and queue layout.

Excludes:

- Advanced, Assurance, private-module cards.
- Product-mode badge or switch.
- Decorative analytics unrelated to next action.

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
  state, open work count, exception/evidence signals, updated time.
- Search across contracts, counterparties, owners, and tags.
- Date, status, owner, counterparty, type, renewal window, review state, missing
  data, open work, evidence, and health filters.
- Quick filters for open exceptions, pending review, missing dates, evidence due,
  open work, renewing soon, and active contracts when backed by data.
- Upload, import, export, and saved-view actions when complete.
- Empty state for adding signed contracts.

States:

- Empty: upload/import CTAs and no placeholder rows.
- Filtered empty: clear-filter action and retained filter context.
- Loading: stable table skeleton.
- Error/degraded: recoverable message without raw query/provider details.

Excludes:

- Passive repository framing where files matter more than tracked obligations,
  dates, owners, and work.

Acceptance:

- User can answer what contracts exist, who owns them, what needs review, and
  which dates matter.

### `/work`

Status: Ship.

Release role:

- Turns contract records into accountable action.
- Consolidates tasks, approvals, obligations, and exceptions.

Direct access behavior:

- Authenticated workspace route.
- Create/update actions require role authorization.

Contains:

- Header: Work.
- Primary action to create a work item if the workflow is complete.
- Summary chips: active, blocked, overdue, due soon, unassigned.
- Tabs: All, My work, Overdue, Blocked, Approvals, Obligations, Exceptions.
- Filters for owner, due date, contract, status, and type.
- Sort by urgency and other implemented sort options.
- Rows with work item, contract, owner, due date, status, updated time, and
  primary action.
- Actions for review, complete, assign, update, block, resolve, and more menu
  only where backed by working mutations.
- Empty and filtered-empty states.

States:

- Empty: explain that work appears from reviewed fields, dates, obligations,
  approvals, exceptions, and manual work items.
- Filtered empty: clear filters without leaving the page.
- Degraded: counts may show partial-data state when work aggregation is delayed.

Absorbs:

- `/contracts/tasks`.
- `/contracts/obligations`.
- `/contracts/approvals`.

Acceptance:

- User can identify overdue, blocked, assigned, and unassigned work in one
  place.

### `/contracts/renewals`

Status: Ship.

Release role:

- High-value Core use case.
- Reduces missed renewal/notice risk without claiming guarantees.

Direct access behavior:

- Authenticated workspace route.
- Export and task creation are role-gated.

Contains:

- Header: Renewals.
- Export renewal report action.
- Create renewal task action.
- Upcoming renewals table.
- Filters for due window, owner, counterparty, status, and review state.
- Renewal date, notice date, owner, status, next action, and related work/evidence
  context.
- Reviewed/source/computed state for date fields where available.
- Links to contracts and work.
- Empty state prompting date review or upload.

States:

- Empty: upload/import and review-date CTAs.
- Missing dates: show which contracts need renewal or notice review.
- Partial data: visible warning when date freshness or recompute state is
  degraded.
- Filtered empty: clear filters and preserve selected window.

Excludes:

- Guarantee that renewals cannot be missed.
- Decision-intelligence or legal recommendation framing.

Acceptance:

- User can see upcoming dates, source/review status, owner, and next action.

### `/contracts/evidence-studio`

Status: Ship.

Release role:

- Supports proof collection for obligations and follow-up.
- Differentiates Oblixa from a static tracker without becoming compliance
  automation.

Direct access behavior:

- Authenticated workspace route.
- Request, upload, review, and close actions are role-gated.

Contains:

- Header: Evidence.
- Request evidence action.
- Request counts: open, overdue, received, due soon, missing file.
- Tabs for open requests, overdue requests, received evidence, linked
  obligations.
- Filters for owner, status, contract, obligation, due date, and file state.
- Quick filters for due soon and missing file.
- Rows with request title, linked obligation, owner, due date, status, updated
  time, file count, upload/review action, and more menu.
- Empty state for creating the first request.

States:

- Empty: create first evidence request or open linked obligations.
- Missing file: explicit file-needed state and upload action.
- Received: distinguish uploaded proof from reviewed/accepted proof when the
  workflow supports review.
- External participant: link status is shown without exposing the raw token.

Terminology:

- Use "Evidence."
- Do not use "Assurance" for Core users.

Acceptance:

- User can request, track, receive, and review evidence tied to a contract or
  obligation.

### `/reports`

Status: Ship.

Release role:

- Converts tracked work into shareable outputs.
- Makes replacing the spreadsheet defensible to leadership, finance,
  operations, or legal-adjacent stakeholders.

Direct access behavior:

- Authenticated workspace route.
- Run/export/send actions are role-gated and provider-config gated.

Contains:

- Header: Reports.
- Export upcoming renewals action.
- Recoverable partial-data state when data freshness is degraded.
- Report catalog.
- Report filters/parameters.
- Preview table.
- Run, export, download, retry, or send actions only when backed by working
  permissions and job states.
- Report history when report runs can be created or sent.

Report preview requirements:

- Preview identifies report type, selected filters, visible row count, partial
  data state, and export availability.
- Tables show contract, counterparty, owner, status, date, next action, or
  request fields appropriate to the selected report.
- Exports use the same filters as preview and disclose partial-data limitations.

Core reports:

- Upcoming renewals.
- Notice deadlines.
- Missing owners.
- Missing key fields.
- Open obligations.
- Overdue work.
- Exceptions by owner.
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
  Notifications, Imports/exports, and other implemented settings destinations.
- Profile settings.
- Workspace identity.
- Team members, roles, pending invites, and invite action when authorized.
- Billing/access status entry.
- Security entry.
- Export/deletion entry when implemented.

States:

- Non-admin: read-only or limited settings view.
- Missing workspace: workspace-required state.
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
- Link to review fields after extraction begins or completes.

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
- Downloadable or visible CSV column expectations when available.
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
- Reviewed key fields and missing/unreviewed field states.
- Renewal and notice checkpoints.
- Owner assignment.
- Obligations.
- Tasks/work.
- Approvals.
- Exceptions.
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
- Turns source-backed suggestions into reviewed operational data.

Direct access behavior:

- Authenticated contextual route.
- Reachable from dashboard, contracts, contract detail, import/upload completion,
  and review CTAs.
- Review actions require review/edit permission.

Contains:

- Header: Review fields.
- Progress indicator.
- Field queue with contract list.
- Suggested value, current approved value, confidence hint where used, source
  snippet, source preview, and contract context.
- Actions: approve, edit, mark unknown, skip.
- Link to source and contract.
- Empty state when no fields need review.
- Recoverable state when source text or preview is temporarily unavailable.

Acceptance:

- User can approve or correct suggested values with source context visible.

### `/contracts/exceptions`

Status: Contextual.

Release role:

- Surfaces tracking problems that would otherwise stay hidden in a spreadsheet.

Direct access behavior:

- Authenticated contextual route.
- Reachable from dashboard, contracts, work, and contract detail when exceptions
  exist.
- Create/update/resolve actions are role-gated.

Contains:

- Exception list with severity, owner, contract, status, due state, and next
  action.
- Create, update, assign, resolve, and reopen actions only where implemented.
- Filters for status, owner, severity, due state, and contract.
- Empty state when no exceptions are open.
- Path back to `/work`.

Terminology:

- Exceptions are tracking issues, not compliance findings.

Acceptance:

- User can identify, assign, and resolve contract-tracking exceptions.

### `/search`

Status: Contextual.

Release role:

- Reduces navigation friction as the workspace grows.

Direct access behavior:

- Authenticated contextual route.
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

Acceptance:

- Search returns only accessible destinations and records.

## Merged Core Routes

### `/contracts/tasks`

Status: Merge.

Release state:

- Redirect or thin wrapper to `/work` with task context.
- No separate primary nav, public copy, or dashboard promotion.
- Task rows live in Work with owner, status, due date, contract, and action.

### `/contracts/obligations`

Status: Merge.

Release state:

- Redirect or thin wrapper to `/work` with obligations context.
- Obligation detail belongs on contract detail.
- Obligation rows include owner, contract, due date, status, evidence state, and
  source/review state.

### `/contracts/approvals`

Status: Merge.

Release state:

- Redirect or thin wrapper to `/work` with approvals context.
- Approval rows include requester, owner, status, due state, contract, and
  action.
- No SLA-simulator promotion for Core users.

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
- Sensitive actions require step-up where implemented.
- Non-admin users see only account-level controls they are allowed to manage.

Contains:

- Account security header.
- MFA status and setup/removal flows where implemented.
- Session list and session controls where implemented.
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

- User can inspect and manage supported account/workspace security controls.

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
- Evaluation or paid-plan state.
- Included Core capabilities.
- Checkout, portal, invoice, and payment actions only when provider-backed and
  configured.
- Billing FAQ.
- Billing contact path.
- Disabled/unconfigured state.
- Admin-only diagnostic utilities hidden behind role and environment boundaries.

Excludes:

- Advanced/Assurance upsell.
- Public enterprise procurement language.
- Unsupported annual commitment.

Acceptance:

- Admin can understand billing/access status and reach billing actions only when
  configured.

### `/settings/operations`

Status: Admin.

Release role:

- Lets admins tune stable operational defaults without support.

Direct access behavior:

- Admin route.
- Non-admin roles redirect, deny, or see read-only workspace defaults.

Contains:

- Notification/reminder defaults for renewals, work, and digest where
  implemented.
- Role-aware read-only state.
- Validation and save states.
- Explanation of operational effect.

Excludes:

- Controls requiring internal knowledge.
- Policy language that implies automation beyond simple settings.

Acceptance:

- Admin can change only controls with clear workspace impact.

### `/settings/health`

Status: Admin.

Release role:

- Reduces support ambiguity by showing whether Core workflows are healthy.

Direct access behavior:

- Admin route.
- Diagnostics links are visible only to authorized operator/admin contexts.

Contains:

- Workspace status summary.
- Needs-action and clear-workflow counts.
- Delivery, report, import, export, extraction, reminder, and background-job
  health where configured.
- Actionable degraded states.
- Retry actions where safe.
- Support diagnostics summary.
- Role gate.

Excludes:

- Provider internals for non-admin users.
- Advanced/Assurance health items for Core workspaces unless the workspace mode
  permits them.

Acceptance:

- Admin can distinguish healthy, degraded, blocked, and configuration-needed
  states.

### `/settings/health/diagnostics`

Status: Internal.

Release state:

- Operator troubleshooting only.
- Hidden from ordinary workspace admins unless explicitly authorized.
- No secrets.
- No ordinary navigation, search, dashboard, email, or onboarding link.
- Direct access by unauthorized users redirects, denies, or returns not found.

### `/settings/product`

Status: Admin.

Release state:

- Hidden from ordinary Core users.
- No Core/Advanced/Assurance switch in the release.
- No private module enablement for ordinary users.
- If retained, it is admin/operator configuration and not a primary release
  surface.
- Direct access requires admin/operator authorization and must not expose a mode
  picker to ordinary Core users.

### `/settings/policy`

Status: Omit.

Release state:

- Hidden from ordinary Core users.
- Simple workflow defaults belong in owning Core surfaces or
  `/settings/operations` when fully supported.
- No governance, policy-registry, or simulation vocabulary in Core release.
- Direct access by ordinary Core users redirects, denies, or returns not found.

### `/settings/policy/registry`

Status: Internal.

Release state:

- Operator/admin-only registry surface.
- No public or ordinary workspace discovery.
- Direct access requires explicit authorization.

### `/settings/policy/diagnostics`

Status: Internal.

Release state:

- Operator diagnostics only.
- No ordinary workspace discovery.
- Direct access requires explicit authorization.

### `/more`

Status: Ship simplify.

Release state:

- Not part of Core primary navigation.
- Functions as an entitlement-filtered tools index when a workspace has
  destinations outside the primary Core nav.
- Can include search, section filtering, contextual shortcuts, and an empty
  state.
- Lists only destinations allowed by workspace mode, role, feature flags, and
  hidden-module settings.
- Never lists Advanced or Assurance routes for Core users.
- No stub cards or links to unavailable surfaces.

Direct access behavior:

- Authenticated route.
- Hidden from Core primary navigation and command palette when Core mode has no
  eligible extra tools.
- Direct access in Core mode shows only eligible Core-safe destinations or a
  clear empty state.

## Advanced Routes Contained From Core Release

These routes can represent substantive implementation work, but they do not help
the optimal release positioning. They must not shape public copy, pricing,
onboarding, Core navigation, Core search, dashboard cards, or emails.

### `/dashboard/persona`

Status: Omit.

Reason:

- Duplicates Dashboard and implies role-program complexity.

Release state:

- Hide from Core users.
- If retained later, make it a preference or role-specific view rather than a
  separate release promise.

### `/contracts/intake`

Status: Omit.

Reason:

- Implies pre-contract or queue-management scope beyond signed-contract
  tracking.

Release state:

- Import work stays in `/contracts/bulk`.

### `/contracts/data-quality`

Status: Omit.

Reason:

- Data quality matters, but a separate page adds conceptual load.

Release state:

- Missing fields and unreviewed suggestions surface in Dashboard, Contracts, and
  `/contracts/review`.

### `/contracts/review-cadence`

Status: Omit.

Reason:

- Review rituals are process-heavy for launch positioning.

Release state:

- Review work stays in Dashboard and `/contracts/review`.

### `/contracts/watchlists`

Status: Omit.

Reason:

- Watchlists are secondary; filters and saved views cover the initial need.

Release state:

- Monitoring signals stay in Contracts and Dashboard.

### `/contracts/execution-graph`

Status: Omit.

Reason:

- Dependency graphs imply advanced orchestration.

Release state:

- Blockers remain visible in Work and Dashboard.

### `/contracts/approvals/workload`

Status: Omit.

Reason:

- Workload analysis implies mature approval operations.

Release state:

- Approval counts and owner filters live in `/work`.

### `/contracts/approvals/sla-simulator`

Status: Omit.

Reason:

- SLA simulation conflicts with the no-enterprise-SLA release boundary.

Release state:

- No Core link or promotion.

### `/contracts/analytics`

Status: Omit.

Reason:

- Analytics distract from operational reports and imply intelligence beyond the
  release proof.

Release state:

- Core metrics live in Dashboard and Reports.

### `/contracts/collaboration`

Status: Omit.

Reason:

- A collaboration center increases permission and support surface.

Release state:

- Contract-specific notes/comments belong on contract detail only when complete.

### `/contracts/programs`

Status: Omit.

Reason:

- Program management is outside spreadsheet replacement.

Release state:

- No Core nav, search, pricing, email, or public copy references.

### `/contracts/maintenance`

Status: Internal.

Reason:

- Operator or admin utility, not user value positioning.

Release state:

- Ordinary users cannot access maintenance actions.
- Any destructive or bulk action requires preview, audit, and rollback.

### `/decisions`

Status: Omit.

Reason:

- Decision workspace positioning broadens the product beyond tracking.

Release state:

- Renewal and exception decisions remain work items or contract context.

### `/decisions/[id]`

Status: Omit.

Release state:

- Guard or redirect for ordinary Core users.

### `/decisions/review`

Status: Omit.

Release state:

- No manager-review queue in Core release.

### `/decisions/compare`

Status: Omit.

Release state:

- No comparison workflow in Core release.

### `/campaigns`

Status: Omit.

Reason:

- Campaigns imply scale and change management beyond Core release.

Release state:

- No nav, search, dashboard, email, or public promotion.

### `/campaigns/[id]`

Status: Omit.

Release state:

- Guard or redirect for ordinary Core users.

### `/campaigns/compare`

Status: Omit.

Release state:

- No campaign comparison in Core release.

### `/relationship-workspaces`

Status: Omit.

Reason:

- Relationship intelligence broadens the product beyond contract tracking.

Release state:

- Counterparty visibility stays inside contract inventory/detail.

### `/accounts/[key]`

Status: Omit.

Release state:

- Account workspace links do not appear in Core navigation, search, command
  palette, reports, dashboard, or emails.

### `/accounts`

Status: Boundary.

Release state:

- No standalone Core destination.
- Redirect, not-found, or show safe unavailable state.

### `/counterparties/[key]`

Status: Omit.

Release state:

- Counterparty workspace links do not appear in Core navigation, search, command
  palette, reports, dashboard, or emails.

### `/counterparties`

Status: Boundary.

Release state:

- No standalone Core destination.
- Redirect, not-found, or show safe unavailable state.

## Assurance Routes Contained From Core Release

Assurance pages are not part of the optimal Core release positioning. They
reframe Oblixa as compliance, controls, or risk governance, which weakens the
contract-tracking wedge.

### `/assurance`

Status: Omit.

Release state:

- Hidden from Core users.
- No public, nav, search, pricing, email, report, or dashboard references.

### `/assurance/findings`

Status: Omit.

Reason:

- Findings imply risk/compliance determinations.

### `/assurance/findings/[id]`

Status: Omit.

Release state:

- Finding detail links unavailable to ordinary Core users.

### `/assurance/control-policies`

Status: Omit.

Reason:

- Control policies are outside contract-tracking release.

### `/assurance/control-policies/[id]`

Status: Omit.

Release state:

- Control policy detail links unavailable to ordinary Core users.

### `/assurance/scorecards`

Status: Omit.

Reason:

- Scorecards imply formal assurance measurement.

### `/assurance/playbooks`

Status: Omit.

Reason:

- Playbooks imply managed assurance operations.

### `/assurance/review-boards`

Status: Omit.

Reason:

- Review boards imply enterprise governance.

### `/assurance/segments`

Status: Omit.

Reason:

- Segmentation is assurance infrastructure.

### `/assurance/program-evolution`

Status: Omit.

Reason:

- Program evolution is outside Core value.

### `/assurance/health-graph`

Status: Omit.

Reason:

- Health graph implies authoritative controls modeling.

### `/assurance/autopilot`

Status: Omit.

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
- Sanitized diagnostic reference if available.

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
- Field review.
- Tasks, approvals, obligations, exceptions, renewals, reminders, evidence.
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

- Create external link.
- Token status.
- Token submit.
- Token workflow step and participant workflow step.

Release rules:

- Tokens are scoped, expiring, non-browsable, and redacted from logs.
- Token routes expose only the requested action context.
- Already-submitted, expired, invalid, and revoked states are safe and
  non-enumerating.

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
- If directly reached by a Core user, they must be guarded, denied, or redirected
  without exposing cross-surface data.

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
- Extraction failed or manual review needed.
- Field review reminder.
- Upcoming renewal reminder.
- Notice deadline reminder.
- Work item assigned.
- Work item overdue.
- Evidence requested.
- Evidence overdue.
- Report/export completed or failed when the user initiated it.
- Weekly digest only when digest generation, preferences, and delivery failure
  states are complete.

Rules:

- Welcome copy focuses on first product action.
- Extraction emails require review of source-backed suggestions before reliance.
- Renewal emails avoid guarantee language.
- Evidence emails name requested proof and due date.
- Billing lifecycle emails stay secondary until billing is active.
- Emails do not promote Advanced, Assurance, Autopilot, campaigns, decisions,
  relationship workspaces, control policies, scorecards, playbooks, or omitted
  routes to Core users.

## Release State Invariants

- Public routes state the product boundary: post-signature contract tracking for
  signed agreements.
- Public and auth copy says "request access" or "limited rollout" when
  describing access control; it does not use beta-like positioning.
- Primary app navigation contains only Dashboard, Contracts, Work, Renewals,
  Evidence, Reports, and Settings.
- Core pages expose upload/import, review, ownership, dates, work, evidence,
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
- API routes enforce auth, tenant scope, validation, redaction, rate limits, and
  recoverable errors according to their family.
- Background and internal routes are not public positioning surfaces.
- Documentation remains documentation only; no runtime or implementation code
  depends on this file.

## Core Release Surface Map

| Route | Status | Primary role | Direct access behavior |
| --- | --- | --- | --- |
| `/` | Ship | Homepage | Public; request-access CTA |
| `/product` | Ship | Product tour | Public; request-access CTA |
| `/early-access` | Ship simplify | Request access | Public; creates request, not workspace |
| `/pricing` | Ship simplify | Paid-use clarity | Public; no checkout unless configured |
| `/contact` | Ship simplify | Async contact | Public; creates contact record |
| `/security` | Ship | Trust page | Public; no workspace data |
| `/privacy` | Ship | Privacy policy | Public |
| `/terms` | Ship | Terms | Public |
| `/acceptable-use` | Ship | Acceptable use | Public |
| `/accessibility` | Ship | Accessibility contact | Public |
| `/cookies` | Ship | Cookie transparency | Public |
| `/login` | Ship | Sign in | Public when unauthenticated; authenticated redirects |
| `/signup` | Ship gated | Gated account creation | Public but access-gated |
| `/forgot-password` | Ship | Recovery request | Public; neutral success |
| `/reset-password` | Ship | Recovery completion | Token/session-gated |
| `/auth/callback` | Boundary | Auth handoff | Callback only; safe redirect |
| `/external/[token]` | Contextual | External action | Scoped token link only |
| `/external` | Boundary | Invalid external link | Safe invalid-link state |
| `/onboarding/calibration` | Ship simplify | Workspace setup | Authenticated admin setup |
| `/dashboard` | Ship | Operational overview | Authenticated workspace route |
| `/contracts` | Ship | Contract inventory | Authenticated workspace route |
| `/work` | Ship | Owned work queue | Authenticated workspace route |
| `/contracts/renewals` | Ship | Renewal tracking | Authenticated workspace route |
| `/contracts/evidence-studio` | Ship | Evidence requests | Authenticated workspace route |
| `/reports` | Ship | Operational reports | Authenticated workspace route |
| `/settings` | Ship | Workspace administration | Authenticated; role-shaped panels |
| `/contracts/new` | Contextual | Upload contract | Authenticated contextual upload |
| `/contracts/bulk` | Contextual | Import contracts | Authenticated contextual import |
| `/contracts/imports/[jobId]` | Contextual | Import job detail | Workspace-scoped detail route |
| `/contracts/[id]` | Ship | Contract detail | Workspace-scoped detail route |
| `/contracts/review` | Contextual | Field review | Authenticated contextual review |
| `/contracts/exceptions` | Contextual | Tracking exceptions | Authenticated contextual queue |
| `/search` | Contextual | Workspace search | Authenticated; filtered by access |
| `/contracts/tasks` | Merge | Task context | Redirect or wrapper to Work |
| `/contracts/obligations` | Merge | Obligation context | Redirect or wrapper to Work |
| `/contracts/approvals` | Merge | Approval context | Redirect or wrapper to Work |
| `/contracts/reports` | Merge | Report history | Redirect or wrapper to Reports |
| `/settings/security` | Ship | Account/workspace security | Authenticated; sensitive actions step-up |
| `/settings/billing` | Admin | Billing/access status | Admin; provider-config gated |
| `/settings/operations` | Admin | Operational defaults | Admin or read-only for non-admin |
| `/settings/health` | Admin | Workspace health | Admin; diagnostics gated |
| `/settings/health/diagnostics` | Internal | Operator diagnostics | Explicit authorization only |
| `/settings/product` | Admin | Operator/admin config | Admin/operator only; no ordinary mode picker |
| `/settings/policy` | Omit | Policy defaults | Hidden or denied for ordinary Core users |
| `/settings/policy/registry` | Internal | Policy registry | Explicit authorization only |
| `/settings/policy/diagnostics` | Internal | Policy diagnostics | Explicit authorization only |
| `/more` | Ship simplify | Tools index | Authenticated; entitlement-filtered |
| `/dashboard/persona` | Omit | Persona dashboard | Hidden from Core |
| `/contracts/intake` | Omit | Intake utility | Hidden from Core |
| `/contracts/data-quality` | Omit | Data-quality utility | Hidden from Core |
| `/contracts/review-cadence` | Omit | Review cadence | Hidden from Core |
| `/contracts/watchlists` | Omit | Watchlists | Hidden from Core |
| `/contracts/execution-graph` | Omit | Execution graph | Hidden from Core |
| `/contracts/approvals/workload` | Omit | Approval workload | Hidden from Core |
| `/contracts/approvals/sla-simulator` | Omit | SLA simulator | Hidden from Core |
| `/contracts/analytics` | Omit | Advanced analytics | Hidden from Core |
| `/contracts/collaboration` | Omit | Collaboration center | Hidden from Core |
| `/contracts/programs` | Omit | Program management | Hidden from Core |
| `/contracts/maintenance` | Internal | Maintenance utility | Operator/admin utility |
| `/decisions` | Omit | Decisions hub | Hidden from Core |
| `/decisions/[id]` | Omit | Decision detail | Hidden from Core |
| `/decisions/review` | Omit | Decision review | Hidden from Core |
| `/decisions/compare` | Omit | Decision comparison | Hidden from Core |
| `/campaigns` | Omit | Campaigns hub | Hidden from Core |
| `/campaigns/[id]` | Omit | Campaign detail | Hidden from Core |
| `/campaigns/compare` | Omit | Campaign comparison | Hidden from Core |
| `/relationship-workspaces` | Omit | Relationship workspace | Hidden from Core |
| `/accounts/[key]` | Omit | Account workspace | Hidden from Core |
| `/accounts` | Boundary | Account root | Safe unavailable state |
| `/counterparties/[key]` | Omit | Counterparty workspace | Hidden from Core |
| `/counterparties` | Boundary | Counterparty root | Safe unavailable state |
| `/assurance` | Omit | Assurance hub | Hidden from Core |
| `/assurance/findings` | Omit | Findings | Hidden from Core |
| `/assurance/findings/[id]` | Omit | Finding detail | Hidden from Core |
| `/assurance/control-policies` | Omit | Control policies | Hidden from Core |
| `/assurance/control-policies/[id]` | Omit | Control policy detail | Hidden from Core |
| `/assurance/scorecards` | Omit | Scorecards | Hidden from Core |
| `/assurance/playbooks` | Omit | Playbooks | Hidden from Core |
| `/assurance/review-boards` | Omit | Review boards | Hidden from Core |
| `/assurance/segments` | Omit | Segments | Hidden from Core |
| `/assurance/program-evolution` | Omit | Program evolution | Hidden from Core |
| `/assurance/health-graph` | Omit | Health graph | Hidden from Core |
| `/assurance/autopilot` | Omit | Autopilot | Hidden from Core |
