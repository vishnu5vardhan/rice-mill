import type { Json } from "@/lib/types";
import type { PaddyInwardPayload } from "@/lib/validation/schemas";

// Deterministic paddy-inward mismatch engine.
//
// "How much paddy came" has up to four competing sources of truth:
//   - truck sheet      -> truck_sheet_bag_count / confirmed_quantity
//   - physical count   -> physical_bag_count
//   - government app    -> app_quantity
//   - weighbridge slip -> weighbridge_net_weight
//
// A mismatch is when two of these disagree beyond tolerance. Per AI_BEHAVIOR.md a
// real conflict must surface (never be silently averaged) and should keep the lot
// out of confirmed stock until a human resolves it. These functions are pure so the
// ledger decision and the unit tests can reason about them without a database.

export type PaddyMismatchType =
  | "paddy_bag_mismatch"
  | "paddy_government_quantity_mismatch"
  | "paddy_weighbridge_mismatch";

export interface MismatchAlert {
  alert_type: PaddyMismatchType;
  title: string;
  message: string;
  severity: "low" | "medium" | "high" | "critical";
  evidence: Record<string, Json>;
  action_label?: string;
}

// Weight comparisons use a fractional tolerance because handwriting, rounding, and
// moisture loss make exact equality unrealistic. Bag counts are compared exactly.
export const WEIGHT_MISMATCH_TOLERANCE = 0.02;
export const SEVERE_WEIGHT_MISMATCH_FRACTION = 0.05;

const WEIGHT_UNIT_TO_KG: Record<string, number> = { kg: 1, qtl: 100, tonne: 1000 };

