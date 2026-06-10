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

## 4. Typography

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

## 5. Composition

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

## 6. Texture And Illustration

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

Rules:

- Texture must be subtle.
- Texture must never reduce contrast below accessibility standards.
- Illustration should support the product thesis.
- Illustration should not substitute for product evidence.
- Diagrammatic motifs should be repeated consistently enough to feel owned.

## 7. Product Artifacts

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

## 8. Diagrams

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

Every diagram must answer at least one of these questions:

- What changes when a contract enters Oblixa?
- Where does trust enter the workflow?
- How does source text become an operational record?
- How are owners, dates, tasks, evidence, and reports connected?
- What stays controlled by the workspace?

## 9. Public Surface Principles

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

## 10. Product Surface Principles

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
- table clarity
- keyboard access
- filter usability
- row action clarity
- status clarity
- responsive stability

## 11. Navigation And Chrome

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
- Badges must have accessible names that define what is counted.
- Header controls must align cleanly across viewport widths.

## 12. Panels, Cards, And Surfaces

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

## 13. Tables And Queues

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

Preferred table feel:

- ledger-like
- quiet header band
- fine row rules
- low visual noise
- strong alignment

## 14. Buttons And Actions

Buttons must be compact and decisive.

Button rules:

- Primary actions use the established primary treatment.
- Secondary actions use light surface and thin border.
- Destructive actions use explicit destructive language.
- Disabled actions explain why when the reason is not obvious.
- Button labels should be verbs or verb phrases.
- Avoid vague labels when context does not make the action exact.
- Avoid glow, glossy gradients, and oversized pill treatment.

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

## 15. Chips, Badges, And Status

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

## 16. Forms

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

## 17. Language

The UI should use user-facing operational language.

Preferred terms:

| Concept | Preferred term |
|---|---|
| Suggested date, owner, counterparty, value, or term | Contract detail / suggested detail |
| Detail confirmation area | Contract Details Review |
| Follow-up item | Task |
| Contractual duty or recurring requirement | Contract requirement |
| General unresolved condition | Problem |
| Derived value | Calculated |
| Task cannot move forward | Cannot proceed |
| Uploaded proof | Evidence |
| Source-backed quote or location | Where Oblixa found it |

Avoid normal user-facing use of:

- field
- extracted field
- blocker
- blocked
- exception
- obligation
- computed
- generic work
- AI magic
- copilot unless the product behavior truly is a copilot

Rules:

- Page and panel leads should be short.
- Public copy may be editorial but must remain concrete.
- Product copy should prioritize speed of comprehension.
- Trust claims must be exact.
- Do not overclaim legal analysis, certifications, procurement readiness, or
  security posture.

## 18. Count Semantics

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

## 19. Trust

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

Recommended upload/import trust note:

> Files are workspace-scoped. Oblixa may use document text to suggest contract
> details, but suggestions are not trusted until someone confirms them. Admins
> can export or delete workspace data.

## 20. Accessibility

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

## 21. Responsiveness

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

## 22. Design QA

Before accepting a substantial design pass, evaluate these questions.

Public-surface checks:

- Does the surface feel serif-led, editorial, and legal-intelligence oriented?
- Does the surface avoid copying reference visuals mechanically?
- Is the primary product artifact substantial and readable?
- Does the surface avoid generic SaaS card rhythm?
- Does it avoid generic dashboard proof?
- Does it show signed contracts becoming operational records?
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

## 23. Anti-Patterns

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

## 24. Final Bar

A finished public surface should feel like a premium legal-intelligence
experience adapted to Oblixa's post-signature contract operations. It should be
serif-led, artifact-rich, spacious, and visibly closer to the supplied references
than to a standard SaaS landing page.

A finished product surface should feel like a legal-operations workbench:
precise, trustworthy, dense where necessary, and visually connected to the
public system without adopting public-page theatricality.

If the result is merely clear, generic, or safe, it is not finished.
