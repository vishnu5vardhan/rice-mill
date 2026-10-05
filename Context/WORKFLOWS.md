# Rice Mill Intelligence System - Workflows

## 1. Workflow Principles

This document defines exact user flows and failure cases for the MVP.

The product is not complete when a screen exists. A workflow is complete only when:

- Original input is stored.
- AI output is saved as draft or extracted data only.
- The user can confirm or correct.
- Corrections are saved to correction memory.
- Confirmed business events are created only after confirmation.
- Ledger/calculation updates are deterministic.
- Missing data creates tasks.
- Conflicts create disputed states.
- Answers and exports can show evidence.

Core user actions:

- Speak
- Upload photo
- Ask
- Confirm

Core system rule:

> AI can create drafts. AI cannot silently create truth.

## 2. Shared Status Model

Use these statuses consistently across flows.

| Status | Applies To | Meaning |
|---|---|---|
| `draft` | Draft entry | Created but not confirmed |
| `ai_extracted` | Field/document | Extracted by AI from photo/audio |
| `user_confirmed` | Field/entry | Confirmed by a human |
| `system_calculated` | Field/ledger/calculation | Derived by deterministic logic |
| `incomplete` | Entry/lot/report | Required data is missing |
| `disputed` | Entry/field/lot | Sources conflict |
| `estimated` | Calculation/report | Calculated with incomplete data |
| `reconciled` | Lot/entry | Required sources match |
| `locked` | Exported/closed record | Period/export prevents direct edit |
| `exported` | Record/export item | Included in CA export |
| `cancelled` | Entry/event | Cancelled without hard delete |
| `adjusted` | Entry/event | Corrected using adjustment event |
| `failed` | Job/extraction/export | System job failed and needs retry/review |

## 3. Shared Confirmation Pattern

All capture workflows use the same confirmation pattern.

### Entry Points

- Home -> Speak
- Home -> Upload photo
- Home -> Manual quick entry
- Pending task -> Add missing value
- Document detail -> Create entry

### User Flow

1. User provides input by voice, photo, or quick manual entry.
2. System stores the original input.
3. System creates a draft.
4. System shows a confirmation screen with extracted fields.
5. User reviews fields.
6. User either confirms, edits, marks missing, marks disputed, or cancels.
7. System saves the final user decision.

### System Flow

1. Create `document` or `input_capture` record.
2. Store file/transcript/raw text.
3. Run classification/extraction if applicable.
4. Save `extraction_run`.
5. Save `extracted_fields` with confidence and source.
6. Create `draft_entry`.
7. Calculate missing required fields for the draft type.
8. Show confirm screen.
9. On confirm:
   - validate required fields
   - save confirmed fields
   - save correction memory for changed AI fields
   - create business event
   - create audit log
   - run ledger/calculation functions
   - create tasks/alerts if needed

### Success State

- Draft is either confirmed, incomplete, disputed, cancelled, or left pending.
- No AI-extracted field becomes confirmed without user action.
- Evidence can be traced back to source input.

### Shared Failure Cases

| Failure | User Message | System Behavior |
|---|---|---|
| Upload fails | "Photo did not upload. Try again." | Do not create business draft. Log failed upload. |
| File stored but extraction fails | "Photo saved, but I could not read it. You can enter details manually." | Keep document. Create manual-entry task. Mark extraction `failed`. |
| AI returns invalid structure | "Photo saved, but extracted details need manual entry." | Save raw AI output for debugging. Do not create confirmed fields. |
| Low confidence field | "I am not sure about this value. Please check." | Field status remains `ai_extracted` until user confirms. |
| Required field missing | "This entry is incomplete. I saved it and added a pending task." | Save incomplete draft/event if allowed. Create task. |
| User closes confirmation screen | "Draft saved in pending entries." | Keep draft with `draft` or `incomplete` status. |
| User confirms wrong value then edits later | "Correction saved as adjustment." | Create adjustment event and audit log. Do not overwrite history silently. |
| Record is locked/exported | "This was already exported. I will create an adjustment instead." | Create adjustment event, not direct edit. |

## 4. Home Flow

### Goal

Give the owner the shortest path to Speak, Upload photo, Ask, Confirm pending work, or review alerts.

