import { Buffer } from "node:buffer";
import { z } from "zod";
import type { DraftType, FieldStatus, Json, PaddySourceType, SourceType } from "@/lib/types";
import { byproductAliasPromptLine, inferByproductProduct } from "@/lib/byproducts/aliases";
import {
  byproductSaleExtractionSchema,
  documentTypeSchema,
  expenseExtractionSchema,
  paddySourceTypeSchema,
  roughNotesExtractionSchema,
  truckSheetExtractionSchema,
  weighbridgeExtractionSchema,
  type ByproductSaleExtraction,
  type ExpenseExtraction,
  type RoughNotesExtraction,
  type WeighbridgeExtraction,
  type TruckSheetExtraction
} from "@/lib/validation/schemas";

export const GEMINI_PROVIDER = "google-gemini";
export const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-3.5-flash";

type DocumentType = z.infer<typeof documentTypeSchema>;

export type GeminiValidatedExtraction = {
  documentType: DocumentType;
  documentTypeConfidence: number | null;
  draftType: DraftType | null;
  sourceType: SourceType;
  extraction: TruckSheetExtraction | ByproductSaleExtraction | ExpenseExtraction | WeighbridgeExtraction | RoughNotesExtraction | null;
  missingFields: string[];
  ambiguousFields: string[];
  suggestedNextAction: string;
  raw: Json;
};

const rawGeminiExtractionSchema = z.object({
  document_type: documentTypeSchema.catch("unknown"),
  document_type_confidence: z.number().min(0).max(1).nullable().optional(),
  confidence: z.number().min(0).max(1).nullable().optional(),
  missing_fields: z.array(z.string()).optional(),
  ambiguous_fields: z.array(z.string()).optional(),
  suggested_next_action: z.string().nullable().optional()
}).passthrough();

export function hasGeminiConfig() {
  return Boolean(geminiApiKey());
}

export async function extractDocumentWithGemini(input: {
  fileBuffer: Buffer;
  mimeType: string;
  selectedDocumentType?: string | null;
  businessContext?: string | null;
}) {
  const apiKey = geminiApiKey();
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is missing. Add it to the deployment environment before running image extraction.");
  }

  const buffer = input.fileBuffer;
  const mimeType = input.mimeType || "image/jpeg";
  const body = {
    contents: [
      {
        role: "user",
        parts: [
          { text: buildExtractionPrompt(input.selectedDocumentType, input.businessContext) },
          {
            inlineData: {
              mimeType,
              data: buffer.toString("base64")
            }
          }
        ]
      }
    ],
    generationConfig: {
      temperature: 0,
      responseMimeType: "application/json",
      // Extraction is OCR, not reasoning. Thinking adds latency and — on large images —
      // makes the model truncate its JSON output, which fails the parse entirely.
      thinkingConfig: { thinkingBudget: 0 }
    }
  };

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    }
  );

  const rawResponse = (await response.json().catch(() => ({}))) as Json;
  if (!response.ok) {
    throw new Error(`Gemini extraction failed: ${response.status} ${response.statusText}`);
  }

  const text = extractCandidateText(rawResponse);
  const rawJson = parseModelJson(text);
  const validated = normalizeGeminiExtraction(rawJson, input.selectedDocumentType);

  return { rawResponse, rawJson, validated, model: GEMINI_MODEL, provider: GEMINI_PROVIDER };
}

