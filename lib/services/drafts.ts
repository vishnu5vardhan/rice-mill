import type { Json, DraftEntry, DraftField, LedgerDecision } from "@/lib/types";
import type { SupabaseServerClient } from "@/lib/supabase/server";
import { buildCorrectionMemoryRows } from "@/lib/corrections/memory";
import { buildLedgerDecision } from "@/lib/ledger/events";
import { buildLowRateAlert } from "@/lib/reconciliation/byproduct";
import { buildNegativeStockAlert, CONFIRMED_STOCK_STATUSES } from "@/lib/ledger/stock";
import { getMillBusinessConfig } from "@/lib/services/business-context";
import { invalidateVoicePromptContext } from "@/lib/services/voice-prompt-context";
import { createAuditLog } from "@/lib/services/audit";

export async function getDraftWithFields(supabase: SupabaseServerClient, millId: string, draftId: string) {
  const { data: draft, error: draftError } = await supabase
    .from("draft_entries")
    .select("*")
    .eq("mill_id", millId)
    .eq("id", draftId)
    .single();

  throwIfDbError("Loading draft", draftError);

  const { data: fields, error: fieldsError } = await supabase
    .from("draft_entry_fields")
    .select("*")
    .eq("mill_id", millId)
    .eq("draft_entry_id", draftId)
    .order("created_at");

  throwIfDbError("Loading draft fields", fieldsError);
  return { draft: draft as DraftEntry, fields: fields as DraftField[] };
}

export async function createManualDraft(
  supabase: SupabaseServerClient,
  input: {
    millId: string;
    userId: string | null;
    draftType: string;
    payload: Record<string, Json>;
    fields: DraftField[];
    sourceType?: string;
    sourceId?: string | null;
    documentId?: string | null;
    extractionRunId?: string | null;
  }
) {
  const { data: draft, error: draftError } = await supabase
    .from("draft_entries")
    .insert({
      mill_id: input.millId,
      draft_type: input.draftType,
      source_type: input.sourceType ?? "manual",
      source_id: input.sourceId ?? null,
      document_id: input.documentId ?? null,
      extraction_run_id: input.extractionRunId ?? null,
      payload: input.payload,
      missing_fields: input.fields.filter((field) => field.status === "missing" && field.required).map((field) => field.field_name),
      status: "pending_confirmation",
      created_by: input.userId,
      updated_by: input.userId
    })
    .select("*")
    .single();

  throwIfDbError("Creating manual draft", draftError);

  const { error: fieldsInsertError } = await supabase.from("draft_entry_fields").insert(
    input.fields.map((field) => ({
      mill_id: input.millId,
      draft_entry_id: draft.id,
      field_name: field.field_name,
      value: field.value,
      source_type: input.sourceType ?? "manual",
      source_id: input.sourceId ?? null,
      linked_document_id: input.documentId ?? null,
      confidence: field.confidence,
      status: field.status,
      required: field.required,
      needs_review: field.needs_review,
      created_by: input.userId,
      updated_by: input.userId
    }))
  );
  throwIfDbError("Creating manual draft fields", fieldsInsertError);

  return draft as DraftEntry;
}

