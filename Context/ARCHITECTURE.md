# Rice Mill Intelligence System - Architecture

## 1. FDE Engagement Classification

This is a Mode A Forward Deployed Engineer engagement: the system is acting as the FDE for a real operating workflow, not designing a generic SaaS dashboard.

The product is pre-MVP but must be architected for real rice mill operations from day one:

- The operator workflow is messy, partial, and document-heavy.
- The owner wants memory, warnings, and evidence, not dashboard theatre.
- AI is useful only as a capture and explanation layer.
- Truth must come from confirmed events, source documents, deterministic calculations, and audit trails.

Primary failure mode to prevent:

> AI creates confident-looking business truth from incomplete or unconfirmed data.

The architecture therefore prioritizes:

1. Correctness
2. Recoverability
3. Auditability
4. Owner trust
5. Simple UX
6. Fast pilot
7. Clean abstraction
8. Visual polish

## 2. Product Architecture Thesis

Rice Mill Intelligence System is a voice-first and photo-first operating memory for a rice mill.

The core architectural loop is:

```text
Voice/photo/manual input
  -> stored source artifact
  -> AI draft extraction
  -> field-level confidence and missing-field detection
  -> owner confirmation/correction
  -> correction memory
  -> confirmed business event
  -> deterministic ledger/calculation update
  -> mismatch/missing-data detection
  -> evidence-backed answer/export
```

The system must never collapse this loop into "AI extracted it, therefore it is true."

## 3. System Layers

```text
Input Layer
  Voice, photo upload, document upload, manual quick edit, ask/search

AI Understanding Layer
  Speech-to-text, OCR/vision extraction, document classification,
  structured draft generation, question intent detection

Draft Layer
  AI-created draft entries, field-level confidence, missing fields,
  human confirmation/correction workflow

Truth Layer
  Confirmed business events, source documents, field statuses,
  event ledger, audit logs, correction memory

Logic Layer
  Stock calculations, paddy inward reconciliation, milling recovery,
  by-product stock/sale calculations, expense totals, CA export math

Intelligence Layer
  Missing data alerts, mismatch detection, low-rate sale detection,
  abnormal recovery detection, evidence-backed explanations

Export Layer
  Monthly/yearly summaries, Excel export, PDF export,
  document bundles, locked/versioned export snapshots
```

## 4. Recommended MVP Stack

Use the practical MVP stack specified in the product documents:

- Next.js App Router for frontend and backend routes
- TypeScript
- Tailwind CSS
- Supabase Postgres
- Supabase Auth
- Supabase Storage
- OpenAI API for structured extraction, vision, voice, and explanations
- Zod for runtime validation of AI and API payloads
- Excel/PDF export utilities
- Optional Google Vision OCR fallback later for difficult handwriting

Avoid v1 microservices. Keep the first deployment as one Next.js application with clear internal modules.

## 5. Bounded Contexts

### Capture

Owns:

- File uploads
- Voice uploads/transcripts
- Manual quick entries
- Raw input records
- Document storage references

Does not own:

- Confirmed stock
- Final business events
- Profit calculations

### Extraction

Owns:

- Document classification
- OCR/vision extraction
- Speech-to-structured-draft conversion
- AI raw output logging
- Extraction confidence
- Draft payloads

Does not own:

- Truth
- Confirmed values
- Ledger writes

### Confirmation

Owns:

- Field review
- User correction
- Required/missing field handling
- Creation of correction memory
- Promotion from draft to confirmed business event

### Ledger

Owns:

- Business events
- Stock events
- Financial events
- Deterministic calculations
- Reversal/adjustment events
- Export locks

### Intelligence

Owns:

- Alert rules
- Mismatch checks
- Data quality scoring
- Ask/search orchestration
- Evidence bundle generation

### Export

Owns:

- Monthly/yearly summaries
- CA export snapshots
- Excel/PDF generation
- Document bundle references
- Export locks/versioning

## 6. Human System Map

