export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type RecordStatus =
  | "draft"
  | "incomplete"
  | "pending_confirmation"
  | "confirmed"
  | "reconciled"
  | "disputed"
  | "estimated"
  | "locked"
  | "exported"
  | "cancelled"
  | "adjusted";

export type FieldStatus =
  | "missing"
  | "draft"
  | "ai_extracted"
  | "needs_review"
  | "user_confirmed"
  | "system_calculated"
  | "estimated"
  | "disputed"
  | "locked"
  | "adjusted";

export type SourceType =
  | "voice"
  | "manual"
  | "document"
  | "truck_sheet"
  | "weighbridge_slip"
  | "moisture_note"
  | "government_app"
  | "physical_count"
  | "sale_bill"
  | "expense_bill"
  | "system_calculation"
  | "adjustment_event"
  | "import";

export type ProductType = "paddy" | "rice" | "bran" | "broken_rice" | "husk";
export type PaddySourceType = "government" | "private" | "farmer_custom" | "own_purchase" | "unknown";

export type DraftType = "paddy_inward" | "byproduct_sale" | "expense" | "payment" | "document_only";

export interface DraftField {
  id?: string;
  field_name: string;
  value: Json;
  status: FieldStatus;
  confidence: number | null;
  required: boolean;
  needs_review: boolean;
  source_type: SourceType;
  source_id?: string | null;
  linked_document_id?: string | null;
}

export interface DraftEntry {
  id: string;
  mill_id: string;
  draft_type: DraftType;
  source_type: SourceType;
  source_id?: string | null;
  document_id?: string | null;
  input_capture_id?: string | null;
  extraction_run_id?: string | null;
  payload: Record<string, Json>;
  missing_fields: string[];
  status: RecordStatus;
  created_at?: string;
}

export interface ConfirmedDraftInput {
  draft: DraftEntry;
  fields: DraftField[];
  correctedValues: Record<string, Json>;
  actorId: string | null;
  bagWeightKg?: number | null;
}

export interface LedgerDecision {
  businessEvent: {
    event_type: string;
    event_date: string;
    payload: Record<string, Json>;
    status: RecordStatus;
    idempotency_key: string;
  };
  operation?: {
    table: "paddy_lots" | "byproduct_sales" | "expenses";
    payload: Record<string, Json>;
  };
  stockEvent?: {
    event_type: string;
    event_date: string;
    product_type: ProductType;
    paddy_source_type: PaddySourceType;
    direction: "in" | "out" | "adjustment";
    quantity_delta: number;
    quantity_unit: "kg" | "qtl" | "tonne" | "bag";
    related_entity_type?: string;
    related_entity_id?: string;
    payload: Record<string, Json>;
    status: RecordStatus;
    idempotency_key: string;
  };
  tasks: Array<{
    task_type: string;
    title: string;
    description?: string;
    missing_field_name?: string;
    priority: number;
    linked_entity_type?: string;
  }>;
  alerts: Array<{
    alert_type: string;
    title: string;
    message: string;
    severity: "low" | "medium" | "high" | "critical";
    evidence: Record<string, Json>;
    action_label?: string;
    action_url?: string;
  }>;
}
