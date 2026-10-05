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