| Role | Incentive | Workflow Touchpoint | Fear | Authority | Adoption Risk |
|---|---|---|---|---|---|
| Owner | Reduce memory load, avoid losses, know stock, prepare CA reports | Speaks, uploads photos, confirms, asks questions | Software becomes complicated or AI guesses wrong | Can confirm, correct, approve disputed entries, lock periods | If UX feels like ERP, owner stops using it |
| Manager/operator | Quick entry without blame | Truck arrivals, bag count, moisture, milling outputs, expenses | Entry mistakes become blame | Can create drafts and maybe confirm low-risk entries | If entry is slow, they return to paper/WhatsApp |
| Accountant/CA | Clean summaries and documents | Monthly/yearly export | Data incomplete or unverifiable | Consumes exports, may request corrections | If reports lack evidence, they ignore the system |
| Family/helper | Visibility and basic assistance | Search, alerts, read-only review | Accidentally changing records | Usually read-only or limited edit | If permissions are unclear, trust drops |
| System admin | Keep app running | Users, roles, storage, backups | Nobody can recover failures | Technical/admin authority | If no runbook exists, system depends on one engineer |

## 7. Core Ontology

| Entity | Meaning | Source of Truth | Other Sources | Key Events | Automation Boundary |
|---|---|---|---|---|---|
| Mill | Operating business unit | Supabase `mills` | Owner setup | Created, updated | No AI writes |
| User | Person using the system | Supabase Auth + `profiles` | Manual admin | Invited, role changed, disabled | No AI writes |
| Party | Farmer, dealer, center, vendor, CA contact | Confirmed party table | AI extraction, correction memory | Created, merged, corrected | AI can suggest, human confirms |
| Source Center | IKP/PPC/government source | Confirmed party/center table | Truck sheet, app screenshot | Added, corrected | AI can suggest |
| Document | Original uploaded artifact | Supabase Storage + `documents` | User upload | Uploaded, classified, linked, archived | AI can classify, cannot delete truth |
| Extracted Field | AI/vision/voice field result | `extracted_fields` | Model output | Extracted, superseded | AI writes only draft fields |
| Business Event | Confirmed operational event | `business_events` | Confirmed draft | Confirmed, adjusted, cancelled, locked | Created only after confirmation or deterministic system rule |
| Paddy Lot | Trackable paddy unit | Confirmed paddy inward event | Truck sheet, weighbridge, app screenshot | Created, reconciled, disputed, milled | AI cannot finalize |
| Stock Event | Deterministic stock movement | Ledger logic | Business event | Inward, output, sale, adjustment | System-calculated only |
| Milling Batch | Paddy processed into outputs | Confirmed batch event | Operator entry, documents | Started, output recorded, reconciled | Human confirms outputs |
| By-product Sale | Sale of bran/broken rice/husk | Confirmed sale event | Bill/photo, voice | Drafted, confirmed, paid, adjusted | AI can flag low rate |
| Expense | Labour/transport/electricity/maintenance cost | Confirmed expense event | Bill/photo, voice | Drafted, confirmed, exported | AI drafts only |
| Payment | Receivable/payment status | Confirmed payment event | Bill, manual entry | Recorded, settled, adjusted | Human confirms |
| Alert | Actionable risk or missing item | Rule engine | Data quality jobs | Created, snoozed, resolved | System creates, human resolves |
| Task | Missing data or follow-up | Rule engine/user | Incomplete entry | Created, assigned, completed | System creates from missing fields |
| Correction Memory | Owner correction of AI/system suggestion | Correction table | Confirmation UI | Created, reused | AI can retrieve, not overwrite |
| Audit Log | Immutable record of important actions | System logging | All modules | Created per mutation | Append-only |
| Export Snapshot | CA/month/year export state | Export module | Ledger/documents | Generated, locked, superseded | Human triggers |

## 8. Data Truth Model

Every important field should support:

- `value`
- `source_type`
- `source_id`
- `status`
- `confidence`
- `confirmed_by`
- `confirmed_at`
- `linked_document_id`
- `audit_log_id`

Required statuses:

| Status | Meaning |
|---|---|
| `draft` | Created but not confirmed |
| `ai_extracted` | Extracted by AI from image/audio |
| `user_confirmed` | Confirmed by human |
| `system_calculated` | Derived by deterministic logic |
| `incomplete` | Missing required fields |
| `disputed` | Conflicting sources exist |
| `estimated` | Calculated with incomplete data |
| `reconciled` | Required sources match |
| `locked` | Locked after period close/export |
| `exported` | Sent to CA/reporting export |
| `cancelled` | Cancelled but not hard-deleted |
| `adjusted` | Corrected using an adjustment event |

Important rule:

> Record-level status and field-level status are both needed.

Example:

- Paddy lot status: `incomplete`
- `truck_number`: `user_confirmed`
- `bag_count`: `ai_extracted`
- `moisture`: missing
- `app_quantity`: missing

## 9. Source and Evidence Model

Answers and reports must be generated from evidence bundles.

An evidence bundle should include:

- Confirmed business events used
- Source documents linked to those events
- Deterministic calculation function used
- Relevant audit logs
- Data completeness score
- Correction history if relevant
- Missing/disputed fields that reduce confidence

The assistant answer layer should never query raw documents alone and present the result as business truth. It should first retrieve confirmed events and calculation outputs, then attach supporting documents.

## 10. Event and Ledger Architecture

Use an event-ledger model instead of mutable balance fields as the primary source of truth.

### Business Event Examples

- `paddy_inward_confirmed`
- `paddy_inward_adjusted`
- `milling_batch_started`
- `milling_output_recorded`
- `byproduct_sale_confirmed`
- `expense_confirmed`
- `payment_recorded`
- `export_snapshot_created`
- `entry_cancelled`

### Stock Event Examples

- `paddy_in`
- `paddy_milled_out`
- `rice_out`
- `bran_out`
- `broken_rice_out`
- `byproduct_sold_out`
- `stock_adjustment`

Stock summaries should be calculated from stock events, not from AI output or editable totals.

### No Hard Delete Rule

Important business records are never hard-deleted. Use:

- `cancelled` events for voids
- `adjusted` events for corrections
- locked/exported records with future adjustment events

## 11. Primary Data Flow

```text
User input
  -> upload/input record
  -> source document stored in Supabase Storage
  -> document row created
  -> AI classification/extraction job
  -> extracted fields saved with confidence/status
  -> draft entry created
  -> confirmation screen
  -> user confirms/corrects fields
  -> correction memory saved for changed fields
  -> confirmed business event created
  -> deterministic ledger function emits stock/financial events
  -> mismatch/missing-data rules run
  -> alerts/tasks/data-quality scores update
  -> answers/exports can use the confirmed evidence
```

## 12. MVP Database Modules

The first migration should be organized around these modules.

### Identity and Ownership

- `mills`
- `profiles`
- `mill_members`
- `roles`

### Parties and Reference Data

- `parties`
- `party_aliases`
- `centers`
- `dealers`
- `expense_categories`
- `product_types`

### Documents and Extraction

- `documents`
- `document_links`
- `extraction_runs`
- `extracted_fields`
- `draft_entries`
- `draft_entry_fields`

### Confirmation and Memory

- `confirmed_field_values`
- `correction_memory`
- `audit_logs`

### Operations

- `paddy_lots`
- `paddy_inward_events`
- `milling_batches`
- `milling_batch_inputs`
- `milling_batch_outputs`
- `byproduct_sales`
- `expenses`
- `payments`

### Ledger

- `business_events`
- `stock_events`
- `financial_events`
- `calculation_runs`

### Intelligence

- `alerts`
- `tasks`
- `data_quality_scores`
- `evidence_bundles`
- `assistant_queries`
- `assistant_answer_sources`

### Export

- `export_snapshots`
- `export_snapshot_items`
- `export_files`

## 13. Core Workflows

### 13.1 Truck Sheet Upload to Paddy Inward

```text
Upload truck sheet photo
  -> store original file
  -> classify document as truck_sheet
  -> extract center, truck number, bag count, date, notes
  -> create paddy inward draft
  -> show missing fields and confidence
  -> owner confirms/corrects
  -> save correction memory
  -> create paddy lot
  -> create stock event only for confirmed quantity
  -> create tasks for missing app details, moisture, weighbridge, actual count
  -> run mismatch checks
```

Critical behavior:

- If the truck number is unclear, do not guess.
- If bag count conflicts with physical count, mark `disputed`.
- If app details are missing, keep lot `incomplete`, not blocked.

### 13.2 Voice Paddy Inward

```text
Owner speaks
  -> audio stored
  -> transcript generated
  -> structured draft extracted
  -> missing fields identified
  -> confirmation screen
  -> confirmed fields become paddy inward event
  -> missing fields become tasks
```

Voice entries are allowed to be incomplete. This is a feature, not an error.

### 13.3 OPMS / Government App Reconciliation

Support three modes:

| Mode | Input | System Behavior |
|---|---|---|
| Full Reconciliation | Truck sheet, app entry/screenshot, physical count, weighbridge, moisture | Compare all available sources and mark matched/incomplete/disputed/reconciled |
| Lightweight Capture | Partial voice/photo/manual data | Save incomplete entry and create pending tasks |
| Doubt Check | Owner asks about a truck/lot | Show all sources, missing sources, conflicts, confidence, and next action |

Government paddy, farmer/custom paddy, private paddy, rice, bran, broken rice, and expenses must remain separated by product/source type.

