# Oblixa UI Design Principles

This document defines the target visual, interaction, and creative system for
Oblixa. It governs page layouts, shared components, copy, typography, color,
density, public-site art direction, and product-app surface treatment.

The document must not become a runtime dependency. Code may be tested against the
intended design contract, but production behavior must never depend on reading
this file.

## 1. Core Thesis

Oblixa turns signed contracts into an operational system: confirmed details,
dates, owners, tasks, evidence, and reports. The UI must make that transformation
feel specific, trustworthy, and inevitable.

Oblixa has two related but different design modes:

| Mode | Job | Visual posture |
|---|---|---|
| **Public site** | Make Oblixa memorable, credible, and worth requesting access to. | Art-directed, product-specific, dramatic when earned, proof-heavy. |
| **Product app** | Help operators understand and act on contract follow-up. | Light-first, precise, dense, restrained, workflow-efficient. |

The public site and product app must share a recognizable Oblixa language, but
they should not have the same pacing, density, or theatrical range. The app is
an operational workspace. The public site is a brand-defining argument.

Design goals:

- **Comprehension first**: users should understand each page, count, status,
  shortcut, and action without translating internal terminology.
- **Source-backed trust**: suggested details, confirmed details, source text,
  files, workspace scope, and administrative controls must be visually distinct.
- **Operational precision**: alignment, borders, rules, and object hierarchy carry
  product surfaces more than glow, gradients, or decorative cards.
- **Public-site memorability**: marketing pages must have a strong creative
  concept, product-specific motifs, and enough visual force to be remembered.
- **Distinctiveness without imitation**: references can calibrate quality, but
  Oblixa needs its own visual world.

## 2. Dovetail Reference Boundary

Dovetail is a useful reference for quality, confidence, and art direction. It is
not a template to copy.

Extract these qualities:

- a decisive first viewport
- a clear creative concept
- strong typography and contrast
- a repeatable geometric motif
- product UI staged as an object of interest
- memorable atmosphere
- section choreography rather than stacked templates
- confidence that precedes explanation

Do not copy these qualities:

- Dovetail's black-first palette as the Oblixa default
- pixelated type
- Dovetail's exact landing structure
- 3D keyboard/object spectacle as a routine motif
- Dovetail's customer-signal positioning
- abstract AI magic visuals
- logo-wall proof as a substitute for product clarity

For Oblixa, the translation is:

> Source-backed contract operations, staged with enough visual conviction that
> signed contracts feel like they become a living control system.

Reference usage rule:

- Use Dovetail to calibrate ambition, not to justify copying palette, structure,
  type, or objects.
- A reference is useful only when it clarifies a visual quality Oblixa should own.
- If a pass produces a compliant but forgettable page, the reference has not been
  applied at the right level.

## 3. Design Modes

### 3.1 Product App System

The app is a light-first operational system.

App surfaces should feel:

- precise
- efficient
- trustworthy
- calm
- scannable
- source-backed
- business-critical

App surfaces should not feel:

- theatrical
- decorative
- marketing-led
- pastel SaaS
- generic AI dashboard
- visually empty

Preserve by default:

- route structure
- navigation membership
- page purpose
- table-first inventory surfaces
- queue-first task and review surfaces
- existing Core workflows
- current auth, billing, roles, and hidden-route eligibility rules

Change when justified:

- color system
- typography hierarchy
- surface treatment
- radius, border, shadow, and focus treatment
- chip, badge, and status presentation
- page-header treatment
- table density and alignment
- local section grouping when the current structure impedes comprehension

Structural redesign is allowed only when the current structure itself creates a
clarity defect. Do not redesign a route merely because a reference site uses a
different structure.

### 3.2 Public Site System

The public site is not the app with larger headings. It is the product's
argument, atmosphere, and memory structure.

Public pages should feel:

- art-directed
- specific to Oblixa
- visually substantial
- confident
- product-evident
- buyer-aware
- memorable

Public pages should not feel:

- like documentation
- like a sequence of generic SaaS sections
- like a compliance checklist
- empty in the name of restraint
- table-heavy without visual relief
- copied from Dovetail

Public pages may use stronger contrast, larger type, staged product visuals,
denser proof modules, selective high-contrast bands, and more dramatic section
pacing than the app. This is allowed as long as the page remains Oblixa-specific
and does not turn into abstract AI spectacle.

### 3.3 Shared Oblixa Motifs

The public site and app should share motifs that are native to Oblixa's product
model.

Preferred motifs:

- signed contract record
- source snippet
- suggested detail becoming confirmed detail
- owner assignment
- date window
- task queue
- evidence request
- report/export trail
- audit/history line
- contract set / bounded workspace
- spreadsheet drift becoming controlled workflow

