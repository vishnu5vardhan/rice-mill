import assert from "node:assert/strict";
import test from "node:test";
import type { ConfirmedDraftInput, DraftEntry, DraftField } from "@/lib/types";
import { separateByRecordStatus } from "@/lib/ask/evidence";
import { parseQuestionIntent } from "@/lib/ask/intents";
import { canCreateStockEventFromBusinessEvent } from "@/lib/ledger/guards";
import { buildLedgerDecision } from "@/lib/ledger/events";
import { buildLowRateAlert } from "@/lib/reconciliation/byproduct";
import { buildPaddyMismatchAlerts, buildWeighbridgeMismatchAlert } from "@/lib/reconciliation/mismatch";
import { buildNegativeStockAlert } from "@/lib/ledger/stock";
import { buildCaExportPreview, buildCaExportSummary, caExportCsv } from "@/lib/reports/ca-export";
import { saleAmountLines } from "@/lib/sales/display";
import { inferByproductProduct } from "@/lib/byproducts/aliases";
import { parseRoughNoteByproductLine, parseRoughNoteExpenseLine } from "@/lib/rough-notes/expense";
import { normalizeGeminiExtraction } from "@/lib/ai/gemini";
import { draftCancelUpdatePayload } from "@/lib/services/draft-cancel";
import {
  expenseCandidateFromDraft,
  expenseCandidateFromRecord,
  maybeExpenseCorrectionRequest,
  suggestionFromCandidate
} from "@/lib/ask/actions";

function paddyDraft(overrides: Record<string, unknown> = {}): ConfirmedDraftInput {
  const payload = {
    arrival_date: "2026-05-29",
    paddy_source_type: "government",
    source_party_name: "Mallapur PPC",
    truck_number: "TS09 AB 1234",
    truck_sheet_bag_count: 460,
    physical_bag_count: null,
    confirmed_quantity: 460,
    quantity_unit: "bag",
    moisture_percent: null,
    notes: null,
    ...overrides
  };

  const draft: DraftEntry = {
    id: "draft-1",
    mill_id: "mill-1",
    draft_type: "paddy_inward",
    source_type: "truck_sheet",
    source_id: "doc-1",
    document_id: "doc-1",
    extraction_run_id: "run-1",
    payload: {},
    missing_fields: [],
    status: "pending_confirmation"
  };

  const fields: DraftField[] = Object.entries(payload).map(([field_name, value]) => ({
    field_name,
    value: value as never,
    status: value === null ? "missing" : "ai_extracted",
    confidence: value === null ? null : 0.75,
    required: ["arrival_date", "paddy_source_type", "source_party_name", "confirmed_quantity", "quantity_unit"].includes(field_name),
    needs_review: false,
    source_type: "truck_sheet",
    source_id: "doc-1",
    linked_document_id: "doc-1"
  }));

  return { draft, fields, correctedValues: {}, actorId: "user-1" };
}

function byproductSaleDraft(overrides: Record<string, unknown> = {}): ConfirmedDraftInput {
  const payload = {
    sale_date: "2026-05-29",
    dealer_name: "Dealer",
    product_type: "bran",
    paddy_source_type: "unknown",
    quantity: 10,
    quantity_unit: "qtl",
    rate: 1200,
    payment_status: "pending",
    notes: null,
    ...overrides
  };

  const draft: DraftEntry = {
    id: "draft-sale-1",
    mill_id: "mill-1",
    draft_type: "byproduct_sale",
    source_type: "sale_bill",
    source_id: "doc-sale-1",
    document_id: "doc-sale-1",
    extraction_run_id: "run-sale-1",
    payload: {},
    missing_fields: [],
    status: "pending_confirmation"
  };

  const fields: DraftField[] = Object.entries(payload).map(([field_name, value]) => ({
    field_name,
    value: value as never,
    status: value === null ? "missing" : "ai_extracted",
    confidence: value === null ? null : 0.75,
    required: ["sale_date", "product_type", "quantity", "quantity_unit", "rate"].includes(field_name),
    needs_review: false,
    source_type: "sale_bill",
    source_id: "doc-sale-1",
    linked_document_id: "doc-sale-1"
  }));

  return { draft, fields, correctedValues: {}, actorId: "user-1" };
}

