import type { RecordStatus } from "@/lib/types";
import type { PaddyInwardPayload } from "@/lib/validation/schemas";
import { paddyHasHardMismatch } from "@/lib/reconciliation/mismatch";

export const paddyRequiredFields = [
  "arrival_date",
  "paddy_source_type",
  "source_party_name",
  "confirmed_quantity",
  "quantity_unit"
];

export function missingPaddyFields(payload: Partial<PaddyInwardPayload>) {
  return paddyRequiredFields.filter((field) => {
    const value = payload[field as keyof PaddyInwardPayload];
    return value === null || value === undefined || value === "";
  });
}

export function paddyRecordStatus(
  payload: Partial<PaddyInwardPayload>,
  options?: { bagWeightKg?: number | null }
): RecordStatus {
  // A hard mismatch (bag / government / weighbridge) is more severe than missing data:
  // dispute the lot and keep it out of confirmed stock until a human resolves it.
  if (paddyHasHardMismatch(payload, options)) return "disputed";
  if (missingPaddyFields(payload).length > 0) return "incomplete";
  return "confirmed";
}

export function paddyDataQualityScore(payload: Partial<PaddyInwardPayload>) {
  const fields = [
    payload.arrival_date,
    payload.paddy_source_type,
    payload.source_party_name,
    payload.truck_number,
    payload.truck_sheet_bag_count,
    payload.physical_bag_count,
    payload.confirmed_quantity,
    payload.quantity_unit,
    payload.moisture_percent
  ];
  const filled = fields.filter((value) => value !== null && value !== undefined && value !== "").length;
  return Math.round((filled / fields.length) * 100);
}

export function buildMissingFieldTasks(payload: Partial<PaddyInwardPayload>) {
  const missing = new Set([...missingPaddyFields(payload)]);

  if (payload.moisture_percent === null || payload.moisture_percent === undefined) {
    missing.add("moisture_percent");
  }

  return Array.from(missing).map((field) => ({
    task_type: "missing_data",
    title: titleForMissingField(field),
    description: "Complete this field so the entry has better evidence.",
    missing_field_name: field,
    priority: field === "confirmed_quantity" ? 1 : 3,
    linked_entity_type: "paddy_lot"
  }));
}

function titleForMissingField(field: string) {
  const labels: Record<string, string> = {
    arrival_date: "Add arrival date",
    paddy_source_type: "Add paddy source type",
    source_party_name: "Add source center or party",
    confirmed_quantity: "Add confirmed quantity",
    quantity_unit: "Add quantity unit",
    moisture_percent: "Add moisture reading"
  };

  return labels[field] ?? `Add ${field.replaceAll("_", " ")}`;
}