### 13.4 Milling Batch

```text
Select paddy lot(s)
  -> enter input quantity
  -> record rice, bran, broken rice, shortage/wastage
  -> calculate recovery deterministically
  -> update stock events
  -> flag abnormal recovery
  -> mark incomplete if outputs are missing
```

Recovery calculation belongs in deterministic code, not the LLM.

### 13.5 By-product Sale

```text
Enter/upload sale
  -> classify/extract dealer, product, quantity, rate, payment status
  -> user confirms
  -> calculate total
  -> compare rate to historical confirmed rates
  -> create alert if suspicious
  -> save owner's accepted reason if marked intentional
  -> update by-product stock
```

Low-rate alert example:

```text
Today rate: Rs 1,350/qtl
30-day average: Rs 1,520/qtl
Difference: Rs 170/qtl
Quantity: 50 qtl
Possible impact: Rs 8,500
```

### 13.6 Expense

```text
Voice/photo/manual expense input
  -> extract category, amount, date, bill/document
  -> confirm
  -> save expense event
  -> include in monthly cost and CA export
  -> create task if bill is missing
```

V1 categories:

- Labour
- Transport
- Electricity
- Maintenance

### 13.7 Ask/Search

```text
Question
  -> intent detection
  -> retrieve confirmed events/calculation outputs first
  -> retrieve linked documents/audit logs as evidence
  -> compute confirmed/pending/disputed/estimated separation
  -> generate simple owner-facing answer
  -> attach evidence sources and confidence
```

If evidence is incomplete, the answer must say so.

### 13.8 CA Export

```text
Select month/year
  -> run data completeness checks
  -> show missing/disputed items
  -> generate summary from confirmed ledger
  -> include document links/bundle
  -> create Excel/PDF
  -> create export snapshot
  -> mark exported records
  -> lock/version records
  -> future changes create adjustment events
```

## 14. AI Architecture

AI has four permitted jobs in v1:

1. Capture
   - Voice transcription
   - Photo/document classification
   - OCR/vision extraction
   - Structured draft generation

2. Assist confirmation
   - Highlight low-confidence fields
   - Show missing fields
   - Suggest likely party/center aliases from correction memory

3. Explain
   - Explain deterministic calculations in simple language
   - Summarize evidence and missing data

4. Search
   - Interpret natural-language questions
   - Retrieve relevant entries/documents

AI must not:

- Silently update stock
- Finalize government confirmation
- Guess unreadable handwriting as truth
- Invent profit reasons
- Hide missing data
- Give answers without evidence
- Edit confirmed records directly

### Structured Output Boundary

All AI extraction must go through Zod-validated schemas.

Invalid or partial AI output should be saved as a draft/extraction failure, not coerced into confirmed data.

### Correction Memory Retrieval

Use correction memory as context/rules:

- party aliases
- center aliases
- truck number correction patterns
- document type corrections
- accepted low-rate reasons
- recurring handwriting/OCR corrections

Do not fine-tune in v1.

## 15. Deterministic Calculation Architecture

Business calculations must live in typed deterministic functions.

Required calculators:

- Paddy inward totals
- Confirmed/pending/disputed stock
- Milling recovery percentage
- Rice/bran/broken rice stock
- By-product sale totals
- Historical average sale rate
- Low-rate impact estimate
- Monthly expense totals
- CA monthly/yearly summaries
- Data quality/completeness scores

Each calculation run should record:

- input event IDs
- input filters
- function/version used
- output value
- completeness/confidence classification
- timestamp

## 16. Mismatch and Alert Rules

Initial alert rules:

- Missing truck sheet
- Missing actual bag count
- Missing moisture
- Missing weighbridge slip
- OPMS/app details missing
- Truck sheet vs physical count mismatch
- OPMS/app vs truck sheet mismatch
- Negative stock
- Milling output missing
- Abnormal recovery
- Low by-product sale rate
- Unpaid by-product sale
- Missing expense bill
- CA export incomplete
- Compliance reminder

Alerts must be actionable:

```text
Moisture missing for Mallapur truck TS09AB1234.
Add now or remind later?
```

Bad alerts like "Data missing" are not acceptable.

## 17. Data Quality Score

Data quality should exist at three levels:

- Lot level
- Month level
- Export/report level

Example scoring dimensions:

- Required field completeness
- Confirmed vs AI-extracted fields
- Linked source document coverage
- Disputed field count
- Missing task count
- Locked/exported status

The score should never hide details. It is a summary over visible missing/disputed items.