### User Flow

1. User opens app.
2. User sees primary actions:
   - Speak
   - Upload photo
   - Ask
   - Pending tasks
   - Alerts
3. User taps one action.

### System Flow

1. Load user and mill context.
2. Load urgent alerts.
3. Load pending tasks count.
4. Load drafts needing confirmation.
5. Load today's summary only if it can be computed from confirmed/pending/disputed data.

### Success State

- Owner can start a capture in one tap.
- Owner sees only actionable warnings, not dashboard noise.

### Failure Cases

| Failure | User Message | System Behavior |
|---|---|---|
| User not authenticated | "Please sign in." | Redirect to sign-in. |
| Mill not selected | "Select your mill." | Show mill selector. |
| Data fetch fails | "Some latest items could not load. Capture still works." | Keep Speak/Upload available if possible. Log error. |
| Too many alerts | Show top urgent alerts and "View all" | Do not spam the home screen. |

## 5. Truck Sheet Upload -> Paddy Inward Flow

### Goal

Convert a truck sheet photo into a paddy inward draft, confirm it, create a paddy lot, and update stock only for confirmed quantity.

### Entry Points

- Home -> Upload photo
- Documents -> Upload
- Pending task -> Add truck sheet

### Required Data for Confirmed Paddy Inward

Minimum for a confirmed paddy lot:

- Date
- Source type: government/private/farmer/custom
- Source center or party
- Quantity basis: bags or weight
- Confirmed quantity value

Recommended but allowed as missing:

- Truck number
- Moisture
- Weighbridge slip
- Physical bag count
- OPMS/app details
- Truck sheet photo

### User Flow

1. User taps Upload photo.
2. User selects or takes a truck sheet photo.
3. System uploads and shows "Reading photo..."
4. System shows confirmation screen:
   - document type
   - center/party
   - truck number
   - date
   - bag count
   - weight if available
   - missing fields
   - confidence per field
5. User corrects wrong fields.
6. User chooses source type.
7. User confirms the entry or saves incomplete.
8. System shows result:
   - "Paddy inward saved"
   - stock impact
   - pending tasks
   - mismatch alerts if any

### System Flow

1. Store original image in document vault.
2. Create `documents` row with status `uploaded`.
3. Classify document.
4. If classified as `truck_sheet`, run truck sheet extraction schema.
5. Save extracted fields:
   - document type
   - source center/party
   - truck number
   - date
   - bag count
   - weight
   - notes
6. Create `draft_entry` of type `paddy_inward`.
7. Compute missing fields.
8. Show confirmation screen.
9. On confirmation:
   - save user-confirmed field values
   - save correction memory for edited AI fields
   - create `business_event: paddy_inward_confirmed`
   - create `paddy_lot`
   - create `stock_event: paddy_in`
   - link document to paddy lot
   - create missing tasks for moisture, weighbridge, OPMS/app, actual count as needed
   - run mismatch rules
   - create audit log

### Success State

- Original truck sheet is stored.
- Paddy lot exists.
- Confirmed stock changes only by confirmed quantity.
- Missing OPMS/app/moisture/weighbridge data is visible as tasks.

### Failure Cases

| Failure | User Message | System Behavior |
|---|---|---|
| Photo is blurry | "Photo saved, but it is not clear. Please enter details or upload again." | Keep document. Mark extraction `failed` or low confidence. |
| Wrong document type detected | "I thought this was a truck sheet. Please choose the correct type." | User correction updates document type and correction memory. |
| Truck number unreadable | "I am not sure about truck number." | Leave truck number pending. Create missing-field task. |
| Center name unrecognized | "I found this center name. Confirm or choose existing center." | Offer existing aliases. Do not auto-create confirmed party unless user confirms. |
| Bag count missing | "Bag count is missing. Save incomplete?" | Allow incomplete entry if source/date known. Do not create confirmed stock from missing count. |
| Bag count conflicts with physical count | "Truck sheet and physical count do not match." | Mark field/lot `disputed`. Do not reconcile automatically. |
| Duplicate truck sheet uploaded | "This looks like an existing truck sheet. Link to existing entry or create new?" | Detect by file hash/truck/date/center. Prevent silent duplicate stock event. |
| User confirms duplicate as new | "This may double count stock. Confirm creating a separate entry." | Require explicit confirmation and audit log. |
| Stock event creation fails | "Entry saved, but stock update failed. It is in review." | Business event remains. Stock event job goes to failed jobs. Alert admin/owner. |