Visual devices that can express these motifs:

- source-highlight strips
- before/after record transformations
- ruled contract ledgers
- confirmation rails
- workflow timelines
- evidence packets
- queue stacks
- export receipts
- contract cells
- thin geometric frames inspired by documents, tables, and source locations

These motifs should do more than decorate. They should explain how Oblixa works.

## 4. Public Site Creative Direction

### 4.1 Creative Concept Required

Do not implement a major public-page redesign without a creative concept.

A creative concept is a concise visual premise that organizes the page. It should
answer:

1. What transformation does Oblixa make visible?
2. What recurring visual motif expresses that transformation?
3. What should the first viewport make the visitor feel?
4. How does the page prove the product without becoming a documentation page?
5. What is the page's memorable visual signature?

Acceptable Oblixa concepts include:

- signed contracts become live operational records
- static agreements become an accountable control system
- source-backed details turn contract memory into action
- scattered follow-up becomes a contract operations queue
- the PDF becomes a workspace of dates, owners, tasks, evidence, and reports

If the concept cannot be stated, the page will likely become generic.

### 4.2 First Viewport Standard

The first viewport must be memorable and product-specific.

It must include:

- a strong promise in plain language
- a visible product or product-derived object
- a clear request-access path
- a trust or scope signal
- a visual motif that can recur later on the page

It should avoid:

- centered headline plus small card as the whole composition
- product mock that looks like a generic dashboard
- large empty margins without visual purpose
- generic AI wording
- relying on blue buttons as the only brand signal

The first viewport does not have to be light-only. It may use a high-contrast
stage, dark inset, dramatic product frame, or strong geometric field if that
serves the creative concept. The product app remains light-first.

### 4.3 Public Page Rhythm

Public pages need section choreography, not repeated sections.

A strong public page alternates:

- high-impact brand/product stage
- dense proof module
- editorial explanation
- product workflow demonstration
- comparison or objection handling
- fit/pricing/access path

Allowed section patterns:

- product-stage hero
- split editorial/product proof section
- full-width transformation diagram
- before/after contract record
- comparison table
- workflow rail with staged product module
- source-backed review demonstration
- evidence/report trail
- fit checklist with product record
- high-contrast interlude when earned
- pricing/access path with operational commitments
- compact FAQ for objections

Avoid using `eyebrow -> centered heading -> centered paragraph -> isolated card`
as the default rhythm. That pattern may appear once or twice, not as the page's
structure.

### 4.4 Public Page Density

Restraint is not sparseness.

Every major public-page viewport should contain one of:

- product UI evidence
- transformation visual
- workflow diagram
- comparison table
- capability proof
- outcome/proof block
- pricing/access explanation
- trust/security explanation
- concrete contract-operations example

Large blank bands are defects unless they frame a major focal moment. If a
section looks elegant but could describe any SaaS product, revise it.

### 4.5 Product Evidence On Public Pages

Public product visuals should be staged, not merely shown.

Good product evidence:

- shows realistic contract objects
- explains a workflow state
- demonstrates source-backed confirmation
- shows before/after transformation
- contains enough density to feel credible
- has strong internal hierarchy
- is visually framed as a product moment

Weak product evidence:

- generic dashboard cards
- decorative mock tables
- isolated screenshots without narrative purpose
- fake UI that does not teach the workflow
- too many similar bordered panels

Public product mocks should include real Oblixa concepts:

- signed contracts
- renewal and notice dates
- suggested details
- source snippets
- owners
- tasks
- evidence requests
- reports or exports

### 4.6 Table And Panel Budget On Public Pages

Tables are useful for Oblixa, but they are not a brand by themselves.

Rules:

- Do not place several table-like sections in sequence without a different
  visual structure between them.
- Use tables when comparison, rows, or operational proof are the point.
- Use transformation diagrams, staged records, rails, or product scenes when the
  page needs memorability.
- If a public page feels like documentation, reduce table repetition and increase
  visual staging.

### 4.7 Public Site Visual Mass

Public pages need visual mass from Oblixa-specific material, not decoration.

Allowed sources of visual mass:

- large staged product scenes
- contract/source transformation modules
- strong geometric frames
- dense but readable proof modules
- editorial type moments
- high-contrast product stages
- repeated source/record/queue motifs

Not allowed:

- abstract glowing orbs
- generic AI illustrations
- decorative charts with no product meaning
- table repetition as filler
- stock-like imagery
- empty gradients

### 4.8 Public Site Quality Bar

A public page is not successful merely because it is clear and compliant. It is
successful when it makes Oblixa feel specific, inevitable, and memorable.

Public page checks:

