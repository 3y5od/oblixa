# Oblixa UI Design Principles

This document defines Oblixa's visual, interaction, and content principles. It is
a design contract, not a page blueprint. It must not prescribe the structure of
specific pages.

The document must not become a runtime dependency. Code may be tested against the
intended design contract, but production behavior must never depend on reading
this file.

## 1. Scope

This document governs:

- public marketing surfaces
- authenticated product surfaces
- auth and access surfaces
- external token surfaces
- settings and administrative surfaces
- shared primitives
- typography
- spacing
- surface treatment
- product artifacts
- diagrams
- copy tone
- accessibility
- responsive behavior

This document does not define:

- page-by-page layouts
- route membership
- navigation information architecture
- database behavior
- API behavior
- auth behavior
- billing behavior
- implementation sequencing

Page structure must be decided from the product goal of the surface. These
principles define the visual and interaction standard that every surface must
satisfy.

## 2. Direction

Oblixa's target visual direction is legal-intelligence editorial design adapted
to post-signature contract operations.

The design should feel:

- premium
- precise
- editorial
- trustworthy
- legally literate
- product-specific
- operationally useful
- calm under complexity

The design should not feel:

- generic SaaS
- generic dashboard software
- AI-template software
- playful consumer software
- decorative for its own sake
- visually empty
- compliance-theater
- like documentation with cards

The structural, typographic, and compositional language should move toward the
supplied legal/contract-intelligence references as closely as is reasonable while
using Oblixa's own product concepts and assets. This document does not require a
specific palette.

### 2.1 Non-Negotiable Standards

The quality bar is exceptional. "Functional", "clear enough", "professional",
"consistent with the existing app", or "not obviously broken" is not sufficient.
Every substantial UI surface must meet all of these standards:

- **Immediate comprehension**: a qualified first-time user can identify the
  surface purpose, object types, statuses, primary actions, and consequences
  without a walkthrough.
- **Product specificity**: the surface visibly belongs to post-signature
  contract operations. It cannot be interchangeable with a generic AI dashboard,
  document manager, CRM, or task tracker.
- **Premium execution**: typography, spacing, rhythm, hierarchy, surface
  treatment, and artifact staging must look intentionally designed, not merely
  assembled from components.
- **Operational credibility**: all product examples, counts, dates, statuses,
  source text, contracts, owners, tasks, evidence, and reports must be plausible
  and internally coherent.
- **Trust clarity**: suggested, confirmed, calculated, missing, manual,
  workspace-scoped, and risky states must be visibly distinguishable.
- **Interaction precision**: every interactive control must have a clear target,
  clear result, visible state, keyboard access, and an understandable disabled,
  loading, error, and success treatment where relevant.
- **Responsive integrity**: the surface must preserve meaning and polish across
  desktop, laptop, tablet, and mobile sizes. Reflow must not create overlap,
  clipping, ambiguous grouping, or lost labels.
- **Accessibility parity**: keyboard and screen-reader users must receive the
  same object, state, action, and consequence information as sighted pointer
  users.
- **No placeholder quality**: unfinished, stub-like, generic, or decorative
  treatments are not acceptable on any accessible surface.

Failure of any one standard is a design defect. Do not compensate for a failed
standard by improving another category. A visually premium surface that is not
self-explanatory fails. A clear surface that looks generic fails. A polished
surface with ambiguous trust state fails. A responsive surface that loses labels
or action meaning fails.

### 2.2 Quality Floor

The following defects are never acceptable:

- text overlap
- clipped controls
- clipped important labels
- horizontal overflow that makes content hard to use
- layout shifts caused by hover, focus, loading, or dynamic counts
- ambiguous primary action
- ambiguous count object type
- ambiguous status meaning
- unlabeled important icons
- inaccessible custom controls
- inconsistent terminology for the same object
- duplicate counts with unclear scope
- source-backed values shown as trusted before confirmation
- destructive actions without explicit object and consequence
- trust or security claims that exceed known product behavior
- product mockups that are unreadable at their displayed size
- diagrams that look impressive but fail to explain the system
- empty states that do not explain absence, consequence, and next action
- errors that do not identify failure and recovery
- disabled actions that do not explain why when the reason is not obvious

These are not polish issues. They are release-blocking UI defects.

## 3. Product Thesis

Oblixa turns signed contracts into operational records.

The interface must repeatedly make this transformation visible:

> signed agreement -> reviewed contract detail -> accountable follow-up

Everything visual should support that thesis. Decorative elements are acceptable
only when they reinforce the feeling of signed documents becoming controlled
operations.

Core product objects:

- signed contracts
- source text
- contract details
- renewal dates
- notice deadlines
- owners
- tasks
- contract requirements
- evidence requests
- reports
- workspace access
- audit or activity history