## 6. Voice Paddy Inward Flow

### Goal

Let the owner say a partial paddy inward entry and save it without forcing long forms.

### Example Voice Input

```text
Mallapur truck came today, around 460 bags. Moisture not checked.
```

### User Flow

1. User taps Speak.
2. User speaks.
3. System transcribes.
4. System shows what it understood:
   - source center: Mallapur
   - date: today
   - bag count: around 460
   - moisture: missing
5. User corrects or confirms.
6. User saves as confirmed or incomplete.

### System Flow

1. Store audio.
2. Generate transcript.
3. Run voice-to-structured-draft extraction.
4. Save transcript and extracted fields.
5. Classify approximate fields.
6. If value is approximate, mark field status `estimated` until user confirms as exact.
7. Create paddy inward draft.
8. On user confirmation:
   - exact confirmed values can update ledger
   - approximate values remain pending/estimated
   - missing fields create tasks

### Success State

- Owner can save partial operational memory in under one minute.
- The system does not reject incomplete real-world input.

### Failure Cases

| Failure | User Message | System Behavior |
|---|---|---|
| Transcription fails | "I could not hear clearly. Try again or type a short note." | Keep audio if available. No business event. |
| Multiple trucks mentioned | "I heard more than one truck. Save separately?" | Split into multiple drafts only after user approval. |
| Approximate quantity | "You said around 460 bags. Confirm exact or keep pending." | Estimated values do not become confirmed stock unless user confirms exact quantity. |
| Ambiguous center | "Which Mallapur did you mean?" | Ask user to choose party/center. Save alias if corrected. |
| User says "later" | "Saved as incomplete." | Create task with missing fields. |
| Voice says government paddy but source missing | "Government paddy source is missing." | Save incomplete. Do not mix with private/farmer stock. |

## 7. Manual Quick Entry Flow

### Goal

Allow fast entry when AI/photo/voice is unavailable or not useful.

### User Flow

1. User taps manual entry or opens pending task.
2. User chooses entry type:
   - Paddy inward
   - By-product sale
   - Expense
   - Milling batch
3. System shows only required fields first.
4. User fills known values.
5. User saves.

### System Flow

1. Create draft with `source_type: manual`.
2. Validate required fields.
3. If enough data exists, allow confirmation.
4. If not, save incomplete and create tasks.
5. Audit who entered each field.

### Failure Cases

| Failure | User Message | System Behavior |
|---|---|---|
| Required field missing | "Saved incomplete. I added a pending task." | Do not block partial memory unless no useful field exists. |
| Invalid number | "Check this number." | Inline validation. Do not save invalid field. |
| User tries to enter stock total directly | "Stock changes must come from an inward, output, sale, or adjustment." | Route to correct event type. |
| Manual entry conflicts with existing document | "This differs from the uploaded document." | Mark disputed or ask user to resolve. |

## 8. OPMS / Government App Reconciliation Flow

### Goal

Support government/app details without forcing the owner to check external systems every time.

### Modes

| Mode | When Used | Result |
|---|---|---|
| Full reconciliation | Truck sheet, app details, actual count, weighbridge, moisture are available | Lot can become `reconciled` if values match |
| Lightweight capture | Only partial data is available | Lot remains `incomplete` with tasks |
| Doubt check | Owner suspects mismatch | System shows all sources and missing/conflicting fields |

### Full Reconciliation User Flow

1. User opens paddy lot.
2. User adds OPMS/app details manually or uploads screenshot.
3. System extracts app fields.
4. System compares:
   - app quantity
   - app bags
   - truck sheet quantity
   - actual physical count
   - weighbridge/net weight
   - moisture
   - truck number
   - source center
5. User reviews comparison.
6. User marks matched, disputed, or needs follow-up.

### Lightweight Capture User Flow

1. User uploads truck sheet or speaks entry.
2. User does not add app details.
3. System saves paddy lot as incomplete.
4. System creates task:
   - "App details missing for this government paddy lot."

