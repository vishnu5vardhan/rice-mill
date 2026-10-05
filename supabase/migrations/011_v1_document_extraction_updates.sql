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