Visual language should be built from those objects, not from abstract AI imagery.

## 4. Comprehension Standard

Every surface must be self-explanatory to a qualified first-time user. A user
should not need a demo, documentation, glossary, founder explanation, or prior
product context to understand what the surface is showing and what they can do.

This is a higher priority than visual novelty, density, elegance, or reference
fidelity. If a design looks premium but requires explanation, the design fails.

Every primary surface, panel, table, artifact, diagram, control, status, and
empty state must answer these questions in the UI itself:

1. What object am I looking at?
2. Why does it matter?
3. What condition or state is it in?
4. What action is available?
5. What happens if I take that action?
6. What information is trusted, suggested, missing, or incomplete?

Rules:

- Use visible labels for unfamiliar concepts.
- Define specialized product concepts at first meaningful use.
- Keep explanations close to the object they explain.
- Prefer explicit object names over shorthand.
- Prefer visible clarification over hover-only clarification.
- Do not rely on icons alone for important meaning.
- Do not rely on color alone for state.
- Do not rely on route context to explain a local object.
- Do not rely on a page title to explain every table row, card, or control.
- Do not hide the reason for a count, status, or disabled action.
- Do not make the user infer whether a count refers to contracts, tasks, dates,
  files, rows, or reports.
- Do not make the user infer whether data is suggested, confirmed, calculated,
  missing, or manually entered.
- Do not use a short label if the short label is ambiguous without product
  training.

Self-explanatory does not mean verbose. The goal is immediate understanding with
the least necessary language. Use short visible text, clear hierarchy, exact
labels, and progressive detail. Add longer explanation only when a short label
cannot carry the meaning accurately.

The standard user for comprehension checks is not a developer and not an Oblixa
insider. Assume the user understands contracts, spreadsheets, folders,
calendars, and inbox follow-up, but does not understand Oblixa's internal model.

Comprehension test:

- If a reasonable target user asks "What does this mean?" the label is probably
  too internal or too vague.
- If a reasonable target user asks "What happens when I click this?" the action
  label or local context is insufficient.
- If a reasonable target user asks "Is this a contract count or an item count?"
  the count is under-specified.
- If a reasonable target user asks "Can I trust this value?" the source/trust
  state is under-specified.
- If a reasonable target user asks "Why is this important?" the surface lacks an
  operational consequence.

## 5. Typography

Typography must carry much of the product's identity.

Public and editorial surfaces:

- Use a high-contrast serif for major headings.
- Use serif headings to create legal, editorial, authoritative tone.
- Use large type confidently where the surface needs brand presence.
- Use emphasis treatment on selected words only when it clarifies hierarchy.
- Keep body copy concise.
- Use sans-serif for navigation, labels, buttons, UI controls, metadata, and
  product artifacts.

Product and operational surfaces:

- Use sans-serif as the default.
- Use serif sparingly for orientation moments, empty states, or editorial panels.
- Never reduce scan speed in dense workflows for brand expression.
- Tables, filters, forms, settings, and queues remain sans-serif.

Rules:

- Do not use novelty type.
- Do not use pixelated type.
- Do not overuse all-caps labels.
- Do not use monospaced type for normal prose.
- Use monospaced type only for file names, source snippets, IDs, timestamps,
  paths, and technical metadata.
- Counts, dates, durations, percentages, and ratios should use tabular numbers.
- User-provided names, companies, emails, and file names must not be forced into
  uppercase.

Hierarchy requirements:

- Every surface needs one obvious primary heading.
- Secondary headings must be visibly subordinate.
- Labels must be close to the object they describe.
- Metadata must be quiet but legible.
- Long headlines must wrap intentionally, not accidentally.

## 6. Composition

Oblixa should use editorial composition rather than template composition.

Use:

- generous whitespace
- asymmetry where it clarifies hierarchy
- large artifact moments
- alternating density and rest
- thin rules
- structured panels
- diagrammatic alignment
- clear object hierarchy
- intentional negative space

Avoid:

- repeated equal-weight card grids as the dominant pattern
- centered heading plus paragraph plus cards as the default section rhythm
- generic dashboard screenshots as primary proof
- large empty bands with no focal object
- excessive small icons
- decorative chip rows
- stacked boxes with identical border weight
- floating cards with no relationship to each other

Compositional principles:

- Every visible object must have a role.
- The most important object must be visually dominant.
- Product artifacts should occupy enough space to be readable.
- Dense product proof should be balanced by quieter editorial space.
- Adjacent sections should differ in role, density, or visual structure.
- A viewer should understand the visual hierarchy before reading every word.
- A viewer should understand what each major region represents without needing
  surrounding narration.
- Related label, value, status, and action must be visually grouped.
- Unrelated objects must not appear connected through proximity, shared border,
  or shared background.