### Doubt Check User Flow

1. User asks: "Check this truck."
2. System asks for truck/lot if ambiguous.
3. System shows:
   - truck sheet values
   - app values
   - actual count
   - weighbridge values
   - missing values
   - mismatches
   - linked documents
4. User chooses next action:
   - upload app screenshot
   - enter app details
   - mark disputed
   - resolve mismatch
   - remind later

### System Flow

1. Link app screenshot/manual app details to paddy lot.
2. Save extracted fields with source `government_app`.
3. Run reconciliation rule.
4. For each comparable field:
   - if values match within tolerance, mark matched
   - if one side missing, mark incomplete
   - if values conflict, mark disputed
5. Update lot status:
   - `reconciled` if required sources match
   - `incomplete` if sources missing
   - `disputed` if conflict exists
6. Create alerts/tasks.

### Failure Cases

| Failure | User Message | System Behavior |
|---|---|---|
| App screenshot unreadable | "Screenshot saved, but I could not read it clearly." | Keep document. Ask manual entry. |
| App value conflicts with truck sheet | "App and truck sheet do not match." | Mark disputed. Do not choose winner automatically. |
| App truck number differs | "Truck number differs between sources." | Mark truck number disputed. Ask user to verify. |
| App details missing | "App details are missing for this government lot." | Create task. Keep lot incomplete. |
| Owner does not want to check app | "Saved. I will keep this in pending app details." | Do not block normal workflow. |
| Multiple lots match same truck | "I found multiple possible lots. Choose one." | Do not auto-link. |
| User resolves dispute without reason | "Add a reason for resolving this mismatch." | Require reason for audit trail. |

## 9. Add Missing Field From Task Flow

### Goal

Turn incomplete entries into complete/reconciled records over time.

### User Flow

1. User opens Pending tasks.
2. User taps a task:
   - Add moisture
   - Add weighbridge slip
   - Add actual bag count
   - Add app details
   - Add missing bill
3. System opens the smallest possible input screen.
4. User enters value or uploads document.
5. System updates the linked entry.
6. System reruns missing/mismatch checks.

### System Flow

1. Load task and linked object.
2. Accept value/document.
3. Save field with source and status.
4. Create audit log.
5. If AI-extracted from new document, require confirmation unless low-risk metadata only.
6. Recalculate object status and data quality.
7. Resolve task if field is complete.
8. Create new alert if value conflicts.

### Failure Cases

| Failure | User Message | System Behavior |
|---|---|---|
| Added value conflicts | "This value conflicts with existing data." | Mark disputed. Keep task open or convert to dispute task. |
| Task object was exported | "This period was exported. I will create an adjustment." | Create adjustment workflow. |
| User enters partial value | "Saved, but this task is still incomplete." | Keep task open. |
| User marks not available | "Marked unavailable." | Store reason. Data quality remains affected. |

## 10. Milling Batch Flow

### Goal

Track paddy input and rice/bran/broken rice output with deterministic recovery calculation.

### User Flow

1. User opens Paddy/Stock or Milling.
2. User taps Start milling batch.
3. User selects paddy lot(s) or enters input quantity.
4. User saves batch start.
5. Later, user records outputs:
   - rice output
   - bran output
   - broken rice output
   - shortage/wastage
6. System shows recovery percentage.
7. User confirms.

### System Flow

1. Create `milling_batch` draft or confirmed start event.
2. Link input paddy lots.
3. Validate input quantity does not exceed available confirmed stock unless explicitly marked disputed/adjustment.
4. On output confirmation:
   - create `milling_output_recorded` business event
   - create stock events:
     - paddy out
     - rice in
     - bran in
     - broken rice in
   - calculate recovery
   - flag abnormal recovery if outside configured threshold
   - update data quality

### Success State

- Paddy stock decreases.
- Rice/bran/broken rice stock increases.
- Recovery is calculated by deterministic logic.
- Missing outputs are visible.

### Failure Cases

