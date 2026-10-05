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