function expenseDraft(overrides: Record<string, unknown> = {}): ConfirmedDraftInput {
  const payload = {
    expense_date: "2026-05-29",
    expense_category: "other",
    vendor_name: null,
    amount: 500,
    currency: "INR",
    notes: null,
    ...overrides
  };

  const draft: DraftEntry = {
    id: "draft-expense-1",
    mill_id: "mill-1",
    draft_type: "expense",
    source_type: "manual",
    source_id: null,
    document_id: null,
    extraction_run_id: null,
    payload: {},
    missing_fields: [],
    status: "pending_confirmation"
  };

  const fields: DraftField[] = Object.entries(payload).map(([field_name, value]) => ({
    field_name,
    value: value as never,
    status: value === null ? "missing" : "ai_extracted",
    confidence: value === null ? null : 0.75,
    required: ["expense_date", "expense_category", "amount"].includes(field_name),
    needs_review: false,
    source_type: "manual",
    source_id: null,
    linked_document_id: null
  }));

  return { draft, fields, correctedValues: {}, actorId: "user-1" };
}

test("AI/extracted field cannot create stock event directly", () => {
  assert.equal(
    canCreateStockEventFromBusinessEvent({
      businessEventStatus: "draft",
      businessEventMillId: "mill-1",
      stockEventMillId: "mill-1"
    }),
    false
  );
  assert.equal(
    canCreateStockEventFromBusinessEvent({
      businessEventStatus: "confirmed",
      businessEventMillId: "mill-1",
      stockEventMillId: "other-mill"
    }),
    false
  );
});

test("confirmed paddy draft creates business event", () => {
  const decision = buildLedgerDecision(paddyDraft());
  assert.equal(decision.businessEvent.event_type, "paddy_inward_confirmed");
  assert.equal(decision.businessEvent.status, "confirmed");
});

test("business event creates stock event for confirmed paddy", () => {
  const decision = buildLedgerDecision(paddyDraft());
  assert.equal(decision.stockEvent?.event_type, "paddy_in");
  assert.equal(decision.stockEvent?.quantity_delta, 460);
});

test("incomplete entry creates task and no stock event", () => {
  const decision = buildLedgerDecision(paddyDraft({ confirmed_quantity: null }));
  assert.equal(decision.businessEvent.status, "incomplete");
  assert.equal(decision.stockEvent, undefined);
  assert.ok(decision.tasks.some((task) => task.missing_field_name === "confirmed_quantity"));
});

test("invalid paddy arrival date is treated as missing instead of throwing", () => {
  const decision = buildLedgerDecision(paddyDraft({ arrival_date: "Invalid date" }));
  assert.equal(decision.businessEvent.status, "incomplete");
  assert.equal(decision.businessEvent.payload.arrival_date, null);
  assert.equal(decision.operation?.payload.arrival_date, null);
  assert.equal(decision.stockEvent, undefined);
  assert.ok(decision.tasks.some((task) => task.missing_field_name === "arrival_date"));
});

test("invalid calendar paddy arrival date is treated as missing", () => {
  const decision = buildLedgerDecision(paddyDraft({ arrival_date: "2026-02-31" }));
  assert.equal(decision.businessEvent.status, "incomplete");
  assert.equal(decision.businessEvent.payload.arrival_date, null);
  assert.ok(decision.tasks.some((task) => task.missing_field_name === "arrival_date"));
});

test("manual Indian date format is normalized before paddy ledger update", () => {
  const decision = buildLedgerDecision(paddyDraft({ arrival_date: "16/05/2026" }));
  assert.equal(decision.businessEvent.status, "confirmed");
  assert.equal(decision.businessEvent.payload.arrival_date, "2026-05-16");
  assert.equal(decision.operation?.payload.arrival_date, "2026-05-16");
  assert.equal(decision.tasks.some((task) => task.missing_field_name === "arrival_date"), false);
});