| Failure | User Message | System Behavior |
|---|---|---|
| User starts batch but output missing | "Batch saved. Output is pending." | Create task: milling output missing. Recovery unavailable. |
| Input exceeds confirmed stock | "Input is more than confirmed available stock." | Block or require owner adjustment/dispute path. |
| Selected lot is disputed | "This lot has disputed quantity. Continue with pending stock?" | Require explicit owner confirmation. |
| Output totals impossible | "Output is higher than input. Check values." | Block confirmation unless marked as correction with reason. |
| Recovery abnormal | "Recovery looks low/high compared with normal range." | Create alert. Let owner add reason. |
| Output entered twice | "Output already recorded for this batch." | Prevent duplicate stock events. Offer adjustment. |
| Batch includes government and custom paddy | "These stock types should not be mixed casually." | Require separate batches or explicit owner approval with audit. |

## 11. By-product Sale Flow

### Goal

Record sale of bran, broken rice, or husk, update stock, track payment, and flag suspicious low rates.

### User Flow

1. User taps Speak, Upload photo, or By-product sale.
2. User provides:
   - dealer
   - product type
   - quantity
   - rate
   - payment status
   - bill/photo if available
3. System shows confirmation.
4. User confirms/corrects.
5. System shows total and any low-rate alert.
6. If low-rate alert appears, user chooses reason:
   - low quality
   - wet bran
   - urgent sale
   - trusted dealer
   - mistake
   - other

### System Flow

1. Save source input/document if present.
2. Extract sale fields if AI input.
3. Create sale draft.
4. On confirmation:
   - create `byproduct_sale_confirmed`
   - calculate total = quantity * rate
   - create stock event for product sold
   - create financial event/receivable if payment pending
   - compare rate with historical confirmed sale rates
   - create alert if below threshold
   - save accepted reason if user marks intentional
   - link bill/photo

### Success State

- By-product stock decreases.
- Sale total is deterministic.
- Low sale rate is visible with evidence.
- Payment pending is tracked.

### Failure Cases

| Failure | User Message | System Behavior |
|---|---|---|
| Product type missing | "What was sold: bran, broken rice, or husk?" | Block confirmation until product type is selected. |
| Quantity missing | "Quantity is missing. Save as incomplete?" | Allow incomplete draft. Do not update stock. |
| Rate missing | "Rate is missing. Save as incomplete?" | Allow incomplete draft. Do not calculate sale total. |
| Sale quantity exceeds confirmed stock | "Sale quantity is more than confirmed stock." | Block or create disputed/adjustment path. |
| Low rate detected | "This rate looks low compared with recent sales." | Create alert and ask reason. |
| Owner marks low rate intentional | "Reason saved." | Resolve/suppress this alert. Save correction memory/rule context. |
| Dealer name ambiguous | "Which dealer is this?" | Ask user to choose or create party. |
| Bill missing | "Bill photo missing." | Save sale with missing bill task if core values confirmed. |
| Duplicate sale bill | "This bill may already be saved." | Ask link/create new. Prevent duplicate stock event without confirmation. |
| Payment status unclear | "Payment status missing." | Save receivable/payment task. |

## 12. Expense Flow

### Goal

Capture labour, transport, electricity, and maintenance costs for monthly tracking and CA export.

### User Flow

1. User taps Speak, Upload photo, or Expense.
2. User provides:
   - category
   - amount
   - date
   - bill/photo if available
   - notes
   - linked batch/month if available
3. System shows confirmation.
4. User confirms or saves incomplete.

### System Flow

1. Store source document/audio/manual input.
2. Extract fields if needed.
3. Create expense draft.
4. On confirmation:
   - create `expense_confirmed` business event
   - create financial event
   - include in monthly expense totals
   - create missing bill task if no document
   - link to batch/month if provided

### Failure Cases

| Failure | User Message | System Behavior |
|---|---|---|
| Amount missing | "Amount is missing." | Save incomplete. Do not include in totals. |
| Category missing | "Choose expense type." | Require category before confirmation. |
| Bill missing | "Expense saved. Bill photo is pending." | Create missing bill task. |
| Duplicate bill | "This bill may already exist." | Ask link/create new. |
| Expense in locked period | "This month was exported. I will create an adjustment." | Adjustment event. |
| Unusual cost spike | "This expense is higher than normal." | Create alert if above threshold. |

## 13. Document Vault Flow

### Goal

Store original documents, classify them, link them to business objects, and make them searchable.

### User Flow