function isNum(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function round(value: number) {
  return Math.round(value * 100) / 100;
}

// Converts to kg. Bags need the mill's configured bag weight; without it we return
// null so callers skip the comparison instead of guessing and raising a false mismatch.
function toKg(value: number, unit: string | null | undefined, bagWeightKg?: number | null): number | null {
  if (!unit) return null;
  if (unit === "bag") return bagWeightKg && bagWeightKg > 0 ? value * bagWeightKg : null;
  const factor = WEIGHT_UNIT_TO_KG[unit];
  return factor ? value * factor : null;
}

export function detectBagMismatch(payload: Partial<PaddyInwardPayload>): MismatchAlert | null {
  const truck = payload.truck_sheet_bag_count;
  const physical = payload.physical_bag_count;
  if (!isNum(truck) || !isNum(physical) || truck === physical) return null;

  const diff = Math.abs(truck - physical);
  return {
    alert_type: "paddy_bag_mismatch",
    title: "Truck sheet and physical count mismatch",
    message: `Truck sheet shows ${truck} bags but physical count is ${physical} bags (difference ${diff}).`,
    severity: "high",
    evidence: {
      truck_sheet_bag_count: truck,
      physical_bag_count: physical,
      difference_bags: diff,
      comparison: "truck_sheet_vs_physical",
      source: "confirmation"
    },
    action_label: "Review lot"
  };
}

export function detectGovernmentQuantityMismatch(
  payload: Partial<PaddyInwardPayload>,
  tolerance = WEIGHT_MISMATCH_TOLERANCE
): MismatchAlert | null {
  const app = payload.app_quantity;
  if (!isNum(app)) return null;

  const unit = payload.quantity_unit ?? null;
  const declared = isNum(payload.confirmed_quantity)
    ? payload.confirmed_quantity
    : unit === "bag" && isNum(payload.truck_sheet_bag_count)
      ? payload.truck_sheet_bag_count
      : null;
  if (!isNum(declared)) return null;

  // Bag counts (and unit-less figures) must match exactly; weights allow tolerance.
  const exact = unit === "bag" || unit === null;
  const diff = Math.abs(app - declared);
  const diffPct = declared !== 0 ? diff / declared : app === 0 ? 0 : 1;
  if (exact ? diff === 0 : diffPct <= tolerance) return null;

  const unitLabel = unit ?? "units";
  return {
    alert_type: "paddy_government_quantity_mismatch",
    title: "Truck sheet and government app quantity mismatch",
    message: exact
      ? `Truck sheet quantity is ${declared} ${unitLabel} but the government app shows ${app} ${unitLabel} (difference ${round(diff)}).`
      : `Truck sheet quantity is ${declared} ${unitLabel} but the government app shows ${app} ${unitLabel} (difference ${round(diff)}, ${round(diffPct * 100)}%).`,
    severity: exact || diffPct >= SEVERE_WEIGHT_MISMATCH_FRACTION ? "high" : "medium",
    evidence: {
      declared_quantity: declared,
      government_app_quantity: app,
      quantity_unit: unit,
      difference: round(diff),
      difference_percent: exact ? null : round(diffPct * 100),
      comparison: "truck_sheet_vs_government_app"
    },
    action_label: "Review government entry"
  };
}

// Reusable across the confirm-time path (payload) and the weighbridge-link path
// (which has explicit units), so both raise the same shaped alert.
export function buildWeighbridgeMismatchAlert(
  input: {
    declaredQuantity: number | null | undefined;
    declaredUnit: string | null | undefined;
    weighbridgeNetWeight: number | null | undefined;
    weighbridgeUnit: string | null | undefined;
    bagWeightKg?: number | null;
  },
  tolerance = WEIGHT_MISMATCH_TOLERANCE
): MismatchAlert | null {
  if (!isNum(input.declaredQuantity) || !isNum(input.weighbridgeNetWeight)) return null;

  const declaredKg = toKg(input.declaredQuantity, input.declaredUnit, input.bagWeightKg);
  const netKg = toKg(input.weighbridgeNetWeight, input.weighbridgeUnit ?? "kg", input.bagWeightKg);
  // Still skip if units can't be resolved (e.g. bags with no configured bag weight).
  if (declaredKg === null || netKg === null) return null;

  const diffKg = Math.abs(declaredKg - netKg);
  const diffPct = declaredKg !== 0 ? diffKg / declaredKg : netKg === 0 ? 0 : 1;
  if (diffPct <= tolerance) return null;

  return {
    alert_type: "paddy_weighbridge_mismatch",
    title: "Declared quantity and weighbridge weight mismatch",
    message: `Declared ${input.declaredQuantity} ${input.declaredUnit ?? "units"} (~${round(declaredKg)} kg) but weighbridge net is ${round(netKg)} kg (difference ${round(diffKg)} kg, ${round(diffPct * 100)}%).`,
    severity: diffPct >= SEVERE_WEIGHT_MISMATCH_FRACTION ? "high" : "medium",
    evidence: {
      declared_quantity: input.declaredQuantity,
      declared_unit: input.declaredUnit ?? null,
      declared_quantity_kg: round(declaredKg),
      weighbridge_net_weight: input.weighbridgeNetWeight,
      weighbridge_unit: input.weighbridgeUnit ?? "kg",
      weighbridge_net_kg: round(netKg),
      difference_kg: round(diffKg),
      difference_percent: round(diffPct * 100),
      comparison: "declared_vs_weighbridge"
    },
    action_label: "Review weighbridge"
  };
}

export function buildPaddyMismatchAlerts(
  payload: Partial<PaddyInwardPayload>,
  options?: { bagWeightKg?: number | null }
): MismatchAlert[] {
  const alerts: MismatchAlert[] = [];

  const bag = detectBagMismatch(payload);
  if (bag) alerts.push(bag);

  const government = detectGovernmentQuantityMismatch(payload);
  if (government) alerts.push(government);

  const weighbridge = buildWeighbridgeMismatchAlert({
    declaredQuantity: payload.confirmed_quantity,
    declaredUnit: payload.quantity_unit,
    weighbridgeNetWeight: payload.weighbridge_net_weight,
    weighbridgeUnit: "kg",
    bagWeightKg: options?.bagWeightKg ?? null
  });
  if (weighbridge) alerts.push(weighbridge);

  return alerts;
}

// Any hard mismatch keeps the lot out of confirmed stock until a human resolves it.
export function paddyHasHardMismatch(
  payload: Partial<PaddyInwardPayload>,
  options?: { bagWeightKg?: number | null }
): boolean {
  return buildPaddyMismatchAlerts(payload, options).length > 0;
}