- If the logo were removed, would the page still feel like Oblixa?
- Is there a visual idea a visitor could remember?
- Does the page show the product transformation, not just describe it?
- Does each section have a distinct role?
- Is there enough visual force to compete with high-quality SaaS references?
- Does the page avoid copying the reference while matching its ambition?

## 5. Product App Visual System

### 5.1 Light-First Palette Direction

The app's target palette is light-first, technical, and neutral. It is not
Dovetail black and not the old pale-blue SaaS system.

Use a light technical palette:

| Role | Direction |
|---|---|
| Canvas | Cool white or very light neutral. Avoid broad blue haze. |
| Page frame | Slightly deeper neutral used to structure work areas. |
| Panel surface | White or lightly graphite-tinted. High contrast against canvas. |
| Inset surface | Muted neutral for table headers, source areas, and filter bands. |
| Primary text | Near-black graphite. Avoid navy as the default text color. |
| Secondary text | Neutral gray with sufficient contrast. |
| Tertiary text | Muted gray, used only for metadata and quiet hints. |
| Border | Precise neutral gray rules. Border strength creates hierarchy. |
| Accent | Restrained cobalt or blue. Used for current route, primary action, focus, and selected state. |
| Status | Muted red, amber, green, and blue. Status colors are semantic only. |

Initial token target:

| Token role | Target family |
|---|---|
| `--canvas` | Warm or cool off-white, approximately `#f7f7f3` to `#fafaf7`. |
| `--canvas-strong` | Slightly deeper neutral, approximately `#eeeeea` to `#f2f3ee`. |
| `--surface` | Near-white neutral, usually `#ffffff` or a very light graphite tint. |
| `--surface-muted` | Neutral inset fill, approximately `#f3f4f1` to `#f6f6f3`. |
| `--text-primary` | Graphite near-black, not navy. |
| `--text-secondary` | Neutral gray with strong contrast against surfaces. |
| `--border-subtle` | Cool/warm neutral gray, visible but quiet. |
| `--border-strong` | Stronger neutral used for table frames, selected rows, and active panels. |
| `--accent` | Restrained cobalt/blue. Avoid electric neon except for narrow focus indicators. |
| `--accent-soft` | Very low-chroma tint. Never a broad blue page wash. |

These are target families, not mandatory final hex values. Tune the final palette
in-browser against real Core surfaces before making it canonical.

Rules:

- Color should clarify state, selection, or hierarchy.
- Do not use color as decoration.
- Do not rely on wide blue-tinted backgrounds to make a page feel designed.
- Avoid gradients as default app-surface treatment.
- Use design tokens in code, not hard-coded one-off colors.
- Never use literal `white` or `black` inside `color-mix(...)`; use tokens that
  adapt to mode.

### 5.2 Dark Mode

Dark mode is supported only as an adaptation of the light-first app system.

Rules:

- Do not design dark mode as the canonical product-app appearance.
- Do not import Dovetail's black canvas as the app default.
- Preserve the same route structure, density, and object hierarchy as light mode.
- Use dark surfaces to maintain readability, not to create spectacle.
- Re-tune borders and status colors so they remain visible without glowing.

Public pages may use high-contrast or dark stages as art direction. That does not
make the product app dark-first.

### 5.3 Surface Roles

Use functional surface roles instead of card tiers.

| Surface | Purpose | Treatment |
|---|---|---|
| Canvas | Page background | Light neutral, quiet geometric texture only when useful. |
| Page frame | Route-level work area | Full-width or max-width constrained region with strong alignment. |
| Operational panel | Bounded work module | Thin border, low radius, minimal shadow. |
| Table surface | Inventory or queue | Header band, row rules, stable columns, clear hover/selection. |
| Inspection pane | Review or source-backed verification | Strong separation between source, suggestion, confirmation, and context. |
| Summary band | Count and filter overview | Compact, explanatory, object-specific counts. |
| Dialog | Interruptive or confirming action | Clear title, short body, explicit primary/destructive action. |
| Alert | Important system state | Semantic tone, concise copy, clear recovery action. |
| Public feature stage | Marketing/product explanation | More expressive than app surfaces; concept-led. |

### 5.4 Radius, Borders, Shadows

Default app shape should be precise, not pillowy.

- Panels: 6px to 8px radius.
- Tables: 6px to 8px outer radius, square internal grid.
- Buttons: 6px radius.
- Inputs: 6px radius.
- Chips: compact capsule only when semantically useful.
- Dialogs: 8px radius.

Hierarchy order in the app:

1. Layout and alignment.
2. Border strength.
3. Surface contrast.
4. Typography.
5. Controlled accent color.
6. Shadow, only when elevation is genuinely needed.

Avoid:

- heavy glow
- soft pastel cards
- large rounded friendly SaaS containers
- shadows that do the job of borders
- nested cards used only for decoration