1. User opens Documents.
2. User uploads/takes photo.
3. System saves the original.
4. System classifies document type.
5. User confirms or corrects document type.
6. User links document to an existing entry or creates a draft from it.

### System Flow

1. Store file.
2. Create document record.
3. Classify type:
   - truck sheet
   - weighbridge slip
   - moisture/quality note
   - government/app screenshot
   - delivery challan
   - sale bill
   - by-product sale bill
   - transport bill
   - labour note
   - electricity bill
   - maintenance bill
   - license/compliance document
   - CA/accounting document
   - unknown document
4. Extract fields according to document type.
5. Save metadata and extracted fields.
6. Link to business object when confirmed.

### Failure Cases

| Failure | User Message | System Behavior |
|---|---|---|
| Unknown document | "I saved this as unknown. Choose type if needed." | Keep document searchable by upload date/notes. |
| Classification wrong | "Document type updated." | Save correction memory. |
| Extraction impossible | "Saved, but details could not be read." | Allow manual tagging/linking. |
| User deletes document request | "Business documents are archived, not permanently deleted." | Soft archive only if allowed. |
| Document linked to wrong entry | "Link changed and logged." | Audit unlink/link. Do not delete document. |
| Same file uploaded twice | "This document may already exist." | Offer existing document. |

## 14. Ask/Search Flow

### Goal

Answer owner questions using confirmed data, calculations, documents, and missing-data warnings.

### Supported MVP Questions

- What came today?
- Which entries are incomplete?
- Which truck sheets are missing?
- Which app/government details are missing?
- Which lot has mismatch?
- How much confirmed stock exists?
- What by-products were sold?
- Which sale rate looks low?
- What expenses were recorded this month?
- What data can be sent to CA?

### User Flow

1. User taps Ask.
2. User types or speaks a question.
3. System shows answer.
4. User can open evidence:
   - entries
   - documents
   - calculations
   - missing fields
   - audit trail

### System Flow

1. Capture question.
2. Detect intent.
3. Resolve date/entity references.
4. Query confirmed events and deterministic calculation functions first.
5. Query pending/disputed/incomplete records separately.
6. Build evidence bundle.
7. Generate owner-facing answer.
8. Attach confidence:
   - high: confirmed data with evidence and no major missing fields
   - medium: some pending/missing data
   - low: many missing/disputed fields
9. Log assistant query and sources.

### Answer Rules

The answer must separate:

- confirmed
- pending
- disputed
- estimated

Example:

```text
Confirmed paddy stock: 3,240 qtl.
Pending paddy stock: 280 qtl.
Disputed paddy stock: 64 qtl.
Possible total: 3,584 qtl.

Confidence: Medium.
Reason: 3 lots are missing app details and 1 lot has bag count mismatch.
```

### Failure Cases

| Failure | User Message | System Behavior |
|---|---|---|
| Intent unclear | "Do you mean stock, sales, expenses, or documents?" | Ask one clarifying question. |
| No evidence found | "I do not have evidence for that yet." | Offer related pending tasks/documents. |
| Data incomplete | Answer with missing-data warning | Do not fake final number. |
| Data disputed | Show disputed entries separately | Do not choose winner. |
| Calculation unavailable | "I could not calculate this because required data is missing." | List missing fields/tasks. |
| User asks for profit | Provide confirmed/estimated only if calculators exist | Do not invent reasons. |
| User asks government confirmation | "I can show evidence, but I cannot finalize government action automatically." | Keep human-in-loop. |
| Retrieval finds draft only | Label it pending/draft | Do not present as confirmed. |

## 15. Alerts Flow

### Goal

Surface actionable operational risks without nagging the owner all day.

### User Flow

1. User sees alert count on Home.
2. User opens Alerts.
3. User sees actionable alert text.
4. User chooses:
   - fix now
   - remind later
   - mark intentional/acceptable
   - mark disputed
   - resolve

### System Flow

1. Alert rules run after relevant events and scheduled reconciliation.
2. Each alert has:
   - type
   - severity
   - linked object
   - evidence
   - recommended action
   - status
3. User action updates alert status.
4. Alert resolution creates audit log.
5. If resolution teaches the system, save correction memory or rule context.

### Failure Cases