export async function confirmDraft(
  supabase: SupabaseServerClient,
  input: {
    millId: string;
    userId: string | null;
    draftId: string;
    correctedValues: Record<string, Json>;
  }
) {
  const { draft, fields } = await getDraftWithFields(supabase, input.millId, input.draftId);
  const businessConfig = await getMillBusinessConfig(supabase, input.millId);
  const decision = buildLedgerDecision({
    draft,
    fields,
    correctedValues: input.correctedValues,
    actorId: input.userId,
    bagWeightKg: businessConfig.bagWeightKg
  });

  const correctionRows = buildCorrectionMemoryRows(
    fields.map((field) => ({
      field,
      correctedValue: confirmedFieldValue(field, input.correctedValues),
      userId: input.userId,
      millId: input.millId,
      draftEntryId: draft.id,
      documentId: draft.document_id,
      extractionRunId: draft.extraction_run_id
    }))
  );

  if (correctionRows.length > 0) {
    const { error } = await supabase.from("correction_memory").insert(correctionRows);
    throwIfDbError("Saving correction memory", error);
    invalidateVoicePromptContext(input.millId);
  }

  const confirmedAt = new Date().toISOString();
  await Promise.all(
    fields.map(async (field) => {
      const nextValue = confirmedFieldValue(field, input.correctedValues);
      const { error } = await supabase
        .from("draft_entry_fields")
        .update({
          value: nextValue,
          status: nextValue === null || nextValue === "" ? "missing" : "user_confirmed",
          confirmed_by: input.userId,
          confirmed_at: confirmedAt,
          updated_by: input.userId
        })
        .eq("mill_id", input.millId)
        .eq("id", field.id);
      throwIfDbError(`Saving confirmed field ${field.field_name}`, error);
    })
  );

  const { data: businessEvent, error: businessError } = await supabase
    .from("business_events")
    .upsert(
      {
        mill_id: input.millId,
        event_type: decision.businessEvent.event_type,
        event_date: decision.businessEvent.event_date,
        source_type: draft.source_type,
        source_id: draft.source_id,
        draft_entry_id: draft.id,
        document_id: draft.document_id,
        payload: decision.businessEvent.payload,
        status: decision.businessEvent.status,
        idempotency_key: decision.businessEvent.idempotency_key,
        confirmed_by: input.userId,
        confirmed_at: new Date().toISOString(),
        created_by: input.userId,
        updated_by: input.userId
      },
      { onConflict: "mill_id,idempotency_key" }
    )
    .select("*")
    .single();

  throwIfDbError("Saving business event", businessError);

  let operation: { id: string } | null = null;
  if (decision.operation) {
    const linkColumn = decision.operation.table === "paddy_lots" ? "created_from_business_event_id" : "business_event_id";
    const operationPayload = withoutUndefined({
      ...decision.operation.payload,
      mill_id: input.millId,
      [linkColumn]: businessEvent.id,
      document_id: decision.operation.table === "paddy_lots" ? undefined : draft.document_id,
      created_by: input.userId,
      updated_by: input.userId
    });

    const { data: existingOperation, error: existingOperationError } = await supabase
      .from(decision.operation.table)
      .select("id")
      .eq("mill_id", input.millId)
      .eq(linkColumn, businessEvent.id)
      .maybeSingle();
    throwIfDbError("Checking existing operation", existingOperationError);

    const { data, error } = existingOperation
      ? await supabase
          .from(decision.operation.table)
          .update(operationPayload)
          .eq("mill_id", input.millId)
          .eq("id", existingOperation.id)
          .select("id")
          .single()
      : await supabase
          .from(decision.operation.table)
          .insert(operationPayload)
          .select("id")
          .single();

    throwIfDbError("Saving operation record", error);
    if (!data) throw new Error("Saving operation record failed: no operation id returned.");
    operation = data;

    const { error: eventLinkError } = await supabase
      .from("business_events")
      .update({
        related_entity_type: decision.operation.table,
        related_entity_id: data.id,
        updated_by: input.userId
      })
      .eq("id", businessEvent.id);
    throwIfDbError("Linking business event to operation", eventLinkError);
  }

  if (decision.stockEvent && operation) {
    const { error: stockError } = await supabase.from("stock_events").upsert(
      {
        mill_id: input.millId,
        business_event_id: businessEvent.id,
        event_type: decision.stockEvent.event_type,
        event_date: decision.stockEvent.event_date,
        product_type: decision.stockEvent.product_type,
        paddy_source_type: decision.stockEvent.paddy_source_type,
        direction: decision.stockEvent.direction,
        quantity_delta: decision.stockEvent.quantity_delta,
        quantity_unit: decision.stockEvent.quantity_unit,
        related_entity_type: decision.stockEvent.related_entity_type,
        related_entity_id: operation.id,
        payload: decision.stockEvent.payload,
        status: decision.stockEvent.status,
        idempotency_key: decision.stockEvent.idempotency_key,
        created_by: input.userId,
        updated_by: input.userId
      },
      { onConflict: "mill_id,idempotency_key" }
    );
    throwIfDbError("Saving stock event", stockError);

    // Out-events (e.g. by-product sales) can drive a confirmed balance below zero.
    // Detect it the moment the event lands, not in a nightly sweep.
    if (decision.stockEvent.direction === "out") {
      await raiseNegativeStockAlertIfNeeded(supabase, {
        millId: input.millId,
        userId: input.userId,
        stockEvent: decision.stockEvent,
        linkedEntityType: decision.operation?.table ?? "stock_event",
        linkedEntityId: operation.id
      });
    }
  }

  if (operation) {
    const operationId = operation.id;
    const linkedEntityType = taskLinkedEntityType(decision.operation?.table);
    const currentMissingFields = new Set(decision.tasks.map((task) => task.missing_field_name).filter(Boolean));

    const { data: openTasks, error: openTasksError } = await supabase
      .from("tasks")
      .select("id,missing_field_name")
      .eq("mill_id", input.millId)
      .eq("linked_entity_type", linkedEntityType)
      .eq("linked_entity_id", operationId)
      .in("status", ["open", "in_progress", "snoozed"]);
    throwIfDbError("Loading open missing-data tasks", openTasksError);

    await Promise.all((openTasks ?? []).map(async (task) => {
      const field = task.missing_field_name;
      if (field && currentMissingFields.has(field)) return;

      const { error } = await supabase
        .from("tasks")
        .update({
          status: "completed",
          completed_by: input.userId,
          completed_at: new Date().toISOString(),
          updated_by: input.userId
        })
        .eq("mill_id", input.millId)
        .eq("id", task.id);
      throwIfDbError("Completing resolved missing-data task", error);
    }));

    await Promise.all(decision.tasks.map(async (task) => {
      let existingTaskQuery = supabase
        .from("tasks")
        .select("id")
        .eq("mill_id", input.millId)
        .eq("linked_entity_type", task.linked_entity_type ?? decision.operation?.table ?? "draft_entry")
        .eq("linked_entity_id", operationId)
        .in("status", ["open", "in_progress", "snoozed"]);

      existingTaskQuery = task.missing_field_name
        ? existingTaskQuery.eq("missing_field_name", task.missing_field_name)
        : existingTaskQuery.is("missing_field_name", null);

      const { data: existing, error: existingTaskError } = await existingTaskQuery.maybeSingle();
      throwIfDbError("Checking existing missing-data task", existingTaskError);

      if (!existing) {
        const { error } = await supabase.from("tasks").insert({
          mill_id: input.millId,
          task_type: task.task_type,
          title: task.title,
          description: task.description,
          priority: task.priority,
          linked_entity_type: task.linked_entity_type ?? decision.operation?.table,
          linked_entity_id: operationId,
          missing_field_name: task.missing_field_name,
          source_type: draft.source_type,
          source_id: draft.source_id,
          created_by: input.userId,
          updated_by: input.userId
        });
        throwIfDbError("Creating missing-data task", error);
      }
    }));
  }

  const alerts = [...decision.alerts];
  if (decision.operation?.table === "byproduct_sales" && operation) {
    const product = String(decision.operation.payload.product_type);
    const unit = decision.operation.payload.quantity_unit;

    // Rate is per-unit, so only compare against sales in the SAME unit — otherwise a
    // ₹/kg rate gets averaged with ₹/qtl rates and the alert is meaningless.
    let historicalQuery = supabase
      .from("byproduct_sales")
      .select("rate")
      .eq("mill_id", input.millId)
      .eq("product_type", product)
      .eq("status", "confirmed")
      .not("rate", "is", null)
      .neq("id", operation.id);
    if (typeof unit === "string") {
      historicalQuery = historicalQuery.eq("quantity_unit", unit);
    }

    const { data: historical } = await historicalQuery.order("sale_date", { ascending: false }).limit(5);

    const alert = buildLowRateAlert(decision.businessEvent.payload as never, (historical ?? []).map((row) => Number(row.rate)));
    if (alert) alerts.push(alert);
  }

  if (alerts.length > 0) {
    const linkedEntityType = decision.operation?.table ?? "business_event";
    const linkedEntityId = operation?.id ?? businessEvent.id;
    const actionUrl = operation ? `/${decision.operation?.table === "paddy_lots" ? "paddy" : "alerts"}` : "/alerts";

    // Idempotent: re-confirming the same draft must not duplicate an open alert.
    // One alert per (alert_type, linked entity) while still open/snoozed.
    for (const alert of alerts) {
      const { data: existingAlert, error: existingAlertError } = await supabase
        .from("alerts")
        .select("id")
        .eq("mill_id", input.millId)
        .eq("alert_type", alert.alert_type)
        .eq("linked_entity_id", linkedEntityId)
        .in("status", ["open", "snoozed"])
        .maybeSingle();
      throwIfDbError("Checking existing alert", existingAlertError);
      if (existingAlert) continue;

      const { error } = await supabase.from("alerts").insert({
        mill_id: input.millId,
        alert_type: alert.alert_type,
        title: alert.title,
        message: alert.message,
        severity: alert.severity,
        linked_entity_type: linkedEntityType,
        linked_entity_id: linkedEntityId,
        evidence: alert.evidence,
        action_label: alert.action_label ?? null,
        action_url: actionUrl,
        created_by: input.userId,
        updated_by: input.userId
      });
      throwIfDbError("Creating alert", error);
    }
  }

  const { error: draftUpdateError } = await supabase
    .from("draft_entries")
    .update({
      status: decision.businessEvent.status,
      confirmed_by: input.userId,
      confirmed_at: new Date().toISOString(),
      missing_fields: decision.tasks.map((task) => task.missing_field_name).filter(Boolean),
      updated_by: input.userId
    })
    .eq("id", draft.id);
  throwIfDbError("Updating draft status", draftUpdateError);

  await createAuditLog(supabase, {
    millId: input.millId,
    actorId: input.userId,
    action: "draft_confirmed",
    entityType: "draft_entry",
    entityId: draft.id,
    afterValue: {
      business_event_id: businessEvent.id,
      operation_id: operation?.id ?? null,
      stock_created: Boolean(decision.stockEvent && operation),
      corrections_saved: correctionRows.length
    },
    sourceType: draft.source_type,
    sourceId: draft.source_id
  });

  return { draft, businessEvent, operation, stockCreated: Boolean(decision.stockEvent && operation), correctionCount: correctionRows.length };
}