### 5.5 Geometric Structure

Subtle geometry is allowed when it supports the product's technical character.

Allowed:

- thin ruled grids
- hairline dividers
- framed panel groups
- table-like alignment
- source-location marks
- faint document/table geometry on public pages

Not allowed:

- decorative grids that compete with content
- invisible decorations that only appear in dev tools
- busy background texture behind dense tables
- public-site atmosphere inside app work routes

If a geometric element can be removed without changing the perceived UI quality,
remove it.

## 6. Typography

Use a clean sans-serif for all human-readable UI. Do not use pixelated type in
Oblixa, even when referencing Dovetail.

Typography rules:

- App page titles should be confident but not landing-scale.
- Public page titles may be much larger and more editorial when the concept earns
  it.
- Route leads should explain the page's job in one short sentence.
- Body text should be direct and operational.
- Uppercase text is reserved for structural labels and compact metadata.
- Do not uppercase user-provided names, organizations, emails, or file names.
- Counts, dates, durations, percentages, and ratios use tabular numbers.
- Mono type is for technical strings only: IDs, paths, environment keys,
  timestamps, source snippets, and compact machine-like values.

Suggested app scale:

| Use | Direction |
|---|---|
| Page title | 28px to 34px, semibold, tight line height |
| Section title | 14px to 18px, semibold |
| Table row title | 13px to 14px, semibold |
| Body copy | 13px to 15px |
| Metadata | 11px to 12px |
| Structural caps | 10px to 11px, moderate tracking |
| Large operational number | 28px to 40px, tabular, no decorative treatment |

Suggested public scale:

| Use | Direction |
|---|---|
| Hero title | Large enough to create a brand moment; avoid app-scale restraint. |
| Editorial section title | Varied by section role; not every section gets the same size. |
| Product proof label | Compact, structural, often caps or mono. |
| Source snippet | Mono or source-like treatment, readable before decorative. |
| Proof number | Large only when tied to a real claim or product concept. |

Do not overuse wide letter spacing. It should help structure, not become a
visual signature applied everywhere.

## 7. Page Architecture

### 7.1 App Page Header

The default app header is direct and utility-oriented.

Required elements:

- route title
- concise route purpose
- primary route actions when available
- optional route metadata when useful

Avoid default decorative identity patterns:

- no icon tile by default
- no obligatory eyebrow
- no page-header card unless the route genuinely needs a bounded intro region
- no duplicate title inside the first panel

Icons in app page headers are allowed only when they add semantic value. The
route title should carry identity.

### 7.2 Core Route Layout

Core operational routes should prioritize the work object:

- contracts prioritize the table and filters
- review routes prioritize source-backed confirmation
- tasks prioritize queue filters and task rows
- renewals prioritize dates and next actions
- evidence prioritizes request state and proof files
- reports prioritize report selection, preview, export state, and rows

Do not add dashboard-style metric cards to every route. Use summaries only when
they clarify the route's current work state.

### 7.3 Section Structure

Sections should be separated by:

- spacing
- thin rules
- panel boundaries
- header bands
- consistent columns

Do not stack multiple card treatments simply to make a page look full.

### 7.4 Density

Operational density is acceptable. Clutter is not.

Density is acceptable when:

- columns align
- row height is stable
- icons have reserved slots
- chips are bounded and meaningful
- long names truncate predictably
- the object type of each count is clear

Density becomes clutter when:

- multiple chip rows compete for attention
- counts appear without object labels
- row actions are ambiguous
- table cells overlap
- decorative icons repeat without purpose

## 8. Components

### 8.1 Tables

Tables are first-class app surfaces.

Rules:

- Table layout must be planned before visual decoration is added.
- The checkbox column must never touch or overlap the table container border.
- Header labels must be stable and aligned with row content.
- Row hover and selected states must be visible but restrained.
- Long contract names, owner names, emails, and counterparty names must truncate
  with stable widths.
- Status and type labels must not crowd primary object names.
- Row actions must say what they do.
- Empty table states must identify the missing object type and next action.
- Table footer counts must describe rows shown, not repeat page totals without
  purpose.

Use table density to support scanning, not to show every possible attribute.

Table priority order:

1. Primary object name.
2. Status or date that changes what the user should do.
3. Owner or responsible party.
4. Related object metadata.
5. Secondary timestamps and counts.
6. Row actions.

If a table cannot show all attributes without crowding, remove lower-priority
attributes before reducing readability.

### 8.2 Summary Bands And Shortcuts

Summary bands must explain what is counted and what the shortcut does.

Every count must specify its object type:

- contracts
- tasks
- dates
- evidence requests
- files
- reports
- rows
- users
- workspaces

Shortcut filters must answer:

1. What object is counted?
2. What condition qualifies the object?
3. Does clicking filter the table below?

Examples:

- `104 contracts needing review`
- `68 tasks cannot proceed`
- `22 dates in view`
- `35 open evidence requests`

Avoid vague labels:

- `Needs response`
- `Open`
- `Review`
- `Issues`
- `Pending`

Use them only when the surrounding text makes the object and condition explicit.

### 8.3 Tabs

Tabs switch the visible category or view. They are not a dumping ground for every
status count.

Rules:

- Tab labels must be mutually understandable.
- Counts on tabs reflect the active filter context unless explicitly stated
  otherwise.
- A tab row should not duplicate a shortcut row with the same labels.
- Use tabs for durable views, shortcuts for attention filters.

### 8.4 Filters And Dropdowns

Filters should feel precise and compact.

Rules:

- Filter labels identify the dimension being filtered: Owner, Status,
  Counterparty, Date, Type, Requirement, Files.
- Avoid native selects for custom-styled app filters.
- Dropdown menus inside clipped panels must render through a portal or otherwise
  avoid clipping.
- Applied filters must be visible or clearable.
- Sort controls are visually separate from filters.

### 8.5 Chips And Badges

Chips are metadata, state, or filter affordances. They are not decoration.

Allowed chip uses:

- selected filter
- status value
- compact count with object label
- date or duration
- type label
- risk/attention state
- stable metadata attached to a row

Rules:

- Do not create rows of decorative pills.
- Do not repeat the same count in a label and trailing badge.
- Do not use chips to compensate for unclear layout.
- Keep chips compact and low-radius.
- Status chips must explain the operational condition.
- Count chips must define the counted object when ambiguity is possible.

Use plain text, column labels, or row metadata instead of a chip when the value
does not need selection, status, type, or compact scannability.

### 8.6 Buttons And Actions

Actions must be explicit.

Good:

- `Open contract`
- `Confirm detail`
- `Upload file`
- `Export report`
- `Create task`
- `Request evidence`

Weak:

- `Manage`
- `Review`
- `Resolve`
- `Open`
- `Continue`

Weak labels are allowed only when the surrounding surface makes the action exact.

Button hierarchy:

- Primary: one per local decision area when possible.
- Secondary: route actions or alternatives.
- Ghost: navigation, low-risk utility, or table-row actions.
- Destructive: explicit destructive verbs and confirmation.

Primary app buttons should be crisp, not glossy. Public CTA treatment may be more
dramatic if it fits the creative concept.

### 8.7 Forms

Forms should feel precise and low-friction.

Rules:

- Labels sit close to inputs.
- Optional markers are quiet.
- Required errors are explicit.
- Error copy states the failed condition.
- Inputs have stable height and border treatment.
- Password, token, and access-code fields communicate sensitivity without
  excessive decoration.
- Trust or security notes appear near risky actions, not buried in footer copy.

### 8.8 Review And Inspection Surfaces

Contract detail review is an inspection workflow, not a generic form.

The UI must visually distinguish:

- detail being reviewed
- suggested value
- current confirmed value
- source text
- source status
- where the detail is used
- contract context
- confirmation actions

Rules:

- Use `Contract Details Review` as the formal route name.
- Use `Detail to review` for the current item.
- Use `Where this is used` for the operational impact block.
- Use `Where Oblixa found it` for source/citation display.
- Use `Source preview` for document preview content.
- Use `Contract context` for related contract metadata.
- Confidence is quiet metadata, not a primary trust signal.
- Missing source is a real state and must be visible.

Decision hierarchy:

1. What contract is being reviewed?
2. What detail is being checked?
3. What did Oblixa suggest?
4. Where did the suggestion come from?
5. Where will the detail be used?
6. What can the user do next?

Every review layout must preserve this order even if the visual arrangement
changes.

### 8.9 Empty, Loading, Error, And Disabled States

Empty states should identify:

- what object is absent
- why that matters
- what the user can do next

Loading states must preserve layout dimensions where possible.

Error states must include:

- what failed
- whether data may be incomplete
- what action can recover or retry

Disabled states must explain why an action is unavailable when the reason is not
obvious.

## 9. Navigation And Chrome

Core navigation should reflect the user's operational model.

Current Core surfaces:

- Dashboard
- Contracts
- Contract Details Review
- Tasks
- Renewals
- Evidence
- Reports
- Settings

Rules:

- Navigation labels must be formal enough to stand as route names.
- Route titles and leads can explain plain-language purpose.
- Do not use nav labels as tutorials.
- Do not include hidden, advanced, or operator-only surfaces in Core nav unless
  they are intentionally enabled for the workspace.
- Current route state should be clear without excessive color.
- Sidebar badges must define their object type through nearby route context or
  accessible labels.

