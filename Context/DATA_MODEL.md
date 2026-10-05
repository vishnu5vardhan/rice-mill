# Rice Mill Intelligence System - Data Model

## 1. Data Model Purpose

This document defines the core entities, statuses, relationships, and source-of-truth rules for the MVP.

The data model must support imperfect real-world rice mill data:

- voice entries
- photo/document uploads
- AI-extracted fields
- user-confirmed fields
- missing fields
- disputed values
- deterministic stock and financial calculations
- correction memory
- audit trails
- evidence-backed answers
- CA exports

Primary rule:

> AI data is draft evidence. Confirmed business events and deterministic ledger events are truth.

## 2. Source-of-Truth Hierarchy

When data conflicts, use this hierarchy.

1. Confirmed business events
2. Confirmed field values
3. Deterministic stock/financial/calculation events
4. Source documents linked to confirmed events
5. Audit logs
6. User correction memory
7. AI-extracted fields
8. Raw OCR/transcript/model output

Important:

- AI extraction can suggest values.
- User confirmation promotes values to business truth.
- Deterministic ledger functions create stock/financial truth.
- Documents provide evidence, but a document alone is not confirmed business truth.
- Raw model output must never be used directly in stock, profit, or CA export calculations.

## 3. Ownership Boundaries

| Data Area | Owns | Cannot Own |
|---|---|---|
| Capture | raw uploads, audio, transcripts, document storage references | confirmed stock, final events |
| Extraction | AI classification, extracted fields, confidence, missing fields | truth, ledger writes |
| Confirmation | field review, user corrections, promotion to confirmed event | deterministic calculations |
| Ledger | business events, stock events, financial events, adjustments | raw AI output |
| Intelligence | alerts, tasks, data quality, evidence bundles | silent edits to truth |
| Export | snapshots, export files, exported/locked state | unconfirmed business data as final truth |

## 4. Global Entity Rules

Every important business table should include:

- `id`
- `mill_id`
- `status`
- `created_at`
- `created_by`
- `updated_at`
- `updated_by`

Every important field value should be traceable to:

- source type
- source ID
- status
- confidence if AI-derived
- confirmation user
- confirmation timestamp
- linked document if available
- audit log

Every mutation of important business data should create an audit log.

Important business rows should not be hard-deleted. Use cancellation, archive, reversal, or adjustment events.

## 5. Core Status Enums

### 5.1 Field Status

Use for individual important fields.

| Status | Meaning | Can Drive Ledger? |
|---|---|---:|
| `missing` | Field is required or useful but absent | No |
| `draft` | Entered but not confirmed | No |
| `ai_extracted` | Extracted from document/audio by AI | No |
| `needs_review` | Low confidence or ambiguous | No |
| `user_confirmed` | Confirmed by human | Yes, if required fields complete |
| `system_calculated` | Calculated by deterministic logic | Yes |
| `estimated` | Approximate or incomplete calculation | No for final truth |
| `disputed` | Conflicting sources exist | No until resolved |
| `locked` | Field included in locked/exported state | Yes as historical truth |
| `adjusted` | Field corrected through adjustment event | Yes via adjustment |

### 5.2 Record Status

Use for entries, lots, batches, sales, expenses, reports.

| Status | Meaning |
|---|---|
| `draft` | Created but not reviewed |
| `incomplete` | Useful record exists but required data is missing |
| `pending_confirmation` | Waiting for human confirmation |
| `confirmed` | Human accepted required business fields |
| `reconciled` | Required source comparisons match |
| `disputed` | One or more conflicts exist |
| `estimated` | Summary includes incomplete data |
| `locked` | Cannot be directly edited |
| `exported` | Included in CA/report export |
| `cancelled` | Cancelled without hard deletion |
| `adjusted` | Corrected using adjustment event |

### 5.3 Job Status

Use for extraction, export, calculation, and background jobs.

| Status | Meaning |
|---|---|
| `queued` | Waiting to run |
| `running` | In progress |
| `succeeded` | Completed successfully |
| `failed` | Failed and visible for retry/review |
| `retrying` | Waiting for retry |
| `cancelled` | Stopped intentionally |

### 5.4 Alert Status

