import type { SupabaseServerClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/types";
import { answerWithOpenAI, hasOpenAIAskConfig } from "@/lib/ai/openai-ask";
import { buildBusinessContext, toAskProfile } from "@/lib/services/business-context";
import { calculateStockSummary } from "@/lib/ledger/stock";
import { parseQuestionIntent, intentLabel } from "@/lib/ask/intents";
import { separateByRecordStatus } from "@/lib/ask/evidence";
import { buildChatActionSuggestions } from "@/lib/services/ask-tools";

export async function answerQuestion(
  supabase: SupabaseServerClient,
  input: {
    millId: string;
    userId: string | null;
    question: string;
    history?: Array<{ role: "user" | "assistant"; content: string }>;
  }
) {
  const intent = parseQuestionIntent(input.question);
  const calendar = businessCalendar();
  const today = calendar.today;
  const yesterday = calendar.yesterday;
  const startOfMonth = calendar.startOfMonth;

  let answer = "";
  let evidence: unknown = {};
  let missingData: unknown[] = [];
  let confidence: "low" | "medium" | "high" = "high";

  if (intent === "what_came_today") {
    const result = await answerPaddyForDate(supabase, input.millId, today, "today");
    answer = result.answer;
    evidence = result.evidence;
  } else if (intent === "what_came_yesterday") {
    const result = await answerPaddyForDate(supabase, input.millId, yesterday, "yesterday");
    answer = result.answer;
    evidence = result.evidence;
  } else if (intent === "entries_incomplete") {
    const { data } = await supabase
      .from("draft_entries")
      .select("*")
      .eq("mill_id", input.millId)
      .in("status", ["incomplete", "pending_confirmation", "draft"])
      .order("created_at", { ascending: false });
    answer = `${data?.length ?? 0} entries need confirmation or missing data.`;
    evidence = { entries: data ?? [] };
    confidence = "medium";
  } else if (intent === "truck_sheet_count") {
    const result = await answerTruckSheetCount(supabase, input.millId);
    answer = result.answer;
    evidence = result.evidence;
  } else if (intent === "truck_sheets_missing") {
    const { data } = await supabase
      .from("tasks")
      .select("*")
      .eq("mill_id", input.millId)
      .eq("status", "open")
      .or("missing_field_name.eq.truck_sheet,task_type.eq.missing_truck_sheet");
    answer = `${data?.length ?? 0} truck sheet tasks are open.`;
    evidence = { tasks: data ?? [] };
  } else if (intent === "lot_mismatch") {
    const [{ data: lots }, { data: alerts }] = await Promise.all([
      supabase.from("paddy_lots").select("*").eq("mill_id", input.millId).eq("status", "disputed"),
      supabase
        .from("alerts")
        .select("*")
        .eq("mill_id", input.millId)
        .in("alert_type", ["paddy_bag_mismatch", "paddy_government_quantity_mismatch", "paddy_weighbridge_mismatch"])
        .eq("status", "open")
    ]);
    answer = `${lots?.length ?? 0} disputed lots and ${alerts?.length ?? 0} open mismatch alerts found.`;
    evidence = { disputed_lots: lots ?? [], alerts: alerts ?? [] };
  } else if (intent === "confirmed_stock") {
    const { data } = await supabase
      .from("stock_events")
      .select("product_type,paddy_source_type,quantity_delta,quantity_unit,status")
      .eq("mill_id", input.millId);
    const summary = calculateStockSummary((data ?? []).map((row) => ({ ...row, quantity_delta: Number(row.quantity_delta) })));
    const negative = summary.filter((row) => row.confirmed < 0);
    answer = summary.length
      ? `Confirmed stock summary is separated by product, source, and unit.${negative.length ? ` ${negative.length} balance(s) are negative and need review.` : ""}`
      : "No stock events found.";
    evidence = { summary, negative_balances: negative };
    if (negative.length) confidence = "medium";
  } else if (intent === "byproducts_sold") {
    const { data } = await supabase
      .from("byproduct_sales")
      .select("*")
      .eq("mill_id", input.millId)
      .order("sale_date", { ascending: false })
      .limit(20);
    answer = `${data?.length ?? 0} by-product sales found.`;
    evidence = { sales: data ?? [] };
  } else if (intent === "low_sale_rate") {
    const { data } = await supabase
      .from("alerts")
      .select("*")
      .eq("mill_id", input.millId)
      .eq("alert_type", "byproduct_low_rate")
      .in("status", ["open", "snoozed"])
      .order("created_at", { ascending: false });
    answer = `${data?.length ?? 0} low sale-rate alerts are open.`;
    evidence = { alerts: data ?? [] };
  } else if (intent === "expenses_this_month") {
    const { data } = await supabase
      .from("expenses")
      .select("*")
      .eq("mill_id", input.millId)
      .gte("expense_date", startOfMonth)
      .order("expense_date", { ascending: false });
    const total = (data ?? []).reduce((sum, row) => sum + Number(row.amount ?? 0), 0);
    answer = `${data?.length ?? 0} expenses recorded this month, totaling INR ${total}.`;
    evidence = { expenses: data ?? [], total_amount: total };
  } else if (intent === "ca_export_ready") {
    const [{ data: events }, { data: tasks }, { data: disputed }] = await Promise.all([
      supabase.from("business_events").select("*").eq("mill_id", input.millId).in("status", ["confirmed", "reconciled"]),
      supabase.from("tasks").select("*").eq("mill_id", input.millId).in("status", ["open", "in_progress"]),
      supabase.from("business_events").select("*").eq("mill_id", input.millId).eq("status", "disputed")
    ]);
    answer = `${events?.length ?? 0} confirmed events can be previewed for CA. ${tasks?.length ?? 0} missing-data items and ${disputed?.length ?? 0} disputed events must be shown separately.`;
    evidence = { confirmed: events ?? [], missing: tasks ?? [], disputed: disputed ?? [] };
    missingData = tasks ?? [];
  } else if (hasOpenAIAskConfig()) {
    const snapshot = await buildAskSnapshot(supabase, input.millId, calendar, startOfMonth);
    const ai = await answerWithOpenAI({
      question: input.question,
      today,
      snapshot: snapshot as Json,
      history: input.history
    });

    answer = ai.parsed.answer;
    confidence = ai.parsed.confidence;
    missingData = ai.parsed.missing_data;
    evidence = {
      answer_mode: "ai_grounded_database_chat",
      model: ai.model,
      evidence_notes: ai.parsed.evidence_notes,
      suggested_actions: ai.parsed.suggested_actions,
      snapshot
    };
  } else {
    answer = "Open chat is not configured yet because OPENAI_API_KEY is missing. I can still answer the fixed evidence questions shown below.";
    confidence = "low";
    evidence = {
      supported_questions: [
        intentLabel("what_came_today"),
        intentLabel("what_came_yesterday"),
        intentLabel("entries_incomplete"),
        intentLabel("truck_sheet_count"),
        intentLabel("truck_sheets_missing"),
        intentLabel("lot_mismatch"),
        intentLabel("confirmed_stock"),
        intentLabel("byproducts_sold"),
        intentLabel("low_sale_rate"),
        intentLabel("expenses_this_month"),
        intentLabel("ca_export_ready")
      ]
    };
  }

  const suggestedActions = await buildChatActionSuggestions(supabase, {
    millId: input.millId,
    question: input.question
  });

  await supabase.from("assistant_queries").insert({
    mill_id: input.millId,
    asked_by: input.userId,
    question: input.question,
    interpreted_intent: intent,
    answer,
    confidence,
    evidence: suggestedActions.length > 0 ? { ...(evidence as Record<string, unknown>), chat_actions: suggestedActions } : evidence,
    missing_data: missingData,
    status: "succeeded",
    created_by: input.userId,
    updated_by: input.userId
  });

  return {
    intent,
    answer,
    confidence,
    evidence: suggestedActions.length > 0 ? { ...(evidence as Record<string, unknown>), chat_actions: suggestedActions } : evidence,
    missing_data: missingData,
    suggested_actions: suggestedActions
  };
}

async function answerTruckSheetCount(supabase: SupabaseServerClient, millId: string) {
  const [{ data: documents }, { data: drafts }, { data: businessEvents }] = await Promise.all([
    supabase
      .from("documents")
      .select("id,original_filename,document_type,classification_status,extraction_status,status,created_at")
      .eq("mill_id", millId)
      .eq("document_type", "truck_sheet")
      .order("created_at", { ascending: false }),
    supabase
      .from("draft_entries")
      .select("id,status,source_type,document_id,created_at")
      .eq("mill_id", millId)
      .eq("source_type", "truck_sheet")
      .order("created_at", { ascending: false }),
    supabase
      .from("business_events")
      .select("id,event_type,status,document_id,event_date,created_at")
      .eq("mill_id", millId)
      .not("document_id", "is", null)
      .order("created_at", { ascending: false })
  ]);

  const docs = documents ?? [];
  const truckSheetDocumentIds = new Set(docs.map((document) => document.id));
  const truckSheetDrafts = drafts ?? [];
  const linkedEvents = (businessEvents ?? []).filter((event) =>
    event.document_id && truckSheetDocumentIds.has(event.document_id)
  );
  const confirmedEvents = linkedEvents.filter((event) => ["confirmed", "reconciled", "locked", "exported"].includes(event.status));
  const incompleteEvents = linkedEvents.filter((event) => ["incomplete", "pending_confirmation", "draft"].includes(event.status));
  const disputedEvents = linkedEvents.filter((event) => event.status === "disputed");
  const pendingDrafts = truckSheetDrafts.filter((draft) => ["draft", "pending_confirmation", "incomplete"].includes(draft.status));
  const confirmedDrafts = truckSheetDrafts.filter((draft) => ["confirmed", "reconciled", "locked", "exported"].includes(draft.status));
  const extractedDocuments = docs.filter((document) => document.extraction_status === "succeeded");
  const queuedDocuments = docs.filter((document) => ["queued", "running"].includes(document.extraction_status));
  const failedDocuments = docs.filter((document) => document.extraction_status === "failed");
  const draftDocumentIds = new Set(truckSheetDrafts.map((draft) => draft.document_id).filter(Boolean));
  const documentsWithoutDraft = docs.filter((document) => !draftDocumentIds.has(document.id));

  return {
    answer: `You have ${docs.length} uploaded ${plural(docs.length, "truck-sheet document")}. Of these, ${confirmedEvents.length} ${confirmedEvents.length === 1 ? "is" : "are"} confirmed into paddy entries, ${pendingDrafts.length} ${pendingDrafts.length === 1 ? "is" : "are"} still pending confirmation, ${queuedDocuments.length} ${queuedDocuments.length === 1 ? "is" : "are"} still waiting for extraction, and ${failedDocuments.length} ${failedDocuments.length === 1 ? "has" : "have"} failed extraction.`,
    evidence: {
      uploaded_truck_sheet_documents_count: docs.length,
      extracted_truck_sheet_documents_count: extractedDocuments.length,
      confirmed_paddy_entries_from_truck_sheets_count: confirmedEvents.length,
      pending_truck_sheet_drafts_count: pendingDrafts.length,
      confirmed_truck_sheet_drafts_count: confirmedDrafts.length,
      incomplete_paddy_entries_from_truck_sheets_count: incompleteEvents.length,
      disputed_paddy_entries_from_truck_sheets_count: disputedEvents.length,
      queued_truck_sheet_documents_count: queuedDocuments.length,
      failed_truck_sheet_documents_count: failedDocuments.length,
      truck_sheet_documents_without_draft_count: documentsWithoutDraft.length,
      documents: docs,
      drafts: truckSheetDrafts,
      linked_business_events: linkedEvents
    }
  };
}

function plural(count: number, singular: string) {
  return count === 1 ? singular : `${singular}s`;
}

async function buildAskSnapshot(
  supabase: SupabaseServerClient,
  millId: string,
  calendar: BusinessCalendar,
  startOfMonth: string
) {
  const [
    { data: mill },
    { data: paddyLots },
    { data: paddyArrivedToday },
    { data: paddyArrivedYesterday },
    { data: paddyToday },
    { data: paddyYesterday },
    { data: stockEvents },
    { data: businessEvents },
    { data: byproductSales },
    { data: expensesThisMonth },
    { data: tasks },
    { data: alerts },
    { data: documents },
    { data: draftEntries }
  ] = await Promise.all([
    supabase.from("mills").select("id,name,location,status").eq("id", millId).maybeSingle(),
    supabase
      .from("paddy_lots")
      .select("id,lot_code,arrival_date,paddy_source_type,truck_number,truck_sheet_bag_count,physical_bag_count,app_quantity,weighbridge_net_weight,moisture_percent,confirmed_quantity,quantity_unit,data_quality_score,status,notes,metadata,created_at")
      .eq("mill_id", millId)
      .order("arrival_date", { ascending: false })
      .limit(30),
    supabase
      .from("paddy_lots")
      .select("id,lot_code,arrival_date,paddy_source_type,truck_number,confirmed_quantity,quantity_unit,status,metadata,created_at")
      .eq("mill_id", millId)
      .eq("arrival_date", calendar.today)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("paddy_lots")
      .select("id,lot_code,arrival_date,paddy_source_type,truck_number,confirmed_quantity,quantity_unit,status,metadata,created_at")
      .eq("mill_id", millId)
      .eq("arrival_date", calendar.yesterday)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("paddy_lots")
      .select("id,lot_code,arrival_date,paddy_source_type,truck_number,confirmed_quantity,quantity_unit,status,metadata,created_at")
      .eq("mill_id", millId)
      .gte("created_at", calendar.todayStartUtc)
      .lt("created_at", calendar.tomorrowStartUtc)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("paddy_lots")
      .select("id,lot_code,arrival_date,paddy_source_type,truck_number,confirmed_quantity,quantity_unit,status,metadata,created_at")
      .eq("mill_id", millId)
      .gte("created_at", calendar.yesterdayStartUtc)
      .lt("created_at", calendar.todayStartUtc)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("stock_events")
      .select("id,event_type,event_date,product_type,paddy_source_type,direction,quantity_delta,quantity_unit,status,related_entity_type,related_entity_id,payload,created_at")
      .eq("mill_id", millId)
      .order("event_date", { ascending: false })
      .limit(80),
    supabase
      .from("business_events")
      .select("id,event_type,event_date,status,related_entity_type,related_entity_id,payload,document_id,created_at")
      .eq("mill_id", millId)
      .order("event_date", { ascending: false })
      .limit(40),
    supabase
      .from("byproduct_sales")
      .select("id,sale_date,product_type,paddy_source_type,quantity,quantity_unit,rate,subtotal_amount,payment_status,status,notes,metadata,created_at")
      .eq("mill_id", millId)
      .order("sale_date", { ascending: false })
      .limit(30),
    supabase
      .from("expenses")
      .select("id,expense_date,expense_category,amount,currency,status,notes,metadata,created_at")
      .eq("mill_id", millId)
      .gte("expense_date", startOfMonth)
      .order("expense_date", { ascending: false })
      .limit(30),
    supabase
      .from("tasks")
      .select("id,task_type,title,description,priority,status,linked_entity_type,linked_entity_id,missing_field_name,created_at")
      .eq("mill_id", millId)
      .in("status", ["open", "in_progress", "snoozed", "blocked"])
      .order("created_at", { ascending: false })
      .limit(30),
    supabase
      .from("alerts")
      .select("id,alert_type,title,message,severity,status,linked_entity_type,linked_entity_id,evidence,created_at")
      .eq("mill_id", millId)
      .in("status", ["open", "snoozed"])
      .order("created_at", { ascending: false })
      .limit(30),
    supabase
      .from("documents")
      .select("id,original_filename,document_type,classification_status,extraction_status,status,metadata,created_at")
      .eq("mill_id", millId)
      .order("created_at", { ascending: false })
      .limit(30),
    supabase
      .from("draft_entries")
      .select("id,draft_type,status,missing_fields,source_type,document_id,input_capture_id,created_at")
      .eq("mill_id", millId)
      .in("status", ["draft", "pending_confirmation", "incomplete", "disputed"])
      .order("created_at", { ascending: false })
      .limit(30)
  ]);

  const stockSummary = calculateStockSummary(
    (stockEvents ?? []).map((row) => ({ ...row, quantity_delta: Number(row.quantity_delta) }))
  );
  const paddyByStatus = separateByRecordStatus(paddyLots ?? []);
  const arrivedTodayByStatus = separateByRecordStatus(paddyArrivedToday ?? []);
  const arrivedYesterdayByStatus = separateByRecordStatus(paddyArrivedYesterday ?? []);
  const todayByStatus = separateByRecordStatus(paddyToday ?? []);
  const yesterdayByStatus = separateByRecordStatus(paddyYesterday ?? []);
  const expenseTotalThisMonth = (expensesThisMonth ?? []).reduce((sum, row) => sum + Number(row.amount ?? 0), 0);
  const businessProfile = toAskProfile(await buildBusinessContext(supabase, millId));

  return {
    generated_at: new Date().toISOString(),
    business_profile: businessProfile,
    business_timezone: "Asia/Kolkata",
    today: calendar.today,
    yesterday: calendar.yesterday,
    mill,
    summaries: {
      paddy_lots: {
        total_recent: paddyLots?.length ?? 0,
        confirmed: paddyByStatus.confirmed.length,
        pending: paddyByStatus.pending.length,
        disputed: paddyByStatus.disputed.length
      },
      paddy_recorded_today: {
        total: paddyToday?.length ?? 0,
        confirmed: todayByStatus.confirmed.length,
        pending: todayByStatus.pending.length,
        disputed: todayByStatus.disputed.length
      },
      paddy_arrived_today: {
        total: paddyArrivedToday?.length ?? 0,
        confirmed: arrivedTodayByStatus.confirmed.length,
        pending: arrivedTodayByStatus.pending.length,
        disputed: arrivedTodayByStatus.disputed.length
      },
      paddy_recorded_yesterday: {
        total: paddyYesterday?.length ?? 0,
        confirmed: yesterdayByStatus.confirmed.length,
        pending: yesterdayByStatus.pending.length,
        disputed: yesterdayByStatus.disputed.length
      },
      paddy_arrived_yesterday: {
        total: paddyArrivedYesterday?.length ?? 0,
        confirmed: arrivedYesterdayByStatus.confirmed.length,
        pending: arrivedYesterdayByStatus.pending.length,
        disputed: arrivedYesterdayByStatus.disputed.length
      },
      stock: stockSummary,
      expenses_this_month: {
        count: expensesThisMonth?.length ?? 0,
        total_amount: expenseTotalThisMonth,
        currency: "INR"
      },
      open_tasks: tasks?.length ?? 0,
      open_alerts: alerts?.length ?? 0,
      recent_documents: documents?.length ?? 0,
      pending_drafts: draftEntries?.length ?? 0
    },
    records: {
      paddy_lots: paddyLots ?? [],
      paddy_arrived_today: paddyArrivedToday ?? [],
      paddy_arrived_yesterday: paddyArrivedYesterday ?? [],
      paddy_recorded_today: paddyToday ?? [],
      paddy_recorded_yesterday: paddyYesterday ?? [],
      stock_events: stockEvents ?? [],
      business_events: businessEvents ?? [],
      byproduct_sales: byproductSales ?? [],
      expenses_this_month: expensesThisMonth ?? [],
      tasks: tasks ?? [],
      alerts: alerts ?? [],
      documents: documents ?? [],
      draft_entries: draftEntries ?? []
    }
  };
}

async function answerPaddyForDate(
  supabase: SupabaseServerClient,
  millId: string,
  date: string,
  label: "today" | "yesterday"
) {
  const { startUtc, endUtc } = indiaDateUtcRange(date);
  const [{ data: arrivedRows }, { data: recordedRows }] = await Promise.all([
    supabase
      .from("paddy_lots")
      .select("*")
      .eq("mill_id", millId)
      .eq("arrival_date", date)
      .order("created_at", { ascending: false }),
    supabase
      .from("paddy_lots")
      .select("*")
      .eq("mill_id", millId)
      .gte("created_at", startUtc)
      .lt("created_at", endUtc)
      .order("created_at", { ascending: false })
  ]);

  const arrived = separateByRecordStatus(arrivedRows ?? []);
  const recorded = separateByRecordStatus(recordedRows ?? []);
  const arrivedCount = countSeparated(arrived);
  const recordedCount = countSeparated(recorded);
  const arrivedText = `${arrived.confirmed.length} confirmed, ${arrived.pending.length} pending/incomplete, ${arrived.disputed.length} disputed`;
  const recordedText = `${recorded.confirmed.length} confirmed, ${recorded.pending.length} pending/incomplete, ${recorded.disputed.length} disputed`;

  return {
    answer: arrivedCount > 0
      ? `${arrivedText} paddy entries have arrival date ${label} (${date}). ${recordedCount} paddy entries were recorded in the system ${label}.`
      : `No paddy entries have arrival date ${label} (${date}). But ${recordedText} paddy entries were recorded in the system ${label}, including older source-date truck sheets if shown in evidence.`,
    evidence: {
      business_timezone: "Asia/Kolkata",
      date,
      [`arrived_${label}_by_arrival_date`]: arrived,
      [`recorded_${label}_by_created_at`]: recorded
    }
  };
}

function countSeparated(value: ReturnType<typeof separateByRecordStatus>) {
  return value.confirmed.length + value.pending.length + value.disputed.length;
}

interface BusinessCalendar {
  today: string;
  yesterday: string;
  startOfMonth: string;
  yesterdayStartUtc: string;
  todayStartUtc: string;
  tomorrowStartUtc: string;
}

function businessCalendar(): BusinessCalendar {
  const today = indiaDateString(new Date());
  const yesterday = addDays(today, -1);
  const tomorrow = addDays(today, 1);
  return {
    today,
    yesterday,
    startOfMonth: `${today.slice(0, 7)}-01`,
    yesterdayStartUtc: indiaDateUtcRange(yesterday).startUtc,
    todayStartUtc: indiaDateUtcRange(today).startUtc,
    tomorrowStartUtc: indiaDateUtcRange(tomorrow).startUtc
  };
}

function indiaDateString(date: Date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function addDays(date: string, days: number) {
  const [year, month, day] = date.split("-").map(Number);
  const utc = Date.UTC(year, month - 1, day + days);
  return new Date(utc).toISOString().slice(0, 10);
}

function indiaDateUtcRange(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  const start = Date.UTC(year, month - 1, day) - 5.5 * 60 * 60 * 1000;
  const end = Date.UTC(year, month - 1, day + 1) - 5.5 * 60 * 60 * 1000;
  return {
    startUtc: new Date(start).toISOString(),
    endUtc: new Date(end).toISOString()
  };
}