- A design that requires a spoken walkthrough to understand the basic object
  model is not acceptable.

## 7. Texture And Illustration

Texture and illustration should create legal-intelligence atmosphere.

Allowed:

- paper grain
- subtle speckle
- soft geometric hatch patterns
- thin linework
- document-margin motifs
- source-location marks
- diagrammatic loops
- hub-and-spoke diagrams
- layered product architecture blocks
- contract/document frames
- organic illustration when it is custom and conceptually relevant

Not allowed:

- stock illustrations
- copied third-party art
- decorative blobs
- generic AI shapes
- sparkle effects
- heavy gradients
- texture behind dense tables when it reduces readability
- illustration that competes with product evidence
- illustration that makes the product relationship harder to understand

Rules:

- Texture must be subtle.
- Texture must never reduce contrast below accessibility standards.
- Illustration should support the product thesis.
- Illustration should not substitute for product evidence.
- Diagrammatic motifs should be repeated consistently enough to feel owned.
- Decorative atmosphere must never obscure the operational meaning of the
  surface.

## 8. Product Artifacts

Product artifacts are staged representations of Oblixa's product concepts. They
are not arbitrary screenshots and not decorative mockups.

Artifact types:

- contract document preview
- highlighted source excerpt
- reviewed detail record
- date ledger
- task queue
- evidence request list
- report/export preview
- activity history
- workspace access control panel
- system diagram

Artifact rules:

- Artifacts must look credible.
- Artifacts must use realistic contract data.
- Artifacts must be readable at their displayed size.
- Artifacts must show product logic, not just decoration.
- Artifacts must be understandable without a caption explaining the whole scene.
- Artifact chrome should be minimal.
- Product content should be more important than toolbar decoration.
- Subtle containers and thin borders are preferred.
- Shadow should be minimal and used only for separation.
- Cropping is allowed when it improves composition and still preserves meaning.
- Do not show unrelated app chrome.

Required artifact content quality:

- Use realistic contract names.
- Use plausible dates.
- Use plausible owner names.
- Use concrete status labels.
- Use concrete evidence and report examples.
- Use source snippets where source-backed review is being shown.
- Avoid fake metrics unless they are clearly illustrative and defensible.
- Show enough surrounding context for a user to understand the represented
  workflow state.
- Do not crop away the label, status, or action that explains the artifact.

## 9. Diagrams

Diagrams should be used to explain systems and relationships.

Preferred diagram forms:

- loop
- flywheel
- hub-and-spoke
- layered system
- workflow rail
- source-to-record transformation
- document-to-follow-up map
- owner/date/evidence network

Diagram rules:

- Use thin lines.
- Use clear surface hierarchy.
- Use restrained emphasis.
- Use serif labels for high-level concepts only.
- Use sans-serif labels for operational objects.
- Avoid over-dense enterprise architecture diagrams.
- Avoid diagrams that require long prose to understand.
- Avoid diagrams that are visually impressive but product-ambiguous.
- Avoid diagrams where labels name internal systems rather than user-visible
  outcomes.

Every diagram must answer at least one of these questions:

- What changes when a contract enters Oblixa?
- Where does trust enter the workflow?
- How does source text become an operational record?
- How are owners, dates, tasks, evidence, and reports connected?
- What stays controlled by the workspace?
- What should the user understand faster because this diagram exists?

## 10. Public Surface Principles

Public surfaces must persuade through product-specific editorial design.

They should use:

- serif-led major headings
- textured editorial backgrounds
- large staged product artifacts
- concise supporting copy
- diagrammatic proof
- trust and control signals
- clear request-access path
- legal-operations specificity

They should not use:

- generic feature grids as the main visual system
- dashboard KPI walls
- abstract AI claims
- broad legal advice claims
- unsupported enterprise-security claims
- repeated section templates
- copied reference assets
- product visuals too small to evaluate

Public surfaces must make these things clear without strain:

- Oblixa operates after contracts are signed.
- Oblixa is for contract follow-up operations.
- Suggested contract details are reviewed before being trusted.
- The workspace connects documents to dates, owners, tasks, evidence, and
  reports.
- Access is controlled.

Public surfaces must not assume the visitor already understands Oblixa's
category. They must explain the category through product objects, not through
generic claims.

## 11. Product Surface Principles

Product surfaces must remain efficient operational tools.

They should feel:

- precise
- calm
- source-backed
- legible
- dense where necessary
- controlled
- legally adjacent

They should not feel:

- theatrical
- marketing-led
- generic dashboard SaaS
- card-heavy
- decorative
- visually empty
- playful

Apply the reference direction through:

- more intentional canvas treatment
- paper-like source areas
- refined table rules
- fewer decorative badges
- record-like panels
- ledger-like tables
- precise spacing
- serif only in non-dense orientation moments

