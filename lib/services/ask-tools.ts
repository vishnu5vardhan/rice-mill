import type { SupabaseServerClient } from "@/lib/supabase/server";
import type { DraftField, Json } from "@/lib/types";
import { inferByproductProduct, type ByproductProduct } from "@/lib/byproducts/aliases";
import {
  chatActionInputSchema,
  expenseCandidateFromDraft,
  expenseCandidateFromRecord,
  maybeExpenseCorrectionRequest,
  suggestionFromCandidate,
  type ChatActionInput,
  type ChatActionSuggestion
} from "@/lib/ask/actions";
import { createAuditLog } from "@/lib/services/audit";
import { createManualDraft } from "@/lib/services/drafts";
import { draftCancelUpdatePayload } from "@/lib/services/draft-cancel";

const REVIEWABLE_DRAFT_STATUSES = ["draft", "pending_confirmation", "incomplete"] as const;

export async function buildChatActionSuggestions(
  supabase: SupabaseServerClient,
  input: {
    millId: string;
    question: string;
  }
): Promise<ChatActionSuggestion[]> {
  if (!maybeExpenseCorrectionRequest(input.question)) return [];

  const [{ data: expenseDrafts }, { data: expenses }] = await Promise.all([
    supabase
      .from("draft_entries")
      .select("id,payload,status,created_at")
      .eq("mill_id", input.millId)
      .eq("draft_type", "expense")
      .in("status", [...REVIEWABLE_DRAFT_STATUSES])
      .order("created_at", { ascending: false })
      .limit(10),
    supabase
      .from("expenses")
      .select("id,expense_date,expense_category,amount,currency,status,notes,metadata,created_at")
      .eq("mill_id", input.millId)
      .order("created_at", { ascending: false })
      .limit(20)
  ]);

  const draftSuggestions = (expenseDrafts ?? [])
    .map((draft) => expenseCandidateFromDraft(draft as never))
    .filter((candidate) => candidate !== null)
    .map(suggestionFromCandidate);

  const expenseSuggestions = (expenses ?? [])
    .map((expense) => expenseCandidateFromRecord(expense as never))
    .filter((candidate) => candidate !== null)
    .map(suggestionFromCandidate);

  return [...draftSuggestions, ...expenseSuggestions].slice(0, 5);
}

export async function applyChatAction(
  supabase: SupabaseServerClient,
  input: {
    millId: string;
    userId: string | null;
    action: ChatActionInput;
  }
) {
  const action = chatActionInputSchema.parse(input.action);

  if (action.kind === "create_byproduct_sale_draft_from_expense") {
    return createByproductDraftFromExpense(supabase, {
      millId: input.millId,
      userId: input.userId,
      expenseId: action.target_id,
      requestedProduct: action.product_type ?? null,
      reason: action.reason ?? null
    });
  }

  if (action.kind === "convert_expense_draft_to_byproduct_sale_draft") {
    return convertExpenseDraftToByproductDraft(supabase, {
      millId: input.millId,
      userId: input.userId,
      draftId: action.target_id,
      requestedProduct: action.product_type ?? null,
      reason: action.reason ?? null
    });
  }

  return cancelDraftFromChat(supabase, {
    millId: input.millId,
    userId: input.userId,
    draftId: action.target_id,
    reason: action.reason ?? null
  });
}

async function createByproductDraftFromExpense(
  supabase: SupabaseServerClient,
  input: {
    millId: string;
    userId: string | null;
    expenseId: string;
    requestedProduct: ByproductProduct | null;
    reason: string | null;
  }
) {
  const { data: expense, error } = await supabase
    .from("expenses")
    .select("*")
    .eq("mill_id", input.millId)
    .eq("id", input.expenseId)
    .single();
  if (error) throw error;

  const metadata = objectRecord(expense.metadata);
  const sourceText = [
    expense.expense_category,
    expense.notes,
    typeof metadata.vendor_name === "string" ? metadata.vendor_name : null
  ]
    .filter(Boolean)
    .join(" ");
  const productType = input.requestedProduct ?? inferByproductProduct(sourceText);
  if (!productType) throw new Error("Could not infer a by-product from this expense.");

  const payload = byproductPayloadFromExpense({
    expenseDate: expense.expense_date,
    amount: numberOrNull(expense.amount),
    productType,
    notes: `Created by chat from expense ${expense.id}. Original notes: ${expense.notes ?? "none"}`
  });

  const draft = await createByproductDraft(supabase, {
    millId: input.millId,
    userId: input.userId,
    payload,
    sourceId: expense.id
  });

  await createAuditLog(supabase, {
    millId: input.millId,
    actorId: input.userId,
    action: "chat_action_created_byproduct_draft_from_expense",
    entityType: "draft_entry",
    entityId: draft.id,
    afterValue: {
      source_expense_id: expense.id,
      product_type: productType,
      reason: input.reason
    },
    sourceType: "adjustment_event",
    sourceId: expense.id
  });

  return {
    ok: true,
    message: "Created a by-product sale draft for review. The original expense was not changed.",
    draft_id: draft.id,
    href: `/confirm/${draft.id}`
  };
}

