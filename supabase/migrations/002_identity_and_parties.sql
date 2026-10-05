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
