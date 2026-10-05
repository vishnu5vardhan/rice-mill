-- AUTO-GENERATED: all migrations + storage policies in order.
-- Paste this whole file into the Supabase SQL Editor and Run.



-- ============================================================
-- FILE: supabase/migrations/001_extensions_and_enums.sql
-- ============================================================

-- MVP v0 foundation: extensions, schemas, enums, and shared triggers.

create extension if not exists pgcrypto;

create schema if not exists app_private;

create type public.field_status as enum (
  'missing',
  'draft',
  'ai_extracted',
  'needs_review',
  'user_confirmed',
  'system_calculated',
  'estimated',
  'disputed',
  'locked',
  'adjusted'
);

create type public.record_status as enum (
  'draft',
  'incomplete',
  'pending_confirmation',
  'confirmed',
  'reconciled',
  'disputed',
  'estimated',
  'locked',
  'exported',
  'cancelled',
  'adjusted'
);

create type public.job_status as enum (
  'queued',
  'running',
  'succeeded',
  'failed',
  'retrying',
  'cancelled'
);

create type public.alert_status as enum (
  'open',
  'snoozed',
  'resolved',
  'dismissed',
  'converted_to_task'
);

create type public.task_status as enum (
  'open',
  'in_progress',
  'completed',
  'snoozed',
  'not_applicable',
  'blocked'
);

create type public.source_type as enum (
  'voice',
  'manual',
  'document',
  'truck_sheet',
  'weighbridge_slip',
  'moisture_note',
  'government_app',
  'physical_count',
  'sale_bill',
  'expense_bill',
  'system_calculation',
  'adjustment_event',
  'import'
);

create type public.paddy_source_type as enum (
  'government',
  'private',
  'farmer_custom',
  'own_purchase',
  'unknown'
);

create type public.product_type as enum (
  'paddy',
  'rice',
  'bran',
  'broken_rice',
  'husk'
);

create type public.document_type as enum (
  'truck_sheet',
  'weighbridge_slip',
  'moisture_quality_note',
  'government_app_screenshot',
  'delivery_challan',
  'sale_bill',
  'byproduct_sale_bill',
  'transport_bill',
  'labour_note',
  'electricity_bill',
  'maintenance_bill',
  'license_compliance_document',
  'ca_accounting_document',
  'rough_notes',
  'unknown'
);

create type public.party_type as enum (
  'source_center',
  'farmer',
  'dealer',
  'vendor',
  'transporter',
  'worker_group',
  'ca',
  'government_office',
  'other'
);

create type public.member_role as enum (
  'owner',
  'manager',
  'operator',
  'accountant_ca',
  'family_helper',
  'readonly',
  'admin'
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;


-- ============================================================
-- FILE: supabase/migrations/002_identity_and_parties.sql
-- ============================================================

-- Identity, mill membership, and human-confirmed parties.

create table public.mills (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  location text,
  metadata jsonb not null default '{}'::jsonb,
  status text not null default 'active'
    check (status in ('active', 'inactive', 'suspended')),
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);

create trigger set_mills_updated_at
before update on public.mills
for each row execute function public.set_updated_at();

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  phone text,
  preferred_language text not null default 'en',
  metadata jsonb not null default '{}'::jsonb,
  status text not null default 'active'
    check (status in ('active', 'inactive', 'disabled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create table public.mill_members (
  id uuid primary key default gen_random_uuid(),
  mill_id uuid not null references public.mills(id),
  profile_id uuid not null references public.profiles(id),
  role public.member_role not null,
  status text not null default 'active'
    check (status in ('invited', 'active', 'inactive', 'disabled')),
  invited_by uuid references public.profiles(id),
  joined_at timestamptz,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles(id),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id),
  unique (mill_id, profile_id)
);

create trigger set_mill_members_updated_at
before update on public.mill_members
for each row execute function public.set_updated_at();

create table public.parties (
  id uuid primary key default gen_random_uuid(),
  mill_id uuid not null references public.mills(id),
  party_type public.party_type not null,
  name text not null,
  normalized_name text generated always as (
    lower(regexp_replace(trim(name), '\s+', ' ', 'g'))
  ) stored,
  phone text,
  address text,
  metadata jsonb not null default '{}'::jsonb,
  status public.record_status not null default 'confirmed',
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles(id),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id)
);

create trigger set_parties_updated_at
before update on public.parties
for each row execute function public.set_updated_at();

create table public.party_aliases (
  id uuid primary key default gen_random_uuid(),
  mill_id uuid not null references public.mills(id),
  party_id uuid not null references public.parties(id),
  alias text not null,
  alias_normalized text generated always as (
    lower(regexp_replace(trim(alias), '\s+', ' ', 'g'))
  ) stored,
  source_type public.source_type not null default 'manual',
  source_id uuid,
  confidence numeric(5,4) check (confidence is null or (confidence >= 0 and confidence <= 1)),
  status public.field_status not null default 'user_confirmed',
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles(id),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id)
);

create trigger set_party_aliases_updated_at
before update on public.party_aliases
for each row execute function public.set_updated_at();

create index idx_mill_members_profile_id on public.mill_members(profile_id);
create index idx_mill_members_mill_role_status on public.mill_members(mill_id, role, status);

create index idx_parties_mill_id on public.parties(mill_id);
create index idx_parties_normalized_name on public.parties(mill_id, normalized_name);
create index idx_parties_type_status on public.parties(mill_id, party_type, status);
create unique index idx_parties_unique_active_name
  on public.parties(mill_id, party_type, normalized_name)
  where status <> 'cancelled';

create index idx_party_aliases_mill_id on public.party_aliases(mill_id);
create index idx_party_aliases_alias on public.party_aliases(mill_id, alias_normalized);
create unique index idx_party_aliases_unique_active_alias
  on public.party_aliases(mill_id, alias_normalized)
  where status <> 'disputed';


-- ============================================================
-- FILE: supabase/migrations/003_documents_and_extraction.sql
-- ============================================================

-- Source artifacts, raw captures, AI/OCR runs, and extracted fields.

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  mill_id uuid not null references public.mills(id),
  uploaded_by uuid references public.profiles(id),
  storage_bucket text not null default 'documents',
  storage_path text not null,
  original_filename text not null,
  mime_type text,
  file_size bigint check (file_size is null or file_size >= 0),
  checksum text,
  document_type public.document_type not null default 'unknown',
  classification_status public.job_status not null default 'queued',
  extraction_status public.job_status not null default 'queued',
  status public.record_status not null default 'draft',
  metadata jsonb not null default '{}'::jsonb,
  uploaded_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles(id),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id),
  unique (mill_id, storage_bucket, storage_path)
);

create trigger set_documents_updated_at
before update on public.documents
for each row execute function public.set_updated_at();

create table public.document_links (
  id uuid primary key default gen_random_uuid(),
  mill_id uuid not null references public.mills(id),
  document_id uuid not null references public.documents(id),
  linked_entity_type text not null,
  linked_entity_id uuid not null,
  link_type text not null default 'evidence',
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles(id),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id),
  unique (mill_id, document_id, linked_entity_type, linked_entity_id, link_type)
);

create trigger set_document_links_updated_at
before update on public.document_links
for each row execute function public.set_updated_at();