async function convertExpenseDraftToByproductDraft(
  supabase: SupabaseServerClient,
  input: {
    millId: string;
    userId: string | null;
    draftId: string;
    requestedProduct: ByproductProduct | null;
    reason: string | null;
  }
) {
  const { data: draft, error } = await supabase
    .from("draft_entries")
    .select("*")
    .eq("mill_id", input.millId)
    .eq("id", input.draftId)
    .eq("draft_type", "expense")
    .single();
  if (error) throw error;
  if (!REVIEWABLE_DRAFT_STATUSES.includes(draft.status as never)) {
    throw new Error("Only unconfirmed expense drafts can be converted by chat.");
  }

  const payloadRecord = objectRecord(draft.payload) as Record<string, Json>;
  const sourceText = [payloadRecord.expense_category, payloadRecord.vendor_name, payloadRecord.notes].filter(Boolean).join(" ");
  const productType = input.requestedProduct ?? inferByproductProduct(sourceText);
  if (!productType) throw new Error("Could not infer a by-product from this draft.");

  const payload = byproductPayloadFromExpense({
    expenseDate: typeof payloadRecord.expense_date === "string" ? payloadRecord.expense_date : null,
    amount: numberOrNull(payloadRecord.amount),
    productType,
    notes: `Created by chat from expense draft ${draft.id}. Original notes: ${
      typeof payloadRecord.notes === "string" ? payloadRecord.notes : "none"
    }`
  });

  const replacement = await createByproductDraft(supabase, {
    millId: input.millId,
    userId: input.userId,
    payload,
    sourceId: draft.id
  });

  const { error: cancelError } = await supabase
    .from("draft_entries")
    .update(draftCancelUpdatePayload(input.userId))
    .eq("mill_id", input.millId)
    .eq("id", draft.id)
    .in("status", [...REVIEWABLE_DRAFT_STATUSES]);
  if (cancelError) throw cancelError;

  await createAuditLog(supabase, {
    millId: input.millId,
    actorId: input.userId,
    action: "chat_action_converted_expense_draft_to_byproduct_draft",
    entityType: "draft_entry",
    entityId: replacement.id,
    afterValue: {
      source_draft_id: draft.id,
      cancelled_source_draft: true,
      product_type: productType,
      reason: input.reason
    },
    sourceType: "adjustment_event",
    sourceId: draft.id
  });

  return {
    ok: true,
    message: "Created a replacement by-product sale draft and cancelled the old expense draft.",
    draft_id: replacement.id,
    href: `/confirm/${replacement.id}`
  };
}

async function cancelDraftFromChat(
  supabase: SupabaseServerClient,
  input: {
    millId: string;
    userId: string | null;
    draftId: string;
    reason: string | null;
  }
) {
  const { data: draft, error: readError } = await supabase
    .from("draft_entries")
    .select("id,status")
    .eq("mill_id", input.millId)
    .eq("id", input.draftId)
    .single();
  if (readError) throw readError;
  if (!REVIEWABLE_DRAFT_STATUSES.includes(draft.status as never)) {
    throw new Error("Only unconfirmed drafts can be cancelled by chat.");
  }

  const { error } = await supabase
    .from("draft_entries")
    .update(draftCancelUpdatePayload(input.userId))
    .eq("mill_id", input.millId)
    .eq("id", input.draftId)
    .in("status", [...REVIEWABLE_DRAFT_STATUSES]);
  if (error) throw error;

  await createAuditLog(supabase, {
    millId: input.millId,
    actorId: input.userId,
    action: "chat_action_cancelled_draft",
    entityType: "draft_entry",
    entityId: input.draftId,
    afterValue: {
      status: "cancelled",
      reason: input.reason
    },
    sourceType: "adjustment_event",
    sourceId: input.draftId
  });

  return {
    ok: true,
    message: "Cancelled the draft.",
    draft_id: input.draftId,
    href: "/documents"
  };
}

async function createByproductDraft(
  supabase: SupabaseServerClient,
  input: {
    millId: string;
    userId: string | null;
    payload: Record<string, Json>;
    sourceId: string;
  }
) {
  return createManualDraft(supabase, {
    millId: input.millId,
    userId: input.userId,
    draftType: "byproduct_sale",
    sourceType: "adjustment_event",
    sourceId: input.sourceId,
    payload: input.payload,
    fields: Object.entries(input.payload).map(([fieldName, value]) =>
      chatDraftField(fieldName, value, ["sale_date", "product_type", "quantity", "quantity_unit", "rate"].includes(fieldName))
    )
  });
}

function byproductPayloadFromExpense(input: {
  expenseDate?: string | null;
  amount: number | null;
  productType: ByproductProduct;
  notes: string;
}): Record<string, Json> {
  return {
    sale_date: input.expenseDate || new Date().toISOString().slice(0, 10),
    dealer_name: null,
    product_type: input.productType,
    paddy_source_type: "unknown",
    quantity: null,
    quantity_unit: "qtl",
    rate: null,
    subtotal_amount: input.amount,
    payment_status: "pending",
    notes: input.notes
  };
}

function chatDraftField(fieldName: string, value: Json, required: boolean): DraftField {
  const missing = value === null || value === "";
  return {
    field_name: fieldName,
    value,
    status: missing ? "missing" : "needs_review",
    confidence: null,
    required,
    needs_review: true,
    source_type: "adjustment_event"
  };
}

function objectRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function numberOrNull(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}