| Status | Meaning |
|---|---|
| `open` | Needs action |
| `snoozed` | Deferred by user |
| `resolved` | Fixed or accepted |
| `dismissed` | Not relevant |
| `converted_to_task` | Tracked as a task |

### 5.5 Task Status

| Status | Meaning |
|---|---|
| `open` | Needs work |
| `in_progress` | User started resolving |
| `completed` | Finished |
| `snoozed` | Deferred |
| `not_applicable` | User marked not needed with reason |
| `blocked` | Cannot be resolved without external information |

## 6. Source Types

Use a consistent `source_type` enum for field provenance.

| Source Type | Meaning |
|---|---|
| `voice` | Owner/operator voice input |
| `manual` | Typed/manual entry |
| `document` | Uploaded document or photo |
| `truck_sheet` | Truck sheet document |
| `weighbridge_slip` | Weighbridge document |
| `moisture_note` | Moisture/quality note |
| `government_app` | OPMS/PPS/Civil Supplies app data or screenshot |
| `physical_count` | Actual bag count by person |
| `sale_bill` | Sale bill document |
| `expense_bill` | Expense bill document |
| `system_calculation` | Deterministic calculation function |
| `adjustment_event` | Later correction event |
| `import` | Imported structured data if added later |

## 7. Product and Stock Types

Separate stock and source categories explicitly.

### Paddy Source Type

- `government`
- `private`
- `farmer_custom`
- `own_purchase`
- `unknown`

### Stock Product Type

- `paddy`
- `rice`
- `bran`
- `broken_rice`
- `husk`

Do not casually mix government paddy, farmer/custom paddy, private paddy, rice, bran, broken rice, and expenses. Every stock event must carry product type and relevant source category.

## 8. Entity Groups

The MVP data model is grouped into:

1. Identity and ownership
2. Parties and aliases
3. Documents and extraction
4. Drafts and confirmation
5. Operations
6. Ledger and calculations
7. Intelligence
8. Export
9. Audit and reliability

## 9. Identity and Ownership Entities

### 9.1 `mills`

Business unit being managed.

Key fields:

- `id`
- `name`
- `location`
- `status`
- `created_at`

Relationships:

- has many `mill_members`
- has many operational records
- scopes all business data

Source of truth:

- user/admin setup

Rules:

- every business row must be scoped to `mill_id`
- retrieval must never cross `mill_id`

### 9.2 `profiles`

Application user profile linked to auth user.

Key fields:

- `id`
- `auth_user_id`
- `display_name`
- `phone`
- `preferred_language`
- `status`

Source of truth:

- Supabase Auth plus profile record

### 9.3 `mill_members`

User membership and role inside a mill.

Key fields:

- `id`
- `mill_id`
- `profile_id`
- `role`
- `status`

Roles:

- `owner`
- `manager`
- `operator`
- `accountant_ca`
- `family_helper`
- `readonly`
- `admin`

Rules:

- owner can confirm, adjust, export, and manage users
- manager/operator permissions should be configurable
- accountant/CA should primarily consume reports and exports

## 10. Party and Reference Entities

### 10.1 `parties`

People and organizations the mill interacts with.

Party types:

- `source_center`
- `farmer`
- `dealer`
- `vendor`
- `transporter`
- `worker_group`
- `ca`
- `government_office`
- `other`

Key fields:

- `id`
- `mill_id`
- `party_type`
- `name`
- `normalized_name`
- `phone`
- `address`
- `status`

Source of truth:

- human-confirmed party table

Other sources:

- AI extraction
- voice input
- documents
- correction memory

Rules:

- AI can suggest party creation or mapping
- human must confirm new party identity
- ambiguous party names must remain unresolved until user chooses

### 10.2 `party_aliases`

Alternate names/spellings from documents, voice, or corrections.

Key fields:

- `id`
- `mill_id`
- `party_id`
- `alias`
- `source_type`
- `source_id`
- `confidence`
- `status`

Rules:

- one alias should not silently map to multiple parties
- alias conflicts require user selection

### 10.3 `expense_categories`

Allowed expense categories.

Initial values:

- `labour`
- `transport`
- `electricity`
- `maintenance`

Rules:

- category is required before expense can be confirmed

### 10.4 `product_types`

Reference for stock/product categories.

Initial values:

- `paddy`
- `rice`
- `bran`
- `broken_rice`
- `husk`

Rules:

- every stock event must specify product type

## 11. Documents and Extraction Entities

### 11.1 `documents`

Original uploaded file and document metadata.

Document types:

- `truck_sheet`
- `weighbridge_slip`
- `moisture_quality_note`
- `government_app_screenshot`
- `delivery_challan`
- `sale_bill`
- `byproduct_sale_bill`
- `transport_bill`
- `labour_note`
- `electricity_bill`
- `maintenance_bill`
- `license_compliance_document`
- `ca_accounting_document`
- `unknown`

Key fields:

- `id`
- `mill_id`
- `uploaded_by`
- `storage_bucket`
- `storage_path`
- `original_filename`
- `mime_type`
- `file_size`
- `checksum`
- `document_type`
- `classification_status`
- `extraction_status`
- `status`
- `uploaded_at`

Source of truth:

- original file in storage plus document row

Rules:

- originals are never overwritten
- classification can be AI-suggested
- user correction of document type must be stored in correction memory
- a document can link to multiple business objects if valid

### 11.2 `document_links`

Links documents to business entities.

Key fields:

- `id`
- `mill_id`
- `document_id`
- `linked_entity_type`
- `linked_entity_id`
- `link_type`
- `created_by`
- `created_at`

Link types:

- `evidence`
- `source`
- `supporting`
- `export_attachment`
- `correction_reference`

Rules:

- unlinking must be audited
- linked documents support evidence but do not automatically confirm values

### 11.3 `extraction_runs`

One AI/OCR/voice processing attempt.

Key fields:

- `id`
- `mill_id`
- `document_id`
- `input_capture_id`
- `run_type`
- `model`
- `schema_name`
- `schema_version`
- `status`
- `raw_output`
- `validated_output`
- `error`
- `started_at`
- `finished_at`

Run types:

- `document_classification`
- `ocr_vision_extraction`
- `voice_transcription`
- `voice_structuring`
- `question_intent`

Rules:

- failed runs are retained
- raw output is for debugging, not business truth

### 11.4 `extracted_fields`

Field-level AI/OCR/voice results.

Key fields:

- `id`
- `mill_id`
- `extraction_run_id`
- `document_id`
- `input_capture_id`
- `field_name`
- `raw_value`
- `normalized_value`
- `confidence`
- `status`
- `source_type`
- `source_id`
- `needs_review`

Rules:

- extracted fields start as `ai_extracted` or `needs_review`
- extracted fields cannot drive ledger updates
- user confirmation creates confirmed field values or business event fields

### 11.5 `input_captures`

Raw non-document user input.

Capture types:

- `voice`
- `manual_note`
- `quick_form`
- `ask_question`

Key fields:

- `id`
- `mill_id`
- `created_by`
- `capture_type`
- `raw_text`
- `transcript`
- `audio_storage_path`
- `status`
- `created_at`

Rules:

- voice audio/transcript is evidence for a draft
- transcript is not confirmed truth

## 12. Draft and Confirmation Entities

### 12.1 `draft_entries`

Temporary structured entry before confirmation.

Draft types:

- `paddy_inward`
- `milling_batch`
- `byproduct_sale`
- `expense`
- `payment`
- `document_only`

Key fields:

- `id`
- `mill_id`
- `draft_type`
- `source_type`
- `source_id`
- `status`
- `created_by`
- `created_at`
- `last_reviewed_by`
- `last_reviewed_at`

Rules:

- drafts can be incomplete
- drafts do not update stock or financial truth
- stale drafts should appear in pending work

### 12.2 `draft_entry_fields`

Field values inside a draft.

Key fields:

- `id`
- `mill_id`
- `draft_entry_id`
- `field_name`
- `value`
- `source_type`
- `source_id`
- `confidence`
- `status`
- `required`

Rules:

- field status must distinguish AI, manual, confirmed, missing, and disputed
- low-confidence fields require review

### 12.3 `confirmed_field_values`

Optional normalized table for field-level truth and provenance.

