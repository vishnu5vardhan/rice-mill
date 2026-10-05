import type { DraftField, Json } from "@/lib/types";

export interface CorrectionMemoryInput {
  field: DraftField;
  correctedValue: Json;
  userId: string | null;
  millId: string;
  draftEntryId: string;
  documentId?: string | null;
  extractionRunId?: string | null;
}

export function jsonEqual(left: Json, right: Json) {
  return JSON.stringify(left ?? null) === JSON.stringify(right ?? null);
}

export function correctionTypeForField(fieldName: string) {
  if (fieldName === "truck_number") return "truck_number";
  if (fieldName === "truck_sheet_bag_count" || fieldName === "physical_bag_count") return "bag_count";
  if (fieldName === "document_type") return "document_type";
  if (fieldName.includes("party") || fieldName.includes("center")) return "party_mapping";
  return "field_value";
}

export function buildCorrectionMemoryRows(inputs: CorrectionMemoryInput[]) {
  return inputs
    .filter(({ field, correctedValue }) => {
      const aiStatus = field.status === "ai_extracted" || field.status === "needs_review";
      return aiStatus && !jsonEqual(field.value, correctedValue);
    })
    .map(({ field, correctedValue, userId, millId, draftEntryId, documentId, extractionRunId }) => ({
      mill_id: millId,
      user_id: userId,
      correction_type: correctionTypeForField(field.field_name),
      document_id: documentId ?? null,
      extraction_run_id: extractionRunId ?? null,
      draft_entry_id: draftEntryId,
      draft_entry_field_id: field.id ?? null,
      entity_type: "draft_entry",
      entity_id: draftEntryId,
      field_name: field.field_name,
      original_ai_value: field.value ?? null,
      corrected_value: correctedValue,
      confidence_before: field.confidence,
      reason: "Corrected during confirmation",
      status: "confirmed",
      created_by: userId,
      updated_by: userId
    }));
}
