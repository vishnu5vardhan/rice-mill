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
