import { truckSheetExtractionSchema, type TruckSheetExtraction } from "@/lib/validation/schemas";

export function classifyDocumentStub(filename?: string | null, selectedType?: string | null) {
  if (selectedType && selectedType !== "unknown") {
    return { document_type: selectedType, confidence: 0.99 };
  }

  const normalized = (filename ?? "").toLowerCase();
  if (normalized.includes("truck") || normalized.includes("paddy")) {
    return { document_type: "truck_sheet", confidence: 0.72 };
  }
  if (normalized.includes("bran") || normalized.includes("sale")) {
    return { document_type: "byproduct_sale_bill", confidence: 0.65 };
  }
  return { document_type: "unknown", confidence: 0.45 };
}

export function extractTruckSheetStub(now = new Date()): TruckSheetExtraction {
  const today = now.toISOString().slice(0, 10);

  return truckSheetExtractionSchema.parse({
    document_type: "truck_sheet",
    arrival_date: today,
    paddy_source_type: "government",
    source_party_name: "Mallapur PPC",
    truck_number: "TS09 AB 1234",
    truck_sheet_bag_count: 460,
    physical_bag_count: null,
    confirmed_quantity: 460,
    quantity_unit: "bag",
    moisture_percent: null,
    notes: "Stub extraction. Owner must confirm before ledger update.",
    fields: [
      field("arrival_date", today, 0.82, true),
      field("paddy_source_type", "government", 0.78, true),
      field("source_party_name", "Mallapur PPC", 0.74, true),
      field("truck_number", "TS09 AB 1234", 0.62, false, true),
      field("truck_sheet_bag_count", 460, 0.7, false),
      field("physical_bag_count", null, null, false),
      field("confirmed_quantity", 460, 0.68, true),
      field("quantity_unit", "bag", 0.8, true),
      field("moisture_percent", null, null, false),
      field("notes", "Stub extraction. Owner must confirm before ledger update.", 0.5, false)
    ]
  });
}

export function parseVoiceEntryStub(text: string, now = new Date()) {
  return {
    draft_type: "paddy_inward",
    payload: {
      arrival_date: now.toISOString().slice(0, 10),
      paddy_source_type: "unknown",
      source_party_name: text.match(/[A-Z][a-z]+/)?.[0] ?? null,
      confirmed_quantity: Number(text.match(/\d+/)?.[0] ?? 0) || null,
      quantity_unit: text.toLowerCase().includes("bag") ? "bag" : null,
      moisture_percent: null,
      notes: text
    }
  };
}

function field(
  field_name: string,
  value: unknown,
  confidence: number | null,
  required: boolean,
  needs_review = false
) {
  return {
    field_name,
    value,
    confidence,
    required,
    needs_review,
    status: value === null ? "missing" : needs_review ? "needs_review" : "ai_extracted"
  };
}