export function normalizeGeminiExtraction(rawInput: unknown, selectedDocumentType?: string | null): GeminiValidatedExtraction {
  const raw = asRecord(rawInput);
  const base = rawGeminiExtractionSchema.parse(raw);
  const hint = documentTypeSchema.safeParse(selectedDocumentType).success
    ? documentTypeSchema.parse(selectedDocumentType)
    : "unknown";
  const documentType = base.document_type === "unknown" && hint !== "unknown" ? hint : base.document_type;
  const documentTypeConfidence = base.document_type_confidence ?? base.confidence ?? null;
  const missingFields = arrayOfStrings(base.missing_fields);
  const ambiguousFields = arrayOfStrings(base.ambiguous_fields);
  const suggestedNextAction = base.suggested_next_action ?? "Review extracted fields before confirming.";

  if (documentType === "truck_sheet") {
    const extraction = buildTruckSheetExtraction(raw, documentType, missingFields, ambiguousFields);
    return {
      documentType,
      documentTypeConfidence,
      draftType: "paddy_inward",
      sourceType: "truck_sheet",
      extraction,
      missingFields,
      ambiguousFields,
      suggestedNextAction,
      raw: toJson(raw)
    };
  }

  if (documentType === "byproduct_sale_bill" || documentType === "sale_bill") {
    const extraction = buildByproductSaleExtraction(raw, documentType, missingFields, ambiguousFields);
    return {
      documentType,
      documentTypeConfidence,
      draftType: "byproduct_sale",
      sourceType: "sale_bill",
      extraction,
      missingFields,
      ambiguousFields,
      suggestedNextAction,
      raw: toJson(raw)
    };
  }

  if (documentType === "weighbridge_slip") {
    const extraction = buildWeighbridgeExtraction(raw, missingFields, ambiguousFields);
    return {
      documentType,
      documentTypeConfidence,
      draftType: null,
      sourceType: "weighbridge_slip",
      extraction,
      missingFields,
      ambiguousFields,
      suggestedNextAction: suggestedNextAction || "Link this weighbridge slip to a paddy lot after review.",
      raw: toJson(raw)
    };
  }

  if (documentType === "rough_notes") {
    const extraction = buildRoughNotesExtraction(raw, missingFields, ambiguousFields, suggestedNextAction);
    return {
      documentType,
      documentTypeConfidence,
      draftType: null,
      sourceType: "document",
      extraction,
      missingFields,
      ambiguousFields,
      suggestedNextAction: "Review rough note candidate lines manually. Rough notes do not create ledger drafts automatically.",
      raw: toJson(raw)
    };
  }

  if (["transport_bill", "labour_note", "electricity_bill", "maintenance_bill"].includes(documentType)) {
    const extraction = buildExpenseExtraction(raw, documentType, missingFields, ambiguousFields);
    return {
      documentType,
      documentTypeConfidence,
      draftType: "expense",
      sourceType: "expense_bill",
      extraction,
      missingFields,
      ambiguousFields,
      suggestedNextAction,
      raw: toJson(raw)
    };
  }

  return {
    documentType,
    documentTypeConfidence,
    draftType: null,
    sourceType: "document",
    extraction: null,
    missingFields,
    ambiguousFields,
    suggestedNextAction,
    raw: toJson(raw)
  };
}

function buildTruckSheetExtraction(
  raw: Record<string, unknown>,
  documentType: DocumentType,
  missingFields: string[],
  ambiguousFields: string[]
) {
  const payload = {
    document_type: documentType,
    arrival_date: dateValue(raw, ["arrival_date", "date", "truck_date"]),
    paddy_source_type: paddySourceValue(raw, ["paddy_source_type", "source_type"]),
    source_party_name: stringValue(raw, ["source_party_name", "source_center", "center", "party", "party_name", "village"]),
    truck_number: stringValue(raw, ["truck_number", "lorry_number", "vehicle_number"]),
    truck_sheet_bag_count: numberValue(raw, ["truck_sheet_bag_count", "bag_count", "bags", "no_of_bags"]),
    physical_bag_count: numberValue(raw, ["physical_bag_count", "actual_bag_count", "actual_count"]),
    confirmed_quantity: numberValue(raw, ["confirmed_quantity", "quantity", "truck_sheet_bag_count", "bag_count", "bags"]),
    quantity_unit: unitValue(raw, ["quantity_unit", "unit"], ["bag", "kg", "qtl", "tonne"]),
    moisture_percent: numberValue(raw, ["moisture_percent", "moisture"]),
    notes: stringValue(raw, ["notes", "remarks"])
  };

  return truckSheetExtractionSchema.parse({
    ...payload,
    fields: buildFields(payload, {
      required: ["arrival_date", "paddy_source_type", "source_party_name", "confirmed_quantity", "quantity_unit"],
      missingFields,
      ambiguousFields,
      rawFields: raw.fields
    })
  });
}