Key fields:

- `id`
- `mill_id`
- `entity_type`
- `entity_id`
- `field_name`
- `value`
- `source_type`
- `source_id`
- `status`
- `confidence`
- `confirmed_by`
- `confirmed_at`
- `document_id`
- `audit_log_id`

Rules:

- use for important fields that need source/status/confidence display
- do not rely only on final entity columns for provenance

### 12.4 `correction_memory`

Owner/user correction history for AI and system suggestions.

Correction types:

- `document_type`
- `field_value`
- `party_mapping`
- `alias_mapping`
- `truck_number`
- `bag_count`
- `rate_alert_reason`
- `accepted_exception`

Key fields:

- `id`
- `mill_id`
- `user_id`
- `document_id`
- `entity_type`
- `entity_id`
- `field_name`
- `original_ai_value`
- `corrected_value`
- `confidence_before`
- `reason`
- `status`
- `created_at`

Rules:

- correction memory informs future extraction and suggestions
- do not fine-tune in v1
- conflicting corrections must be surfaced, not silently merged

## 13. Operations Entities

### 13.1 `paddy_lots`

Trackable unit of paddy received by the mill.

Key fields:

- `id`
- `mill_id`
- `lot_code`
- `paddy_source_type`
- `source_party_id`
- `arrival_date`
- `status`
- `data_quality_score`
- `created_from_business_event_id`

Important field values:

- truck number
- truck sheet bag count
- physical bag count
- app/government quantity
- weighbridge net weight
- moisture
- confirmed quantity

Relationships:

- belongs to mill
- belongs to party/source center
- has many documents through `document_links`
- has many paddy inward events
- can feed many milling batch inputs
- has tasks/alerts

Source of truth:

- confirmed paddy inward business event plus confirmed field values

Rules:

- lot can be `incomplete`, `confirmed`, `disputed`, or `reconciled`
- government paddy lots must track app/government details separately
- confirmed stock uses confirmed quantity only

### 13.2 `paddy_inward_events`

Operational detail for paddy inward.

Key fields:

- `id`
- `mill_id`
- `paddy_lot_id`
- `business_event_id`
- `event_date`
- `source_party_id`
- `paddy_source_type`
- `quantity_value`
- `quantity_unit`
- `status`

Rules:

- creates stock event only when confirmed
- incomplete records can exist without stock event if quantity is not confirmed

### 13.3 `milling_batches`

Processing batch converting paddy to rice/by-products.

Key fields:

- `id`
- `mill_id`
- `batch_code`
- `started_at`
- `completed_at`
- `status`
- `data_quality_score`

Relationships:

- has many `milling_batch_inputs`
- has many `milling_batch_outputs`
- links to paddy lots
- creates stock events

Rules:

- missing output keeps batch incomplete
- recovery is system-calculated
- disputed input lots require explicit confirmation

### 13.4 `milling_batch_inputs`

Paddy lots and quantities used in a batch.

Key fields:

- `id`
- `mill_id`
- `milling_batch_id`
- `paddy_lot_id`
- `quantity_value`
- `quantity_unit`
- `status`

Rules:

- input quantity cannot exceed available confirmed stock without adjustment/dispute path
- source categories should not be mixed casually

### 13.5 `milling_batch_outputs`

Rice and by-product output from milling.

Key fields:

- `id`
- `mill_id`
- `milling_batch_id`
- `product_type`
- `quantity_value`
- `quantity_unit`
- `status`

Product types:

- `rice`
- `bran`
- `broken_rice`
- `husk`
- `shortage_wastage`

Rules:

- confirmed outputs create stock events
- recovery is calculated from confirmed input/output

### 13.6 `byproduct_sales`

Sale of bran, broken rice, or husk.

Key fields:

- `id`
- `mill_id`
- `business_event_id`
- `dealer_party_id`
- `product_type`
- `quantity_value`
- `quantity_unit`
- `rate`
- `total_amount`
- `payment_status`
- `sale_date`
- `status`

Payment statuses:

- `unpaid`
- `partial`
- `paid`
- `unknown`

Rules:

- total amount is system-calculated from confirmed quantity and rate
- sale creates stock-out event only when confirmed
- low-rate detection compares against confirmed historical sales