Do not sacrifice:

- scan speed
- first-pass comprehension
- table clarity
- keyboard access
- filter usability
- row action clarity
- status clarity
- responsive stability

Product surfaces must be understandable at three levels:

- surface level: what the page or panel is for
- row/object level: what each item represents
- action level: what each available action will do

## 12. Navigation And Chrome

Navigation should be quiet and workmanlike.

Public navigation:

- logo left
- concise links
- compact actions
- restrained height
- thin boundary
- no oversized pills
- no glow
- no decorative icon clutter

Product navigation:

- clear current route state
- compact labels
- legible badges
- minimal decoration
- route identity through title and content, not large icon tiles
- no hidden or advanced surfaces in core navigation unless intentionally enabled

Rules:

- Navigation labels must be formal enough to stand alone.
- Navigation labels should not be tutorials.
- Navigation labels must not be so terse that they obscure the route purpose.
- Badges must have accessible names that define what is counted.
- Header controls must align cleanly across viewport widths.

## 13. Panels, Cards, And Surfaces

Use surfaces as records, ledgers, artifacts, or controls. Do not use cards as
default decoration.

Surface rules:

- Use low to moderate radius.
- Use thin borders.
- Use shadow sparingly.
- Prefer rules and contrast over elevation.
- Avoid nested cards unless the inner card is a real artifact.
- Use surface treatment to distinguish object roles.
- Use consistent padding within each surface type.
- Keep panel headings close to panel content.
- Every bounded surface must have an obvious purpose.
- If a surface contains multiple object types, separate them visibly and label
  them explicitly.

Surface roles:

| Surface role | Visual treatment |
|---|---|
| Editorial field | Large type, minimal borders, strong focal hierarchy. |
| Product artifact | Subtle container, thin border, readable internal UI. |
| Ledger/table | Header band, row rules, stable columns. |
| Source area | Paper-like inset, source highlight, strong text legibility. |
| Inspection pane | Clear separation between source, suggestion, impact, and action. |
| Administrative panel | Quiet, precise, grouped by task. |
| Alert | Semantic treatment, concise text, clear recovery action. |
| Dialog | Focused, low radius, explicit action hierarchy. |

## 14. Tables And Queues

Tables and queues are core product surfaces.

Rules:

- Table columns must be stable.
- Header labels must be concise and meaningful.
- Rows must have clear separation.
- Row hover and focus states must be visible.
- Checkbox columns must be inset from container edges.
- Row actions must be explicit.
- Long contract names must truncate predictably.
- Long emails must truncate predictably.
- Counts must state their object type.
- Status labels must be specific.
- Do not use table density so high that actions or status become ambiguous.
- Column labels must make row values understandable without decoding.
- Empty cells must use an intentional missing-value treatment, not ambiguous
  blank space.
- Row actions must be close enough to the row object that the action target is
  obvious.

Preferred table feel:

- ledger-like
- quiet header band
- fine row rules
- low visual noise
- strong alignment

## 15. Buttons And Actions

Buttons must be compact and decisive.

Button rules:

- Primary actions use the established primary treatment.
- Secondary actions use light surface and thin border.
- Destructive actions use explicit destructive language.
- Disabled actions explain why when the reason is not obvious.
- Button labels should be verbs or verb phrases.
- Avoid vague labels when context does not make the action exact.
- Avoid glow, glossy gradients, and oversized pill treatment.
- The action target must be clear before activation.
- The user should not need to click a menu to learn the primary action available
  for an object.
- If an action changes trust state, ownership, billing, access, deletion, or
  external visibility, the consequence must be visible before completion.

Strong labels:

- `Upload contract`
- `Import contracts`
- `Confirm detail`
- `Request evidence`
- `Export report`
- `Create task`
- `Delete workspace`

Weak labels:

- `Manage`
- `Review`
- `Resolve`
- `Open`
- `Continue`

Weak labels are acceptable only when surrounding context makes the action
specific.

## 16. Chips, Badges, And Status

Chips and badges must carry state, metadata, or filter meaning.

Allowed chip uses:

- status
- count
- active filter
- category
- source state
- file state
- ownership state

Not allowed:

- decorative chip rows
- duplicate count chips
- ambiguous badges without object type
- decorative badges where treatment does not encode state

Status labels must answer what condition exists.
They must not require the user to know internal state names.

Preferred labels:

- `Cannot proceed`
- `Past due`
- `Due within 7 days`
- `Unassigned`
- `Needs confirmation`
- `Missing owner`
- `Source not found`
- `No file uploaded`
- `Calculated`
- `Confirmed`

Avoid:

- `Waiting`
- `Blocked`
- `Exception`
- `Open` without clear object context
- `Pending` without explaining what is pending
- `Active` when the active object or scope is unclear