test("missing paddy source type follows existing unknown default", () => {
  const decision = buildLedgerDecision(paddyDraft({ paddy_source_type: null }));
  assert.equal(decision.businessEvent.payload.paddy_source_type, "unknown");
  assert.equal(decision.operation?.payload.paddy_source_type, "unknown");
});

test("conflicting bag count creates disputed alert", () => {
  const decision = buildLedgerDecision(paddyDraft({ physical_bag_count: 455 }));
  assert.equal(decision.businessEvent.status, "disputed");
  assert.equal(decision.stockEvent, undefined);
  assert.equal(decision.alerts[0]?.alert_type, "paddy_bag_mismatch");
});

test("government app quantity mismatch disputes paddy and blocks stock", () => {
  // Default draft is 460 bags confirmed; government app says 450 -> exact bag mismatch.
  const decision = buildLedgerDecision(paddyDraft({ app_quantity: 450 }));
  assert.equal(decision.businessEvent.status, "disputed");
  assert.equal(decision.stockEvent, undefined);
  assert.ok(decision.alerts.some((alert) => alert.alert_type === "paddy_government_quantity_mismatch"));
});

test("matching government app quantity stays confirmed with no alert", () => {
  const decision = buildLedgerDecision(paddyDraft({ app_quantity: 460 }));
  assert.equal(decision.businessEvent.status, "confirmed");
  assert.equal(decision.alerts.length, 0);
});

test("bag and government mismatches both surface as separate alerts", () => {
  const alerts = buildPaddyMismatchAlerts({
    truck_sheet_bag_count: 460,
    physical_bag_count: 455,
    app_quantity: 450,
    confirmed_quantity: 460,
    quantity_unit: "bag"
  });
  const types = alerts.map((alert) => alert.alert_type).sort();
  assert.deepEqual(types, ["paddy_bag_mismatch", "paddy_government_quantity_mismatch"]);
});

test("weighbridge weight within tolerance does not alert", () => {
  // 100 qtl = 10000 kg vs 10100 kg = 1% < 2% tolerance.
  const alert = buildWeighbridgeMismatchAlert({
    declaredQuantity: 100,
    declaredUnit: "qtl",
    weighbridgeNetWeight: 10100,
    weighbridgeUnit: "kg"
  });
  assert.equal(alert, null);
});

test("weighbridge weight beyond tolerance alerts as high severity", () => {
  // 100 qtl = 10000 kg vs 10800 kg = 8% >= 5% severe fraction.
  const alert = buildWeighbridgeMismatchAlert({
    declaredQuantity: 100,
    declaredUnit: "qtl",
    weighbridgeNetWeight: 10800,
    weighbridgeUnit: "kg"
  });
  assert.equal(alert?.alert_type, "paddy_weighbridge_mismatch");
  assert.equal(alert?.severity, "high");
});

test("weighbridge comparison is skipped for bag units when bag weight is unknown", () => {
  const alert = buildWeighbridgeMismatchAlert({
    declaredQuantity: 460,
    declaredUnit: "bag",
    weighbridgeNetWeight: 16000,
    weighbridgeUnit: "kg"
  });
  assert.equal(alert, null);
});

test("weighbridge reconciles bag units once the mill's bag weight is known", () => {
  // 460 bags x 40 kg = 18400 kg declared vs 16000 kg weighbridge = ~13% > 5% → high.
  const alert = buildWeighbridgeMismatchAlert({
    declaredQuantity: 460,
    declaredUnit: "bag",
    weighbridgeNetWeight: 16000,
    weighbridgeUnit: "kg",
    bagWeightKg: 40
  });
  assert.equal(alert?.alert_type, "paddy_weighbridge_mismatch");
  assert.equal(alert?.severity, "high");
});

