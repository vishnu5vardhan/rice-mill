import type { ByproductSalePayload } from "@/lib/validation/schemas";

export function isLowByproductRate(
  current: Pick<ByproductSalePayload, "rate">,
  historicalRates: number[],
  thresholdRatio = 0.9
) {
  if (current.rate === null || current.rate === undefined) return false;
  if (historicalRates.length < 2) return false;
  const average = historicalRates.reduce((sum, rate) => sum + rate, 0) / historicalRates.length;
  return current.rate < average * thresholdRatio;
}

export function buildLowRateAlert(
  payload: ByproductSalePayload,
  historicalRates: number[],
  thresholdRatio = 0.9
) {
  if (!isLowByproductRate(payload, historicalRates, thresholdRatio)) return null;
  const average = historicalRates.reduce((sum, rate) => sum + rate, 0) / historicalRates.length;

  return {
    alert_type: "byproduct_low_rate",
    title: "Sale rate looks low",
    message: `${payload.product_type.replace("_", " ")} sold at ${payload.rate}/${
      payload.quantity_unit
    }, below the recent average ${Math.round(average)}/${payload.quantity_unit}.`,
    severity: "medium" as const,
    evidence: {
      current_rate: payload.rate,
      recent_average_rate: Math.round(average * 100) / 100,
      sample_size: historicalRates.length,
      threshold_ratio: thresholdRatio
    },
    action_label: "Review sale"
  };
}
