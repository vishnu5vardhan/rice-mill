import type { ConfirmedDraftInput, Json, LedgerDecision, PaddySourceType } from "@/lib/types";
import {
  byproductSalePayloadSchema,
  expensePayloadSchema,
  paddyInwardPayloadSchema
} from "@/lib/validation/schemas";
import {
  buildMissingFieldTasks,
  paddyDataQualityScore,
  paddyRecordStatus
} from "@/lib/reconciliation/paddy";
import { buildPaddyMismatchAlerts } from "@/lib/reconciliation/mismatch";

export function mergeConfirmedPayload(input: ConfirmedDraftInput) {
  return input.fields.reduce<Record<string, unknown>>(
    (payload, field) => {
      payload[field.field_name] =
        Object.prototype.hasOwnProperty.call(input.correctedValues, field.field_name)
          ? input.correctedValues[field.field_name]
          : field.value;
      return payload;
    },
    { ...input.draft.payload }
  ) as Record<string, Json>;
}

export function buildLedgerDecision(input: ConfirmedDraftInput): LedgerDecision {
  if (input.draft.draft_type === "paddy_inward") return buildPaddyInwardDecision(input);
  if (input.draft.draft_type === "byproduct_sale") return buildByproductSaleDecision(input);
  if (input.draft.draft_type === "expense") return buildExpenseDecision(input);

  const eventDate = new Date().toISOString().slice(0, 10);
  return {
    businessEvent: {
      event_type: `${input.draft.draft_type}_confirmed`,
      event_date: eventDate,
      payload: mergeConfirmedPayload(input),
      status: "confirmed",
      idempotency_key: `draft:${input.draft.id}:business`
    },
    tasks: [],
    alerts: []
  };
}

function buildPaddyInwardDecision(input: ConfirmedDraftInput): LedgerDecision {
  const payload = paddyInwardPayloadSchema.parse(normalizeEmpty(mergeConfirmedPayload(input)));
  const mismatchOptions = { bagWeightKg: input.bagWeightKg ?? null };
  const status = paddyRecordStatus(payload, mismatchOptions);
  const eventDate = payload.arrival_date ?? new Date().toISOString().slice(0, 10);
  const mismatchAlerts = buildPaddyMismatchAlerts(payload, mismatchOptions);
  const canCreateStock = status === "confirmed" && payload.confirmed_quantity !== null && payload.quantity_unit !== null;

  return {
    businessEvent: {
      event_type: status === "disputed" ? "paddy_inward_disputed" : "paddy_inward_confirmed",
      event_date: eventDate,
      payload,
      status,
      idempotency_key: `draft:${input.draft.id}:business`
    },
    operation: {
      table: "paddy_lots",
      payload: {
        paddy_source_type: payload.paddy_source_type,
        arrival_date: payload.arrival_date,
        truck_number: payload.truck_number,
        truck_sheet_bag_count: payload.truck_sheet_bag_count,
        physical_bag_count: payload.physical_bag_count,
        app_quantity: payload.app_quantity ?? null,
        weighbridge_net_weight: payload.weighbridge_net_weight ?? null,
        moisture_percent: payload.moisture_percent,
        confirmed_quantity: payload.confirmed_quantity,
        quantity_unit: payload.quantity_unit,
        data_quality_score: paddyDataQualityScore(payload),
        status,
        notes: payload.notes ?? null,
        metadata: {
          source_party_name: payload.source_party_name
        }
      }
    },
    stockEvent: canCreateStock
      ? {
          event_type: "paddy_in",
          event_date: eventDate,
          product_type: "paddy",
          paddy_source_type: payload.paddy_source_type as PaddySourceType,
          direction: "in",
          quantity_delta: payload.confirmed_quantity!,
          quantity_unit: payload.quantity_unit!,
          related_entity_type: "paddy_lot",
          payload: {
            source_party_name: payload.source_party_name,
            truck_number: payload.truck_number
          },
          status: "confirmed",
          idempotency_key: `draft:${input.draft.id}:stock:paddy_in`
        }
      : undefined,
    tasks: buildMissingFieldTasks(payload),
    alerts: mismatchAlerts
  };
}

function buildByproductSaleDecision(input: ConfirmedDraftInput): LedgerDecision {
  const payload = byproductSalePayloadSchema.parse(normalizeEmpty(mergeConfirmedPayload(input)));
  const status = payload.quantity !== null && payload.rate !== null ? "confirmed" : "incomplete";

  return {
    businessEvent: {
      event_type: "byproduct_sale_confirmed",
      event_date: payload.sale_date,
      payload,
      status,
      idempotency_key: `draft:${input.draft.id}:business`
    },
    operation: {
      table: "byproduct_sales",
      payload: {
        sale_date: payload.sale_date,
        dealer_party_id: null,
        product_type: payload.product_type,
        paddy_source_type: payload.paddy_source_type,
        quantity: payload.quantity,
        quantity_unit: payload.quantity_unit,
        rate: payload.rate,
        subtotal_amount: payload.subtotal_amount ?? null,
        gst_percent: payload.gst_percent ?? null,
        tax_amount: payload.tax_amount ?? null,
        payment_status: payload.payment_status,
        status,
        notes: payload.notes ?? null,
        metadata: { dealer_name: payload.dealer_name }
      }
    },
    stockEvent:
      status === "confirmed"
        ? {
            event_type: "byproduct_sold_out",
            event_date: payload.sale_date,
            product_type: payload.product_type,
            paddy_source_type: payload.paddy_source_type,
            direction: "out",
            quantity_delta: -payload.quantity!,
            quantity_unit: payload.quantity_unit,
            related_entity_type: "byproduct_sale",
            payload: { dealer_name: payload.dealer_name, rate: payload.rate },
            status: "confirmed",
            idempotency_key: `draft:${input.draft.id}:stock:byproduct_sold_out`
          }
        : undefined,
    tasks:
      status === "incomplete"
        ? [
            {
              task_type: "missing_data",
              title: "Complete by-product sale",
              description: "Quantity and rate are needed before this sale can affect stock.",
              missing_field_name: payload.quantity === null ? "quantity" : "rate",
              priority: 2,
              linked_entity_type: "byproduct_sale"
            }
          ]
        : [],
    alerts: []
  };
}

function buildExpenseDecision(input: ConfirmedDraftInput): LedgerDecision {
  const payload = expensePayloadSchema.parse(normalizeEmpty(mergeConfirmedPayload(input)));
  const status = payload.amount !== null ? "confirmed" : "incomplete";

  return {
    businessEvent: {
      event_type: "expense_confirmed",
      event_date: payload.expense_date,
      payload,
      status,
      idempotency_key: `draft:${input.draft.id}:business`
    },
    operation: {
      table: "expenses",
      payload: {
        expense_date: payload.expense_date,
        expense_category: payload.expense_category,
        amount: payload.amount,
        currency: payload.currency,
        status,
        notes: payload.notes ?? null,
        metadata: { vendor_name: payload.vendor_name }
      }
    },
    tasks:
      payload.amount === null
        ? [
            {
              task_type: "missing_data",
              title: "Add expense amount",
              description: "The expense is saved but cannot be sent to CA until amount is present.",
              missing_field_name: "amount",
              priority: 2,
              linked_entity_type: "expense"
            }
          ]
        : [],
    alerts: []
  };
}

function normalizeEmpty(value: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key, item === "" ? null : item])
  );
}