test("weighbridge bag reconciliation passes when within tolerance", () => {
  // 400 bags x 40 kg = 16000 kg vs 16100 kg = 0.6% < 2% → no alert.
  const alert = buildWeighbridgeMismatchAlert({
    declaredQuantity: 400,
    declaredUnit: "bag",
    weighbridgeNetWeight: 16100,
    weighbridgeUnit: "kg",
    bagWeightKg: 40
  });
  assert.equal(alert, null);
});

test("overselling a tracked product raises a high-severity negative-stock alert", () => {
  const alert = buildNegativeStockAlert({
    productType: "rice",
    paddySourceType: "government",
    quantityUnit: "qtl",
    resultingConfirmedBalance: -5,
    hadConfirmedInflow: true
  });
  assert.equal(alert?.alert_type, "negative_stock");
  assert.equal(alert?.severity, "high");
});

test("selling an untracked by-product flags negative stock at medium severity", () => {
  const alert = buildNegativeStockAlert({
    productType: "bran",
    paddySourceType: "unknown",
    quantityUnit: "qtl",
    resultingConfirmedBalance: -10,
    hadConfirmedInflow: false
  });
  assert.equal(alert?.severity, "medium");
  assert.equal(alert?.evidence.stock_key, "bran:unknown:qtl");
});

test("non-negative balance produces no negative-stock alert", () => {
  const alert = buildNegativeStockAlert({
    productType: "rice",
    paddySourceType: "government",
    quantityUnit: "qtl",
    resultingConfirmedBalance: 0,
    hadConfirmedInflow: true
  });
  assert.equal(alert, null);
});

test("by-product low-rate alert works", () => {
  const alert = buildLowRateAlert(
    {
      sale_date: "2026-05-29",
      dealer_name: "Dealer",
      product_type: "bran",
      paddy_source_type: "unknown",
      quantity: 10,
      quantity_unit: "qtl",
      rate: 1200,
      payment_status: "pending",
      notes: null
    },
    [1500, 1520, 1480]
  );
  assert.equal(alert?.alert_type, "byproduct_low_rate");
});

test("sale display uses invoice total when GST is present", () => {
  const lines = saleAmountLines({
    quantity: 130,
    quantity_unit: "qtl",
    rate: 2700,
    subtotal_amount: 351000,
    gst_percent: 5,
    tax_amount: 17550,
    total_amount: 351000,
    total_with_tax: 368550
  });

  assert.equal(lines.subtotalLine, "Subtotal: INR 3,51,000");
  assert.equal(lines.taxLine, "GST 5%: INR 17,550");
  assert.equal(lines.totalLine, "Invoice total: INR 3,68,550");
});

test("by-product sale confirmation defaults null unit before incomplete handling", () => {
  const decision = buildLedgerDecision(byproductSaleDraft({ quantity: null, quantity_unit: null, paddy_source_type: null, payment_status: null }));
  assert.equal(decision.businessEvent.status, "incomplete");
  assert.equal(decision.businessEvent.payload.quantity_unit, "qtl");
  assert.equal(decision.businessEvent.payload.paddy_source_type, "unknown");
  assert.equal(decision.businessEvent.payload.payment_status, "pending");
  assert.equal(decision.operation?.payload.quantity_unit, "qtl");
  assert.equal(decision.stockEvent, undefined);
  assert.ok(decision.tasks.some((task) => task.missing_field_name === "quantity"));
});

test("expense confirmation defaults null currency before incomplete handling", () => {
  const decision = buildLedgerDecision(expenseDraft({ amount: null, currency: null }));
  assert.equal(decision.businessEvent.status, "incomplete");
  assert.equal(decision.businessEvent.payload.currency, "INR");
  assert.equal(decision.operation?.payload.currency, "INR");
  assert.ok(decision.tasks.some((task) => task.missing_field_name === "amount"));
});