function buildByproductSaleExtraction(
  raw: Record<string, unknown>,
  documentType: "byproduct_sale_bill" | "sale_bill",
  missingFields: string[],
  ambiguousFields: string[]
) {
  const quantity = numberValue(raw, ["quantity", "qty", "weight"]);
  const subtotal = numberValue(raw, ["subtotal_amount", "subtotal", "taxable_amount"]);
  const total = numberValue(raw, ["total_amount", "total", "bill_amount", "amount"]);
  const rate = numberValue(raw, ["rate", "price", "rate_per_unit"]) ?? deriveRate(quantity, subtotal ?? total);
  const taxAmount = numberValue(raw, ["tax_amount", "gst_amount", "cgst_amount", "sgst_amount"]);
  const payload = {
    document_type: documentType,
    sale_date: dateValue(raw, ["sale_date", "bill_date", "date"]),
    dealer_name: stringValue(raw, ["dealer_name", "buyer", "party", "party_name"]),
    product_type: productValue(raw, ["product_type", "product", "item"]),
    paddy_source_type: paddySourceValue(raw, ["paddy_source_type", "source_type"]),
    quantity,
    quantity_unit: unitValue(raw, ["quantity_unit", "unit"], ["kg", "qtl", "tonne"]),
    rate,
    subtotal_amount: subtotal,
    gst_percent: numberValue(raw, ["gst_percent", "gst_rate", "tax_percent"]),
    tax_amount: taxAmount,
    total_amount: total,
    payment_status: paymentStatusValue(raw, ["payment_status"]),
    notes: stringValue(raw, ["notes", "remarks"])
  };

  return byproductSaleExtractionSchema.parse({
    ...payload,
    fields: buildFields(payload, {
      required: ["sale_date", "product_type", "quantity", "quantity_unit", "rate"],
      missingFields,
      ambiguousFields,
      rawFields: raw.fields
    })
  });
}

function buildWeighbridgeExtraction(raw: Record<string, unknown>, missingFields: string[], ambiguousFields: string[]) {
  const gross = numberValue(raw, ["gross_weight", "gross"]);
  const tare = numberValue(raw, ["tare_weight", "tare"]);
  const explicitNet = numberValue(raw, ["net_weight", "net", "weighbridge_net_weight"]);
  const payload = {
    document_type: "weighbridge_slip" as const,
    weighbridge_date: dateValue(raw, ["weighbridge_date", "date", "slip_date"]),
    party_name: stringValue(raw, ["party_name", "source_party_name", "center", "customer"]),
    truck_number: stringValue(raw, ["truck_number", "lorry_number", "vehicle_number"]),
    gross_weight: gross,
    tare_weight: tare,
    net_weight: explicitNet ?? (gross !== null && tare !== null && gross >= tare ? gross - tare : null),
    quantity_unit: unitValue(raw, ["quantity_unit", "weight_unit", "unit"], ["kg", "qtl", "tonne"]),
    notes: stringValue(raw, ["notes", "remarks"])
  };

  return weighbridgeExtractionSchema.parse({
    ...payload,
    fields: buildFields(payload, {
      required: ["weighbridge_date", "truck_number", "net_weight", "quantity_unit"],
      missingFields,
      ambiguousFields,
      rawFields: raw.fields
    })
  });
}

function buildRoughNotesExtraction(
  raw: Record<string, unknown>,
  missingFields: string[],
  ambiguousFields: string[],
  suggestedNextAction: string
) {
  const rawLines = Array.isArray(raw.candidate_lines) ? raw.candidate_lines : Array.isArray(raw.lines) ? raw.lines : [];
  const candidateLines = rawLines
    .map((line) => {
      if (typeof line === "string") {
        return { line_text: line, possible_entry_type: "unknown", confidence: null, needs_review: true };
      }
      const record = asRecord(line);
      return {
        line_text: stringValue(record, ["line_text", "text", "raw_text"]) ?? "",
        possible_entry_type: entryTypeValue(record),
        confidence: typeof record.confidence === "number" ? record.confidence : null,
        needs_review: record.needs_review !== false
      };
    })
    .filter((line) => line.line_text.trim().length > 0);

  return roughNotesExtractionSchema.parse({
    document_type: "rough_notes",
    candidate_lines: candidateLines,
    missing_fields: missingFields,
    ambiguous_fields: ambiguousFields,
    suggested_next_action: suggestedNextAction || "Review candidate lines manually.",
    fields: candidateLines.map((line, index) => ({
      field_name: `candidate_line_${index + 1}`,
      value: line.line_text,
      confidence: line.confidence,
      status: "needs_review",
      required: false,
      needs_review: true
    }))
  });
}

