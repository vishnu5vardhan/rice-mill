"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { requireMillContext } from "@/lib/db/context";
import { createAuditLog } from "@/lib/services/audit";
import { createDocumentForExtraction, runDocumentExtraction } from "@/lib/services/documents";
import { draftCancelUpdatePayload } from "@/lib/services/draft-cancel";
import { confirmDraft, createManualDraft } from "@/lib/services/drafts";
import { buildWeighbridgeMismatchAlert } from "@/lib/reconciliation/mismatch";
import { getMillBusinessConfig } from "@/lib/services/business-context";
import { hasSupabaseEnv } from "@/lib/supabase/server";
import type { DraftField, DraftType, Json } from "@/lib/types";
import { buildCaExportPreview, buildCaExportSummary, currentMonthPeriod } from "@/lib/reports/ca-export";
import { parseRoughNoteByproductLine, parseRoughNoteExpenseLine } from "@/lib/rough-notes/expense";
import { coerceFormValue } from "@/lib/validation/form";

export async function uploadDocumentAction(formData: FormData) {
  if (!hasSupabaseEnv()) redirect("/upload");

  const context = await requireMillContext();
  const fileValue = formData.get("file");
  const file = fileValue instanceof File && fileValue.size > 0 ? fileValue : null;
  const selectedDocumentType = String(formData.get("document_type") ?? "unknown");

  // Stage 1: persist the file and queue the run. This returns fast so the operator can
  // upload the next sheet instead of waiting ~20s for Gemini.
  const created = await createDocumentForExtraction(context.supabase, {
    millId: context.millId,
    userId: context.userId,
    file,
    selectedDocumentType
  });

  revalidatePath("/dashboard");
  revalidatePath("/documents");

  if ("duplicate" in created && created.duplicate === true) {
    redirect("/documents");
  }

  // Stage 2: the slow Gemini extraction runs after the response is sent. The draft
  // shows up in the Documents queue as "Ready to confirm" when it finishes. Nothing
  // reaches the ledger until the operator confirms it.
  const supabase = context.supabase;
  const millId = context.millId;
  const userId = context.userId;
  const documentId = created.document.id;
  const extractionRunId = created.extractionRun.id;
  const fileBuffer = created.fileBuffer;
  const mimeType = created.mimeType;

  after(async () => {
    try {
      await runDocumentExtraction(supabase, {
        millId,
        userId,
        documentId,
        extractionRunId,
        selectedDocumentType,
        fileBuffer,
        mimeType
      });
    } catch (error) {
      console.error("Background document extraction failed", error);
    }
  });

  redirect("/documents");
}

export async function saveBusinessContextAction(formData: FormData) {
  const context = await requireMillContext();

  const name = String(formData.get("name") ?? "").trim() || "Rice Mill";
  const location = String(formData.get("location") ?? "").trim() || null;
  const bagWeightRaw = Number(String(formData.get("bag_weight_kg") ?? "").trim());
  const bagWeightKg = Number.isFinite(bagWeightRaw) && bagWeightRaw > 0 ? bagWeightRaw : 40;
  const defaultQuantityUnit = String(formData.get("default_quantity_unit") ?? "").trim() || null;
  const centers = splitList(String(formData.get("centers") ?? ""));
  const dealers = splitList(String(formData.get("dealers") ?? ""));

  const { data: mill } = await context.supabase
    .from("mills")
    .select("metadata")
    .eq("id", context.millId)
    .maybeSingle();

  const existingMetadata = mill?.metadata && typeof mill.metadata === "object" && !Array.isArray(mill.metadata)
    ? (mill.metadata as Record<string, unknown>)
    : {};

  const metadata = {
    ...existingMetadata,
    business_context: {
      bag_weight_kg: bagWeightKg,
      default_quantity_unit: defaultQuantityUnit,
      centers,
      dealers
    }
  };

  await context.supabase
    .from("mills")
    .update({ name, location, metadata, updated_by: context.userId })
    .eq("id", context.millId);

  await createAuditLog(context.supabase, {
    millId: context.millId,
    actorId: context.userId,
    action: "business_context_updated",
    entityType: "mill",
    entityId: context.millId,
    afterValue: { name, location, bag_weight_kg: bagWeightKg, default_quantity_unit: defaultQuantityUnit, centers_count: centers.length, dealers_count: dealers.length },
    sourceType: "manual",
    sourceId: null
  });

  revalidatePath("/setup");
  redirect("/setup");
}