test("ask answer evidence separates confirmed, pending, and disputed", () => {
  const separated = separateByRecordStatus([
    { id: "1", status: "confirmed" },
    { id: "2", status: "incomplete" },
    { id: "3", status: "disputed" }
  ]);
  assert.deepEqual(separated.confirmed.map((row) => row.id), ["1"]);
  assert.deepEqual(separated.pending.map((row) => row.id), ["2"]);
  assert.deepEqual(separated.disputed.map((row) => row.id), ["3"]);
});

test("ask routes yesterday paddy questions to deterministic date logic", () => {
  assert.equal(parseQuestionIntent("what came yesterday"), "what_came_yesterday");
  assert.equal(parseQuestionIntent("show entries yesterday"), "what_came_yesterday");
});

test("ask routes truck sheet count questions to deterministic count logic", () => {
  assert.equal(parseQuestionIntent("how many truck sheets i have"), "truck_sheet_count");
  assert.equal(parseQuestionIntent("total truck sheets uploaded"), "truck_sheet_count");
  assert.equal(parseQuestionIntent("which truck sheets are missing"), "truck_sheets_missing");
});

test("export preview shows missing data separately", () => {
  const preview = buildCaExportPreview({
    businessEvents: [{ id: "be-1", event_type: "paddy_inward_confirmed", event_date: "2026-05-29", status: "confirmed", payload: {} }],
    tasks: [{ id: "task-1", title: "Add moisture", missing_field_name: "moisture_percent", linked_entity_type: "paddy_lot" }],
    disputedLots: [],
    alerts: []
  });
  assert.equal(preview.summary.confirmed_count, 1);
  assert.equal(preview.summary.missing_count, 1);
  assert.equal(preview.missing[0]?.missing_field_name, "moisture_percent");
});

test("CA export summary and CSV keep confirmed and missing sections", () => {
  const preview = buildCaExportPreview({
    businessEvents: [
      { id: "be-1", event_type: "expense_confirmed", event_date: "2026-06-02", status: "confirmed", payload: { vendor_name: "Hamali", expense_category: "labour", amount: 30000, notes: "June labour" } },
      { id: "be-2", event_type: "byproduct_sale_confirmed", event_date: "2026-06-02", status: "confirmed", payload: { dealer_name: "Dealer A", product_type: "bran", quantity: 10, quantity_unit: "qtl", rate: 1200, subtotal_amount: 12000, payment_status: "paid" } }
    ],
    tasks: [{ id: "task-1", title: "Add bill photo", missing_field_name: "bill_photo", linked_entity_type: "expense" }],
    disputedLots: [],
    alerts: []
  });
  const summary = buildCaExportSummary({ preview, periodStart: "2026-06-01", periodEnd: "2026-06-30", generatedAt: "2026-06-02T00:00:00.000Z" });
  const csv = caExportCsv(summary);

  assert.equal(summary.confidence, "medium");
  assert.match(csv, /section,date,voucher_type,party,item_or_category,quantity,unit,rate,taxable_amount,gst_percent,gst_amount,total_amount,payment_status,record_status,notes,source_id/);
  assert.match(csv, /Expenses,2026-06-02,Expense,Hamali,labour,,,,30000,,,30000,,ready,June labour,be-1/);
  assert.match(csv, /Sales,2026-06-02,By-product sale,Dealer A,bran,10,qtl,1200,12000,,,12000,paid,ready,,be-2/);
  assert.match(csv, /Pending issue,,Data quality task,,expense,,,,,,,,,pending,Add bill photo - missing bill_photo,task-1/);
});

test("CA export flags likely by-product aliases saved as expenses", () => {
  const preview = buildCaExportPreview({
    businessEvents: [
      { id: "be-exp", event_type: "expense_confirmed", event_date: "2026-06-02", status: "confirmed", payload: { vendor_name: "Param", expense_category: "other", amount: 20000, notes: "From rough note: 20,000 - Param" } }
    ],
    tasks: [],
    disputedLots: [],
    alerts: []
  });
  const summary = buildCaExportSummary({ preview, periodStart: "2026-06-01", periodEnd: "2026-06-30", generatedAt: "2026-06-02T00:00:00.000Z" });
  const csv = caExportCsv(summary);

  assert.match(csv, /Review needed,2026-06-02,Possible by-product sale saved as expense,Param,broken rice,,,,20000,,,20000,,review/);
});