function buildExpenseExtraction(
  raw: Record<string, unknown>,
  documentType: DocumentType,
  missingFields: string[],
  ambiguousFields: string[]
) {
  const inferredCategory = documentType === "labour_note"
    ? "labour"
    : documentType === "transport_bill"
      ? "transport"
      : documentType === "electricity_bill"
        ? "electricity"
        : documentType === "maintenance_bill"
          ? "maintenance"
          : null;
  const payload = {
    document_type: documentType,
    expense_date: dateValue(raw, ["expense_date", "bill_date", "date"]),
    expense_category: expenseCategoryValue(raw, ["expense_category", "category"], inferredCategory),
    vendor_name: stringValue(raw, ["vendor_name", "party", "party_name", "supplier"]),
    amount: numberValue(raw, ["amount", "total_amount", "total", "bill_amount"]),
    currency: stringValue(raw, ["currency"]) ?? "INR",
    notes: stringValue(raw, ["notes", "remarks"])
  };

  return expenseExtractionSchema.parse({
    ...payload,
    fields: buildFields(payload, {
      required: ["expense_date", "expense_category", "amount"],
      missingFields,
      ambiguousFields,
      rawFields: raw.fields
    })
  });
}

function buildFields(
  payload: Record<string, unknown>,
  input: { required: string[]; missingFields: string[]; ambiguousFields: string[]; rawFields: unknown }
) {
  const rawFields = fieldMetadata(input.rawFields);
  const explicitMissing = new Set(input.missingFields);
  const ambiguous = new Set(input.ambiguousFields);

  return Object.entries(payload)
    .filter(([fieldName]) => fieldName !== "document_type")
    .map(([fieldName, value]) => {
      const metadata = rawFields.get(fieldName);
      const confidence = metadata?.confidence ?? (value === null ? null : 0.7);
      const needsReview = Boolean(metadata?.needs_review || ambiguous.has(fieldName) || (confidence !== null && confidence < 0.7));
      const status: FieldStatus = value === null || explicitMissing.has(fieldName)
        ? "missing"
        : needsReview
          ? "needs_review"
          : "ai_extracted";

      return {
        field_name: fieldName,
        value: toJson(value),
        confidence,
        required: input.required.includes(fieldName),
        needs_review: needsReview,
        status
      };
    });
}

