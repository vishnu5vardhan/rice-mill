type SaleAmountInput = {
  quantity: number | string | null;
  quantity_unit: string | null;
  rate: number | string | null;
  subtotal_amount: number | string | null;
  gst_percent: number | string | null;
  tax_amount: number | string | null;
  total_amount: number | string | null;
  total_with_tax: number | string | null;
};

export function saleAmountLines(sale: SaleAmountInput) {
  const subtotal = numberOrNull(sale.subtotal_amount) ?? numberOrNull(sale.total_amount);
  const tax = numberOrNull(sale.tax_amount);
  const invoiceTotal = numberOrNull(sale.total_with_tax) ?? subtotal;
  const hasTax = tax !== null && tax > 0;

  return {
    rateLine: `${sale.quantity ?? "Missing"} ${sale.quantity_unit ?? ""} at INR ${sale.rate ?? "missing"}`.trim(),
    subtotalLine: hasTax ? `Subtotal: INR ${formatAmount(subtotal)}` : null,
    taxLine: hasTax ? `GST ${sale.gst_percent ?? ""}%: INR ${formatAmount(tax)}` : null,
    totalLine: `${hasTax ? "Invoice total" : "Total"}: INR ${formatAmount(invoiceTotal)}`
  };
}

function numberOrNull(value: number | string | null) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function formatAmount(value: number | null) {
  return value === null ? "Not calculated" : value.toLocaleString("en-IN", { maximumFractionDigits: 2 });
}