## 10. Language And Terminology

The UI should use user-facing operational terms, not internal data names.

Preferred presentation terms:

| Use | Preferred term |
|---|---|
| Suggested date, owner, counterparty, value, or term | Contract detail / suggested detail |
| Detail confirmation route | Contract Details Review |
| Follow-up item | Task |
| Contractual duty or recurring requirement | Contract requirement |
| General unresolved condition | Problem |
| Derived value | Calculated |
| Task cannot move forward | Cannot proceed |
| Uploaded proof | Evidence |
| Source-backed quote or location | Where Oblixa found it |

Avoid in normal Core UI:

- field
- extracted field
- blocker
- blocked
- exception
- obligation
- computed
- generic work
- generic issue when `Problem` is more understandable

Internal keys, database values, route names, and query params may retain existing
names. Translation is presentation-only unless the implementation plan explicitly
changes the data model.

### 10.1 Status Labels

A status label must answer what is affected and why.

Weak:

- `Waiting`
- `Needs response`
- `Blocked`
- `Open`

Better:

- `Cannot proceed`
- `Past due`
- `Due within 7 days`
- `Unassigned`
- `Needs confirmation`
- `Missing owner`
- `Source not found`
- `No file uploaded`

If a short status is still ambiguous, add local explanatory text or tooltip copy.

### 10.2 Count Semantics

Every count must be understandable without guessing.

Required pattern:

- number
- object type
- qualifying condition

Examples:

- `77 contracts with open problems`
- `104 contracts needing detail review`
- `68 tasks that cannot proceed`
- `22 renewal and notice dates in view`
- `23 evidence requests missing files`

Do not assume users know whether a count refers to contracts, tasks, dates, files,
or rows.

### 10.3 Page Leads

Page leads should be plain and operational.

Good:

- `Track signed contracts, owners, dates, requirements, tasks, and evidence.`
- `Check suggested dates, owners, and terms against source text before they appear in reminders, tasks, and reports.`
- `Track proof files and confirmations tied to contract requirements and tasks.`

Avoid:

- broad product promises in the app
- vague AI claims
- tutorial paragraphs
- internal workflow jargon

Public pages may use more editorial copy, but it still needs to be concrete.

## 11. Trust By Design

Oblixa handles sensitive contract documents. Trust must be visible at the point
of risk.

Trust affordances belong near:

- upload forms
- bulk imports
- access requests
- signup and invite acceptance
- external evidence links
- file download/delete actions
- workspace settings
- security settings
- billing and cancellation actions

Rules:

- Explain workspace scoping where files are uploaded or shared.
- Explain that suggested details are not trusted until confirmed.
- Link to security information from public access and signup surfaces.
- Do not promise certifications, procurement readiness, or legal review unless
  they are actually supported.
- Do not bury security-sensitive behavior in marketing copy.
- Keep trust notes concise and specific.

Recommended concise trust note for upload/import surfaces:

> Files are workspace-scoped. Oblixa may use document text to suggest contract
> details, but suggestions are not trusted until someone confirms them. Admins
> can export or delete workspace data.

## 12. Route-Family Guidance

### 12.1 Dashboard

The dashboard is a command overview, not a decorative KPI wall.

Rules:

- Summary cards must define what is counted.
- Modules should be clearly separated by operational purpose.
- Priority work appears before passive monitoring.
- Recent activity should support confidence, not dominate.
- Data quality should show what weakens routing and reports.

### 12.2 Contracts

Contracts is an inventory surface.

Rules:

- Search, filters, shortcuts, table, and footer form one integrated surface.
- Shortcut counts are contract counts unless explicitly stated otherwise.
- The table is visually primary.
- Do not add dashboard-style metric cards above the inventory.

### 12.3 Contract Details Review

This route is a source-backed verification surface.

Rules:

- The user must see what was suggested, where it came from, and where it will be
  used.
- Source status must be visible.
- Review actions must be clear and close to the suggested value.
- The left rail shows review scope; the right rail shows source and context.

### 12.4 Tasks

Tasks is a follow-up queue.

Rules:

- Counts are task counts.
- The summary band explains which tasks require attention and why.
- Tabs switch row categories.
- Type labels use user-facing terms: Task, Contract requirement, Approval,
  Problem, Evidence request, Renewal task, Unassigned task.
- Internal blocked/waiting states present as `Cannot proceed`.

### 12.5 Renewals

Renewals is a date-control surface.

Rules:

- Counts are date counts unless specifically labeled as contract counts.
- Renewal dates and notice deadlines are distinct.
- Calculated dates must be labeled as calculated.
- Missing owner and needs-confirmation states must be prominent.
- Long owner emails must truncate predictably.