### 13.7 `expenses`

Confirmed expense record.

Key fields:

- `id`
- `mill_id`
- `business_event_id`
- `category`
- `amount`
- `expense_date`
- `vendor_party_id`
- `linked_batch_id`
- `notes`
- `status`

Rules:

- amount and category are required for confirmed expense
- missing bill creates task but does not necessarily block expense confirmation
- locked/exported expenses require adjustment event

### 13.8 `payments`

Payment or receivable event.

Key fields:

- `id`
- `mill_id`
- `business_event_id`
- `party_id`
- `related_entity_type`
- `related_entity_id`
- `amount`
- `payment_direction`
- `payment_method`
- `payment_date`
- `status`

Payment directions:

- `incoming`
- `outgoing`

Rules:

- payment affects receivable/payable summaries
- do not treat unclear payment status as paid

## 14. Ledger and Calculation Entities

### 14.1 `business_events`

Canonical event log for confirmed operational actions.

Event types:

- `paddy_inward_confirmed`
- `paddy_inward_adjusted`
- `milling_batch_started`
- `milling_output_recorded`
- `byproduct_sale_confirmed`
- `expense_confirmed`
- `payment_recorded`
- `entry_cancelled`
- `export_snapshot_created`

Key fields:

- `id`
- `mill_id`
- `event_type`
- `entity_type`
- `entity_id`
- `event_date`
- `status`
- `created_by`
- `created_at`
- `idempotency_key`

Source of truth:

- confirmed user action or deterministic system action

Rules:

- append-only for important business actions
- cancellation/adjustment is another event
- all stock and financial events should reference a business event

### 14.2 `stock_events`

Deterministic stock movement ledger.

Event types:

- `paddy_in`
- `paddy_milled_out`
- `rice_in`
- `bran_in`
- `broken_rice_in`
- `husk_in`
- `byproduct_sold_out`
- `stock_adjustment`

Key fields:

- `id`
- `mill_id`
- `business_event_id`
- `product_type`
- `paddy_source_type`
- `quantity_delta`
- `quantity_unit`
- `event_date`
- `status`
- `calculation_run_id`
- `idempotency_key`

Source of truth:

- deterministic ledger function from confirmed business event

Rules:

- stock summaries are calculated from stock events
- AI output never creates stock events directly
- negative stock should create alert or block depending on operation

### 14.3 `financial_events`

Deterministic income/expense/payment ledger.

Event types:

- `sale_income`
- `expense_cost`
- `payment_in`
- `payment_out`
- `receivable_created`
- `receivable_settled`
- `financial_adjustment`

Key fields:

- `id`
- `mill_id`
- `business_event_id`
- `party_id`
- `amount_delta`
- `event_date`
- `status`
- `calculation_run_id`
- `idempotency_key`

Rules:

- financial summaries use confirmed financial events
- do not generate profit from LLM reasoning

### 14.4 `calculation_runs`

Records deterministic calculations.

Calculation types:

- `stock_summary`
- `paddy_inward_total`
- `milling_recovery`
- `byproduct_sale_total`
- `historical_rate_average`
- `low_rate_impact`
- `monthly_expense_total`
- `ca_export_summary`
- `data_quality_score`

Key fields:

- `id`
- `mill_id`
- `calculation_type`
- `function_name`
- `function_version`
- `input_entity_ids`
- `input_filters`
- `output`
- `confidence`
- `status`
- `created_at`

Rules:

- calculation outputs should be reproducible
- incomplete inputs produce estimated/medium/low confidence outputs, not fake final numbers

## 15. Intelligence Entities

### 15.1 `tasks`

Missing data and follow-up work.

Task types:

- `missing_truck_sheet`
- `missing_actual_bag_count`
- `missing_moisture`
- `missing_weighbridge_slip`
- `missing_government_app_details`
- `missing_milling_output`
- `missing_expense_bill`
- `missing_sale_bill`
- `ca_export_missing_data`
- `compliance_reminder`

Key fields:

- `id`
- `mill_id`
- `task_type`
- `linked_entity_type`
- `linked_entity_id`
- `title`
- `details`
- `priority`
- `due_at`
- `status`
- `created_by_system`