test("CA export flags sale amount mismatches for review", () => {
  const preview = buildCaExportPreview({
    businessEvents: [
      { id: "be-sale", event_type: "byproduct_sale_confirmed", event_date: "2026-06-02", status: "confirmed", payload: { dealer_name: "Dealer A", product_type: "bran", quantity: 200, quantity_unit: "qtl", rate: 20000, subtotal_amount: 20000, payment_status: "paid" } }
    ],
    tasks: [],
    disputedLots: [],
    alerts: []
  });
  const summary = buildCaExportSummary({ preview, periodStart: "2026-06-01", periodEnd: "2026-06-30", generatedAt: "2026-06-02T00:00:00.000Z" });
  const csv = caExportCsv(summary);

  assert.match(csv, /Sales,2026-06-02,By-product sale,Dealer A,bran,200,qtl,20000,20000,,,20000,paid,review/);
  assert.match(csv, /Review amount: quantity x rate = 4000000, but taxable amount = 20000/);
});

test("Gemini truck sheet extraction normalizes to paddy draft evidence", () => {
  const result = normalizeGeminiExtraction({
    document_type: "truck_sheet",
    document_type_confidence: 0.91,
    arrival_date: "2026-05-29",
    paddy_source_type: "government",
    source_party_name: "Pambanda PPC",
    truck_number: "TS09 AB 1234",
    truck_sheet_bag_count: "460",
    confirmed_quantity: "460",
    quantity_unit: "bags",
    moisture_percent: null,
    missing_fields: ["moisture_percent"]
  });

  assert.equal(result.draftType, "paddy_inward");
  assert.equal(result.sourceType, "truck_sheet");
  assert.equal(result.extraction?.document_type, "truck_sheet");
  assert.equal(result.extraction?.confirmed_quantity, 460);
  assert.ok(result.extraction?.fields.some((field) => field.field_name === "moisture_percent" && field.status === "missing"));
});

test("Gemini by-product bill extraction normalizes to sale draft evidence", () => {
  const result = normalizeGeminiExtraction({
    document_type: "byproduct_sale_bill",
    sale_date: "2026-05-29",
    dealer_name: "Dealer A",
    product_type: "bran",
    quantity: "10",
    quantity_unit: "qtl",
    subtotal_amount: "12000",
    gst_percent: "5",
    tax_amount: "600",
    payment_status: "pending"
  });

  assert.equal(result.draftType, "byproduct_sale");
  assert.equal(result.sourceType, "sale_bill");
  assert.equal(result.extraction?.document_type, "byproduct_sale_bill");
  assert.equal(result.extraction?.rate, 1200);
});

test("Gemini weighbridge extraction stays document evidence until manual linking", () => {
  const result = normalizeGeminiExtraction({
    document_type: "weighbridge_slip",
    weighbridge_date: "2026-05-29",
    truck_number: "TS09 AB 1234",
    gross_weight: 25000,
    tare_weight: 9000,
    quantity_unit: "kg"
  });

  assert.equal(result.draftType, null);
  assert.equal(result.sourceType, "weighbridge_slip");
  assert.equal(result.extraction?.document_type, "weighbridge_slip");
  assert.equal(result.extraction?.net_weight, 16000);
});

test("rough notes extract candidate lines without ledger draft", () => {
  const result = normalizeGeminiExtraction({
    document_type: "rough_notes",
    candidate_lines: [
      { line_text: "Mallapur 460 bags", possible_entry_type: "paddy_inward", confidence: 0.6 }
    ]
  });

  assert.equal(result.draftType, null);
  assert.equal(result.extraction?.document_type, "rough_notes");
  assert.equal(result.extraction?.candidate_lines[0]?.line_text, "Mallapur 460 bags");
});