## 18. API Route Shape

Use Next.js route handlers/server actions with typed input validation.

Suggested MVP routes:

### Capture

- `POST /api/uploads/document`
- `POST /api/uploads/voice`
- `POST /api/manual-entry`

### Extraction

- `POST /api/extraction/document`
- `POST /api/extraction/voice`
- `GET /api/drafts/:id`

### Confirmation

- `POST /api/drafts/:id/confirm`
- `POST /api/drafts/:id/correct`
- `POST /api/entries/:id/adjust`
- `POST /api/entries/:id/cancel`

### Operations

- `GET /api/paddy/lots`
- `GET /api/paddy/lots/:id`
- `POST /api/milling-batches`
- `POST /api/byproduct-sales`
- `POST /api/expenses`

### Intelligence

- `GET /api/tasks`
- `POST /api/tasks/:id/complete`
- `GET /api/alerts`
- `POST /api/alerts/:id/resolve`
- `POST /api/ask`

### Export

- `GET /api/export/ca/preview`
- `POST /api/export/ca`
- `GET /api/export/:id/download`

## 19. First Screens

### Home

Primary actions:

- Speak
- Upload photo
- Ask
- Pending tasks
- Alerts

### Confirm Entry

Shows:

- AI extracted fields
- confidence
- missing fields
- source document preview
- edit/correct controls
- confirm/save action

### Documents

Shows:

- uploaded documents
- document type
- linked entry
- search
- missing document tasks

### Paddy / Stock

Shows:

- confirmed stock
- pending stock
- disputed stock
- lots
- linked documents

### Ask

Supports owner questions with evidence-backed answers.

### CA Export

Shows:

- monthly/yearly summary
- missing data before export
- Excel/PDF export
- document bundle export

Do not make the first screen a generic dashboard.

## 20. Reliability Architecture

### Idempotency

Every write operation should have an operation ID:

- upload operation ID
- extraction run ID
- draft confirmation ID
- business event ID
- export snapshot ID

Retries must not duplicate documents, stock events, sales, or expenses.

### Retry Policy

Safe operations:

- AI extraction retry
- OCR retry
- export file generation retry
- alert recalculation retry

Risky operations:

- confirming a business event
- emitting stock events
- locking/exporting records

Risky operations require explicit idempotency checks and audit logs.

### Dead Letter Queue

Use a `failed_jobs` or equivalent table for failed async work:

- payload
- job type
- source ID
- error
- retry count
- created timestamp
- last attempted timestamp
- owner/status

### Reconciliation Jobs

Scheduled jobs should check:

- drafts stuck after extraction
- documents without linked entries
- confirmed events without stock events
- stock events with impossible negative balances
- missing app/government details
- unresolved alerts
- export snapshots with failed files

### Kill Switches

Config flags should allow disabling:

- AI extraction
- assistant answers
- alert generation
- export generation
- any future autonomous action

Manual entry and confirmed ledger viewing must remain available.

## 21. Observability and Audit

Every important mutation should create an audit log:

- who did it
- what changed
- previous value
- new value
- source
- timestamp
- request/operation ID

Every AI call should log:

- input type
- model
- prompt/schema version
- retrieved correction memory IDs
- raw output
- validated output
- confidence
- latency
- cost if available
- user correction outcome

Operational dashboards should answer:

- Are uploads working?
- Are extractions failing?
- Are drafts being confirmed?
- Which entries are stuck incomplete?
- Are stock calculations consistent?
- Are export jobs failing?

## 22. Security and Permissions

Minimum roles:

- Owner/admin
- Manager/operator
- Accountant/CA
- Family/helper/read-only

Permission defaults:

| Action | Owner | Manager | Accountant/CA | Read-only |
|---|---:|---:|---:|---:|
| Upload documents | Yes | Yes | Yes | No |
| Create drafts | Yes | Yes | Limited | No |
| Confirm entries | Yes | Configurable | No | No |
| Adjust locked/exported records | Yes | No | No | No |
| View reports | Yes | Configurable | Yes | Yes |
| Generate CA export | Yes | No | Configurable | No |
| Manage users | Yes | No | No | No |

Use Supabase Row Level Security by `mill_id`.

Never build a shared retrieval index across mills or permission boundaries.

## 23. Storage Architecture

Store originals in Supabase Storage.

Recommended path pattern:

```text
mills/{mill_id}/documents/{yyyy}/{mm}/{document_id}/{original_filename}
```

Document rows should store:

- storage bucket/path
- MIME type
- file size
- checksum if available
- uploaded by
- upload timestamp
- document type
- extraction status
- linked business objects

Do not overwrite originals. New versions should create new document rows or version records.

## 24. Search and Retrieval Architecture

Search should combine:

- structured database filters
- document metadata search
- extracted field search
- optional vector search for document text later

Retrieval order for business answers:

1. Confirmed business events
2. Deterministic calculation outputs
3. Linked documents
4. Audit logs
5. Extracted draft fields only as pending/incomplete evidence

Draft or AI-extracted data must be labeled as pending, not treated as confirmed truth.

## 25. MVP Implementation Slices

Build in slices that prove the loop.

### Slice 1 - Document Upload and Vault

- Upload original document
- Store metadata
- Classify document
- Show document list/detail

### Slice 2 - AI Extraction to Draft

- Extract fields for truck sheet and sale/expense bills
- Validate with Zod
- Save extracted fields and draft entries

### Slice 3 - Confirmation and Correction Memory

- Confirm entry UI
- Correct fields
- Save correction memory
- Create confirmed business event

### Slice 4 - Paddy Inward Ledger

- Create paddy lot
- Emit confirmed stock event
- Show confirmed/pending/disputed stock
- Create missing-field tasks

### Slice 5 - By-product Sales and Low-Rate Alert

- Confirm by-product sale
- Calculate total
- Compare against historical confirmed rates
- Create actionable alert

### Slice 6 - Expenses and Monthly Cost

- Confirm expenses
- Show monthly totals
- Track missing bill tasks

### Slice 7 - Ask with Evidence

- Answer first MVP questions using database/calculation evidence
- Show sources and missing data warnings

### Slice 8 - CA Export

- Preview data quality
- Generate Excel/PDF summary
- Create export snapshot
- Lock/version exported records

## 26. Open Field Discovery Questions

These must be answered before finalizing schema details:

1. What exact fields exist on the truck sheet?
2. What exact fields exist in OPMS/app entries or screenshots?
3. Who usually enters/confirms government app details?
4. What happens operationally when there is a mismatch?
5. What is the actual moisture recording process?
6. How are lots named today?
7. How are milling batches recorded today?
8. How are bran/broken rice sales recorded today?
9. What does the CA ask for yearly?
10. Which documents are legally/operationally mandatory to keep?
11. Which fields are critical and which are optional?
12. What language should the owner interface use first?
13. What is the minimum daily summary the owner wants?
14. Who is allowed to edit confirmed entries?
15. When should data be locked?

## 27. MVP Non-Goals

Do not build these in v1:

- Full ERP
- Full accounting system
- GST filing
- Full Tally integration
- Automatic government portal confirmation
- Complex dashboards
- Prediction model
- Custom trained handwriting model
- Multi-mill SaaS admin
- Play Store mobile app
- Autonomous financial decisions

## 28. Architecture Decisions

### ADR-001: AI Creates Drafts, Not Truth

AI outputs are stored as extracted fields and drafts. Only confirmation or deterministic logic creates business truth.

### ADR-002: Event Ledger Over Mutable Totals

Stock and financial summaries are derived from events. Adjustments and cancellations are events, not destructive edits.

### ADR-003: Field-Level Status Is Required

Record-level status alone cannot represent real rice mill data quality. Each important field tracks source, status, confidence, and audit trail.

### ADR-004: Evidence-First Assistant

The assistant answers from confirmed ledger entries, documents, calculation functions, audit logs, and completeness scores. If evidence is missing, the answer must say so.

### ADR-005: No Shared Retrieval Across Mill Boundaries

All retrieval and search must be scoped by `mill_id` and user permissions.

### ADR-006: Quiet Until Needed

The system should not nag all day. It should maintain pending tasks and surface urgent/actionable alerts when needed.

## 29. Definition of Done

A feature is done only when:

- Data is saved correctly
- Missing data is handled
- Corrections are stored
- Audit trail exists
- Calculation is deterministic
- Evidence can be shown
- User can recover from mistakes
- Export/report impact is clear

Screens alone do not make the MVP successful.

The MVP is successful only if one real rice mill can use the capture-confirm-ledger-evidence loop for real entries and answer:

1. What came today?
2. Which entries are incomplete?
3. Which truck sheets are missing?
4. Which app/government details are missing?
5. Which lot has mismatch?
6. How much confirmed stock exists?
7. What by-products were sold?
8. Which sale rate looks low?
9. What expenses were recorded this month?
10. What data can be sent to CA?