export async function retryExtractionAction(documentId: string) {
  const context = await requireMillContext();

  await context.supabase
    .from("documents")
    .update({ extraction_status: "queued", classification_status: "queued", updated_by: context.userId })
    .eq("mill_id", context.millId)
    .eq("id", documentId);

  revalidatePath("/documents");

  const supabase = context.supabase;
  const millId = context.millId;
  const userId = context.userId;

  after(async () => {
    try {
      await runDocumentExtraction(supabase, { millId, userId, documentId });
    } catch (error) {
      console.error("Background extraction retry failed", error);
    }
  });

  redirect("/documents");
}

export async function confirmDraftAction(draftId: string, fieldNames: string[], formData: FormData) {
  const context = await requireMillContext();
  const correctedValues = Object.fromEntries(
    fieldNames.map((fieldName) => [fieldName, coerceFormValue(fieldName, formData.get(fieldName))])
  );

  const result = await confirmDraft(context.supabase, {
    millId: context.millId,
    userId: context.userId,
    draftId,
    correctedValues
  });

  revalidatePath("/dashboard");
  revalidatePath("/documents");
  revalidatePath("/paddy");
  revalidatePath("/sales");
  revalidatePath("/expenses");
  revalidatePath("/tasks");
  revalidatePath("/alerts");

  if (result.draft.source_type === "voice" && result.draft.input_capture_id) {
    const { data: nextDraft } = await context.supabase
      .from("draft_entries")
      .select("id")
      .eq("mill_id", context.millId)
      .eq("input_capture_id", result.draft.input_capture_id)
      .eq("status", "pending_confirmation")
      .neq("id", draftId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (nextDraft?.id) redirect(`/confirm/${nextDraft.id}`);
  }

  if (result.businessEvent.status === "disputed") redirect("/alerts");
  if (result.businessEvent.status === "incomplete") redirect("/tasks");
  if (result.businessEvent.event_type.startsWith("byproduct_sale")) redirect("/sales");
  if (result.businessEvent.event_type.startsWith("expense")) redirect("/expenses");
  redirect("/paddy");
}

export async function confirmVoiceReviewDraftAction(captureId: string, draftId: string, fieldNames: string[], formData: FormData) {
  const context = await requireMillContext();
  const correctedValues = Object.fromEntries(
    fieldNames.map((fieldName) => [fieldName, coerceFormValue(fieldName, formData.get(fieldName))])
  );

  const result = await confirmDraft(context.supabase, {
    millId: context.millId,
    userId: context.userId,
    draftId,
    correctedValues
  });

  revalidatePath("/dashboard");
  revalidatePath("/voice");
  revalidatePath(`/voice/review/${captureId}`);
  revalidatePath("/paddy");
  revalidatePath("/sales");
  revalidatePath("/expenses");
  revalidatePath("/tasks");
  revalidatePath("/alerts");

  if (result.draft.input_capture_id !== captureId) redirect(`/confirm/${draftId}`);
  redirect(`/voice/review/${captureId}`);
}

export async function reclassifyVoiceReviewDraftAction(captureId: string, draftId: string, nextDraftType: "byproduct_sale" | "expense") {
  const context = await requireMillContext();
  const { data: draft, error: draftError } = await context.supabase
    .from("draft_entries")
    .select("*")
    .eq("mill_id", context.millId)
    .eq("id", draftId)
    .eq("input_capture_id", captureId)
    .eq("source_type", "voice")
    .single();
  if (draftError) throw draftError;

  const { data: fields, error: fieldsError } = await context.supabase
    .from("draft_entry_fields")
    .select("*")
    .eq("mill_id", context.millId)
    .eq("draft_entry_id", draftId)
    .order("created_at", { ascending: true });
  if (fieldsError) throw fieldsError;

  const nextFields = remapVoiceReviewFields(fields as DraftField[], nextDraftType);
  const payload = Object.fromEntries(nextFields.map((field) => [field.field_name, field.value])) as Record<string, Json>;
  const missingFields = nextFields
    .filter((field) => field.required && (field.value === null || field.value === ""))
    .map((field) => field.field_name);

  const { error: updateDraftError } = await context.supabase
    .from("draft_entries")
    .update({
      draft_type: nextDraftType,
      payload,
      missing_fields: missingFields,
      status: "pending_confirmation",
      updated_by: context.userId
    })
    .eq("mill_id", context.millId)
    .eq("id", draft.id);
  if (updateDraftError) throw updateDraftError;

  const { error: deleteFieldsError } = await context.supabase
    .from("draft_entry_fields")
    .delete()
    .eq("mill_id", context.millId)
    .eq("draft_entry_id", draftId);
  if (deleteFieldsError) throw deleteFieldsError;

  const { error: insertFieldsError } = await context.supabase.from("draft_entry_fields").insert(
    nextFields.map((field) => ({
      mill_id: context.millId,
      draft_entry_id: draftId,
      field_name: field.field_name,
      value: field.value,
      source_type: "voice",
      source_id: captureId,
      confidence: field.confidence,
      status: field.status,
      required: field.required,
      needs_review: true,
      created_by: context.userId,
      updated_by: context.userId
    }))
  );
  if (insertFieldsError) throw insertFieldsError;

  revalidatePath(`/voice/review/${captureId}`);
  redirect(`/voice/review/${captureId}`);
}

export async function createManualDraftAction(formData: FormData) {
  const context = await requireMillContext();
  const draftType = draftTypeFromForm(formData);
  const payload = manualPayload(draftType, formData);
  const fields = Object.entries(payload).map(([fieldName, value]) =>
    manualField(fieldName, value, requiredFieldsForDraft(draftType).includes(fieldName))
  );

  const draft = await createManualDraft(context.supabase, {
    millId: context.millId,
    userId: context.userId,
    draftType,
    payload,
    fields
  });

  revalidatePath("/dashboard");
  redirect(`/confirm/${draft.id}`);
}

export async function createExpenseDraftFromRoughNoteAction(documentId: string, formData: FormData) {
  const context = await requireMillContext();
  const lineText = String(formData.get("line_text") ?? "").trim();
  if (!lineText) throw new Error("Choose a rough-note line first.");

  const { data: document, error: documentError } = await context.supabase
    .from("documents")
    .select("id,document_type")
    .eq("mill_id", context.millId)
    .eq("id", documentId)
    .single();
  if (documentError) throw documentError;
  if (document.document_type !== "rough_notes") throw new Error("Only rough notes can create review drafts from candidate lines.");

  const parsed = parseRoughNoteExpenseLine(lineText);
  const payload = {
    expense_date: new Date().toISOString().slice(0, 10),
    expense_category: parsed.category,
    vendor_name: parsed.vendorName,
    amount: parsed.amount,
    currency: "INR",
    notes: `From rough note: ${parsed.notes ?? lineText}`
  } satisfies Record<string, Json>;
  const fields = Object.entries(payload).map(([fieldName, value]) =>
    roughNoteExpenseField(fieldName, value, ["expense_date", "expense_category", "amount"].includes(fieldName))
  );

  const draft = await createManualDraft(context.supabase, {
    millId: context.millId,
    userId: context.userId,
    draftType: "expense",
    sourceType: "document",
    sourceId: documentId,
    documentId,
    payload,
    fields
  });

  revalidatePath("/documents");
  revalidatePath("/dashboard");
  redirect(`/confirm/${draft.id}`);
}

export async function createByproductDraftFromRoughNoteAction(documentId: string, formData: FormData) {
  const context = await requireMillContext();
  const lineText = String(formData.get("line_text") ?? "").trim();
  if (!lineText) throw new Error("Choose a rough-note line first.");

  const { data: document, error: documentError } = await context.supabase
    .from("documents")
    .select("id,document_type")
    .eq("mill_id", context.millId)
    .eq("id", documentId)
    .single();
  if (documentError) throw documentError;
  if (document.document_type !== "rough_notes") throw new Error("Only rough notes can create review drafts from candidate lines.");

  const parsed = parseRoughNoteByproductLine(lineText);
  if (!parsed.productType) throw new Error("This rough-note line does not contain a known by-product alias.");

  const payload = {
    sale_date: new Date().toISOString().slice(0, 10),
    dealer_name: null,
    product_type: parsed.productType,
    paddy_source_type: "unknown",
    quantity: null,
    quantity_unit: "qtl",
    rate: null,
    subtotal_amount: parsed.subtotalAmount,
    payment_status: "pending",
    notes: `From rough note: ${parsed.notes ?? lineText}`
  } satisfies Record<string, Json>;
  const fields = Object.entries(payload).map(([fieldName, value]) =>
    roughNoteDraftField(fieldName, value, ["sale_date", "product_type", "quantity", "quantity_unit", "rate"].includes(fieldName))
  );

  const draft = await createManualDraft(context.supabase, {
    millId: context.millId,
    userId: context.userId,
    draftType: "byproduct_sale",
    sourceType: "document",
    sourceId: documentId,
    documentId,
    payload,
    fields
  });

  revalidatePath("/documents");
  revalidatePath("/dashboard");
  redirect(`/confirm/${draft.id}`);
}

export async function cancelDraftAction(draftId: string) {
  const context = await requireMillContext();
  const cancelledAt = new Date().toISOString();

  const { error } = await context.supabase
    .from("draft_entries")
    .update(draftCancelUpdatePayload(context.userId))
    .eq("mill_id", context.millId)
    .eq("id", draftId)
    .in("status", ["draft", "pending_confirmation", "incomplete"]);
  if (error) throw error;

  await createAuditLog(context.supabase, {
    millId: context.millId,
    actorId: context.userId,
    action: "draft_cancelled",
    entityType: "draft_entry",
    entityId: draftId,
    afterValue: { status: "cancelled", cancelled_at: cancelledAt },
    sourceType: "manual",
    sourceId: null
  });

  revalidatePath("/dashboard");
  revalidatePath("/documents");
  revalidatePath("/tasks");
  redirect("/documents");
}

export async function generateCaExportAction() {
  const context = await requireMillContext();
  const { periodStart, periodEnd } = currentMonthPeriod();

  const [{ data: events, error: eventsError }, { data: tasks, error: tasksError }, { data: lots, error: lotsError }, { data: alerts, error: alertsError }] = await Promise.all([
    context.supabase
      .from("business_events")
      .select("*")
      .eq("mill_id", context.millId)
      .gte("event_date", periodStart)
      .lte("event_date", periodEnd)
      .order("event_date", { ascending: false }),
    context.supabase.from("tasks").select("*").eq("mill_id", context.millId).in("status", ["open", "in_progress"]),
    context.supabase.from("paddy_lots").select("*").eq("mill_id", context.millId).eq("status", "disputed"),
    context.supabase.from("alerts").select("*").eq("mill_id", context.millId).in("status", ["open", "snoozed"])
  ]);
  if (eventsError) throw eventsError;
  if (tasksError) throw tasksError;
  if (lotsError) throw lotsError;
  if (alertsError) throw alertsError;

  const preview = buildCaExportPreview({
    businessEvents: events ?? [],
    tasks: tasks ?? [],
    disputedLots: lots ?? [],
    alerts: alerts ?? []
  });
  const generatedAt = new Date().toISOString();
  const summary = buildCaExportSummary({ preview, periodStart, periodEnd, generatedAt });

  const { data: latestVersion, error: latestError } = await context.supabase
    .from("export_snapshots")
    .select("version")
    .eq("mill_id", context.millId)
    .eq("export_type", "ca_monthly")
    .eq("period_start", periodStart)
    .eq("period_end", periodEnd)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (latestError) throw latestError;

  const version = Number(latestVersion?.version ?? 0) + 1;
  const { data: snapshot, error: snapshotError } = await context.supabase
    .from("export_snapshots")
    .insert({
      mill_id: context.millId,
      export_type: "ca_monthly",
      period_start: periodStart,
      period_end: periodEnd,
      version,
      status: "exported",
      summary,
      generated_by: context.userId,
      generated_at: generatedAt,
      locked_at: generatedAt,
      idempotency_key: `ca_monthly:${periodStart}:${periodEnd}:v${version}`,
      created_by: context.userId,
      updated_by: context.userId
    })
    .select("id")
    .single();
  if (snapshotError) throw snapshotError;

  const confirmedIds = preview.confirmed.map((event) => event.id);
  if (confirmedIds.length > 0) {
    const { error: lockError } = await context.supabase
      .from("business_events")
      .update({ status: "exported", updated_by: context.userId })
      .eq("mill_id", context.millId)
      .in("id", confirmedIds)
      .in("status", ["confirmed", "reconciled"]);
    if (lockError) throw lockError;
  }

  await createAuditLog(context.supabase, {
    millId: context.millId,
    actorId: context.userId,
    action: "ca_export_snapshot_created",
    entityType: "export_snapshot",
    entityId: snapshot.id,
    afterValue: { period_start: periodStart, period_end: periodEnd, version, summary: preview.summary },
    sourceType: "system_calculation",
    sourceId: null
  });

  revalidatePath("/reports/ca-export");
  revalidatePath("/dashboard");
  redirect(`/api/reports/ca-export/${snapshot.id}/download?format=csv`);
}

export async function completeTaskAction(taskId: string) {
  const context = await requireMillContext();
  await context.supabase
    .from("tasks")
    .update({
      status: "completed",
      completed_by: context.userId,
      completed_at: new Date().toISOString(),
      updated_by: context.userId
    })
    .eq("mill_id", context.millId)
    .eq("id", taskId);
  revalidatePath("/tasks");
}

export async function snoozeTaskAction(taskId: string) {
  const context = await requireMillContext();
  const snoozedUntil = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  await context.supabase
    .from("tasks")
    .update({ status: "snoozed", snoozed_until: snoozedUntil, updated_by: context.userId })
    .eq("mill_id", context.millId)
    .eq("id", taskId);
  revalidatePath("/tasks");
}

export async function resolveAlertAction(alertId: string, formData: FormData) {
  const context = await requireMillContext();
  const reason = String(formData.get("reason") ?? "").trim();
  await context.supabase
    .from("alerts")
    .update({
      status: "resolved",
      resolved_by: context.userId,
      resolved_at: new Date().toISOString(),
      metadata: { resolution_reason: reason },
      updated_by: context.userId
    })
    .eq("mill_id", context.millId)
    .eq("id", alertId);
  revalidatePath("/alerts");
}

export async function linkWeighbridgeDocumentAction(formData: FormData) {
  const context = await requireMillContext();
  const documentId = String(formData.get("document_id") ?? "");
  const paddyLotId = String(formData.get("paddy_lot_id") ?? "");
  if (!documentId || !paddyLotId) throw new Error("Choose a document and paddy lot to link.");

  const { data: run, error: runError } = await context.supabase
    .from("extraction_runs")
    .select("validated_output")
    .eq("mill_id", context.millId)
    .eq("document_id", documentId)
    .eq("status", "succeeded")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (runError) throw runError;

  const extraction = extractionObject(run?.validated_output);
  const gross = jsonNumber(extraction.gross_weight);
  const tare = jsonNumber(extraction.tare_weight);
  const net = jsonNumber(extraction.net_weight);
  const quantityUnit = typeof extraction.quantity_unit === "string" ? extraction.quantity_unit : null;

  const { data: lot, error: lotUpdateError } = await context.supabase
    .from("paddy_lots")
    .update({
      weighbridge_gross_weight: gross,
      weighbridge_tare_weight: tare,
      weighbridge_net_weight: net,
      weighbridge_quantity_unit: quantityUnit,
      updated_by: context.userId
    })
    .eq("mill_id", context.millId)
    .eq("id", paddyLotId)
    .select("id, confirmed_quantity, quantity_unit")
    .single();
  if (lotUpdateError) throw lotUpdateError;

  // The weighbridge slip is the moment a fourth source of truth lands on the lot, so
  // reconcile it against the declared quantity here and raise an idempotent alert.
  const businessConfig = await getMillBusinessConfig(context.supabase, context.millId);
  const weighbridgeMismatch = buildWeighbridgeMismatchAlert({
    declaredQuantity: jsonNumber(lot?.confirmed_quantity),
    declaredUnit: typeof lot?.quantity_unit === "string" ? lot.quantity_unit : null,
    weighbridgeNetWeight: net,
    weighbridgeUnit: quantityUnit ?? "kg",
    bagWeightKg: businessConfig.bagWeightKg
  });
  if (weighbridgeMismatch) {
    const { data: existingMismatch } = await context.supabase
      .from("alerts")
      .select("id")
      .eq("mill_id", context.millId)
      .eq("alert_type", weighbridgeMismatch.alert_type)
      .eq("linked_entity_id", paddyLotId)
      .in("status", ["open", "snoozed"])
      .maybeSingle();
    if (!existingMismatch) {
      await context.supabase.from("alerts").insert({
        mill_id: context.millId,
        alert_type: weighbridgeMismatch.alert_type,
        title: weighbridgeMismatch.title,
        message: weighbridgeMismatch.message,
        severity: weighbridgeMismatch.severity,
        linked_entity_type: "paddy_lots",
        linked_entity_id: paddyLotId,
        evidence: weighbridgeMismatch.evidence,
        action_label: weighbridgeMismatch.action_label ?? null,
        action_url: "/paddy",
        created_by: context.userId,
        updated_by: context.userId
      });
    }
  }

  await context.supabase.from("document_links").insert({
    mill_id: context.millId,
    document_id: documentId,
    linked_entity_type: "paddy_lot",
    linked_entity_id: paddyLotId,
    link_type: "weighbridge_evidence",
    created_by: context.userId
  });

  await createAuditLog(context.supabase, {
    millId: context.millId,
    actorId: context.userId,
    action: "weighbridge_document_linked",
    entityType: "paddy_lot",
    entityId: paddyLotId,
    afterValue: {
      document_id: documentId,
      gross,
      tare,
      net,
      quantity_unit: quantityUnit,
      weighbridge_mismatch: Boolean(weighbridgeMismatch)
    },
    sourceType: "weighbridge_slip",
    sourceId: documentId
  });

  revalidatePath("/documents");
  revalidatePath("/paddy");
  redirect("/documents");
}

function draftTypeFromForm(formData: FormData): DraftType {
  const value = String(formData.get("draft_type") ?? "paddy_inward");
  if (value === "byproduct_sale" || value === "expense" || value === "paddy_inward") return value;
  return "paddy_inward";
}

function manualPayload(draftType: DraftType, formData: FormData): Record<string, Json> {
  if (draftType === "byproduct_sale") {
    return {
      sale_date: String(formData.get("sale_date") || new Date().toISOString().slice(0, 10)),
      dealer_name: coerceFormValue("dealer_name", formData.get("dealer_name")),
      product_type: coerceFormValue("product_type", formData.get("product_type")) ?? "bran",
      paddy_source_type: coerceFormValue("paddy_source_type", formData.get("paddy_source_type")) ?? "unknown",
      quantity: coerceFormValue("quantity", formData.get("quantity")),
      quantity_unit: coerceFormValue("quantity_unit", formData.get("quantity_unit")) ?? "qtl",
      rate: coerceFormValue("rate", formData.get("rate")),
      payment_status: coerceFormValue("payment_status", formData.get("payment_status")) ?? "pending",
      notes: coerceFormValue("notes", formData.get("notes"))
    };
  }

  if (draftType === "expense") {
    return {
      expense_date: String(formData.get("expense_date") || new Date().toISOString().slice(0, 10)),
      expense_category: coerceFormValue("expense_category", formData.get("expense_category")) ?? "other",
      vendor_name: coerceFormValue("vendor_name", formData.get("vendor_name")),
      amount: coerceFormValue("amount", formData.get("amount")),
      currency: "INR",
      notes: coerceFormValue("notes", formData.get("notes"))
    };
  }

  return {
    arrival_date: String(formData.get("arrival_date") || new Date().toISOString().slice(0, 10)),
    paddy_source_type: coerceFormValue("paddy_source_type", formData.get("paddy_source_type")) ?? "unknown",
    source_party_name: coerceFormValue("source_party_name", formData.get("source_party_name")),
    truck_number: coerceFormValue("truck_number", formData.get("truck_number")),
    truck_sheet_bag_count: coerceFormValue("truck_sheet_bag_count", formData.get("truck_sheet_bag_count")),
    physical_bag_count: coerceFormValue("physical_bag_count", formData.get("physical_bag_count")),
    app_quantity: coerceFormValue("app_quantity", formData.get("app_quantity")),
    confirmed_quantity: coerceFormValue("confirmed_quantity", formData.get("confirmed_quantity")),
    quantity_unit: coerceFormValue("quantity_unit", formData.get("quantity_unit")),
    moisture_percent: coerceFormValue("moisture_percent", formData.get("moisture_percent")),
    notes: coerceFormValue("notes", formData.get("notes"))
  };
}

function requiredFieldsForDraft(draftType: DraftType) {
  if (draftType === "byproduct_sale") return ["sale_date", "product_type", "quantity", "quantity_unit", "rate"];
  if (draftType === "expense") return ["expense_date", "expense_category", "amount"];
  return ["arrival_date", "paddy_source_type", "source_party_name", "confirmed_quantity", "quantity_unit"];
}

function manualField(fieldName: string, value: Json, required: boolean): DraftField {
  const missing = value === null || value === "";
  return {
    field_name: fieldName,
    value,
    status: missing ? "missing" : "draft",
    confidence: null,
    required,
    needs_review: false,
    source_type: "manual"
  };
}

function roughNoteExpenseField(fieldName: string, value: Json, required: boolean): DraftField {
  return roughNoteDraftField(fieldName, value, required);
}

function roughNoteDraftField(fieldName: string, value: Json, required: boolean): DraftField {
  const missing = value === null || value === "";
  return {
    field_name: fieldName,
    value,
    status: missing ? "missing" : "needs_review",
    confidence: null,
    required,
    needs_review: true,
    source_type: "document"
  };
}

function remapVoiceReviewFields(fields: DraftField[], draftType: "byproduct_sale" | "expense") {
  const byName = new Map(fields.map((field) => [field.field_name, field]));
  const date = byName.get("sale_date") ?? byName.get("expense_date");
  const notes = byName.get("notes");

  if (draftType === "byproduct_sale") {
    return [
      voiceReviewField("sale_date", date?.value ?? new Date().toISOString().slice(0, 10), byName.get("sale_date") ?? date, true),
      voiceReviewField("dealer_name", byName.get("dealer_name")?.value ?? byName.get("vendor_name")?.value ?? null, byName.get("dealer_name") ?? byName.get("vendor_name"), false),
      voiceReviewField("product_type", inferVoiceReviewProduct(fields), byName.get("product_type"), true),
      voiceReviewField("paddy_source_type", byName.get("paddy_source_type")?.value ?? "unknown", byName.get("paddy_source_type"), false),
      voiceReviewField("quantity", byName.get("quantity")?.value ?? null, byName.get("quantity"), true),
      voiceReviewField("quantity_unit", byName.get("quantity_unit")?.value ?? "qtl", byName.get("quantity_unit"), true),
      voiceReviewField("rate", byName.get("rate")?.value ?? byName.get("amount")?.value ?? null, byName.get("rate") ?? byName.get("amount"), true),
      voiceReviewField("payment_status", byName.get("payment_status")?.value ?? "pending", byName.get("payment_status"), false),
      voiceReviewField("notes", notes?.value ?? null, notes, false)
    ];
  }

  return [
    voiceReviewField("expense_date", date?.value ?? new Date().toISOString().slice(0, 10), byName.get("expense_date") ?? date, true),
    voiceReviewField("expense_category", inferVoiceReviewExpenseCategory(fields), byName.get("expense_category"), true),
    voiceReviewField("vendor_name", byName.get("vendor_name")?.value ?? byName.get("dealer_name")?.value ?? null, byName.get("vendor_name") ?? byName.get("dealer_name"), false),
    voiceReviewField("amount", byName.get("amount")?.value ?? byName.get("rate")?.value ?? null, byName.get("amount") ?? byName.get("rate"), true),
    voiceReviewField("currency", byName.get("currency")?.value ?? "INR", byName.get("currency"), false),
    voiceReviewField("notes", notes?.value ?? null, notes, false)
  ];
}

function voiceReviewField(fieldName: string, value: Json, source: DraftField | undefined, required: boolean): DraftField {
  const missing = value === null || value === "";
  return {
    field_name: fieldName,
    value,
    status: missing ? "missing" : "needs_review",
    confidence: source?.confidence ?? null,
    required,
    needs_review: true,
    source_type: "voice"
  };
}

function inferVoiceReviewProduct(fields: DraftField[]) {
  const text = JSON.stringify(fields.map((field) => field.value)).toLowerCase();
  if (text.includes("nookalu") || text.includes("broken")) return "broken_rice";
  if (text.includes("pottu") || text.includes("husk")) return "husk";
  if (text.includes("rice") && !text.includes("broken")) return "rice";
  return "bran";
}

function inferVoiceReviewExpenseCategory(fields: DraftField[]) {
  const text = JSON.stringify(fields.map((field) => field.value)).toLowerCase();
  if (text.includes("electricity") || text.includes("current")) return "electricity";
  if (text.includes("diesel") || text.includes("transport")) return "transport";
  if (text.includes("maintenance")) return "maintenance";
  if (text.includes("hamali") || text.includes("kamali") || text.includes("amali") || text.includes("coolie") || text.includes("labour") || text.includes("labor") || text.includes("wages")) return "labour";
  return "other";
}

function extractionObject(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {} as Record<string, unknown>;
  const record = value as Record<string, unknown>;
  return record.extraction && typeof record.extraction === "object" && !Array.isArray(record.extraction)
    ? record.extraction as Record<string, unknown>
    : record;
}

function splitList(value: string) {
  return Array.from(
    new Set(
      value
        .split(/[\n,]/)
        .map((item) => item.trim())
        .filter((item) => item.length > 0)
    )
  );
}

function jsonNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}
