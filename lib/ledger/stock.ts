import type { Json, ProductType, RecordStatus } from "@/lib/types";

export interface StockEventLike {
  product_type: ProductType;
  paddy_source_type: string;
  quantity_delta: number;
  quantity_unit: string;
  status: RecordStatus;
}

export const CONFIRMED_STOCK_STATUSES: RecordStatus[] = ["confirmed", "reconciled", "locked", "exported"];

export function stockKey(productType: string, paddySourceType: string, quantityUnit: string) {
  return `${productType}:${paddySourceType}:${quantityUnit}`;
}

export interface NegativeStockCheck {
  productType: ProductType;
  paddySourceType: string;
  quantityUnit: string;
  // Confirmed balance AFTER the new out-event has been applied (signed sum of deltas).
  resultingConfirmedBalance: number;
  // Whether this product/source/unit has ever had a confirmed inflow. Without one the
  // product simply isn't tracked yet (e.g. byproducts before milling batches exist),
  // so a negative figure is a "not recorded" nudge, not an oversell error.
  hadConfirmedInflow: boolean;
}

export function buildNegativeStockAlert(input: NegativeStockCheck) {
  if (input.resultingConfirmedBalance >= 0) return null;

  const product = input.productType.replace(/_/g, " ");
  const balance = Math.round(input.resultingConfirmedBalance * 100) / 100;

  return {
    alert_type: "negative_stock" as const,
    title: "Stock balance went negative",
    message: input.hadConfirmedInflow
      ? `${product} stock for ${input.paddySourceType} is ${balance} ${input.quantityUnit} after this entry — more has gone out than was recorded coming in.`
      : `${product} stock for ${input.paddySourceType} shows ${balance} ${input.quantityUnit}, but no ${product} inflow or production has been recorded yet.`,
    severity: (input.hadConfirmedInflow ? "high" : "medium") as "high" | "medium",
    evidence: {
      product_type: input.productType,
      paddy_source_type: input.paddySourceType,
      quantity_unit: input.quantityUnit,
      resulting_confirmed_balance: balance,
      had_confirmed_inflow: input.hadConfirmedInflow,
      stock_key: stockKey(input.productType, input.paddySourceType, input.quantityUnit)
    } satisfies Record<string, Json>,
    action_label: "Review stock"
  };
}

export function calculateStockSummary(events: StockEventLike[]) {
  const summary = new Map<string, { confirmed: number; pending: number; disputed: number; unit: string }>();

  for (const event of events) {
    const key = `${event.product_type}:${event.paddy_source_type}:${event.quantity_unit}`;
    const row = summary.get(key) ?? {
      confirmed: 0,
      pending: 0,
      disputed: 0,
      unit: event.quantity_unit
    };

    if (event.status === "confirmed" || event.status === "reconciled" || event.status === "locked" || event.status === "exported") {
      row.confirmed += event.quantity_delta;
    } else if (event.status === "disputed") {
      row.disputed += event.quantity_delta;
    } else {
      row.pending += event.quantity_delta;
    }

    summary.set(key, row);
  }

  return Array.from(summary.entries()).map(([key, value]) => {
    const [product_type, paddy_source_type] = key.split(":");
    return { product_type, paddy_source_type, ...value };
  });
}