| Failure | User Message | System Behavior |
|---|---|---|
| Alert is vague | Not allowed | Alert must name object, issue, and action. |
| Alert repeats after resolved | "This issue appeared again." | Create new alert only if underlying data changed. |
| User snoozes urgent alert | "Reminder set." | Respect snooze but keep in pending list. |
| User marks alert intentional | "Reason saved." | Keep evidence and reduce duplicate future alerts where appropriate. |
| Alert created from wrong data | "Correction saved." | Fix source data through adjustment/correction flow. |

## 16. CA Export Flow

### Goal

Prepare clean monthly/yearly data and documents for the CA with completeness warnings and export snapshots.

### User Flow

1. User opens CA Export.
2. User selects month/year.
3. System shows data quality before export:
   - complete areas
   - missing items
   - disputed items
   - confidence
4. User fixes issues or proceeds with warnings.
5. User taps Generate export.
6. System creates Excel/PDF/document bundle.
7. User downloads/shares export.

### System Flow

1. Query confirmed ledgers for period.
2. Query pending/disputed/incomplete records for period.
3. Calculate:
   - income summary
   - by-product sales
   - expense summary
   - stock opening/closing
   - receivables/payments if tracked
   - document coverage
4. Generate preview.
5. On export:
   - create export snapshot
   - generate Excel/PDF files
   - link documents or document bundle
   - mark included records `exported`
   - lock/version records as configured
   - log audit event

### Success State

- CA receives deterministic summaries.
- Missing/disputed data is visible.
- Export can be reproduced from snapshot.
- Later edits create adjustment events.

### Failure Cases

| Failure | User Message | System Behavior |
|---|---|---|
| Missing required data | "Export can be created, but confidence is medium/low." | Show missing items. Let owner decide if allowed. |
| Disputed entries exist | "Some entries are disputed." | Include separately or block based on export policy. |
| PDF/Excel generation fails | "Export failed. Data is safe. Try again." | Snapshot/job marked failed. Retry allowed. |
| User edits exported record | "This was exported. I will create an adjustment." | Adjustment event. New export version if needed. |
| Document bundle incomplete | "Some document files are missing." | Show missing list and create tasks. |
| Export duplicate requested | "Export already exists for this period. Create new version?" | Versioned snapshot. Do not overwrite silently. |

## 17. Correction Memory Flow

### Goal

Remember owner corrections and reuse them in future extraction and suggestions.

### User Flow

1. User sees an AI-extracted value.
2. User edits it.
3. System asks for reason only when useful:
   - wrong OCR
   - wrong party
   - wrong document type
   - accepted exception
4. User saves.

### System Flow

1. Detect field changed from AI value.
2. Save correction memory:
   - original AI value
   - corrected value
   - field name
   - document type
   - document ID
   - user ID
   - mill ID
   - timestamp
   - confidence before correction
   - reason if provided
3. Use correction memory in future:
   - extraction context
   - party/center alias suggestions
   - accepted low-rate reason handling

### Failure Cases

| Failure | User Message | System Behavior |
|---|---|---|
| Same alias maps to two parties | "This name matches more than one party." | Ask user to choose. Do not auto-map. |
| Correction entered accidentally | "Correction reverted." | Create audit log. Do not delete previous correction; mark superseded. |
| Correction conflicts with locked record | "This record is locked. Creating adjustment." | Adjustment event. |
| AI keeps repeating corrected mistake | No silent failure | Track correction recurrence and expose in admin/debug view. |

## 18. Adjustment and Cancellation Flow

### Goal

Recover from mistakes without deleting business history.

### User Flow

1. User opens entry.
2. User taps Edit/Adjust or Cancel.
3. System explains:
   - if unlocked: normal correction may be allowed
   - if exported/locked: adjustment event is required
4. User enters corrected values and reason.
5. System shows impact on stock/report.
6. User confirms.

### System Flow

1. Load entry status.
2. If locked/exported, block direct mutation.
3. Create adjustment/cancellation business event.
4. Emit reversing or delta stock/financial events.
5. Recalculate affected summaries.
6. Create audit log.
7. Mark related exports as needing updated version if applicable.

### Failure Cases