If a status affects actionability, include the next required action or missing
condition nearby.

## 17. Forms

Forms should feel precise, quiet, and trustworthy.

Rules:

- Labels sit close to inputs.
- Optional markers are quiet.
- Required errors state the failed condition.
- Inputs have stable height.
- Focus states are visible.
- Password and access-code fields communicate sensitivity without decoration.
- Trust notes appear near risky actions.
- Do not bury security-sensitive behavior in footer copy.
- Do not make forms look like generic lead-capture widgets when they create or
  request workspace access.
- The form title must state whether the user is requesting access, creating an
  account, accepting an invite, editing settings, or submitting evidence.
- Required fields must be clear before submission.
- Validation errors must identify the field and the recovery action.

## 18. Language

Language is part of the product interface. Oblixa should sound precise,
legally literate, operational, and calm. Copy must reduce interpretation work;
it must not ask users to translate internal vocabulary.

### 18.1 Voice

Use a controlled professional voice:

- exact
- plain
- concrete
- composed
- confident
- operational
- legally aware

Do not use a voice that is:

- playful
- cute
- magical
- salesy inside the app
- evasive
- over-explanatory
- artificially casual
- full of generic SaaS claims

Public surfaces may be more editorial. Product surfaces must be more direct.
Neither mode should become vague.

### 18.2 Sentence Rules

Write short sentences unless the concept requires precision.

Rules:

- Put the object first when the user needs to identify what is affected.
- Put the action first when the user needs to act.
- Prefer active voice.
- Use present tense for current state.
- Use future tense only for predictable outcomes.
- Avoid passive voice when it hides the actor.
- Avoid unexplained nouns made from verbs, such as `activation`, `resolution`,
  `processing`, or `completion`, when a direct verb is clearer.
- Do not write tutorial paragraphs inside dense operational surfaces.
- Do not use marketing slogans inside product workflows.
- Do not say `simple`, `easy`, `seamless`, or `effortless` unless the interface
  proves it.

Good:

- `This contract has no owner.`
- `Confirm the renewal date before it appears in reminders.`
- `Upload evidence for this contract requirement.`
- `This task cannot proceed until a file is uploaded.`
- `5 contracts are missing an owner.`
- `This date is calculated from the renewal date and notice window.`

Weak:

- `Manage contract workflow.`
- `Resolve blocker.`
- `Review item.`
- `Unlock seamless contract intelligence.`
- `Pending.`
- `Open.`

### 18.3 Product Vocabulary

Use these terms consistently:

| Concept | Preferred term |
|---|---|
| Signed agreement managed by Oblixa | Contract |
| Source-backed date, owner, counterparty, value, or term | Contract detail |
| Untrusted value proposed by Oblixa | Suggested detail |
| User-approved value | Confirmed detail |
| Detail confirmation area | Contract Details Review |
| Date a contract renews | Renewal date |
| Last day to give notice before renewal or termination | Notice deadline |
| Time range in which notice may be sent | Notice window |
| Person responsible for a contract or task | Owner |
| Follow-up action | Task |
| Contractual duty, recurring duty, or tracked commitment | Contract requirement |
| General unresolved operational condition | Problem |
| Proof file or confirmation | Evidence |
| Request for proof or confirmation | Evidence request |
| Derived value | Calculated |
| User-verified value | Confirmed |
| Source-backed quote or location | Source text / where Oblixa found it |
| Exportable operational output | Report |
| Grouped tenant or customer environment | Workspace |

Use `suggested` only when a value is not yet trusted. Use `confirmed` only after
a user or trusted workflow has approved the value.

### 18.4 Terms To Avoid

Avoid these terms in normal user-facing UI:

- `field`
- `extracted field`
- `extraction`
- `blocker`
- `blocked`
- `exception`
- `obligation`
- `computed`
- `generic work`
- `workflow`
- `pipeline`
- `AI magic`
- `copilot` unless the product behavior is explicitly a copilot
- `agent` unless the product has an agentic behavior being described accurately
- `leverage`
- `unlock`
- `seamless`
- `robust`
- `mission-critical`
- `world-class`
- `best-in-class`
- `revolutionary`

Allowed exceptions:

- Internal code, tests, route paths, database keys, and query params may retain
  existing names.
- Legal text imported from a contract may use the contract's own language.
- Formal security, legal, or provider terminology may be used when accuracy
  requires it.

When an avoided internal term appears because of an existing model, translate it
at the presentation layer.

### 18.5 Status Language

A status must explain the condition, not merely name a state.

Preferred status labels:

- `Cannot proceed`
- `Past due`
- `Due within 7 days`
- `Unassigned`
- `Needs confirmation`
- `Missing owner`
- `Source not found`
- `No file uploaded`
- `Calculated`
- `Confirmed`
- `Requested`
- `Received`