Rules:

- missing data creates tasks
- tasks should be specific and actionable

### 15.2 `alerts`

Actionable risk or anomaly.

Alert types:

- `truck_sheet_physical_count_mismatch`
- `government_app_truck_sheet_mismatch`
- `negative_stock`
- `abnormal_recovery`
- `low_byproduct_sale_rate`
- `unpaid_byproduct_sale`
- `ca_export_incomplete`
- `compliance_due`
- `cost_spike`

Key fields:

- `id`
- `mill_id`
- `alert_type`
- `linked_entity_type`
- `linked_entity_id`
- `severity`
- `title`
- `details`
- `evidence_bundle_id`
- `recommended_action`
- `status`

Rules:

- alerts must name object, issue, and action
- vague alerts like "data missing" are invalid
- alert resolution should be audited

### 15.3 `data_quality_scores`

Completeness and trust score for lot/month/export.

Scopes:

- `paddy_lot`
- `milling_batch`
- `month`
- `export_snapshot`

Key fields:

- `id`
- `mill_id`
- `scope_type`
- `scope_id`
- `score`
- `present_fields`
- `missing_fields`
- `disputed_fields`
- `calculation_run_id`
- `created_at`

Rules:

- score is a summary over visible missing/disputed details
- score must not hide missing data

### 15.4 `evidence_bundles`

Sources used for answer, alert, or export explanation.

Key fields:

- `id`
- `mill_id`
- `purpose`
- `linked_entity_type`
- `linked_entity_id`
- `business_event_ids`
- `document_ids`
- `calculation_run_ids`
- `audit_log_ids`
- `missing_fields`
- `disputed_fields`
- `confidence`
- `created_at`

Rules:

- every confident assistant answer should have evidence
- exports should be reproducible through snapshot/evidence

### 15.5 `assistant_queries`

Logged Ask/Search interaction.

Key fields:

- `id`
- `mill_id`
- `user_id`
- `question`
- `interpreted_intent`
- `filters`
- `answer`
- `confidence`
- `evidence_bundle_id`
- `created_at`

Rules:

- answers must be backed by database entries, documents, calculation functions, or audit trails
- draft-only answers must be labeled pending

## 16. Export Entities

### 16.1 `export_snapshots`

Versioned CA/month/year export.

Export types:

- `monthly_ca`
- `yearly_ca`
- `document_bundle`

Key fields:

- `id`
- `mill_id`
- `export_type`
- `period_start`
- `period_end`
- `status`
- `data_quality_score`
- `confidence`
- `created_by`
- `created_at`
- `version`

Rules:

- export snapshot is immutable after generation
- later edits create adjustment and new export version

### 16.2 `export_snapshot_items`

Rows/entities included in an export snapshot.

Key fields:

- `id`
- `mill_id`
- `export_snapshot_id`
- `entity_type`
- `entity_id`
- `included_status`
- `notes`

Rules:

- item list allows export reproduction
- disputed/incomplete records should be labeled separately

### 16.3 `export_files`

Generated Excel/PDF/document bundle files.

Key fields:

- `id`
- `mill_id`
- `export_snapshot_id`
- `file_type`
- `storage_path`
- `status`
- `created_at`

Rules:

- failed file generation should not corrupt snapshot
- retry should be idempotent

## 17. Audit and Reliability Entities

### 17.1 `audit_logs`

Append-only record of important changes.

Key fields:

- `id`
- `mill_id`
- `actor_user_id`
- `action`
- `entity_type`
- `entity_id`
- `before_value`
- `after_value`
- `source_type`
- `source_id`
- `idempotency_key`
- `created_at`

Rules:

- important business mutations require audit logs
- audit logs are append-only

### 17.2 `failed_jobs`

Visible queue of failed async work.

Job types:

- `document_extraction`
- `voice_transcription`
- `ledger_event_creation`
- `alert_generation`
- `calculation_run`
- `export_generation`

Key fields:

- `id`
- `mill_id`
- `job_type`
- `payload`
- `error`
- `retry_count`
- `status`
- `last_attempted_at`
- `created_at`

Rules:

- failed jobs must be visible to admin/support
- retries must be idempotent

