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