Avoid ambiguous status labels:

- `Waiting`
- `Blocked`
- `Exception`
- `Open` without object context
- `Pending` without explaining what is pending
- `In progress` when the actor or next action is unclear

If a short status label is still ambiguous, add nearby clarifying text. Do not
force a vague label to carry the whole meaning.
Status copy must answer both "what is true?" and, when relevant, "what is needed
next?"

Examples:

- Use `Cannot proceed` with helper text `Waiting for finance approval.`
- Use `Missing owner` with helper text `Assign an owner before reminders can be routed.`
- Use `Source not found` with helper text `Confirm manually or add source text.`

### 18.6 Action Labels

Actions must describe what will happen.
If the action result is not obvious, add helper text before the action or use a
more specific label.

Strong action labels:

- `Upload contract`
- `Import contracts`
- `Confirm detail`
- `Edit detail`
- `Mark unknown`
- `Assign owner`
- `Create task`
- `Request evidence`
- `Upload evidence`
- `Export report`
- `Download report`
- `Invite member`
- `Delete workspace`

Weak action labels:

- `Manage`
- `Review`
- `Resolve`
- `Open`
- `Continue`
- `Submit`
- `Proceed`
- `Done`

Weak labels are acceptable only when the surrounding object makes the action
exact. For example, `Open contract` is acceptable; `Open` alone is not.

Destructive actions must name the destroyed object:

- `Delete contract`
- `Remove member`
- `Cancel subscription`
- `Delete workspace`

Do not use soft destructive labels such as `Remove this` or `Continue` for
irreversible actions.

### 18.7 Labels, Titles, And Leads

Labels name objects. Leads explain purpose. Titles should not become tutorials.
Together, they must let the user understand the surface without external
explanation.

Rules:

- Navigation labels should be short formal nouns or noun phrases.
- Page titles should name the surface or primary object.
- Section titles should name the object or decision area.
- Panel titles should identify the contained object.
- Field labels should describe the value being requested.
- Helper text should explain constraint, consequence, or recovery.
- Do not put long explanations in labels.
- Do not make nav labels conversational.
- Do not use a vague title and rely on a subtitle to repair it.
- Do not use a clever title where a precise title is needed.
- Do not use an internal noun where a user-facing noun exists.

Good title patterns:

- `Contracts`
- `Contract Details Review`
- `Tasks`
- `Evidence`
- `Workspace access`
- `Security`

Good lead patterns:

- `Track signed contracts, owners, dates, requirements, tasks, and evidence.`
- `Check suggested contract details against source text before they appear elsewhere.`
- `Request proof for contract requirements and follow-up tasks.`

Weak title patterns:

- `Work`
- `Review`
- `Manage`
- `Next steps`
- `Things to do`

### 18.8 Source-Backed Language

When showing suggested contract information, the copy must distinguish source,
suggestion, and trusted data.

Required distinctions:

- `Suggested detail`: not trusted yet.
- `Confirmed detail`: trusted for reminders, tasks, reports, and search.
- `Source text`: contract text or preview supporting the suggestion.
- `Source not found`: suggestion lacks visible source support.
- `Calculated`: derived from other known values.
- `Manual entry`: entered by a user rather than suggested from source text.

Do not imply that suggested details are facts. Do not use `approved`,
`confirmed`, `verified`, or `trusted` until the product state supports that
claim.
When source support is missing, explain what the user can do next.

### 18.9 Trust, Security, And Legal Claims

Trust language must be exact and conservative.

Allowed:

- `Files are workspace-scoped.`
- `Suggested details are reviewed before they are trusted.`
- `Admins control workspace access.`
- `Workspace data can be exported or deleted.`
- `Oblixa helps track contract follow-up after signature.`

Not allowed unless independently true:

- `SOC 2 compliant`
- `HIPAA compliant`
- `enterprise-ready security`
- `procurement-ready`
- `legal review`
- `legal advice`
- `automated legal analysis`
- `guaranteed accuracy`
- `fully secure`
- `zero risk`

If a claim depends on configuration, plan, provider, or customer setup, state the
condition explicitly.

### 18.10 AI Language

AI should be described through product behavior, not hype.

Use:

- `suggests contract details`
- `uses document text to suggest dates, owners, and requirements`
- `shows source text for review`
- `requires confirmation before suggestions are trusted`

Avoid:

- `AI-powered magic`
- `autonomous legal intelligence`
- `agentic workflow`
- `copilot for contracts`
- `automatically understands everything`
- `eliminates review`

Do not anthropomorphize Oblixa. Prefer `Oblixa suggests` over `Oblixa knows`,
`Oblixa understands`, or `Oblixa decides`.

### 18.11 Empty, Error, Disabled, And Loading Copy

Empty states must say:

- what is absent
- why it matters
- what the user can do next
They must not require the user to know why the object normally exists.

Errors must say:

- what failed
- whether data may be incomplete
- how to retry or recover

Disabled states must say why the action is unavailable when the reason is not
obvious.

Loading copy must not imply completion. Use `Loading`, `Importing`, `Uploading`,
or `Checking` only while the operation is active.

Do not use:

- `Something went wrong` by itself
- `Invalid request` by itself
- `Try again later` by itself
- `No data` by itself

### 18.12 Public Versus Product Copy

Public copy may be more editorial, but it must remain concrete.

Public copy may:

- use larger claims
- use sharper contrast
- explain the category
- describe the operational problem
- frame the product transformation

Public copy must not:

- overclaim security, accuracy, legal judgment, or enterprise readiness
- present unsupported metrics
- describe Oblixa as a generic AI platform
- obscure the post-signature contract-operations wedge

Product copy should:

- prioritize speed
- reduce ambiguity
- name objects exactly
- put actions near objects
- avoid sales language
- explain unfamiliar concepts in place

### 18.13 Grammar And Style

Rules:

- Use sentence case for most UI text.
- Use title case only where the design system intentionally uses formal page or
  report names.
- Use numerals for counts and measurable quantities.
- Use absolute dates where relative timing could be confusing.
- Use relative time only as supporting context, such as `Due in 7 days`.
- Do not use exclamation points in product workflows.
- Avoid em dashes in compact UI.
- Do not use emoji in product UI.
- Do not uppercase user-entered content.
- Use `CSV`, `PDF`, and other established acronyms in uppercase.
- Use `workspace` consistently; do not alternate with `account`, `tenant`, or
  `organization` unless those are distinct product concepts.

### 18.14 Language QA

Before accepting copy, check:

- Does every label name the right object?
- Does every count identify its object type?
- Does every status explain the condition?
- Does every action say what will happen?
- Does every trust claim stay within known product capability?
- Does every AI claim describe observable behavior?
- Is any internal model term leaking into user-facing UI?
- Could a first-time operator understand this without a glossary?
- Could a user explain the object, state, and action back in one sentence?
- Would the copy still make sense if removed from its current route?

## 19. Count Semantics

Every count must define what is being counted.

Required count pattern:

> number + object type + condition

Examples:

- `77 contracts with open problems`
- `104 contracts needing detail review`
- `68 tasks that cannot proceed`
- `22 renewal and notice dates in view`
- `23 evidence requests missing files`

Rules:

- Do not assume users know whether a number refers to contracts, tasks, dates,
  files, rows, or reports.
- If the count is shortened visually, preserve a full accessible label.
- Do not repeat the same count in multiple places unless each use has a distinct
  purpose.
- If a count is clickable, the resulting filtered view must match the count's
  wording.
- If a count includes hidden filters, state the filter scope.
- If a count is approximate, delayed, or incomplete, state that directly.

## 20. Trust

Trust must be visible at the point of risk.

Trust affordances belong near:

- uploads
- imports
- access requests
- signup and invite acceptance
- evidence links
- file download and delete actions
- workspace settings
- security settings
- billing and cancellation actions

Rules:

- Explain workspace scoping where files are uploaded or shared.
- Explain that suggested details are not trusted until confirmed.
- Link to security information from public access and signup surfaces.
- Do not imply unsupported certifications.
- Do not imply legal review.
- Do not imply enterprise procurement readiness unless it is true.
- Keep trust notes concise and concrete.
- Put trust explanation near the risky action, not only on a separate security
  page.
- If the user is asked to upload, invite, delete, export, or grant access, the
  interface must explain the relevant scope or consequence.

Recommended upload/import trust note:

> Files are workspace-scoped. Oblixa may use document text to suggest contract
> details, but suggestions are not trusted until someone confirms them. Admins
> can export or delete workspace data.

## 21. Accessibility

Accessibility is part of the visual system.

Rules:

- Text must meet contrast requirements.
- Status labels must not depend on color alone.
- Texture must not reduce readability.
- Focus states must be visible.
- Keyboard navigation must reach every interactive control.
- Tables must preserve accessible row and column relationships.
- Compact controls need accessible names.
- Icons need accessible names when they are not decorative.
- Motion must respect reduced-motion preferences.
- Error states must identify the error and recovery path.
- Disabled states must explain why when the reason is not obvious.
- Accessible names must preserve the same object, state, and action meaning as
  the visible UI.
- Screen-reader users must not receive less explanation than sighted users.

## 22. Responsiveness

Responsive design must preserve meaning, not merely stack elements.

Rules:

- Product artifacts must remain readable or intentionally simplify.
- Long words, emails, file names, and contract names must not overflow.
- Tables must not create incoherent horizontal clipping.
- Touch targets must remain usable.
- Navigation must remain legible.
- Dense product surfaces may use progressive disclosure on small screens.
- Public surfaces should preserve editorial character on mobile.
- Mobile must not degrade into a generic stack of indistinguishable cards.
- Mobile layouts must preserve labels that explain object type, status, and
  action target.
- Do not hide essential explanatory copy only because the viewport is small.

## 23. Design QA

Before accepting a substantial design pass, evaluate these questions.

Public-surface checks:

- Does the surface feel serif-led, editorial, and legal-intelligence oriented?
- Does the surface avoid copying reference visuals mechanically?
- Is the primary product artifact substantial and readable?
- Does the surface avoid generic SaaS card rhythm?
- Does it avoid generic dashboard proof?
- Does it show signed contracts becoming operational records?
- Can a first-time visitor understand what Oblixa does without a sales call?
- Does every unfamiliar concept get explained where it appears?
- Is each major visual object necessary?
- Are trust claims exact?

Product-surface checks:

- Does the surface feel like a legal-operations workbench?
- Is the page purpose immediately clear?
- Are counts scoped to object types?
- Are statuses specific?
- Are tables stable?
- Are source-backed review states visually distinct?
- Are risky actions paired with trust or confirmation copy?
- Are visual emphasis treatments restrained?
- Does the design preserve scan speed?
- Can a first-time operator understand the page without a walkthrough?
- Can the user identify object, state, action, and consequence for each primary
  row or panel?

### 23.1 Acceptance Gates

A design pass is acceptable only if all gates pass.

Comprehension gate:

- A first-time target user can describe the surface purpose in one sentence.
- The user can identify the primary object type without explanation.
- The user can identify which values are suggested, confirmed, calculated,
  missing, or manually entered.
- The user can identify the next available action for each primary object.
- The user can explain what happens after each primary action.

Visual-quality gate:

- The surface has a clear hierarchy at first glance.
- The design has a recognizable legal-intelligence character.
- The surface does not resemble a generic SaaS template.
- Product artifacts are readable, credible, and visually staged.
- Typography, spacing, borders, and grouping are intentional at every major
  breakpoint.

Operational gate:

- Counts identify object type and scope.
- Statuses identify condition and, where relevant, required next action.
- Tables and queues preserve alignment, truncation, labels, and row actions.
- Forms explain required input, validation failure, and recovery.
- Risky actions show scope and consequence before completion.

Trust gate:

- Suggested values are not presented as facts.
- Confirmed values are visually distinct from suggested values.
- Missing source and missing data states are explicit.
- Upload, export, invite, delete, billing, and access actions carry appropriate
  scope or consequence copy.
- Security, legal, AI, and accuracy claims do not exceed known capability.

Accessibility and responsive gate:

- Keyboard users can reach and operate every control.
- Focus states are visible.
- Screen-reader names preserve object, state, and action meaning.
- Mobile layouts preserve labels, status, and action targets.
- No viewport introduces overlap, clipped important content, incoherent wrapping,
  or hidden explanation required for understanding.

If any gate fails, the surface is not ready. Do not accept the pass because the
remaining gates are strong.

## 24. Anti-Patterns

Hard anti-patterns:

- copying third-party logos or assets
- copying reference visuals mechanically
- generic SaaS visual system
- generic AI dashboard visuals
- decorative gradient blobs
- abstract AI sparkle visuals
- feature-card grid as the dominant public visual system
- public surfaces that feel like documentation
- product surfaces that feel like marketing pages
- oversized pill chips
- vague status labels
- counts without object type
- overclaiming security or legal review
- texture that harms readability
- stock illustrations
- product artifacts that do not teach a workflow
- large icon tiles used as decoration
- cards inside cards without artifact meaning
- shadow used instead of structure
- visual emphasis used as decoration
- interfaces that require a founder, demo, tooltip, or documentation to explain
  basic meaning
- icons without visible labels for important actions
- statuses that name an internal state rather than a user-visible condition
- counts that omit object type or scope
- diagrams that look impressive but do not reduce comprehension burden

## 25. Final Bar

A finished public surface should feel like a premium legal-intelligence
experience adapted to Oblixa's post-signature contract operations. It should be
serif-led, artifact-rich, spacious, and visibly closer to the supplied references
than to a standard SaaS landing page.

A finished product surface should feel like a legal-operations workbench:
precise, trustworthy, dense where necessary, and visually connected to the
public system without adopting public-page theatricality.

If the result is merely clear, generic, or safe, it is not finished.
If the result cannot be understood by a qualified first-time user without verbal
explanation, it is not finished.
If the result would be acceptable for an average SaaS product but not memorable,
specific, and trustworthy for Oblixa, it is not finished.
If the result contains any release-blocking UI defect named in this document, it
is not finished.