## 18. Relationship Map

```text
mill
  -> mill_members
  -> parties
      -> party_aliases
  -> documents
      -> extraction_runs
      -> extracted_fields
      -> document_links
  -> input_captures
      -> extraction_runs
      -> draft_entries
  -> draft_entries
      -> draft_entry_fields
      -> correction_memory
  -> business_events
      -> stock_events
      -> financial_events
      -> audit_logs
  -> paddy_lots
      -> paddy_inward_events
      -> milling_batch_inputs
      -> tasks
      -> alerts
  -> milling_batches
      -> milling_batch_inputs
      -> milling_batch_outputs
  -> byproduct_sales
      -> payments
      -> alerts
  -> expenses
  -> calculation_runs
  -> data_quality_scores
  -> evidence_bundles
  -> assistant_queries
  -> export_snapshots
      -> export_snapshot_items
      -> export_files
```

## 19. Key Relationship Rules

### Document to Business Object

- A document can exist without a business object.
- A document can link to a draft.
- A document can link to a confirmed object.
- Linking a document does not automatically confirm extracted values.

### Draft to Business Event

- A draft may create zero or one initial confirmed business event.
- A draft can remain incomplete.
- A draft can be cancelled.
- Confirming a draft must save confirmed fields and audit logs.

### Business Event to Ledger Events

- Confirmed business event can create stock events and/or financial events.
- Ledger events must reference business event ID.
- Ledger event creation must be idempotent.

### Adjustment Rules

- Direct edit is allowed only for unlocked, unexported records and only with audit.
- Locked/exported records require adjustment events.
- Adjustments create delta/reversal ledger events.
- Original history remains visible.

### Evidence Rules

- Evidence bundle can reference business events, documents, calculations, audit logs, missing fields, and disputed fields.
- Assistant answers and alerts should reference evidence bundles.
- No evidence means no confident answer.

## 20. Source-of-Truth Rules by Entity

| Entity | Source of Truth | AI Role | Human Role | Calculation Role |
|---|---|---|---|---|
| Document | Stored original + document row | Classify/extract | Upload/correct/link | None |
| Extracted field | Extraction run | Create | Review/correct | None |
| Party | Confirmed party table | Suggest/alias | Confirm/merge | None |
| Paddy lot | Confirmed paddy inward event | Draft fields | Confirm/dispute/resolve | Stock from event |
| Stock balance | Stock events | None | Approve source events | Calculate balance |
| Milling recovery | Calculation run | Explain only | Confirm inputs/outputs | Calculate recovery |
| By-product sale | Confirmed sale event | Draft fields/low-rate explanation | Confirm sale/reason | Total/rate comparison |
| Expense | Confirmed expense event | Draft fields | Confirm/correct | Monthly totals |
| Payment | Confirmed payment event | Draft if captured | Confirm payment | Receivable/payable totals |
| Alert | Rule engine | Summarize/explain | Resolve/snooze | Trigger from rules |
| CA export | Export snapshot | Explain missing data | Generate/approve | Build summary |

## 21. Confirmed, Pending, Disputed, Estimated Separation

Every stock/profit/report answer should be able to produce separated numbers.

Example stock categories:

- confirmed stock: from confirmed stock events
- pending stock: from incomplete drafts/events with plausible quantity
- disputed stock: from conflicting values
- possible total: confirmed + pending + disputed where appropriate

Rules:

- do not show one fake final number when data is incomplete
- pending and disputed records should not silently affect confirmed balances
- estimated calculations must show missing inputs

## 22. Data Quality Inputs

Data quality should consider:

- required fields present
- required documents linked
- field statuses
- AI confidence
- missing task count
- disputed field count
- source reconciliation state
- export lock status

Data quality is not truth. It is a visibility tool.

## 23. Minimum Required Fields by Workflow

### Paddy Inward

Minimum to create incomplete memory:

- date or approximate date
- at least one identifying detail: center/party, truck number, document, or voice note

Minimum to create confirmed stock:

- source type
- source party/center or accepted unknown reason
- confirmed quantity
- quantity unit
- confirmation user

### Milling Batch

Minimum to start batch:

- date
- input quantity or linked paddy lot

Minimum to calculate recovery:

- confirmed input quantity
- confirmed rice output

### By-product Sale

Minimum to confirm sale:

- product type
- quantity
- rate
- dealer or accepted unknown reason
- sale date

### Expense

Minimum to confirm expense:

- category
- amount
- date

### CA Export

Minimum to generate export:

- selected period
- confirmed ledger data for period
- explicit confidence/completeness report

## 24. Validation Rules

### Numeric Values

- quantities must be positive unless adjustment/reversal
- rates must be non-negative
- totals should be system-calculated where possible
- output quantity should not exceed input without override/dispute reason

### Dates

- event date is required for confirmed business events
- upload date is not a substitute for event date unless user confirms

### Duplicates

Detect possible duplicates using:

- document checksum
- truck number + date + center
- bill number + dealer + amount
- same product + quantity + rate + date

Rules:

- warn on duplicate
- do not silently create duplicate stock/financial events

### Reconciliation

Comparable paddy fields:

- truck number
- source center
- bag count
- weight
- moisture
- government/app quantity
- physical count

Rules:

- matching fields can become reconciled
- missing fields keep record incomplete
- conflicting fields create disputed status

## 25. Permissions and RLS Rules

All business data is scoped by `mill_id`.

Minimum role behavior:

| Action | Owner | Manager/Operator | Accountant/CA | Read-only |
|---|---:|---:|---:|---:|
| Upload document | Yes | Yes | Yes | No |
| Create draft | Yes | Yes | Limited | No |
| Confirm entry | Yes | Configurable | No | No |
| Resolve dispute | Yes | Configurable | No | No |
| Adjust locked/exported record | Yes | No | No | No |
| View reports | Yes | Configurable | Yes | Yes |
| Generate export | Yes | No | Configurable | No |
| Manage users | Yes | No | No | No |

Rules:

- retrieval and assistant answers must respect the same permissions as direct database reads
- no shared retrieval index across mills
- CA/read-only users should not mutate operational truth

## 26. Idempotency Rules

These operations require idempotency keys:

- document upload processing
- extraction runs
- draft confirmation
- business event creation
- stock event creation
- financial event creation
- export generation
- adjustment/cancellation

Rules:

- retry must not duplicate stock, financial, or export records
- idempotency key should include mill, operation type, source entity, and action

## 27. Reporting and Query Rules

### Stock Query

Use:

- confirmed stock events for confirmed stock
- incomplete paddy lots/drafts for pending stock
- disputed lots/events for disputed stock

Do not use:

- raw extracted fields as confirmed stock
- mutable cached balance without ledger trace

### Expense Query

Use:

- confirmed expense business events
- financial events
- linked documents for evidence

### By-product Sale Query

Use:

- confirmed by-product sale events
- stock events
- financial events
- rate comparison calculation runs

### Assistant Query

Use:

1. structured database filters
2. deterministic calculations
3. evidence bundles
4. linked documents
5. draft/extracted fields only as pending evidence

## 28. Open Data Model Questions

These need field discovery before final schema is frozen:

1. Exact truck sheet fields and units.
2. Exact OPMS/PPS/government app screenshot fields.
3. Preferred lot naming scheme.
4. Whether one truck can split into multiple lots.
5. Moisture tolerance and effect on reconciliation.
6. Weight unit conventions: bags, qtl, kg.
7. Normal milling recovery thresholds for this mill.
8. By-product rate comparison window.
9. Expense categories required by CA.
10. Which roles can confirm entries.
11. When monthly records become locked.
12. Whether CA export should block disputed records or include them separately.

## 29. Non-Negotiable Data Model Rules

1. AI output is never the source of truth.
2. Important fields need source, status, confidence, timestamp, and audit trail.
3. Business calculations are deterministic.
4. Incomplete entries are saved and assigned tasks.
5. Conflicts are marked disputed.
6. Government, private, farmer/custom, and by-product stock categories stay separated.
7. Confirmed, pending, disputed, and estimated numbers stay separated.
8. Original documents are stored and never overwritten.
9. Corrections are saved and reused as correction memory.
10. Important business records are adjusted or cancelled, not hard-deleted.
