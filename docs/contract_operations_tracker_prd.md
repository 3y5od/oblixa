**Contract Operations Tracker**

*Product Requirements Document | Version 1.0*

|**Product**|Contract Operations Tracker|**Document**|PRD v1|
| :- | :- | :- | :- |
|**Audience**|Founder / pilot customers|**Scope**|MVP for small service firms|

|**Executive summary.** This product centralizes client agreements, extracts a narrow set of operational fields with source citations, and turns approved dates into reliable reminders and dashboards. It is intentionally a contract operations tool, not a legal AI assistant.|
| :- |

# **1. Problem statement**
## **What problem is being solved**
Small service firms manage contracts through email threads, shared drives, folders, and spreadsheets. Important operational details such as notice windows, renewal dates, and fees are buried inside inconsistent documents. The result is a fragile process that depends on manual follow-up and individual memory.
## **Who the product is for**
The initial customer is a small B2B service business that has enough active client agreements to feel renewal risk, but not enough scale to justify enterprise contract management software. Best-fit firms are agencies, consultancies, recruiting firms, and other service businesses with roughly 20 to 200 active agreements and no dedicated legal operations team.
## **Why this matters**
- Missed notice windows and accidental renewals create direct financial risk.
- Finding the latest signed agreement is slower than it should be.
- Teams cannot easily answer what needs attention this month.
- Current reminders are difficult to trust because the source data is scattered.
## **Core product thesis**
A narrow, review-first system that centralizes contracts, extracts only a few operationally critical fields, and tracks upcoming actions is more credible and more sellable than a broad AI contract assistant.
# **2. Product requirements**
## **Product goal**
Provide a lightweight contract operations system that helps small service firms centralize agreements, extract key dates and terms with human review, and reliably surface upcoming actions.
## **Feature priorities**

|Feature area|What it must do|Priority|Notes|
| :- | :- | :-: | :- |
|Contract intake|Upload PDF or DOCX, preserve original files, capture source metadata, and support multiple files per contract record.|High|Include drag-and-drop and direct upload in v1.|
|Metadata extraction|Extract counterparty, contract type, effective date, start date, end date, renewal date, notice window, term, fee reference, payment cadence if present, and auto-renewal status.|High|Every field must include a source snippet.|
|Review and approval|Allow users to approve, edit, or reject extracted values before any field becomes active.|High|Approved fields become system truth.|
|Dashboard and list view|Show active contracts, contracts needing review, upcoming notice windows, and upcoming renewals.|High|Filter by owner, status, and date.|
|Reminders|Send reminder emails based on approved notice and renewal dates only.|High|No reminders from unapproved data.|
|Manual fallback|Allow manual entry or correction when extraction fails or is incomplete.|High|Distinguish human-entered and AI-extracted values.|
|Search and retrieval|Search by counterparty, contract title, key dates, fee, or keyword and open the original document from results.|Medium|Results should lead to records, not chatbot answers.|
|Ownership and roles|Assign an internal owner and support admin, editor, and viewer roles.|Medium|Owner receives reminders.|

## **Constraints**
- The product must not position itself as legal advice.
- The first version must keep field extraction narrow and operational.
- Ambiguous values must be marked unknown rather than guessed.
- The review workflow must be faster than building or updating a spreadsheet manually.
- The system must remain useful even when contracts are inconsistent or partially messy.
## **Success criteria**
- A new user can create a useful dashboard within 30 minutes.
- At least 80 percent of active contract records have approved key dates.
- At least 90 percent of reminder-triggering fields are sourced and approved.
- Average review time is under 3 minutes per contract for the pilot set.
- The first pilot customer keeps using the product after the first real reminder cycle.
# **3. Scope**

|**Included in MVP**|**Explicitly not included in MVP**|
| :- | :- |
|- - Web app with authentication and organization workspaces|- - Legal advice or legal risk scoring|
|- - Contract upload and file storage|- - Redlining, negotiation workflows, or contract editing|
|- - AI-assisted extraction for the fixed v1 field set|- - Deep clause interpretation beyond the defined field set|
|- - Source-linked review and approval|- - CRM, DocuSign, Slack, or Google Drive integrations|
|- - Contract list and deadline dashboard|- - Advanced OCR-heavy scanned-document support|
|- - Email reminders|- - External party portal or enterprise CLM features|
|- - Basic search and filtering|- - Portfolio analytics beyond basic dashboarding|
|- - Team roles, audit trail, and manual field editing||

Scope boundary: this is a contract operations product for small service firms, not a full contract lifecycle management platform and not a general legal AI copilot.
# **4. User stories and use cases**
## **Primary persona**
Operations lead, founder, finance lead, or account director at a small service firm responsible for keeping client agreements organized and acted on.
## **User stories**
- As an operations lead, I want to upload signed contracts so they are stored in one place.
- As a founder, I want to forward contracts from email so I do not need to reorganize files first.
- As a reviewer, I want to see each extracted field beside its source text so I can confirm it quickly.
- As an owner, I want reminder emails with direct links to the relevant contract and source evidence.
- As a team member, I want to find the latest signed agreement for a client without searching across folders.
- As an account lead, I want a dashboard of contracts with notice windows approaching so I can act on time.
## **Core use cases**

