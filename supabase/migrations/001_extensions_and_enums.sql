-- MVP v0 foundation: extensions, schemas, enums, and shared triggers.

create extension if not exists pgcrypto;

create schema if not exists app_private;

create type public.field_status as enum (
  'missing',
  'draft',
  'ai_extracted',
  'needs_review',
  'user_confirmed',
  'system_calculated',
  'estimated',
  'disputed',
  'locked',
  'adjusted'
);

create type public.record_status as enum (
  'draft',
  'incomplete',
  'pending_confirmation',
  'confirmed',
  'reconciled',
  'disputed',
  'estimated',
  'locked',
  'exported',
  'cancelled',
  'adjusted'
);

create type public.job_status as enum (
  'queued',
  'running',
  'succeeded',
  'failed',
  'retrying',
  'cancelled'
);

create type public.alert_status as enum (
  'open',
  'snoozed',
  'resolved',
  'dismissed',
  'converted_to_task'
);

create type public.task_status as enum (
  'open',
  'in_progress',
  'completed',
  'snoozed',
  'not_applicable',
  'blocked'
);

create type public.source_type as enum (
  'voice',
  'manual',
  'document',
  'truck_sheet',
  'weighbridge_slip',
  'moisture_note',
  'government_app',
  'physical_count',
  'sale_bill',
  'expense_bill',
  'system_calculation',
  'adjustment_event',
  'import'
);

create type public.paddy_source_type as enum (
  'government',
  'private',
  'farmer_custom',
  'own_purchase',
  'unknown'
);

create type public.product_type as enum (
  'paddy',
  'rice',
  'bran',
  'broken_rice',
  'husk'
);

create type public.document_type as enum (
  'truck_sheet',
  'weighbridge_slip',
  'moisture_quality_note',
  'government_app_screenshot',
  'delivery_challan',
  'sale_bill',
  'byproduct_sale_bill',
  'transport_bill',
  'labour_note',
  'electricity_bill',
  'maintenance_bill',
  'license_compliance_document',
  'ca_accounting_document',
  'rough_notes',
  'unknown'
);

create type public.party_type as enum (
  'source_center',
  'farmer',
  'dealer',
  'vendor',
  'transporter',
  'worker_group',
  'ca',
  'government_office',
  'other'
);

create type public.member_role as enum (
  'owner',
  'manager',
  'operator',
  'accountant_ca',
  'family_helper',
  'readonly',
  'admin'
);

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