create table public.input_captures (
  id uuid primary key default gen_random_uuid(),
  mill_id uuid not null references public.mills(id),
  capture_type text not null
    check (capture_type in ('voice', 'manual_note', 'quick_form', 'ask_question')),
  source_type public.source_type not null,
  raw_text text,
  transcript text,
  audio_storage_bucket text,
  audio_storage_path text,
  metadata jsonb not null default '{}'::jsonb,
  status public.record_status not null default 'draft',
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles(id),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id)
);

create trigger set_input_captures_updated_at
before update on public.input_captures
for each row execute function public.set_updated_at();

create table public.extraction_runs (
  id uuid primary key default gen_random_uuid(),
  mill_id uuid not null references public.mills(id),
  document_id uuid references public.documents(id),
  input_capture_id uuid references public.input_captures(id),
  run_type text not null check (
    run_type in (
      'document_classification',
      'ocr_vision_extraction',
      'voice_transcription',
      'voice_structuring',
      'question_intent'
    )
  ),
  model_provider text,
  model_name text,
  prompt_version text,
  schema_name text,
  schema_version text,
  status public.job_status not null default 'queued',
  raw_output jsonb not null default '{}'::jsonb,
  validated_output jsonb not null default '{}'::jsonb,
  error text,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles(id),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id),
  check (document_id is not null or input_capture_id is not null)
);

create trigger set_extraction_runs_updated_at
before update on public.extraction_runs
for each row execute function public.set_updated_at();

create table public.extracted_fields (
  id uuid primary key default gen_random_uuid(),
  mill_id uuid not null references public.mills(id),
  extraction_run_id uuid not null references public.extraction_runs(id),
  document_id uuid references public.documents(id),
  input_capture_id uuid references public.input_captures(id),
  field_name text not null,
  raw_value jsonb,
  normalized_value jsonb,
  confidence numeric(5,4) check (confidence is null or (confidence >= 0 and confidence <= 1)),
  status public.field_status not null default 'ai_extracted',
  source_type public.source_type not null,
  source_id uuid,
  needs_review boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles(id),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id)
);

create trigger set_extracted_fields_updated_at
before update on public.extracted_fields
for each row execute function public.set_updated_at();

create index idx_documents_mill_id on public.documents(mill_id);
create index idx_documents_created_at on public.documents(mill_id, created_at desc);
create index idx_documents_document_type on public.documents(mill_id, document_type);
create index idx_documents_document_type_extraction_status
  on public.documents(mill_id, document_type, extraction_status);
create unique index idx_documents_unique_checksum
  on public.documents(mill_id, checksum)
  where checksum is not null;

create index idx_document_links_mill_id on public.document_links(mill_id);
create index idx_document_links_document_id on public.document_links(document_id);
create index idx_document_links_entity on public.document_links(mill_id, linked_entity_type, linked_entity_id);

create index idx_input_captures_mill_id on public.input_captures(mill_id);
create index idx_input_captures_created_at on public.input_captures(mill_id, created_at desc);
create index idx_input_captures_status on public.input_captures(mill_id, status);

create index idx_extraction_runs_mill_id on public.extraction_runs(mill_id);
create index idx_extraction_runs_document_id on public.extraction_runs(document_id);
create index idx_extraction_runs_input_capture_id on public.extraction_runs(input_capture_id);
create index idx_extraction_runs_status on public.extraction_runs(mill_id, status);

create index idx_extracted_fields_mill_id on public.extracted_fields(mill_id);
create index idx_extracted_fields_extraction_run_id on public.extracted_fields(extraction_run_id);
create index idx_extracted_fields_document_id on public.extracted_fields(document_id);
create index idx_extracted_fields_status on public.extracted_fields(mill_id, status);
create index idx_extracted_fields_needs_review on public.extracted_fields(mill_id, needs_review)
  where needs_review;


-- ============================================================
-- FILE: supabase/migrations/004_drafts_and_corrections.sql
-- ============================================================

-- Human confirmation layer: drafts, draft fields, and correction memory.

create table public.draft_entries (
  id uuid primary key default gen_random_uuid(),
  mill_id uuid not null references public.mills(id),
  draft_type text not null check (
    draft_type in (
      'paddy_inward',
      'byproduct_sale',
      'expense',
      'payment',
      'document_only'
    )
  ),
  source_type public.source_type not null,
  source_id uuid,
  document_id uuid references public.documents(id),
  input_capture_id uuid references public.input_captures(id),
  extraction_run_id uuid references public.extraction_runs(id),
  payload jsonb not null default '{}'::jsonb,
  missing_fields text[] not null default '{}'::text[],
  status public.record_status not null default 'draft',
  last_reviewed_by uuid references public.profiles(id),
  last_reviewed_at timestamptz,
  confirmed_by uuid references public.profiles(id),
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles(id),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id)
);

create trigger set_draft_entries_updated_at
before update on public.draft_entries
for each row execute function public.set_updated_at();

create table public.draft_entry_fields (
  id uuid primary key default gen_random_uuid(),
  mill_id uuid not null references public.mills(id),
  draft_entry_id uuid not null references public.draft_entries(id),
  field_name text not null,
  value jsonb,
  source_type public.source_type not null,
  source_id uuid,
  confidence numeric(5,4) check (confidence is null or (confidence >= 0 and confidence <= 1)),
  status public.field_status not null default 'draft',
  required boolean not null default false,
  needs_review boolean not null default false,
  confirmed_by uuid references public.profiles(id),
  confirmed_at timestamptz,
  linked_document_id uuid references public.documents(id),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles(id),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id)
);

create trigger set_draft_entry_fields_updated_at
before update on public.draft_entry_fields
for each row execute function public.set_updated_at();

create table public.correction_memory (
  id uuid primary key default gen_random_uuid(),
  mill_id uuid not null references public.mills(id),
  user_id uuid not null references public.profiles(id),
  correction_type text not null check (
    correction_type in (
      'document_type',
      'field_value',
      'party_mapping',
      'alias_mapping',
      'truck_number',
      'bag_count',
      'rate_alert_reason',
      'accepted_exception'
    )
  ),
  document_id uuid references public.documents(id),
  extraction_run_id uuid references public.extraction_runs(id),
  draft_entry_id uuid references public.draft_entries(id),
  draft_entry_field_id uuid references public.draft_entry_fields(id),
  entity_type text,
  entity_id uuid,
  field_name text,
  original_ai_value jsonb,
  corrected_value jsonb not null,
  confidence_before numeric(5,4) check (confidence_before is null or (confidence_before >= 0 and confidence_before <= 1)),
  reason text,
  status public.record_status not null default 'confirmed',
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles(id),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id)
);

create trigger set_correction_memory_updated_at
before update on public.correction_memory
for each row execute function public.set_updated_at();

create index idx_draft_entries_mill_id on public.draft_entries(mill_id);
create index idx_draft_entries_created_at on public.draft_entries(mill_id, created_at desc);
create index idx_draft_entries_status on public.draft_entries(mill_id, status);
create index idx_draft_entries_draft_type on public.draft_entries(mill_id, draft_type);
create index idx_draft_entries_document_id on public.draft_entries(document_id);

create index idx_draft_entry_fields_mill_id on public.draft_entry_fields(mill_id);
create index idx_draft_entry_fields_draft_entry_id on public.draft_entry_fields(draft_entry_id);
create index idx_draft_entry_fields_status on public.draft_entry_fields(mill_id, status);
create index idx_draft_entry_fields_required_missing
  on public.draft_entry_fields(mill_id, draft_entry_id)
  where required and status = 'missing';

