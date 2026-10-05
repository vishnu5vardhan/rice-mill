import { inferByproductProduct } from "@/lib/byproducts/aliases";

export interface CaPreviewInputs {
  businessEvents: Array<{ id: string; event_type: string; event_date: string; status: string; payload: unknown }>;
  tasks: Array<{ id: string; title: string; missing_field_name: string | null; linked_entity_type: string | null }>;
  disputedLots: Array<{ id: string; lot_code: string | null; status: string; metadata: unknown }>;
  alerts: Array<{ id: string; title: string; alert_type: string; severity: string; evidence: unknown }>;
}

export type CaExportPreview = ReturnType<typeof buildCaExportPreview>;

export function buildCaExportPreview(input: CaPreviewInputs) {
  const confirmed = input.businessEvents.filter((event) =>
    ["confirmed", "reconciled", "locked", "exported"].includes(event.status)
  );
  const missing = input.tasks;
  const disputed = [
    ...input.businessEvents.filter((event) => event.status === "disputed"),
    ...input.disputedLots,
    ...input.alerts.filter((alert) => alert.alert_type.includes("mismatch"))
  ];

  return {
    summary: {
      confirmed_count: confirmed.length,
      missing_count: missing.length,
      disputed_count: disputed.length
    },
    confirmed,
    missing,
    disputed
  };
}

export function currentMonthPeriod(now = new Date()) {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0));

  return {
    periodStart: start.toISOString().slice(0, 10),
    periodEnd: end.toISOString().slice(0, 10),
    label: start.toLocaleString("en-IN", { month: "long", year: "numeric", timeZone: "UTC" })
  };
}

export function buildCaExportSummary(input: {
  preview: CaExportPreview;
  periodStart: string;
  periodEnd: string;
  generatedAt: string;
}) {
  return {
    period_start: input.periodStart,
    period_end: input.periodEnd,
    generated_at: input.generatedAt,
    confidence: exportConfidence(input.preview.summary),
    summary: input.preview.summary,
    confirmed: input.preview.confirmed,
    missing: input.preview.missing,
    disputed: input.preview.disputed
  };
}

export function caExportCsv(summary: ReturnType<typeof buildCaExportSummary>) {
  const rows = [
    [
      "section",
      "date",
      "voucher_type",
      "party",
      "item_or_category",
      "quantity",
      "unit",
      "rate",
      "taxable_amount",
      "gst_percent",
      "gst_amount",
      "total_amount",
      "payment_status",
      "record_status",
      "notes",
      "source_id"
    ],
    ...summary.confirmed.map(confirmedCaRow),
    ...summary.missing.map((task) => [
      "Pending issue",
      "",
      "Data quality task",
      "",
      task.linked_entity_type ?? "task",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "pending",
      task.missing_field_name ? `${task.title} - missing ${task.missing_field_name}` : task.title,
      task.id
    ]),
    ...summary.disputed.map((item) => [
      "Disputed / review",
      rowDate(item),
      rowType(item),
      "",
      rowTitle(item),
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      rowStatus(item),
      "Review before final CA filing",
      String(item.id ?? "")
    ])
  ];

  return rows.map((row) => row.map(csvCell).join(",")).join("\n");
}

function exportConfidence(summary: { confirmed_count: number; missing_count: number; disputed_count: number }) {
  if (summary.disputed_count > 0) return "low";
  if (summary.missing_count > 0) return "medium";
  if (summary.confirmed_count > 0) return "high";
  return "no_data";
}