### 12.6 Evidence

Evidence is a proof-collection surface.

Rules:

- Counts are evidence request counts.
- Tabs carry request state.
- Attention filters identify due soon and missing file conditions.
- File actions must be clear.
- Linked requirements must use the term `Contract requirement`.

### 12.7 Reports

Reports is an export and preview surface.

Rules:

- Catalog counts identify available report rows or report types.
- Preview rows and export rows must not be confused.
- Partial data states must be visible before export.
- Recent export history should show report, status, row count, and exported time.

### 12.8 Settings And Admin

Settings is an administrative control surface.

Rules:

- Avoid marketing-style cards.
- Group settings by administrative task.
- Permission, billing, security, notification, and workspace controls must be
  visibly distinct.
- Dangerous actions require confirmation.

### 12.9 Auth, Signup, And Access

Auth/access pages should feel secure, calm, and specific.

Rules:

- Keep the path clear: request access, accept invite, create account, sign in.
- Explain gated access without sounding evasive.
- Keep security link visible.
- Do not require users to infer whether they are creating an account or joining
  a workspace.

### 12.10 External Token Surfaces

External surfaces must be minimal and trustworthy.

Rules:

- Explain what the recipient is being asked to provide.
- Explain workspace or request context without exposing unrelated data.
- Keep upload and confirmation actions obvious.
- Do not use internal navigation chrome.

### 12.11 Hidden And Advanced Surfaces

Hidden surfaces may be accessible for development or internal testing, but their
visual treatment still follows this system.

Rules:

- Clearly mark internal-only or advanced state.
- Do not expose hidden routes in Core nav unless intentionally enabled.
- Do not let placeholder surfaces appear finished.
- If a surface is operable but temporarily hidden, it still needs usable layout,
  clear copy, and recovery states.

## 13. Migration Rules

### 13.1 App Migration

Use these replacements when restyling existing app surfaces:

| Current tendency | Target replacement |
|---|---|
| Pale blue app canvas | Light neutral technical canvas |
| Blue wash behind panels | Neutral surface contrast and borders |
| Raised pastel card | Bordered operational panel |
| Large icon tile in every header | Direct route title and purposeful action area |
| Decorative chips | Scoped metadata, filter, or status only |
| Ambiguous shortcut pills | Object-specific shortcut filters |
| Heavy soft shadow | Thin border, divider, or surface contrast |
| Glow CTA | Crisp primary button |
| Rounded friendly cards | Lower-radius precise panels |
| Generic AI dashboard composition | Contract-operations control surface |
| Repeated page counts | One count per purpose, with object type |
| Internal terminology | User-facing operational terminology |

Do not migrate app surfaces by adding new decoration. First remove visual noise,
then add structure only where hierarchy remains unclear.

### 13.2 Public Site Migration

Use these replacements when restyling public pages:

| Current tendency | Target replacement |
|---|---|
| Clean but generic section stack | Art-directed page narrative |
| Centered heading plus card repeated | Varied section choreography |
| Product mock as small proof card | Staged product scene or transformation module |
| Table after table | Mix of table, record, source, workflow, and editorial modules |
| Blue as the whole identity | Oblixa-native motifs plus controlled accent |
| Minimalism through empty space | Richness through product-specific proof |
| Dovetail imitation | Oblixa concept with comparable ambition |

Public migration sequence:

1. Define the creative concept.
2. Define the recurring motif.
3. Design the first viewport as a memorable product stage.
4. Map the narrative sequence.
5. Stage product evidence for each section.
6. Tune palette, type, and motion/interaction.
7. Check that the page remains specific to Oblixa without the logo.

### 13.3 Shared Implementation Sequence

Apply the broader overhaul in this order:

1. Establish tokens for light app canvas, surfaces, borders, text, accent, focus,
   and status.
2. Update shared app primitives for buttons, inputs, tables, panels, filters,
   tabs, chips, and summary bands.
3. Restyle dashboard chrome and navigation.
4. Restyle Core operational routes in this order: Contracts, Contract Details
   Review, Tasks, Renewals, Evidence, Reports, Settings.
5. Restyle auth/access surfaces.
6. Redesign public pages with a public-site creative concept.
7. Tune dark mode as an app adaptation after light mode is coherent.

## 14. Anti-Patterns

Hard anti-patterns:

- public pages without a creative concept
- public pages that are clear but forgettable
- copying Dovetail's palette, pixel type, or structure
- pastel SaaS card stacks
- blue haze as the default app background
- glow used as app hierarchy
- generic AI-dashboard visuals
- decorative icon tiles on every app page
- chip clutter
- ambiguous count chips
- card inside card
- static chevron-only row affordances
- user-facing internal terminology
- table cells that overlap or resize unpredictably
- hidden routes that look like placeholders when accessible
- trust copy that overclaims security or compliance
- decorative grids that reduce readability
- native selects for custom app dropdowns
- literal `white` or `black` in adaptive `color-mix(...)`
- reference-driven redesign that changes product structure without a product
  reason