create index idx_correction_memory_mill_id on public.correction_memory(mill_id);
create index idx_correction_memory_document_id on public.correction_memory(document_id);
create index idx_correction_memory_field_name on public.correction_memory(mill_id, field_name);
create index idx_correction_memory_correction_type on public.correction_memory(mill_id, correction_type);



-- ============================================================
-- FILE: supabase/migrations/005_operations_and_ledger.sql
-- ============================================================

-- Confirmed business events, operational records, and deterministic stock ledger.

create table public.business_events (
  id uuid primary key default gen_random_uuid(),
  mill_id uuid not null references public.mills(id),
  event_type text not null,
  event_date date not null default current_date,
  source_type public.source_type not null,
  source_id uuid,
  draft_entry_id uuid references public.draft_entries(id),
  document_id uuid references public.documents(id),
  related_entity_type text,
  related_entity_id uuid,
  payload jsonb not null default '{}'::jsonb,
  status public.record_status not null default 'confirmed',
  idempotency_key text not null,
  confirmed_by uuid references public.profiles(id),
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles(id),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id),
  unique (mill_id, idempotency_key)
);

create trigger set_business_events_updated_at
before update on public.business_events
for each row execute function public.set_updated_at();

create table public.paddy_lots (
  id uuid primary key default gen_random_uuid(),
  mill_id uuid not null references public.mills(id),
  lot_code text,
  paddy_source_type public.paddy_source_type not null default 'unknown',
  source_party_id uuid references public.parties(id),
  arrival_date date,
  truck_number text,
  truck_sheet_bag_count numeric(12,3) check (truck_sheet_bag_count is null or truck_sheet_bag_count >= 0),
  physical_bag_count numeric(12,3) check (physical_bag_count is null or physical_bag_count >= 0),
  app_quantity numeric(14,3) check (app_quantity is null or app_quantity >= 0),
  weighbridge_gross_weight numeric(14,3) check (weighbridge_gross_weight is null or weighbridge_gross_weight >= 0),
  weighbridge_tare_weight numeric(14,3) check (weighbridge_tare_weight is null or weighbridge_tare_weight >= 0),
  weighbridge_net_weight numeric(14,3) check (weighbridge_net_weight is null or weighbridge_net_weight >= 0),
  weighbridge_quantity_unit text check (weighbridge_quantity_unit is null or weighbridge_quantity_unit in ('kg', 'qtl', 'tonne')),
  moisture_percent numeric(6,3) check (moisture_percent is null or (moisture_percent >= 0 and moisture_percent <= 100)),
  moisture_source text,
  moisture_recorded_at timestamptz,
  confirmed_quantity numeric(14,3) check (confirmed_quantity is null or confirmed_quantity >= 0),
  quantity_unit text check (quantity_unit is null or quantity_unit in ('bag', 'kg', 'qtl', 'tonne')),
  data_quality_score numeric(5,2) check (data_quality_score is null or (data_quality_score >= 0 and data_quality_score <= 100)),
  created_from_business_event_id uuid references public.business_events(id),
  status public.record_status not null default 'incomplete',
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles(id),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id),
  check (
    status not in ('confirmed', 'reconciled', 'locked', 'exported')
    or (confirmed_quantity is not null and quantity_unit is not null and created_from_business_event_id is not null)
  )
);

create trigger set_paddy_lots_updated_at
before update on public.paddy_lots
for each row execute function public.set_updated_at();

create table public.byproduct_sales (
  id uuid primary key default gen_random_uuid(),
  mill_id uuid not null references public.mills(id),
  business_event_id uuid references public.business_events(id),
  sale_date date not null default current_date,
  dealer_party_id uuid references public.parties(id),
  product_type public.product_type not null check (product_type in ('bran', 'broken_rice', 'husk')),
  paddy_source_type public.paddy_source_type not null default 'unknown',
  quantity numeric(14,3) check (quantity is null or quantity >= 0),
  quantity_unit text not null default 'qtl' check (quantity_unit in ('kg', 'qtl', 'tonne')),
  rate numeric(14,2) check (rate is null or rate >= 0),
  subtotal_amount numeric(14,2) check (subtotal_amount is null or subtotal_amount >= 0),
  gst_percent numeric(6,3) check (gst_percent is null or gst_percent >= 0),
  tax_amount numeric(14,2) check (tax_amount is null or tax_amount >= 0),
  total_amount numeric(14,2) generated always as (
    case when quantity is not null and rate is not null then quantity * rate else null end
  ) stored,
  total_with_tax numeric(14,2) generated always as (
    case
      when quantity is not null and rate is not null then (quantity * rate) + coalesce(tax_amount, 0)
      when subtotal_amount is not null then subtotal_amount + coalesce(tax_amount, 0)
      else null
    end
  ) stored,
  payment_status text not null default 'pending'
    check (payment_status in ('pending', 'partial', 'paid', 'cancelled')),
  document_id uuid references public.documents(id),
  status public.record_status not null default 'pending_confirmation',
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles(id),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id),
  check (
    status not in ('confirmed', 'reconciled', 'locked', 'exported')
    or (business_event_id is not null and quantity is not null and rate is not null)
  )
);

create trigger set_byproduct_sales_updated_at
before update on public.byproduct_sales
for each row execute function public.set_updated_at();

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  mill_id uuid not null references public.mills(id),
  business_event_id uuid references public.business_events(id),
  expense_date date not null default current_date,
  expense_category text not null
    check (expense_category in ('labour', 'transport', 'electricity', 'maintenance', 'other')),
  vendor_party_id uuid references public.parties(id),
  amount numeric(14,2) check (amount is null or amount >= 0),
  currency text not null default 'INR',
  document_id uuid references public.documents(id),
  status public.record_status not null default 'pending_confirmation',
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles(id),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id),
  check (
    status not in ('confirmed', 'reconciled', 'locked', 'exported')
    or (business_event_id is not null and amount is not null)
  )
);

create trigger set_expenses_updated_at
before update on public.expenses
for each row execute function public.set_updated_at();

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  mill_id uuid not null references public.mills(id),
  business_event_id uuid references public.business_events(id),
  payment_date date not null default current_date,
  party_id uuid references public.parties(id),
  direction text not null check (direction in ('received', 'paid')),
  amount numeric(14,2) check (amount is null or amount >= 0),
  currency text not null default 'INR',
  method text,
  related_entity_type text,
  related_entity_id uuid,
  document_id uuid references public.documents(id),
  status public.record_status not null default 'pending_confirmation',
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles(id),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id),
  check (
    status not in ('confirmed', 'reconciled', 'locked', 'exported')
    or (business_event_id is not null and amount is not null)
  )
);

create trigger set_payments_updated_at
before update on public.payments
for each row execute function public.set_updated_at();

create table public.stock_events (
  id uuid primary key default gen_random_uuid(),
  mill_id uuid not null references public.mills(id),
  business_event_id uuid not null references public.business_events(id),
  event_type text not null,
  event_date date not null default current_date,
  product_type public.product_type not null,
  paddy_source_type public.paddy_source_type not null default 'unknown',
  direction text not null check (direction in ('in', 'out', 'adjustment')),
  quantity_delta numeric(14,3) not null check (quantity_delta <> 0),
  quantity_unit text not null check (quantity_unit in ('kg', 'qtl', 'tonne', 'bag')),
  related_entity_type text,
  related_entity_id uuid,
  payload jsonb not null default '{}'::jsonb,
  status public.record_status not null default 'confirmed',
  idempotency_key text not null,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles(id),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id),
  unique (mill_id, idempotency_key),
  check (
    (direction = 'in' and quantity_delta > 0)
    or (direction = 'out' and quantity_delta < 0)
    or direction = 'adjustment'
  )
);