function confirmedCaRow(event: CaExportPreview["confirmed"][number]) {
  const payload = objectRecord(event.payload);

  if (event.event_type === "byproduct_sale_confirmed") {
    const taxableAmount = numberOrNull(payload.subtotal_amount) ?? multiply(payload.quantity, payload.rate);
    const gstAmount = numberOrNull(payload.tax_amount);
    const totalAmount = numberOrNull(payload.total_amount) ?? (taxableAmount !== null ? taxableAmount + (gstAmount ?? 0) : null);
    const expectedFromRate = multiply(payload.quantity, payload.rate);
    const amountMismatch = taxableAmount !== null && expectedFromRate !== null && Math.abs(taxableAmount - expectedFromRate) > 0.01;

    return [
      "Sales",
      event.event_date,
      "By-product sale",
      payload.dealer_name ?? "",
      productLabel(payload.product_type),
      payload.quantity ?? "",
      payload.quantity_unit ?? "",
      payload.rate ?? "",
      taxableAmount ?? "",
      payload.gst_percent ?? "",
      gstAmount ?? "",
      totalAmount ?? "",
      payload.payment_status ?? "",
      amountMismatch ? "review" : "ready",
      [payload.notes, amountMismatch ? `Review amount: quantity x rate = ${expectedFromRate}, but taxable amount = ${taxableAmount}` : null].filter(Boolean).join("; "),
      event.id
    ];
  }

  if (event.event_type === "expense_confirmed") {
    const possibleProduct = inferByproductProduct(`${payload.vendor_name ?? ""} ${payload.notes ?? ""}`);
    if (possibleProduct) {
      return [
        "Review needed",
        event.event_date,
        "Possible by-product sale saved as expense",
        payload.vendor_name ?? "",
        productLabel(possibleProduct),
        "",
        "",
        "",
        payload.amount ?? "",
        "",
        "",
        payload.amount ?? "",
        "",
        "review",
        [payload.notes, "Confirm whether this is a sale, not an expense"].filter(Boolean).join("; "),
        event.id
      ];
    }

    return [
      "Expenses",
      event.event_date,
      "Expense",
      payload.vendor_name ?? "",
      expenseLabel(payload.expense_category),
      "",
      "",
      "",
      payload.amount ?? "",
      "",
      "",
      payload.amount ?? "",
      "",
      "ready",
      payload.notes ?? "",
      event.id
    ];
  }

  if (event.event_type.startsWith("paddy_inward")) {
    return [
      "Paddy / stock",
      event.event_date,
      "Paddy inward",
      payload.source_party_name ?? "",
      payload.paddy_source_type ?? "paddy",
      payload.confirmed_quantity ?? "",
      payload.quantity_unit ?? "",
      "",
      "",
      "",
      "",
      "",
      "",
      "ready",
      [payload.truck_number ? `Truck ${payload.truck_number}` : null, payload.notes].filter(Boolean).join("; "),
      event.id
    ];
  }

  return [
    "Other confirmed",
    event.event_date,
    event.event_type.replaceAll("_", " "),
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "ready",
    payloadSummary(event.payload),
    event.id
  ];
}

function payloadSummary(payload: unknown) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return "";
  const record = payload as Record<string, unknown>;
  const parts = [
    record.source_party_name ? `party=${record.source_party_name}` : null,
    record.dealer_name ? `dealer=${record.dealer_name}` : null,
    record.product_type ? `product=${record.product_type}` : null,
    record.confirmed_quantity ? `qty=${record.confirmed_quantity}` : record.quantity ? `qty=${record.quantity}` : null,
    record.amount ? `amount=${record.amount}` : null,
    record.rate ? `rate=${record.rate}` : null
  ].filter(Boolean);
  return parts.join("; ");
}

function objectRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function numberOrNull(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function multiply(left: unknown, right: unknown) {
  const a = numberOrNull(left);
  const b = numberOrNull(right);
  return a !== null && b !== null ? a * b : null;
}

function productLabel(value: unknown) {
  return String(value ?? "").replaceAll("_", " ");
}

function expenseLabel(value: unknown) {
  return String(value ?? "other").replaceAll("_", " ");
}

function rowTitle(item: Record<string, unknown>) {
  return String(item.title ?? item.event_type ?? item.lot_code ?? item.id ?? "Review item");
}

function rowStatus(item: Record<string, unknown>) {
  return String(item.status ?? item.severity ?? "review");
}

function rowDate(item: Record<string, unknown>) {
  return String(item.event_date ?? item.created_at ?? "");
}

function rowType(item: Record<string, unknown>) {
  return String(item.event_type ?? item.alert_type ?? "record");
}

function csvCell(value: unknown) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replaceAll("\"", "\"\"")}"` : text;
}