test("rough notes preserve amount and party candidate lines", () => {
  const result = normalizeGeminiExtraction({
    document_type: "rough_notes",
    candidate_lines: [
      { line_text: "20000 - Arwah", possible_entry_type: "payment", confidence: 0.72, needs_review: true },
      { line_text: "10000 - Thorudu", possible_entry_type: "payment", confidence: 0.7, needs_review: true }
    ]
  });

  assert.equal(result.draftType, null);
  assert.equal(result.extraction?.document_type, "rough_notes");
  if (result.extraction?.document_type !== "rough_notes") throw new Error("Expected rough notes extraction");
  assert.equal(result.extraction?.candidate_lines[0]?.line_text, "20000 - Arwah");
  assert.equal(result.extraction?.candidate_lines[1]?.line_text, "10000 - Thorudu");
});

test("rough note expense line parser extracts amount and category", () => {
  assert.deepEqual(parseRoughNoteExpenseLine("30,000 - Hamali"), {
    amount: 30000,
    category: "labour",
    vendorName: "Hamali",
    notes: "30,000 - Hamali"
  });
  assert.deepEqual(parseRoughNoteExpenseLine("60,000 - Current Bill"), {
    amount: 60000,
    category: "electricity",
    vendorName: "Current Bill",
    notes: "60,000 - Current Bill"
  });
});

test("Telangana by-product slang aliases map to canonical products", () => {
  assert.equal(inferByproductProduct("30,000 - Thoudu"), "bran");
  assert.equal(inferByproductProduct("Param sale"), "broken_rice");
  assert.equal(inferByproductProduct("unka load"), "husk");
  assert.equal(inferByproductProduct("nookalu"), "broken_rice");
  assert.equal(inferByproductProduct("ooka"), "husk");
});

test("rough note by-product parser extracts product and amount", () => {
  assert.deepEqual(parseRoughNoteByproductLine("20,000 - Param"), {
    productType: "broken_rice",
    subtotalAmount: 20000,
    notes: "20,000 - Param"
  });
});

test("draft cancel update payload only touches live draft columns", () => {
  assert.deepEqual(draftCancelUpdatePayload("user-1"), {
    status: "cancelled",
    updated_by: "user-1"
  });
});

test("ask action detector recognizes expense correction requests", () => {
  assert.equal(
    maybeExpenseCorrectionRequest("some entries are recorded as expenses but they are bran sales"),
    true
  );
  assert.equal(maybeExpenseCorrectionRequest("what came today"), false);
});

test("expense-like confirmed records become replacement draft suggestions only", () => {
  const candidate = expenseCandidateFromRecord({
    id: "11111111-1111-4111-8111-111111111111",
    expense_date: "2026-06-02",
    expense_category: "other",
    amount: 1200,
    status: "confirmed",
    notes: "bran sold cash",
    metadata: {}
  });

  assert.equal(candidate?.productType, "bran");
  const suggestion = suggestionFromCandidate(candidate!);
  assert.equal(suggestion.kind, "create_byproduct_sale_draft_from_expense");
  assert.match(suggestion.safety_note, /does not remove the original confirmed expense/i);
});

test("expense draft suggestions stay at draft level", () => {
  const candidate = expenseCandidateFromDraft({
    id: "11111111-1111-4111-8111-222222222222",
    status: "pending_confirmation",
    payload: {
      expense_date: "2026-06-02",
      expense_category: "other",
      amount: 900,
      notes: "husk sale"
    }
  });

  assert.equal(candidate?.productType, "husk");
  const suggestion = suggestionFromCandidate(candidate!);
  assert.equal(suggestion.kind, "convert_expense_draft_to_byproduct_sale_draft");
  assert.match(suggestion.safety_note, /ledger updates later/i);
});