create trigger set_stock_events_updated_at
before update on public.stock_events
for each row execute function public.set_updated_at();

create or replace function app_private.ensure_stock_event_business_event()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  source_event public.business_events%rowtype;
begin
  select *
  into source_event
  from public.business_events
  where id = new.business_event_id;

  if not found then
    raise exception 'stock_events.business_event_id must reference an existing business event';
  end if;

  if source_event.mill_id <> new.mill_id then
    raise exception 'stock_events.mill_id must match business_events.mill_id';
  end if;

  if source_event.status not in ('confirmed', 'reconciled', 'locked', 'exported', 'adjusted') then
    raise exception 'stock events can only be created from confirmed/reconciled/locked/exported/adjusted business events';
  end if;

  return new;
end;
$$;

create trigger ensure_stock_event_business_event
before insert or update on public.stock_events
for each row execute function app_private.ensure_stock_event_business_event();

create index idx_business_events_mill_id on public.business_events(mill_id);
create index idx_business_events_created_at on public.business_events(mill_id, created_at desc);
create index idx_business_events_status on public.business_events(mill_id, status);
create index idx_business_events_event_type on public.business_events(mill_id, event_type);
create index idx_business_events_event_date on public.business_events(mill_id, event_date desc);

create index idx_paddy_lots_mill_id on public.paddy_lots(mill_id);
create index idx_paddy_lots_created_at on public.paddy_lots(mill_id, created_at desc);
create index idx_paddy_lots_status_paddy_source_type
  on public.paddy_lots(mill_id, status, paddy_source_type);
create index idx_paddy_lots_source_party_id on public.paddy_lots(source_party_id);
create unique index idx_paddy_lots_unique_lot_code
  on public.paddy_lots(mill_id, lot_code)
  where lot_code is not null;

create index idx_byproduct_sales_mill_id on public.byproduct_sales(mill_id);
create index idx_byproduct_sales_created_at on public.byproduct_sales(mill_id, created_at desc);
create index idx_byproduct_sales_status on public.byproduct_sales(mill_id, status);
create index idx_byproduct_sales_product_date on public.byproduct_sales(mill_id, product_type, sale_date desc);

create index idx_expenses_mill_id on public.expenses(mill_id);
create index idx_expenses_created_at on public.expenses(mill_id, created_at desc);
create index idx_expenses_status on public.expenses(mill_id, status);
create index idx_expenses_category_date on public.expenses(mill_id, expense_category, expense_date desc);

create index idx_payments_mill_id on public.payments(mill_id);
create index idx_payments_created_at on public.payments(mill_id, created_at desc);
create index idx_payments_status on public.payments(mill_id, status);
create index idx_payments_party_id on public.payments(party_id);

create index idx_stock_events_mill_id on public.stock_events(mill_id);
create index idx_stock_events_created_at on public.stock_events(mill_id, created_at desc);
create index idx_stock_events_business_event_id on public.stock_events(business_event_id);
create index idx_stock_events_product_source
  on public.stock_events(mill_id, product_type, paddy_source_type);
create index idx_stock_events_event_date on public.stock_events(mill_id, event_date desc);


-- ============================================================
-- FILE: supabase/migrations/006_tasks_alerts_audit.sql
-- ============================================================

-- Intelligence work queue, evidence-backed assistant logs, audit, and job failures.

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  mill_id uuid not null references public.mills(id),
  task_type text not null,
  title text not null check (length(trim(title)) > 0),
  description text,
  status public.task_status not null default 'open',
  priority smallint not null default 3 check (priority between 1 and 5),
  due_at timestamptz,
  snoozed_until timestamptz,
  linked_entity_type text,
  linked_entity_id uuid,
  missing_field_name text,
  assigned_to uuid references public.profiles(id),
  source_type public.source_type,
  source_id uuid,
  completed_by uuid references public.profiles(id),
  completed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles(id),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id)
);

create trigger set_tasks_updated_at
before update on public.tasks
for each row execute function public.set_updated_at();

create table public.alerts (
  id uuid primary key default gen_random_uuid(),
  mill_id uuid not null references public.mills(id),
  alert_type text not null,
  title text not null check (length(trim(title)) > 0),
  message text not null check (length(trim(message)) > 0),
  status public.alert_status not null default 'open',
  severity text not null default 'medium'
    check (severity in ('low', 'medium', 'high', 'critical')),
  linked_entity_type text,
  linked_entity_id uuid,
  task_id uuid references public.tasks(id),
  evidence jsonb not null default '{}'::jsonb,
  action_label text,
  action_url text,
  snoozed_until timestamptz,
  resolved_by uuid references public.profiles(id),
  resolved_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles(id),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id)
);

create trigger set_alerts_updated_at
before update on public.alerts
for each row execute function public.set_updated_at();

create table public.assistant_queries (
  id uuid primary key default gen_random_uuid(),
  mill_id uuid not null references public.mills(id),
  asked_by uuid references public.profiles(id),
  input_capture_id uuid references public.input_captures(id),
  question text not null,
  interpreted_intent text,
  answer text,
  confidence text check (confidence is null or confidence in ('low', 'medium', 'high')),
  evidence jsonb not null default '{}'::jsonb,
  missing_data jsonb not null default '[]'::jsonb,
  status public.job_status not null default 'succeeded',
  error text,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles(id),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id)
);

create trigger set_assistant_queries_updated_at
before update on public.assistant_queries
for each row execute function public.set_updated_at();

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  mill_id uuid not null references public.mills(id),
  actor_id uuid references public.profiles(id),
  action text not null,
  entity_type text not null,
  entity_id uuid,
  before_value jsonb,
  after_value jsonb,
  source_type public.source_type,
  source_id uuid,
  request_id text,
  ip_address inet,
  user_agent text,
  created_at timestamptz not null default now()
);

create table public.failed_jobs (
  id uuid primary key default gen_random_uuid(),
  mill_id uuid references public.mills(id),
  job_type text not null,
  status public.job_status not null default 'failed',
  payload jsonb not null default '{}'::jsonb,
  error text not null,
  attempts integer not null default 0 check (attempts >= 0),
  max_attempts integer not null default 3 check (max_attempts >= 1),
  next_retry_at timestamptz,
  related_entity_type text,
  related_entity_id uuid,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles(id),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id)
);

create trigger set_failed_jobs_updated_at
before update on public.failed_jobs
for each row execute function public.set_updated_at();

create or replace function app_private.prevent_audit_log_changes()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  raise exception 'audit_logs are append-only';
end;
$$;

create trigger prevent_audit_log_updates
before update or delete on public.audit_logs
for each row execute function app_private.prevent_audit_log_changes();

create index idx_tasks_mill_id on public.tasks(mill_id);
create index idx_tasks_created_at on public.tasks(mill_id, created_at desc);
create index idx_tasks_status_task_type on public.tasks(mill_id, status, task_type);
create index idx_tasks_linked_entity on public.tasks(mill_id, linked_entity_type, linked_entity_id);
create index idx_tasks_assigned_to on public.tasks(assigned_to);

