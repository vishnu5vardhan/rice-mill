-- Single-mill seed for the current no-sign-in operator build.
--
-- This does not add anon write policies. The app must use a server-only
-- SUPABASE_SERVICE_ROLE_KEY when running without Supabase Auth.

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