function buildExtractionPrompt(selectedDocumentType?: string | null, businessContext?: string | null) {
  const typeHint = selectedDocumentType && selectedDocumentType !== "unknown" ? selectedDocumentType : "unknown";
  const contextBlock = businessContext && businessContext.trim() ? `\n\n${businessContext.trim()}\n` : "";
  return `You extract rice mill operating documents into JSON only.${contextBlock}

Rules:
- AI creates draft evidence only. Do not guess unreadable handwriting as truth.
- Use null for missing or unreadable values.
- Mark low-confidence or ambiguous fields in ambiguous_fields and use confidence below 0.70.
- Dates must be YYYY-MM-DD. If year is missing, use null and mention it in ambiguous_fields.
- Quantities and rates must be numbers without commas or units.
- For rough_notes, read rotated/sideways images if possible. Preserve each visible row as a candidate line.
- For rough_notes with amount/name columns, pair the left amount with the nearest party/name on the same row, for example "20000 - Arwah".
- For rough_notes, do not drop standalone amounts, names, dates, or short labels. If pairing is uncertain, keep the raw visible text in separate candidate lines and mark needs_review true.
- Telangana rice mill by-product slang aliases: ${byproductAliasPromptLine()}. Use these to infer product_type when handwriting uses local words.
- Document types must be one of: truck_sheet, weighbridge_slip, moisture_quality_note, government_app_screenshot, delivery_challan, sale_bill, byproduct_sale_bill, transport_bill, labour_note, electricity_bill, maintenance_bill, license_compliance_document, ca_accounting_document, rough_notes, unknown.
- Paddy source type must be government, private, farmer_custom, own_purchase, or unknown.
- By-product product_type must be bran, broken_rice, or husk.

Selected type hint from user: ${typeHint}.

Return this JSON shape:
{
  "document_type": "truck_sheet|byproduct_sale_bill|transport_bill|...|unknown",
  "document_type_confidence": 0.0,
  "arrival_date": "YYYY-MM-DD or null",
  "paddy_source_type": "government|private|farmer_custom|own_purchase|unknown",
  "source_party_name": "center/party/village or null",
  "truck_number": "vehicle number or null",
  "truck_sheet_bag_count": 0,
  "physical_bag_count": null,
  "confirmed_quantity": 0,
  "quantity_unit": "bag|kg|qtl|tonne|null",
  "moisture_percent": null,
  "sale_date": "YYYY-MM-DD or null",
  "dealer_name": "dealer or null",
  "product_type": "bran|broken_rice|husk|null",
  "quantity": 0,
  "rate": 0,
  "subtotal_amount": 0,
  "gst_percent": 0,
  "tax_amount": 0,
  "total_amount": 0,
  "payment_status": "pending|partial|paid|cancelled",
  "weighbridge_date": "YYYY-MM-DD or null",
  "gross_weight": 0,
  "tare_weight": 0,
  "net_weight": 0,
  "expense_date": "YYYY-MM-DD or null",
  "expense_category": "labour|transport|electricity|maintenance|other|null",
  "vendor_name": "vendor or null",
  "amount": 0,
  "currency": "INR",
  "candidate_lines": [{ "line_text": "raw note line", "possible_entry_type": "paddy_inward|byproduct_sale|expense|payment|unknown", "confidence": 0.0, "needs_review": true }],
  "notes": "short evidence notes",
  "fields": [{ "field_name": "field", "confidence": 0.0, "needs_review": false }],
  "missing_fields": ["field"],
  "ambiguous_fields": ["field"],
  "suggested_next_action": "owner-friendly next action"
}`;
}

function geminiApiKey() {
  return process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;
}

function extractCandidateText(raw: Json) {
  const candidates = asRecord(raw).candidates;
  if (!Array.isArray(candidates)) return "";
  return candidates
    .flatMap((candidate) => {
      const content = asRecord(candidate).content;
      const parts = asRecord(content).parts;
      return Array.isArray(parts) ? parts.map((part) => asRecord(part).text).filter((text): text is string => typeof text === "string") : [];
    })
    .join("\n");
}

function parseModelJson(text: string) {
  const trimmed = text.trim().replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
  if (!trimmed) throw new Error("Gemini returned no JSON text.");

  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    // Safety net: pull out the first balanced JSON object/array if the model wrapped it
    // in stray prose. (Genuine truncation can't be recovered — that's why thinking is off.)
    const candidate = extractBalancedJson(trimmed);
    if (candidate) return JSON.parse(candidate) as unknown;
    throw new Error("Gemini returned malformed JSON that could not be parsed.");
  }
}