|**Use case**|**Trigger**|**Expected flow**|
| :- | :- | :- |
|New client agreement|A signed MSA or SOW is received.|User uploads the document, the system extracts fields, a reviewer approves key dates, and the contract becomes active with reminders scheduled.|
|Existing contract audit|A team wants visibility across a backlog of agreements.|User uploads a batch of contracts, reviews pending fields in sequence, resolves unknowns, and gains a portfolio dashboard of upcoming actions.|
|Upcoming notice deadline|A reminder fires before a notice window closes.|The contract owner opens the record, sees the approved notice date and source clause, and decides whether to renew, renegotiate, or terminate.|

# **5. Designs and prototypes**
## **UX principles**
- Trust before automation
- Show source before summary
- Keep the main workflow review-oriented and table-driven
- Make what needs attention now visible on first load
## **Core screens**
**Upload screen:** Drag-and-drop upload, recent uploads, and clear file status.

**Extraction review screen:** Editable field list paired with source snippets, confidence cues, and approve or reject actions.

**Contract list view:** Table of contracts with filters for owner, status, notice date, and renewal date.

**Dashboard:** Cards for upcoming actions, contracts needing review, and records with missing critical fields.

**Contract detail page:** Key metadata, source citations, original files, reminder schedule, and audit history.
## **Prototype recommendation**
The first technical prototype should prioritize the trust loop rather than visual polish: upload a contract, run structured extraction against the fixed schema, show field values with source evidence, allow approval or correction, and generate a reminder record only after approval.
# **6. Technical architecture**
## **Stack**
- Frontend: Next.js
- Hosting: Vercel
- Backend, auth, database, and storage: Supabase
- Payments: Stripe
- Email delivery: transactional email provider through server routes or Supabase Edge Functions
- AI layer: schema-constrained LLM extraction pipeline
- Document processing: PDF and DOCX text extraction with basic fallback handling
## **Major components**

|**Component**|**Responsibility**|**Key decision**|
| :- | :- | :- |
|Frontend|Authentication, upload flow, review UI, dashboard, and billing screens.|Avoid chat-first UX; keep the product record-based.|
|Application backend|Contract record creation, extraction job orchestration, permissions, reminder scheduling, and audit logging.|Treat approved fields as the only active metadata.|
|Storage layer|Original files and processed artifacts.|Store original documents immutably.|
|Database|Organizations, contracts, files, extracted fields, approved fields, reminders, and audit events.|Support multiple files per contract record.|
|Extraction pipeline|Text extraction, schema-based field extraction, confidence handling, and source snippet capture.|Mark ambiguous values unknown rather than guessed.|
|Reminder engine|Compute upcoming events and deliver reminder emails.|Use approved dates only.|
|Billing|Subscriptions, trials, and plan enforcement.|Keep pricing simple in v1.|

## **Data flow**
1. User uploads a contract file.
1. The file is stored and a contract record is created.
1. A background extraction job parses the document and writes pending extracted fields.
1. A user reviews and approves or edits each field.
1. Approved fields become active metadata for dashboarding, search, and reminders.
1. The reminder engine watches approved dates and sends notifications to the contract owner.
# **7. Delivery plan**
A disciplined MVP can be built in roughly 8 to 10 weeks if the field schema stays narrow and integrations remain out of scope.

|**Milestone**|**Weeks**|**Deliverables**|**Owner**|
| :- | :- | :- | :- |
|Core foundation|1-2|Auth, organization model, storage, schema, contract list shell, and contract detail shell.|Founder|
|Extraction prototype|3-4|PDF or DOCX parsing, fixed-schema extraction, source snippet capture, pending-review state, and first review screen.|Founder|
|Review workflow|5-6|Approve, edit, reject flow; audit trail; active metadata model; dashboard; filters; search.|Founder|
|Reminder loop|7|Reminder scheduling, owner assignment, reminder history, and email notifications.|Founder|
|Pilot readiness|8|Billing, onboarding, seeded demo workspace, error handling, and usage tracking.|Founder|
|Pilot iteration|9-10|Pilot setup, bug fixes, extraction schema adjustments, and review-speed improvements.|Founder|

## **Sequencing logic**
- Build storage and schema before optimization.
- Prove extraction before building reminder logic.
- Complete the review loop before calling dates active.
- Add billing only after the trust loop is usable.
# **8. Acceptance criteria**
**Intake**

- A user can upload a PDF or DOCX and create a contract record.
- Original files are stored and retrievable from the record.
- Upload failures are visible and recoverable.

**Extraction**

- The system extracts the defined v1 field set into structured records.
- Every extracted field includes a source snippet or source citation.
- Missing or ambiguous values are marked unknown.

**Review**

- A reviewer can approve, edit, or reject each extracted field.
- No reminder-triggering field becomes active without approval.
- All field changes are logged in audit history.

**Dashboard and reminders**

- Users can filter contracts by status, owner, and upcoming dates.
- The dashboard surfaces contracts requiring action soon.
- Reminder emails are sent on schedule only for approved dates and link directly to the relevant record.

**Trust and pilot readiness**

- A pilot user can upload and review the first ten contracts with minimal founder intervention.
- A reviewer can verify why a date exists by looking at the contract record.
- The product never presents uncertain extracted values as confirmed facts.
Contract Operations Tracker | Product Requirements Document