Contextual anti-patterns:

- large landing-style type inside operational pages
- sparse public marketing pages
- centered-section monotony
- public pages made mostly of tables
- product mocks that do not explain a workflow
- too many uppercase labels
- shadows on every app panel
- icon use that repeats page titles
- empty states written as paragraphs
- status colors used for non-status decoration
- metric cards on inventory pages
- counts without object type
- pixel or novelty typography
- visual restraint mistaken for lack of content
- FAQ used as filler

## 15. Accessibility And Responsiveness

Accessibility is part of the design system, not a final pass.

Rules:

- Text, borders, focus rings, and status chips must meet contrast requirements in
  light mode and dark mode.
- Keyboard focus must be visible on every interactive element.
- Table row actions must be keyboard reachable.
- Color cannot be the only indicator of state.
- Counts and status labels need accessible names when visual labels are compact.
- Mobile layouts must preserve meaning, not merely stack content.
- Long words, emails, and contract names must not overflow their containers.
- Touch targets must remain usable on mobile.
- Public pages must keep art direction responsive; mobile should not degrade into
  a generic stack of cards.

## 16. Visual QA Checklist

Before accepting a substantial UI change, inspect these surfaces when relevant:

- landing page
- product/public pages
- pricing/access page
- security page
- request access
- signup/invite acceptance
- login/password recovery
- dashboard
- contracts
- contract details review
- contract detail page
- upload/import flows
- tasks
- renewals
- evidence
- reports
- settings
- external evidence/request links
- error and empty states

Public-site checks:

- creative concept is visible
- first viewport is memorable and product-specific
- page still feels like Oblixa if the logo is removed
- product visuals teach workflow states
- sections vary in role, density, and composition
- there is enough visual force to compete with high-quality SaaS references
- public page does not copy Dovetail's palette, type, or structure
- each major viewport contains proof, product evidence, or a clear transition
- FAQ is objection handling, not filler

Product-app checks:

- page purpose is immediately clear
- count object types are explicit
- shortcuts explain what they filter
- tabs do not duplicate shortcut rows
- table columns do not overlap
- checkbox columns do not touch container borders
- row actions are explicit
- source-backed review states are visually distinct
- upload/import trust notes are present
- status labels explain the condition
- color is not overused
- chip rows are not decorative clutter
- focus states are visible
- mobile layout preserves meaning
- dark mode adapts the light-first system without becoming a different product

## 17. Implementation Guidance

Prefer shared primitives over inline one-off styling, but do not preserve an old
primitive if it encodes the previous visual system.

Existing shared primitives such as `DashboardPageHeader`, `DataSurfaceShell`,
`MetricSummaryBand`, `FilterBar`, `UiTabs`, and shared chip/button/table
components may be revised to match this target system. Current implementation
references are provisional, not permanent authority.

When adding or revising a component:

- define its surface role
- define its counted object type, if any
- define its empty/loading/error behavior
- verify keyboard and screen-reader behavior
- verify truncation and responsive behavior
- update tests that intentionally pin visible copy or structure

When redesigning a public page:

- define the creative concept first
- define the recurring motif
- sketch the first viewport before building components
- place product evidence before decorative treatment
- verify the page as a whole, not just each section

## 18. Testing Expectations

Tests should pin durable design behavior, not incidental styling.

Good test targets:

- route titles and leads
- visible terminology
- count object semantics
- table column stability
- absence of deprecated user-facing terms
- source-backed review labels
- trust notes near risky actions
- accessible names for compact controls
- absence of known structural anti-patterns

Do not write tests that require documentation to be available at runtime.

## 19. Final Design Bar

A finished product-app surface should pass these questions:

1. Can a first-time target user identify what the page is for?
2. Are all counts scoped to a clear object type?
3. Are statuses specific enough to explain what is wrong or pending?
4. Is the primary action obvious without decorative emphasis?
5. Does the surface feel like contract-operations software rather than generic
   SaaS?
6. Is the design light-first, precise, and trustworthy?

A finished public page should pass these questions:

1. Is there a clear creative concept?
2. Is the first viewport memorable?
3. Does the page stage product evidence rather than merely describe features?
4. Does it feel specific to Oblixa if the logo is removed?
5. Does the page have section choreography instead of a section stack?
6. Is the visual ambition comparable to strong SaaS references without copying
   them?
7. Does the page make signed-contract follow-up feel like a category worth
   caring about?

If the answer is no, revise the surface before adding more features.
