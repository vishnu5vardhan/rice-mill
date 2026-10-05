-- Intelligence work queue, evidence-backed assistant logs, audit, and job failures.

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  mill_id uuid not null references public.mills(id),
  task_type text not null,
  title text not null check (length(trim(title)) > 0),
  description text,
  status public.task_status not null default 'open',
  priority smallint not null default 3 check (priority between 1 and 5),
  due_at timestamptz,
  snoozed_until timestamptz,
  linked_entity_type text,
  linked_entity_id uuid,
  missing_field_name text,
  assigned_to uuid references public.profiles(id),
  source_type public.source_type,
  source_id uuid,
  completed_by uuid references public.profiles(id),
  completed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles(id),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id)
);

create trigger set_tasks_updated_at
before update on public.tasks
for each row execute function public.set_updated_at();

create table public.alerts (
  id uuid primary key default gen_random_uuid(),
  mill_id uuid not null references public.mills(id),
  alert_type text not null,
  title text not null check (length(trim(title)) > 0),
  message text not null check (length(trim(message)) > 0),
  status public.alert_status not null default 'open',
  severity text not null default 'medium'
    check (severity in ('low', 'medium', 'high', 'critical')),
  linked_entity_type text,
  linked_entity_id uuid,
  task_id uuid references public.tasks(id),
  evidence jsonb not null default '{}'::jsonb,
  action_label text,
  action_url text,
  snoozed_until timestamptz,
  resolved_by uuid references public.profiles(id),
  resolved_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles(id),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id)
);

create trigger set_alerts_updated_at
before update on public.alerts
for each row execute function public.set_updated_at();

create table public.assistant_queries (
  id uuid primary key default gen_random_uuid(),
  mill_id uuid not null references public.mills(id),
  asked_by uuid references public.profiles(id),
  input_capture_id uuid references public.input_captures(id),
  question text not null,
  interpreted_intent text,
  answer text,
  confidence text check (confidence is null or confidence in ('low', 'medium', 'high')),
  evidence jsonb not null default '{}'::jsonb,
  missing_data jsonb not null default '[]'::jsonb,
  status public.job_status not null default 'succeeded',
  error text,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles(id),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id)
);

create trigger set_assistant_queries_updated_at
before update on public.assistant_queries
for each row execute function public.set_updated_at();

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  mill_id uuid not null references public.mills(id),
  actor_id uuid references public.profiles(id),
  action text not null,
  entity_type text not null,
  entity_id uuid,
  before_value jsonb,
  after_value jsonb,
  source_type public.source_type,
  source_id uuid,
  request_id text,
  ip_address inet,
  user_agent text,
  created_at timestamptz not null default now()
);

create table public.failed_jobs (
  id uuid primary key default gen_random_uuid(),
  mill_id uuid references public.mills(id),
  job_type text not null,
  status public.job_status not null default 'failed',
  payload jsonb not null default '{}'::jsonb,
  error text not null,
  attempts integer not null default 0 check (attempts >= 0),
  max_attempts integer not null default 3 check (max_attempts >= 1),
  next_retry_at timestamptz,
  related_entity_type text,
  related_entity_id uuid,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles(id),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id)
);

create trigger set_failed_jobs_updated_at
before update on public.failed_jobs
for each row execute function public.set_updated_at();

create or replace function app_private.prevent_audit_log_changes()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  raise exception 'audit_logs are append-only';
end;
$$;

create trigger prevent_audit_log_updates
before update or delete on public.audit_logs
for each row execute function app_private.prevent_audit_log_changes();

create index idx_tasks_mill_id on public.tasks(mill_id);
create index idx_tasks_created_at on public.tasks(mill_id, created_at desc);
create index idx_tasks_status_task_type on public.tasks(mill_id, status, task_type);
create index idx_tasks_linked_entity on public.tasks(mill_id, linked_entity_type, linked_entity_id);
create index idx_tasks_assigned_to on public.tasks(assigned_to);

create index idx_alerts_mill_id on public.alerts(mill_id);
create index idx_alerts_created_at on public.alerts(mill_id, created_at desc);
create index idx_alerts_status_alert_type on public.alerts(mill_id, status, alert_type);
create index idx_alerts_linked_entity on public.alerts(mill_id, linked_entity_type, linked_entity_id);

create index idx_assistant_queries_mill_id on public.assistant_queries(mill_id);
create index idx_assistant_queries_created_at on public.assistant_queries(mill_id, created_at desc);
create index idx_assistant_queries_asked_by on public.assistant_queries(asked_by);

create index idx_audit_logs_mill_id on public.audit_logs(mill_id);
create index idx_audit_logs_created_at on public.audit_logs(mill_id, created_at desc);
create index idx_audit_logs_entity on public.audit_logs(mill_id, entity_type, entity_id);
create index idx_audit_logs_actor_id on public.audit_logs(actor_id);

create index idx_failed_jobs_mill_id on public.failed_jobs(mill_id);
create index idx_failed_jobs_created_at on public.failed_jobs(created_at desc);
create index idx_failed_jobs_status on public.failed_jobs(status);
create index idx_failed_jobs_next_retry_at on public.failed_jobs(next_retry_at)
  where status in ('failed', 'retrying');
