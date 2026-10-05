import type { Json } from "@/lib/types";
import { isDateField, normalizeDateString } from "@/lib/validation/date";

const numericFields = new Set([
  "truck_sheet_bag_count",
  "physical_bag_count",
  "app_quantity",
  "weighbridge_net_weight",
  "gross_weight",
  "tare_weight",
  "net_weight",
  "confirmed_quantity",
  "moisture_percent",
  "quantity",
  "rate",
  "subtotal_amount",
  "gst_percent",
  "tax_amount",
  "total_amount",
  "amount"
]);

export function coerceFormValue(fieldName: string, value: FormDataEntryValue | null): Json {
  if (value === null) return null;
  const text = String(value).trim();
  if (text === "") return null;
  if (isDateField(fieldName)) return normalizeDateString(text) as Json;
  if (numericFields.has(fieldName)) {
    const parsed = Number(text);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return text;
}

export function fieldValueToInput(value: Json): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}
