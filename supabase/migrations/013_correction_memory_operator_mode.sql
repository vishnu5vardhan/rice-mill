-- Correction memory must work in no-sign-in operator mode and when an owner clears
-- an AI value as missing during confirmation.

alter table public.correction_memory
  alter column user_id drop not null,
  alter column corrected_value drop not null;

comment on column public.correction_memory.user_id is 'Nullable for single-mill no-sign-in operator mode; created_by remains nullable audit actor.';
comment on column public.correction_memory.corrected_value is 'Nullable when the owner corrects an AI value to missing/unknown.';