create index idx_alerts_mill_id on public.alerts(mill_id);
create index idx_alerts_created_at on public.alerts(mill_id, created_at desc);
create index idx_alerts_status_alert_type on public.alerts(mill_id, status, alert_type);
create index idx_alerts_linked_entity on public.alerts(mill_id, linked_entity_type, linked_entity_id);

create index idx_assistant_queries_mill_id on public.assistant_queries(mill_id);
create index idx_assistant_queries_created_at on public.assistant_queries(mill_id, created_at desc);
create index idx_assistant_queries_asked_by on public.assistant_queries(asked_by);

create index idx_audit_logs_mill_id on public.audit_logs(mill_id);
create index idx_audit_logs_created_at on public.audit_logs(mill_id, created_at desc);
create index idx_audit_logs_entity on public.audit_logs(mill_id, entity_type, entity_id);
create index idx_audit_logs_actor_id on public.audit_logs(actor_id);

create index idx_failed_jobs_mill_id on public.failed_jobs(mill_id);
create index idx_failed_jobs_created_at on public.failed_jobs(created_at desc);
create index idx_failed_jobs_status on public.failed_jobs(status);
create index idx_failed_jobs_next_retry_at on public.failed_jobs(next_retry_at)
  where status in ('failed', 'retrying');


-- ============================================================
-- FILE: supabase/migrations/007_exports_and_reports.sql
-- ============================================================

-- Versioned export previews/files for CA and owner reporting.

create table public.export_snapshots (
  id uuid primary key default gen_random_uuid(),
  mill_id uuid not null references public.mills(id),
  export_type text not null check (export_type in ('ca_monthly', 'ca_yearly', 'stock_preview', 'documents_bundle')),
  period_start date,
  period_end date,
  version integer not null default 1 check (version > 0),
  status public.record_status not null default 'draft',
  summary jsonb not null default '{}'::jsonb,
  generated_by uuid references public.profiles(id),
  generated_at timestamptz not null default now(),
  locked_at timestamptz,
  supersedes_snapshot_id uuid references public.export_snapshots(id),
  idempotency_key text,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles(id),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id),
  unique (mill_id, export_type, period_start, period_end, version),
  unique (mill_id, idempotency_key)
);

create trigger set_export_snapshots_updated_at
before update on public.export_snapshots
for each row execute function public.set_updated_at();

create table public.export_files (
  id uuid primary key default gen_random_uuid(),
  mill_id uuid not null references public.mills(id),
  export_snapshot_id uuid not null references public.export_snapshots(id),
  file_type text not null check (file_type in ('xlsx', 'pdf', 'zip', 'csv', 'json')),
  storage_bucket text not null default 'documents',
  storage_path text not null,
  original_filename text,
  mime_type text,
  file_size bigint check (file_size is null or file_size >= 0),
  checksum text,
  status public.job_status not null default 'succeeded',
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles(id),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id),
  unique (mill_id, storage_bucket, storage_path)
);

create trigger set_export_files_updated_at
before update on public.export_files
for each row execute function public.set_updated_at();

create index idx_export_snapshots_mill_id on public.export_snapshots(mill_id);
create index idx_export_snapshots_created_at on public.export_snapshots(mill_id, created_at desc);
create index idx_export_snapshots_status on public.export_snapshots(mill_id, status);
create index idx_export_snapshots_period on public.export_snapshots(mill_id, export_type, period_start, period_end);

create index idx_export_files_mill_id on public.export_files(mill_id);
create index idx_export_files_snapshot_id on public.export_files(export_snapshot_id);
create index idx_export_files_created_at on public.export_files(mill_id, created_at desc);



-- ============================================================
-- FILE: supabase/migrations/008_rls_policies.sql
-- ============================================================

-- Row Level Security for mill-scoped data.

create or replace function app_private.is_mill_member(target_mill_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.mill_members mm
    join public.profiles p on p.id = mm.profile_id
    where mm.mill_id = target_mill_id
      and mm.profile_id = (select auth.uid())
      and mm.status = 'active'
      and p.status = 'active'
  );
$$;

create or replace function app_private.has_mill_role(target_mill_id uuid, allowed_roles text[])
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.mill_members mm
    join public.profiles p on p.id = mm.profile_id
    where mm.mill_id = target_mill_id
      and mm.profile_id = (select auth.uid())
      and mm.status = 'active'
      and p.status = 'active'
      and mm.role::text = any (allowed_roles)
  );
$$;

