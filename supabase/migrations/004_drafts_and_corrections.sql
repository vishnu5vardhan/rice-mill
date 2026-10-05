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

