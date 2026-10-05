import type { DraftField } from "@/lib/types";
import { fieldValueToInput } from "@/lib/validation/form";
import { isDateField, normalizeDateString } from "@/lib/validation/date";
import { StatusBadge } from "@/components/StatusBadge";

const selectOptions: Record<string, string[]> = {
  paddy_source_type: ["government", "private", "farmer_custom", "own_purchase", "unknown"],
  quantity_unit: ["bag", "kg", "qtl", "tonne"],
  product_type: ["bran", "broken_rice", "husk"],
  payment_status: ["pending", "partial", "paid", "cancelled"],
  expense_category: ["labour", "transport", "electricity", "maintenance", "other"]
};

export function FieldEditor({ field }: { field: DraftField }) {
  const normalizedDate = isDateField(field.field_name) ? normalizeDateString(field.value) : null;
  const value = isDateField(field.field_name)
    ? fieldValueToInput(typeof normalizedDate === "string" ? normalizedDate : null)
    : fieldValueToInput(field.value);
  const label = field.field_name.replaceAll("_", " ");
  const options = selectOptions[field.field_name];

  return (
    <label className="block rounded-lg border border-ink/10 bg-white p-4 shadow-sm">
      <span className="flex items-center justify-between gap-3">
        <span className="text-sm font-bold capitalize text-ink">{label}</span>
        <StatusBadge status={field.status} />
      </span>
      {options ? (
        <select
          name={field.field_name}
          defaultValue={value}
          className="mt-3 h-12 w-full rounded-md border border-ink/15 bg-field px-3 text-base"
        >
          <option value="">Missing</option>
          {options.map((option) => (
            <option key={option} value={option}>
              {option.replaceAll("_", " ")}
            </option>
          ))}
        </select>
      ) : (
        <input
          type={isDateField(field.field_name) ? "date" : "text"}
          name={field.field_name}
          defaultValue={value}
          className="mt-3 h-12 w-full rounded-md border border-ink/15 bg-field px-3 text-base"
        />
      )}
      <span className="mt-2 flex justify-between text-xs text-ink/55">
        <span>{field.required ? "Required" : "Optional"}</span>
        <span>{field.confidence === null ? "No confidence" : `${Math.round(field.confidence * 100)}% confidence`}</span>
      </span>
    </label>
  );
}