create or replace function app_private.can_read_profile(target_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select target_profile_id = (select auth.uid())
    or exists (
      select 1
      from public.mill_members self_mm
      join public.mill_members target_mm
        on target_mm.mill_id = self_mm.mill_id
       and target_mm.profile_id = target_profile_id
       and target_mm.status = 'active'
      where self_mm.profile_id = (select auth.uid())
        and self_mm.status = 'active'
    );
$$;

grant usage on schema app_private to authenticated;
grant execute on function app_private.is_mill_member(uuid) to authenticated;
grant execute on function app_private.has_mill_role(uuid, text[]) to authenticated;
grant execute on function app_private.can_read_profile(uuid) to authenticated;

alter table public.mills enable row level security;
alter table public.profiles enable row level security;
alter table public.mill_members enable row level security;
alter table public.parties enable row level security;
alter table public.party_aliases enable row level security;
alter table public.documents enable row level security;
alter table public.document_links enable row level security;
alter table public.input_captures enable row level security;
alter table public.extraction_runs enable row level security;
alter table public.extracted_fields enable row level security;
alter table public.draft_entries enable row level security;
alter table public.draft_entry_fields enable row level security;
alter table public.correction_memory enable row level security;
alter table public.business_events enable row level security;
alter table public.paddy_lots enable row level security;
alter table public.byproduct_sales enable row level security;
alter table public.expenses enable row level security;
alter table public.payments enable row level security;
alter table public.stock_events enable row level security;
alter table public.tasks enable row level security;
alter table public.alerts enable row level security;
alter table public.assistant_queries enable row level security;
alter table public.audit_logs enable row level security;
alter table public.failed_jobs enable row level security;
alter table public.export_snapshots enable row level security;
alter table public.export_files enable row level security;

grant usage on schema public to authenticated;
grant usage on all sequences in schema public to authenticated;
grant select, insert, update on all tables in schema public to authenticated;
grant select on all tables in schema public to anon;

create policy "members can read mills"
on public.mills for select
to authenticated
using ((select app_private.is_mill_member(id)));

create policy "authenticated users can create mills"
on public.mills for insert
to authenticated
with check ((select auth.uid()) is not null);

create policy "owners and admins can update mills"
on public.mills for update
to authenticated
using ((select app_private.has_mill_role(id, array['owner', 'admin'])))
with check ((select app_private.has_mill_role(id, array['owner', 'admin'])));

create policy "users can read visible profiles"
on public.profiles for select
to authenticated
using ((select app_private.can_read_profile(id)));

create policy "users can create own profile"
on public.profiles for insert
to authenticated
with check (id = (select auth.uid()));

create policy "users can update own profile"
on public.profiles for update
to authenticated
using (id = (select auth.uid()))
with check (id = (select auth.uid()));

create policy "members can read mill members"
on public.mill_members for select
to authenticated
using ((select app_private.is_mill_member(mill_id)));

create policy "owners and admins can insert mill members"
on public.mill_members for insert
to authenticated
with check ((select app_private.has_mill_role(mill_id, array['owner', 'admin'])));

create policy "owners and admins can update mill members"
on public.mill_members for update
to authenticated
using ((select app_private.has_mill_role(mill_id, array['owner', 'admin'])))
with check ((select app_private.has_mill_role(mill_id, array['owner', 'admin'])));

create policy "members can read parties"
on public.parties for select
to authenticated
using ((select app_private.is_mill_member(mill_id)));

create policy "operators can insert parties"
on public.parties for insert
to authenticated
with check ((select app_private.has_mill_role(mill_id, array['owner', 'admin', 'manager', 'operator'])));

create policy "operators can update unlocked parties"
on public.parties for update
to authenticated
using (
  (select app_private.has_mill_role(mill_id, array['owner', 'admin', 'manager', 'operator']))
  and status not in ('locked', 'exported')
)
with check ((select app_private.has_mill_role(mill_id, array['owner', 'admin', 'manager', 'operator'])));

create policy "members can read party aliases"
on public.party_aliases for select
to authenticated
using ((select app_private.is_mill_member(mill_id)));

create policy "operators can insert party aliases"
on public.party_aliases for insert
to authenticated
with check ((select app_private.has_mill_role(mill_id, array['owner', 'admin', 'manager', 'operator'])));

create policy "operators can update party aliases"
on public.party_aliases for update
to authenticated
using ((select app_private.has_mill_role(mill_id, array['owner', 'admin', 'manager', 'operator'])))
with check ((select app_private.has_mill_role(mill_id, array['owner', 'admin', 'manager', 'operator'])));

create policy "members can read documents"
on public.documents for select
to authenticated
using ((select app_private.is_mill_member(mill_id)));

create policy "operators can insert documents"
on public.documents for insert
to authenticated
with check ((select app_private.has_mill_role(mill_id, array['owner', 'admin', 'manager', 'operator'])));

create policy "operators can update unlocked documents"
on public.documents for update
to authenticated
using (
  (select app_private.has_mill_role(mill_id, array['owner', 'admin', 'manager', 'operator']))
  and status not in ('locked', 'exported')
)
with check ((select app_private.has_mill_role(mill_id, array['owner', 'admin', 'manager', 'operator'])));

create policy "members can read document links"
on public.document_links for select
to authenticated
using ((select app_private.is_mill_member(mill_id)));

create policy "operators can insert document links"
on public.document_links for insert
to authenticated
with check ((select app_private.has_mill_role(mill_id, array['owner', 'admin', 'manager', 'operator'])));

create policy "operators can update document links"
on public.document_links for update
to authenticated
using ((select app_private.has_mill_role(mill_id, array['owner', 'admin', 'manager', 'operator'])))
with check ((select app_private.has_mill_role(mill_id, array['owner', 'admin', 'manager', 'operator'])));

create policy "members can read input captures"
on public.input_captures for select
to authenticated
using ((select app_private.is_mill_member(mill_id)));

create policy "members can insert input captures"
on public.input_captures for insert
to authenticated
with check ((select app_private.is_mill_member(mill_id)));

create policy "operators can update input captures"
on public.input_captures for update
to authenticated
using ((select app_private.has_mill_role(mill_id, array['owner', 'admin', 'manager', 'operator'])))
with check ((select app_private.has_mill_role(mill_id, array['owner', 'admin', 'manager', 'operator'])));

create policy "members can read extraction runs"
on public.extraction_runs for select
to authenticated
using ((select app_private.is_mill_member(mill_id)));

create policy "operators can insert extraction runs"
on public.extraction_runs for insert
to authenticated
with check ((select app_private.has_mill_role(mill_id, array['owner', 'admin', 'manager', 'operator'])));

create policy "operators can update extraction runs"
on public.extraction_runs for update
to authenticated
using ((select app_private.has_mill_role(mill_id, array['owner', 'admin', 'manager', 'operator'])))
with check ((select app_private.has_mill_role(mill_id, array['owner', 'admin', 'manager', 'operator'])));

create policy "members can read extracted fields"
on public.extracted_fields for select
to authenticated
using ((select app_private.is_mill_member(mill_id)));

create policy "operators can insert extracted fields"
on public.extracted_fields for insert
to authenticated
with check ((select app_private.has_mill_role(mill_id, array['owner', 'admin', 'manager', 'operator'])));

create policy "operators can update extracted fields"
on public.extracted_fields for update
to authenticated
using ((select app_private.has_mill_role(mill_id, array['owner', 'admin', 'manager', 'operator'])))
with check ((select app_private.has_mill_role(mill_id, array['owner', 'admin', 'manager', 'operator'])));

create policy "members can read draft entries"
on public.draft_entries for select
to authenticated
using ((select app_private.is_mill_member(mill_id)));

create policy "operators can insert draft entries"
on public.draft_entries for insert
to authenticated
with check ((select app_private.has_mill_role(mill_id, array['owner', 'admin', 'manager', 'operator'])));

create policy "operators can update unlocked draft entries"
on public.draft_entries for update
to authenticated
using (
  (select app_private.has_mill_role(mill_id, array['owner', 'admin', 'manager', 'operator']))
  and status not in ('locked', 'exported')
)
with check ((select app_private.has_mill_role(mill_id, array['owner', 'admin', 'manager', 'operator'])));

create policy "members can read draft entry fields"
on public.draft_entry_fields for select
to authenticated
using ((select app_private.is_mill_member(mill_id)));

create policy "operators can insert draft entry fields"
on public.draft_entry_fields for insert
to authenticated
with check ((select app_private.has_mill_role(mill_id, array['owner', 'admin', 'manager', 'operator'])));

create policy "operators can update unlocked draft entry fields"
on public.draft_entry_fields for update
to authenticated
using (
  (select app_private.has_mill_role(mill_id, array['owner', 'admin', 'manager', 'operator']))
  and status not in ('locked', 'adjusted')
)
with check ((select app_private.has_mill_role(mill_id, array['owner', 'admin', 'manager', 'operator'])));

create policy "members can read correction memory"
on public.correction_memory for select
to authenticated
using ((select app_private.is_mill_member(mill_id)));

create policy "operators can insert correction memory"
on public.correction_memory for insert
to authenticated
with check ((select app_private.has_mill_role(mill_id, array['owner', 'admin', 'manager', 'operator'])));

create policy "owners and admins can update correction memory"
on public.correction_memory for update
to authenticated
using ((select app_private.has_mill_role(mill_id, array['owner', 'admin'])))
with check ((select app_private.has_mill_role(mill_id, array['owner', 'admin'])));

create policy "members can read business events"
on public.business_events for select
to authenticated
using ((select app_private.is_mill_member(mill_id)));

create policy "operators can insert business events"
on public.business_events for insert
to authenticated
with check ((select app_private.has_mill_role(mill_id, array['owner', 'admin', 'manager', 'operator'])));

create policy "owners and admins can update business events"
on public.business_events for update
to authenticated
using ((select app_private.has_mill_role(mill_id, array['owner', 'admin'])))
with check ((select app_private.has_mill_role(mill_id, array['owner', 'admin'])));

create policy "members can read paddy lots"
on public.paddy_lots for select
to authenticated
using ((select app_private.is_mill_member(mill_id)));

create policy "operators can insert paddy lots"
on public.paddy_lots for insert
to authenticated
with check ((select app_private.has_mill_role(mill_id, array['owner', 'admin', 'manager', 'operator'])));

create policy "operators can update unlocked paddy lots"
on public.paddy_lots for update
to authenticated
using (
  (select app_private.has_mill_role(mill_id, array['owner', 'admin', 'manager', 'operator']))
  and status not in ('locked', 'exported')
)
with check ((select app_private.has_mill_role(mill_id, array['owner', 'admin', 'manager', 'operator'])));

create policy "members can read byproduct sales"
on public.byproduct_sales for select
to authenticated
using ((select app_private.is_mill_member(mill_id)));

create policy "operators can insert byproduct sales"
on public.byproduct_sales for insert
to authenticated
with check ((select app_private.has_mill_role(mill_id, array['owner', 'admin', 'manager', 'operator'])));

create policy "operators can update unlocked byproduct sales"
on public.byproduct_sales for update
to authenticated
using (
  (select app_private.has_mill_role(mill_id, array['owner', 'admin', 'manager', 'operator']))
  and status not in ('locked', 'exported')
)
with check ((select app_private.has_mill_role(mill_id, array['owner', 'admin', 'manager', 'operator'])));

create policy "members can read expenses"
on public.expenses for select
to authenticated
using ((select app_private.is_mill_member(mill_id)));

create policy "operators can insert expenses"
on public.expenses for insert
to authenticated
with check ((select app_private.has_mill_role(mill_id, array['owner', 'admin', 'manager', 'operator'])));

create policy "operators can update unlocked expenses"
on public.expenses for update
to authenticated
using (
  (select app_private.has_mill_role(mill_id, array['owner', 'admin', 'manager', 'operator']))
  and status not in ('locked', 'exported')
)
with check ((select app_private.has_mill_role(mill_id, array['owner', 'admin', 'manager', 'operator'])));

create policy "members can read payments"
on public.payments for select
to authenticated
using ((select app_private.is_mill_member(mill_id)));

create policy "operators can insert payments"
on public.payments for insert
to authenticated
with check ((select app_private.has_mill_role(mill_id, array['owner', 'admin', 'manager', 'operator'])));

create policy "operators can update unlocked payments"
on public.payments for update
to authenticated
using (
  (select app_private.has_mill_role(mill_id, array['owner', 'admin', 'manager', 'operator']))
  and status not in ('locked', 'exported')
)
with check ((select app_private.has_mill_role(mill_id, array['owner', 'admin', 'manager', 'operator'])));

create policy "members can read stock events"
on public.stock_events for select
to authenticated
using ((select app_private.is_mill_member(mill_id)));

create policy "owners and admins can insert stock events"
on public.stock_events for insert
to authenticated
with check ((select app_private.has_mill_role(mill_id, array['owner', 'admin'])));

create policy "owners and admins can update stock events"
on public.stock_events for update
to authenticated
using ((select app_private.has_mill_role(mill_id, array['owner', 'admin'])))
with check ((select app_private.has_mill_role(mill_id, array['owner', 'admin'])));

create policy "members can read tasks"
on public.tasks for select
to authenticated
using ((select app_private.is_mill_member(mill_id)));

create policy "operators can insert tasks"
on public.tasks for insert
to authenticated
with check ((select app_private.has_mill_role(mill_id, array['owner', 'admin', 'manager', 'operator'])));

create policy "operators can update tasks"
on public.tasks for update
to authenticated
using ((select app_private.has_mill_role(mill_id, array['owner', 'admin', 'manager', 'operator'])))
with check ((select app_private.has_mill_role(mill_id, array['owner', 'admin', 'manager', 'operator'])));

create policy "members can read alerts"
on public.alerts for select
to authenticated
using ((select app_private.is_mill_member(mill_id)));

create policy "operators can insert alerts"
on public.alerts for insert
to authenticated
with check ((select app_private.has_mill_role(mill_id, array['owner', 'admin', 'manager', 'operator'])));

create policy "operators can update alerts"
on public.alerts for update
to authenticated
using ((select app_private.has_mill_role(mill_id, array['owner', 'admin', 'manager', 'operator'])))
with check ((select app_private.has_mill_role(mill_id, array['owner', 'admin', 'manager', 'operator'])));

create policy "members can read assistant queries"
on public.assistant_queries for select
to authenticated
using ((select app_private.is_mill_member(mill_id)));

create policy "members can insert assistant queries"
on public.assistant_queries for insert
to authenticated
with check ((select app_private.is_mill_member(mill_id)));

create policy "owners and admins can update assistant queries"
on public.assistant_queries for update
to authenticated
using ((select app_private.has_mill_role(mill_id, array['owner', 'admin'])))
with check ((select app_private.has_mill_role(mill_id, array['owner', 'admin'])));

create policy "members can read audit logs"
on public.audit_logs for select
to authenticated
using ((select app_private.is_mill_member(mill_id)));

create policy "members can insert audit logs"
on public.audit_logs for insert
to authenticated
with check ((select app_private.is_mill_member(mill_id)));

create policy "owners and admins can read failed jobs"
on public.failed_jobs for select
to authenticated
using (mill_id is null or (select app_private.has_mill_role(mill_id, array['owner', 'admin'])));

create policy "owners and admins can insert failed jobs"
on public.failed_jobs for insert
to authenticated
with check (mill_id is null or (select app_private.has_mill_role(mill_id, array['owner', 'admin'])));

create policy "owners and admins can update failed jobs"
on public.failed_jobs for update
to authenticated
using (mill_id is null or (select app_private.has_mill_role(mill_id, array['owner', 'admin'])))
with check (mill_id is null or (select app_private.has_mill_role(mill_id, array['owner', 'admin'])));

create policy "members can read export snapshots"
on public.export_snapshots for select
to authenticated
using ((select app_private.is_mill_member(mill_id)));

create policy "owners admins and ca can insert export snapshots"
on public.export_snapshots for insert
to authenticated
with check ((select app_private.has_mill_role(mill_id, array['owner', 'admin', 'accountant_ca'])));

create policy "owners admins and ca can update export snapshots"
on public.export_snapshots for update
to authenticated
using ((select app_private.has_mill_role(mill_id, array['owner', 'admin', 'accountant_ca'])))
with check ((select app_private.has_mill_role(mill_id, array['owner', 'admin', 'accountant_ca'])));

create policy "members can read export files"
on public.export_files for select
to authenticated
using ((select app_private.is_mill_member(mill_id)));

create policy "owners admins and ca can insert export files"
on public.export_files for insert
to authenticated
with check ((select app_private.has_mill_role(mill_id, array['owner', 'admin', 'accountant_ca'])));

create policy "owners admins and ca can update export files"
on public.export_files for update
to authenticated
using ((select app_private.has_mill_role(mill_id, array['owner', 'admin', 'accountant_ca'])))
with check ((select app_private.has_mill_role(mill_id, array['owner', 'admin', 'accountant_ca'])));


-- ============================================================
-- FILE: supabase/migrations/009_seed_reference_data.sql
-- ============================================================

-- MVP v0 reference seed notes.
--
-- The requested reference values are represented as enums or CHECK constraints:
-- - product_type enum: paddy, rice, bran, broken_rice, husk
-- - paddy_source_type enum: government, private, farmer_custom, own_purchase, unknown
-- - document_type enum
-- - party_type enum
-- - expenses.expense_category CHECK: labour, transport, electricity, maintenance, other
--
-- No demo parties are seeded because party identity must be mill-specific and human-confirmed.



-- ============================================================
-- FILE: supabase/migrations/010_function_search_path_hardening.sql
-- ============================================================

-- Harden helper functions by pinning search_path for Supabase advisor compliance.

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function app_private.prevent_audit_log_changes()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  raise exception 'audit_logs are append-only';
end;
$$;



-- ============================================================
-- FILE: supabase/migrations/011_v1_document_extraction_updates.sql
-- ============================================================

-- V1 schema updates for Gemini extraction, document linking, and richer mill documents.

do $$
begin
  if not exists (
    select 1
    from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    where t.typname = 'document_type'
      and e.enumlabel = 'rough_notes'
  ) then
    alter type public.document_type add value 'rough_notes';
  end if;
end $$;

alter table public.extraction_runs
  add column if not exists model_provider text,
  add column if not exists model_name text,
  add column if not exists prompt_version text;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'extraction_runs' and column_name = 'provider'
  ) and exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'extraction_runs' and column_name = 'model'
  ) then
    execute 'update public.extraction_runs
      set model_provider = coalesce(model_provider, provider),
          model_name = coalesce(model_name, model)
      where model_provider is null or model_name is null';
  end if;