async function raiseNegativeStockAlertIfNeeded(
  supabase: SupabaseServerClient,
  input: {
    millId: string;
    userId: string | null;
    stockEvent: NonNullable<LedgerDecision["stockEvent"]>;
    linkedEntityType: string;
    linkedEntityId: string;
  }
) {
  const { stockEvent } = input;

  // Sum every confirmed event for this product/source/unit, including the one just
  // written, to get the true post-event balance.
  const { data: keyEvents, error: keyEventsError } = await supabase
    .from("stock_events")
    .select("quantity_delta,status")
    .eq("mill_id", input.millId)
    .eq("product_type", stockEvent.product_type)
    .eq("paddy_source_type", stockEvent.paddy_source_type)
    .eq("quantity_unit", stockEvent.quantity_unit);
  throwIfDbError("Loading stock for negative-balance check", keyEventsError);

  const confirmed = (keyEvents ?? []).filter((row) =>
    CONFIRMED_STOCK_STATUSES.includes(row.status)
  );
  const resultingConfirmedBalance = confirmed.reduce((sum, row) => sum + Number(row.quantity_delta), 0);
  const hadConfirmedInflow = confirmed.some((row) => Number(row.quantity_delta) > 0);

  const alert = buildNegativeStockAlert({
    productType: stockEvent.product_type,
    paddySourceType: stockEvent.paddy_source_type,
    quantityUnit: stockEvent.quantity_unit,
    resultingConfirmedBalance,
    hadConfirmedInflow
  });
  if (!alert) return;

  const key = String(alert.evidence.stock_key);

  // Idempotent: at most one open/snoozed negative-stock alert per stock key, so repeated
  // sales of an untracked product do not flood the owner.
  const { data: existing, error: existingError } = await supabase
    .from("alerts")
    .select("id")
    .eq("mill_id", input.millId)
    .eq("alert_type", "negative_stock")
    .in("status", ["open", "snoozed"])
    .eq("metadata->>stock_key", key)
    .maybeSingle();
  throwIfDbError("Checking existing negative-stock alert", existingError);
  if (existing) return;

  const { error: insertError } = await supabase.from("alerts").insert({
    mill_id: input.millId,
    alert_type: alert.alert_type,
    title: alert.title,
    message: alert.message,
    severity: alert.severity,
    linked_entity_type: input.linkedEntityType,
    linked_entity_id: input.linkedEntityId,
    evidence: alert.evidence,
    action_label: alert.action_label ?? null,
    action_url: "/alerts",
    metadata: { stock_key: key },
    created_by: input.userId,
    updated_by: input.userId
  });
  throwIfDbError("Creating negative-stock alert", insertError);
}

function confirmedFieldValue(field: DraftField, correctedValues: Record<string, Json>) {
  return Object.prototype.hasOwnProperty.call(correctedValues, field.field_name)
    ? correctedValues[field.field_name] ?? null
    : field.value ?? null;
}

function withoutUndefined(value: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined));
}

function taskLinkedEntityType(table: NonNullable<LedgerDecision["operation"]>["table"] | undefined) {
  if (table === "paddy_lots") return "paddy_lot";
  if (table === "byproduct_sales") return "byproduct_sale";
  if (table === "expenses") return "expense";
  return "draft_entry";
}

function throwIfDbError(action: string, error: unknown) {
  if (!error) return;

  const dbError = error as { message?: string; code?: string; details?: string | null; hint?: string | null };
  const parts = [
    dbError.message,
    dbError.code ? `code ${dbError.code}` : null,
    dbError.details ? `details: ${dbError.details}` : null,
    dbError.hint ? `hint: ${dbError.hint}` : null
  ].filter(Boolean);

  throw new Error(`${action} failed${parts.length ? `: ${parts.join("; ")}` : "."}`);
}