function extractBalancedJson(text: string) {
  const start = text.search(/[[{]/);
  if (start < 0) return null;
  const open = text[start];
  const close = open === "{" ? "}" : "]";
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < text.length; i++) {
    const char = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') inString = true;
    else if (char === open) depth++;
    else if (char === close) {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function firstValue(raw: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    if (raw[key] !== undefined) return raw[key];
  }
  return null;
}

function stringValue(raw: Record<string, unknown>, keys: string[]) {
  const value = firstValue(raw, keys);
  if (typeof value === "string") return value.trim() || null;
  if (typeof value === "number") return String(value);
  return null;
}

function numberValue(raw: Record<string, unknown>, keys: string[]) {
  const value = firstValue(raw, keys);
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") {
    const parsed = Number(value.replace(/,/g, "").match(/-?\d+(\.\d+)?/)?.[0]);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function dateValue(raw: Record<string, unknown>, keys: string[]) {
  const value = stringValue(raw, keys);
  if (!value) return null;
  const iso = value.match(/\d{4}-\d{2}-\d{2}/)?.[0];
  if (iso) return iso;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
}

function paddySourceValue(raw: Record<string, unknown>, keys: string[]): PaddySourceType {
  const value = stringValue(raw, keys)?.toLowerCase().replace(/[\s-]+/g, "_");
  if (!value) return "unknown";
  if (paddySourceTypeSchema.safeParse(value).success) return value as PaddySourceType;
  if (value.includes("gov") || value.includes("ikp") || value.includes("ppc") || value.includes("opms")) return "government";
  if (value.includes("farmer") || value.includes("custom")) return "farmer_custom";
  if (value.includes("own")) return "own_purchase";
  if (value.includes("private")) return "private";
  return "unknown";
}

function unitValue<T extends readonly string[]>(raw: Record<string, unknown>, keys: string[], allowed: T): T[number] | null {
  const value = stringValue(raw, keys)?.toLowerCase().replace(/[\s.]+/g, "");
  if (!value) return null;
  if (allowed.includes(value as T[number])) return value as T[number];
  if (value.includes("bag")) return allowed.includes("bag" as T[number]) ? "bag" : null;
  if (value.includes("kg")) return "kg";
  if (value.includes("qtl") || value.includes("quintal")) return "qtl";
  if (value.includes("ton")) return "tonne";
  return null;
}

function productValue(raw: Record<string, unknown>, keys: string[]) {
  const rawValue = stringValue(raw, keys);
  const aliased = inferByproductProduct(rawValue);
  if (aliased) return aliased;

  const value = rawValue?.toLowerCase().replace(/[\s-]+/g, "_");
  if (!value) return null;
  if (value.includes("broken")) return "broken_rice";
  if (value.includes("bran")) return "bran";
  if (value.includes("husk")) return "husk";
  return null;
}

function entryTypeValue(raw: Record<string, unknown>) {
  const value = stringValue(raw, ["possible_entry_type", "entry_type", "type"])?.toLowerCase().replace(/[\s-]+/g, "_");
  if (value === "paddy_inward" || value === "byproduct_sale" || value === "expense" || value === "payment") return value;
  return "unknown";
}

function deriveRate(quantity: number | null, total: number | null) {
  if (!quantity || !total) return null;
  return Math.round((total / quantity) * 100) / 100;
}

function paymentStatusValue(raw: Record<string, unknown>, keys: string[]) {
  const value = stringValue(raw, keys)?.toLowerCase();
  if (!value) return "pending";
  if (value.includes("paid")) return "paid";
  if (value.includes("partial")) return "partial";
  if (value.includes("cancel")) return "cancelled";
  return "pending";
}

function expenseCategoryValue(raw: Record<string, unknown>, keys: string[], fallback: string | null) {
  const value = stringValue(raw, keys)?.toLowerCase();
  if (!value) return fallback;
  if (value.includes("labour") || value.includes("labor")) return "labour";
  if (value.includes("transport") || value.includes("truck")) return "transport";
  if (value.includes("electric")) return "electricity";
  if (value.includes("maintenance") || value.includes("repair")) return "maintenance";
  return "other";
}

function fieldMetadata(value: unknown) {
  const rows = Array.isArray(value) ? value : [];
  const map = new Map<string, { confidence: number | null; needs_review: boolean }>();
  for (const row of rows) {
    const record = asRecord(row);
    const fieldName = typeof record.field_name === "string" ? record.field_name : null;
    if (!fieldName) continue;
    const confidence = typeof record.confidence === "number" ? Math.max(0, Math.min(1, record.confidence)) : null;
    map.set(fieldName, { confidence, needs_review: record.needs_review === true });
  }
  return map;
}

function arrayOfStrings(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function toJson(value: unknown): Json {
  return JSON.parse(JSON.stringify(value ?? null)) as Json;
}