end $$;

create table if not exists public.document_links (
  id uuid primary key default gen_random_uuid(),
  mill_id uuid not null references public.mills(id),
  document_id uuid not null references public.documents(id),
  linked_entity_type text not null,
  linked_entity_id uuid not null,
  link_type text not null default 'evidence',
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles(id),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id),
  unique (mill_id, document_id, linked_entity_type, linked_entity_id, link_type)
);

drop trigger if exists set_document_links_updated_at on public.document_links;
create trigger set_document_links_updated_at
before update on public.document_links
for each row execute function public.set_updated_at();

alter table public.document_links enable row level security;
grant select, insert, update on public.document_links to authenticated;

drop policy if exists "members can read document links" on public.document_links;
create policy "members can read document links"
on public.document_links for select
to authenticated
using ((select app_private.is_mill_member(mill_id)));

drop policy if exists "operators can insert document links" on public.document_links;
create policy "operators can insert document links"
on public.document_links for insert
to authenticated
with check ((select app_private.has_mill_role(mill_id, array['owner', 'admin', 'manager', 'operator'])));

drop policy if exists "operators can update document links" on public.document_links;
create policy "operators can update document links"
on public.document_links for update
to authenticated
using ((select app_private.has_mill_role(mill_id, array['owner', 'admin', 'manager', 'operator'])))
with check ((select app_private.has_mill_role(mill_id, array['owner', 'admin', 'manager', 'operator'])));

