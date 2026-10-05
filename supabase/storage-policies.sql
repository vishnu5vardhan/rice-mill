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
