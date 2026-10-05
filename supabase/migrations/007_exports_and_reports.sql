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