create index if not exists idx_document_links_mill_id on public.document_links(mill_id);
create index if not exists idx_document_links_document_id on public.document_links(document_id);
create index if not exists idx_document_links_entity on public.document_links(mill_id, linked_entity_type, linked_entity_id);

alter table public.paddy_lots
  add column if not exists weighbridge_gross_weight numeric(14,3) check (weighbridge_gross_weight is null or weighbridge_gross_weight >= 0),
  add column if not exists weighbridge_tare_weight numeric(14,3) check (weighbridge_tare_weight is null or weighbridge_tare_weight >= 0),
  add column if not exists weighbridge_quantity_unit text check (weighbridge_quantity_unit is null or weighbridge_quantity_unit in ('kg', 'qtl', 'tonne')),
  add column if not exists moisture_source text,
  add column if not exists moisture_recorded_at timestamptz;

alter table public.byproduct_sales
  add column if not exists subtotal_amount numeric(14,2) check (subtotal_amount is null or subtotal_amount >= 0),
  add column if not exists gst_percent numeric(6,3) check (gst_percent is null or gst_percent >= 0),
  add column if not exists tax_amount numeric(14,2) check (tax_amount is null or tax_amount >= 0);

alter table public.byproduct_sales
  add column if not exists total_with_tax numeric(14,2) generated always as (
    case
      when quantity is not null and rate is not null then (quantity * rate) + coalesce(tax_amount, 0)
      when subtotal_amount is not null then subtotal_amount + coalesce(tax_amount, 0)
      else null
    end
  ) stored;

comment on table public.document_links is 'Manual links between source documents and business objects. Linking a document does not confirm extracted values.';
comment on column public.documents.document_type is 'Includes rough_notes; rough notes store candidate lines only and must not create ledger events automatically.';
comment on column public.extraction_runs.prompt_version is 'Prompt version used for AI extraction; needed for auditability and correction memory.';


-- ============================================================
-- FILE: supabase/storage-policies.sql
-- ============================================================

-- Supabase Storage setup for original business documents.
--
-- Bucket: documents
-- Path convention:
--   mills/{mill_id}/documents/{yyyy}/{mm}/{document_id}/{original_filename}
--
-- These policies intentionally allow read/upload for active mill members only.
-- They do not allow object UPDATE or DELETE because original source documents should
-- not be overwritten or hard-deleted in MVP v0.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'documents',
  'documents',
  false,
  52428800,
  array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/heic',
    'image/heif',
    'application/pdf',
    'audio/mpeg',
    'audio/mp4',
    'audio/wav',
    'audio/webm'
  ]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create or replace function app_private.storage_object_mill_id(object_name text)
returns uuid
language sql
stable
set search_path = storage, pg_temp
as $$
  select case
    when (storage.foldername(object_name))[1] = 'mills'
      and (storage.foldername(object_name))[2] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      and (storage.foldername(object_name))[3] = 'documents'
    then (storage.foldername(object_name))[2]::uuid
    else null
  end;
$$;

grant execute on function app_private.storage_object_mill_id(text) to authenticated;

drop policy if exists "active mill members can read document objects" on storage.objects;

create policy "active mill members can read document objects"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'documents'
  and app_private.storage_object_mill_id(name) is not null
  and (select app_private.is_mill_member(app_private.storage_object_mill_id(name)))
);

drop policy if exists "operators can upload document objects" on storage.objects;

create policy "operators can upload document objects"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'documents'
  and app_private.storage_object_mill_id(name) is not null
  and (select app_private.has_mill_role(
    app_private.storage_object_mill_id(name),
    array['owner', 'admin', 'manager', 'operator']
  ))
);

-- ============================================================
-- 012_single_mill_seed.sql
-- ============================================================

drop policy if exists "owners admins and first owner can insert mill members" on public.mill_members;
drop policy if exists "owners and admins can insert mill members" on public.mill_members;
create policy "owners and admins can insert mill members"
on public.mill_members for insert
to authenticated
with check ((select app_private.has_mill_role(mill_id, array['owner', 'admin'])));

insert into public.mills (id, name, location, metadata, status)
values (
  '11111111-1111-4111-8111-111111111111',
  'Rice Mill',
  null,
  '{"single_mill_operator_mode": "true"}'::jsonb,
  'active'
)
on conflict (id) do update
set
  name = excluded.name,
  status = 'active',
  metadata = coalesce(public.mills.metadata, '{}'::jsonb) || '{"single_mill_operator_mode": "true"}'::jsonb;

-- ============================================================
-- 013_correction_memory_operator_mode.sql
-- ============================================================

alter table public.correction_memory
  alter column user_id drop not null,
  alter column corrected_value drop not null;

comment on column public.correction_memory.user_id is 'Nullable for single-mill no-sign-in operator mode; created_by remains nullable audit actor.';
comment on column public.correction_memory.corrected_value is 'Nullable when the owner corrects an AI value to missing/unknown.';
