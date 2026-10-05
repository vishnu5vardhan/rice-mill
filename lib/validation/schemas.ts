import { z } from "zod";
import { normalizeDateString } from "@/lib/validation/date";

const isoDateString = z.string().date();

const nullableNumber = z.preprocess((value) => {
  if (value === "" || value === null || value === undefined) return null;
  if (typeof value === "string") {
    const normalized = value.replace(/,/g, "").trim();
    if (!normalized) return null;
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : value;
  }
  return value;
}, z.number().nullable());

const nullableNonnegativeNumber = nullableNumber.refine((value) => value === null || value >= 0, {
  message: "Expected a non-negative number"
});

const nullableDateString = z.preprocess((value) => {
  const normalized = normalizeDateString(value);
  return typeof normalized === "string" && isoDateString.safeParse(normalized).success ? normalized : null;
}, isoDateString.nullable());

const confidenceNumber = z.preprocess((value) => {
  if (value === "" || value === null || value === undefined) return null;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : value;
  }
  return value;
}, z.number().min(0).max(1).nullable());

const emptyToUndefined = (value: unknown) => (value === null || value === "" || value === undefined ? undefined : value);

export const documentTypeSchema = z.enum([
  "truck_sheet",
  "weighbridge_slip",
  "moisture_quality_note",
  "government_app_screenshot",
  "delivery_challan",
  "sale_bill",
  "byproduct_sale_bill",
  "transport_bill",
  "labour_note",
  "electricity_bill",
  "maintenance_bill",
  "license_compliance_document",
  "ca_accounting_document",
  "rough_notes",
  "unknown"
]);

export const paddySourceTypeSchema = z.enum([
  "government",
  "private",
  "farmer_custom",
  "own_purchase",
  "unknown"
]);

export const productTypeSchema = z.enum(["paddy", "rice", "bran", "broken_rice", "husk"]);

export const draftTypeSchema = z.enum(["paddy_inward", "byproduct_sale", "expense", "payment", "document_only"]);

const defaultPaddySourceType = z.preprocess(emptyToUndefined, paddySourceTypeSchema.default("unknown"));
const defaultByproductQuantityUnit = z.preprocess(emptyToUndefined, z.enum(["kg", "qtl", "tonne"]).default("qtl"));
const defaultPaymentStatus = z.preprocess(emptyToUndefined, z.enum(["pending", "partial", "paid", "cancelled"]).default("pending"));
const defaultCurrency = z.preprocess(emptyToUndefined, z.string().default("INR"));

export const draftFieldSchema = z.object({
  field_name: z.string().min(1),
  value: z.unknown().nullable(),
  confidence: confidenceNumber.default(null),
  status: z.enum([
    "missing",
    "draft",
    "ai_extracted",
    "needs_review",
    "user_confirmed",
    "system_calculated",
    "estimated",
    "disputed",
    "locked",
    "adjusted"
  ]),
  required: z.boolean().default(false),
  needs_review: z.boolean().default(false)
});

export const truckSheetExtractionSchema = z.object({
  document_type: z.literal("truck_sheet"),
  arrival_date: nullableDateString,
  paddy_source_type: defaultPaddySourceType,
  source_party_name: z.string().nullable(),
  truck_number: z.string().nullable(),
  truck_sheet_bag_count: nullableNonnegativeNumber,
  physical_bag_count: nullableNonnegativeNumber,
  confirmed_quantity: nullableNonnegativeNumber,
  quantity_unit: z.enum(["bag", "kg", "qtl", "tonne"]).nullable(),
  moisture_percent: nullableNumber.refine((value) => value === null || (value >= 0 && value <= 100), {
    message: "Expected moisture percent between 0 and 100"
  }),
  notes: z.string().nullable(),
  fields: z.array(draftFieldSchema)
});

export const byproductSaleExtractionSchema = z.object({
  document_type: z.enum(["byproduct_sale_bill", "sale_bill"]),
  sale_date: nullableDateString,
  dealer_name: z.string().nullable(),
  product_type: z.enum(["bran", "broken_rice", "husk"]).nullable(),
  paddy_source_type: defaultPaddySourceType,
  quantity: nullableNonnegativeNumber,
  quantity_unit: z.enum(["kg", "qtl", "tonne"]).nullable(),
  rate: nullableNonnegativeNumber,
  subtotal_amount: nullableNonnegativeNumber.optional(),
  gst_percent: nullableNumber.optional(),
  tax_amount: nullableNonnegativeNumber.optional(),
  total_amount: nullableNonnegativeNumber.optional(),
  payment_status: defaultPaymentStatus,
  notes: z.string().nullable(),
  fields: z.array(draftFieldSchema)
});

