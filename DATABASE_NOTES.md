# Database Notes

## Implemented

MVP v0 schema for the first capture-confirm-ledger-evidence loop:

- Identity: mills, profiles, mill_members
- Parties: parties, party_aliases
- Capture/extraction: documents, input_captures, extraction_runs, extracted_fields
- Draft/confirmation: draft_entries, draft_entry_fields, correction_memory
- Operations: paddy_lots, byproduct_sales, expenses, payments
- Ledger: business_events, stock_events
- Intelligence/audit: tasks, alerts, assistant_queries, audit_logs, failed_jobs
- Exports: export_snapshots, export_files

## Intentionally Deferred

These north-star entities are not implemented in MVP v0: evidence_bundles, calculation_runs, financial_events, export_snapshot_items, data_quality_scores, milling_batches, milling_batch_inputs, milling_batch_outputs, government_allocations, cmr_obligations, and cmr_deliveries.

## AI Draft To Truth

AI extraction writes only `extraction_runs`, `extracted_fields`, `draft_entries`, and `draft_entry_fields`. Those rows carry confidence, review flags, source links, and field statuses. Human confirmation promotes the usable data into `business_events` and operation tables. User edits to AI values are stored in `correction_memory`.

## Stock Events

`stock_events` must reference `business_events.business_event_id`. A database trigger rejects stock events unless the source business event belongs to the same mill and is confirmed, reconciled, locked, exported, or adjusted. This keeps AI-extracted fields and unconfirmed drafts from directly changing stock.

## RLS

All mill-scoped public tables have RLS enabled. Policies use private helper functions:

- `app_private.is_mill_member(target_mill_id uuid)`
- `app_private.has_mill_role(target_mill_id uuid, allowed_roles text[])`

Active members can read rows for their mills. Owners/admins manage membership and most records. Managers/operators can capture documents, create drafts, and enter operational records. Accountant/CA users can read mill data and create export snapshots/files, but cannot mutate operational truth. Read-only users have read access only. There are no delete policies for business records.