| Failure | User Message | System Behavior |
|---|---|---|
| User tries hard delete | "Business records are cancelled, not deleted." | Offer cancellation flow. |
| Adjustment creates negative stock | "This correction would make stock negative." | Block or require owner override with dispute reason. |
| Reason missing for locked adjustment | "Reason is required." | Block until reason provided. |
| Adjustment affects CA export | "This changes exported data." | Mark export impacted and suggest new version. |

## 19. Compliance Reminder Flow

### Goal

Track operational and compliance reminders without spamming.

### User Flow

1. User opens Pending tasks or Alerts.
2. User sees compliance/reminder items:
   - license renewal
   - pollution board document
   - FSSAI/license document if applicable
   - challan due date
   - CA report deadline
   - pending document
3. User uploads document, marks done, or reminds later.

### System Flow

1. Store reminder rules and due dates.
2. Create reminder tasks before deadline.
3. Escalate to alert when urgent.
4. Resolve when document/action is confirmed.

### Failure Cases

| Failure | User Message | System Behavior |
|---|---|---|
| Due date missing | "Due date is missing." | Save reminder incomplete. |
| User snoozes near deadline | "Reminder set, but this is due soon." | Keep urgency visible. |
| Uploaded wrong document | "Document type does not match reminder." | Ask confirm/link anyway or upload correct file. |
| Reminder not applicable | "Marked not applicable." | Store reason. |

## 20. End-to-End MVP Acceptance Flows

The MVP must pass these concrete flows before pilot use.

### Flow A - Truck Sheet to Confirmed Stock

1. Upload truck sheet.
2. AI extracts fields.
3. User corrects one field.
4. Correction memory is saved.
5. User confirms paddy inward.
6. Paddy lot is created.
7. Confirmed stock increases.
8. Missing moisture task is created.
9. Ask "What came today?" shows the entry with source document.

### Flow B - Incomplete Voice Entry

1. Owner says partial truck entry.
2. System saves incomplete draft/entry.
3. Missing truck number and moisture tasks are created.
4. Stock is not falsely finalized from approximate data.
5. Ask "Which entries are incomplete?" shows it.

### Flow C - Government App Missing

1. Government paddy truck sheet is confirmed.
2. App details are not added.
3. Lot remains incomplete for app reconciliation.
4. Pending task says app details missing.
5. Ask "Which app details are missing?" shows this lot.

### Flow D - Mismatch

1. Truck sheet says 480 bags.
2. Physical count says 462 bags.
3. System marks lot disputed.
4. Confirmed/pending/disputed stock separates the disputed quantity.
5. Ask "Which lot has mismatch?" shows evidence from both sources.

### Flow E - Low Bran Sale Rate

1. User records bran sale at low rate.
2. System compares against historical confirmed rate.
3. Alert shows rate difference and possible impact.
4. Owner marks reason as wet bran.
5. Reason is stored for future learning.

### Flow F - CA Export With Missing Data

1. User opens CA Export for month.
2. System shows complete, missing, and disputed sections.
3. User exports with medium confidence.
4. Snapshot is created.
5. Exported records are marked.
6. Later correction creates adjustment, not silent edit.

## 21. Workflow Anti-Patterns

Do not implement these:

- AI extraction writes directly to stock.
- The app rejects partial entries that are operationally useful.
- One "final stock" number hides pending or disputed quantities.
- Missing government/app data blocks all work.
- Low-rate alert appears without rate comparison evidence.
- Ask/Search answers from unconfirmed draft data as if it is true.
- Export silently ignores missing bills or disputed entries.
- Confirmed records are hard-deleted.
- Corrections overwrite history without audit logs.
- Alerts say only "data missing" without object and action.

## 22. Open Workflow Questions

These should be answered during field discovery:

1. Which paddy inward fields are mandatory before stock can increase?
2. What tolerance is acceptable between truck sheet, physical count, and weighbridge?
3. Who is allowed to confirm paddy inward: owner only or manager too?
4. What is the normal recovery range for this mill?
5. How many days should low-rate comparison use: 7, 30, or season-to-date?
6. Which missing tasks deserve alerts versus quiet pending tasks?
7. Should CA export block disputed records or include them separately?
8. What exact categories does the CA need for expenses?
9. Which compliance reminders apply to this mill?
10. When should records become locked?