export const weighbridgeExtractionSchema = z.object({
  document_type: z.literal("weighbridge_slip"),
  weighbridge_date: nullableDateString,
  party_name: z.string().nullable(),
  truck_number: z.string().nullable(),
  gross_weight: nullableNonnegativeNumber,
  tare_weight: nullableNonnegativeNumber,
  net_weight: nullableNonnegativeNumber,
  quantity_unit: z.enum(["kg", "qtl", "tonne"]).nullable(),
  notes: z.string().nullable(),
  fields: z.array(draftFieldSchema)
});

export const roughNotesExtractionSchema = z.object({
  document_type: z.literal("rough_notes"),
  candidate_lines: z.array(z.object({
    line_text: z.string(),
    possible_entry_type: z.enum(["paddy_inward", "byproduct_sale", "expense", "payment", "unknown"]).default("unknown"),
    confidence: confidenceNumber.default(null),
    needs_review: z.boolean().default(true)
  })),
  missing_fields: z.array(z.string()).default([]),
  ambiguous_fields: z.array(z.string()).default([]),
  suggested_next_action: z.string().default("Review rough note lines manually before creating any draft."),
  fields: z.array(draftFieldSchema).default([])
});

export const expenseExtractionSchema = z.object({
  document_type: z.enum(["transport_bill", "labour_note", "electricity_bill", "maintenance_bill"]),
  expense_date: nullableDateString,
  expense_category: z.enum(["labour", "transport", "electricity", "maintenance", "other"]).nullable(),
  vendor_name: z.string().nullable(),
  amount: nullableNonnegativeNumber,
  currency: defaultCurrency,
  notes: z.string().nullable(),
  fields: z.array(draftFieldSchema)
});

export const paddyInwardPayloadSchema = z.object({
  arrival_date: nullableDateString,
  paddy_source_type: defaultPaddySourceType,
  source_party_name: z.string().nullable(),
  truck_number: z.string().nullable(),
  truck_sheet_bag_count: nullableNonnegativeNumber,
  physical_bag_count: nullableNonnegativeNumber,
  app_quantity: nullableNonnegativeNumber.optional(),
  weighbridge_net_weight: nullableNonnegativeNumber.optional(),
  confirmed_quantity: nullableNonnegativeNumber,
  quantity_unit: z.enum(["bag", "kg", "qtl", "tonne"]).nullable(),
  moisture_percent: nullableNumber.refine((value) => value === null || (value >= 0 && value <= 100), {
    message: "Expected moisture percent between 0 and 100"
  }),
  notes: z.string().nullable().optional()
});

export const byproductSalePayloadSchema = z.object({
  sale_date: z.string().date(),
  dealer_name: z.string().nullable(),
  product_type: z.enum(["bran", "broken_rice", "husk"]),
  paddy_source_type: defaultPaddySourceType,
  quantity: nullableNonnegativeNumber,
  quantity_unit: defaultByproductQuantityUnit,
  rate: nullableNonnegativeNumber,
  subtotal_amount: nullableNonnegativeNumber.optional(),
  gst_percent: nullableNumber.optional(),
  tax_amount: nullableNonnegativeNumber.optional(),
  total_amount: nullableNonnegativeNumber.optional(),
  payment_status: defaultPaymentStatus,
  notes: z.string().nullable().optional()
});

export const expensePayloadSchema = z.object({
  expense_date: z.string().date(),
  expense_category: z.enum(["labour", "transport", "electricity", "maintenance", "other"]),
  vendor_name: z.string().nullable(),
  amount: nullableNonnegativeNumber,
  currency: defaultCurrency,
  notes: z.string().nullable().optional()
});

export const questionIntentSchema = z.enum([
  "what_came_today",
  "what_came_yesterday",
  "entries_incomplete",
  "truck_sheet_count",
  "truck_sheets_missing",
  "lot_mismatch",
  "confirmed_stock",
  "byproducts_sold",
  "low_sale_rate",
  "expenses_this_month",
  "ca_export_ready",
  "unknown"
]);

export type TruckSheetExtraction = z.infer<typeof truckSheetExtractionSchema>;
export type ByproductSaleExtraction = z.infer<typeof byproductSaleExtractionSchema>;
export type ExpenseExtraction = z.infer<typeof expenseExtractionSchema>;
export type WeighbridgeExtraction = z.infer<typeof weighbridgeExtractionSchema>;
export type RoughNotesExtraction = z.infer<typeof roughNotesExtractionSchema>;
export type PaddyInwardPayload = z.infer<typeof paddyInwardPayloadSchema>;
export type ByproductSalePayload = z.infer<typeof byproductSalePayloadSchema>;
export type ExpensePayload = z.infer<typeof expensePayloadSchema>;
export type QuestionIntent = z.infer<typeof questionIntentSchema>;
