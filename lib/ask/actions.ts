import { z } from "zod";
import { inferByproductProduct, type ByproductProduct } from "@/lib/byproducts/aliases";
import type { Json } from "@/lib/types";

export const chatActionKindSchema = z.enum([
  "create_byproduct_sale_draft_from_expense",
  "convert_expense_draft_to_byproduct_sale_draft",
  "cancel_draft"
]);

export const chatActionInputSchema = z.object({
  kind: chatActionKindSchema,
  target_id: z.string().uuid(),
  product_type: z.enum(["bran", "broken_rice", "husk"]).optional(),
  reason: z.string().optional()
});

export const chatActionSuggestionSchema = z.object({
  id: z.string(),
  kind: chatActionKindSchema,
  label: z.string(),
  description: z.string(),
  target: z.object({
    type: z.enum(["expense", "draft"]),
    id: z.string(),
    title: z.string(),
    status: z.string().optional(),
    href: z.string().optional()
  }),
  input: chatActionInputSchema,
  safety_note: z.string()
});

export type ChatActionInput = z.infer<typeof chatActionInputSchema>;
export type ChatActionSuggestion = z.infer<typeof chatActionSuggestionSchema>;

export interface ExpenseLikeCandidate {
  targetType: "expense" | "draft";
  id: string;
  title: string;
  status?: string;
  amount?: number | null;
  date?: string | null;
  productType: ByproductProduct;
  reason: string;
  sourceText: string;
}

export function maybeExpenseCorrectionRequest(question: string) {
  const normalized = question.toLowerCase();
  return (
    /expense|expenses|cost|wrong|mistake|recorded|change|convert|sale|by-?product|bran|husk|broken|nuka|nookalu|thoudu|thavudu|pottu/.test(
      normalized
    ) && /expense|wrong|mistake|recorded|change|convert/.test(normalized)
  );
}

export function expenseCandidateFromRecord(record: {
  id: string;
  expense_date?: string | null;
  expense_category?: string | null;
  amount?: number | string | null;
  status?: string | null;
  notes?: string | null;
  metadata?: unknown;
}): ExpenseLikeCandidate | null {
  const metadata = objectRecord(record.metadata);
  const sourceText = [
    record.expense_category,
    record.notes,
    typeof metadata.vendor_name === "string" ? metadata.vendor_name : null
  ]
    .filter(Boolean)
    .join(" ");
  const productType = inferByproductProduct(sourceText);
  if (!productType) return null;

  return {
    targetType: "expense",
    id: record.id,
    title: `${productLabel(productType)} expense`,
    status: record.status ?? undefined,
    amount: numberOrNull(record.amount),
    date: record.expense_date ?? null,
    productType,
    reason: `The expense text contains a ${productLabel(productType)} by-product alias.`,
    sourceText
  };
}

export function expenseCandidateFromDraft(record: {
  id: string;
  payload?: Record<string, Json> | null;
  status?: string | null;
  created_at?: string | null;
}): ExpenseLikeCandidate | null {
  const payload = record.payload ?? {};
  const sourceText = [payload.expense_category, payload.vendor_name, payload.notes].filter(Boolean).join(" ");
  const productType = inferByproductProduct(sourceText);
  if (!productType) return null;

  return {
    targetType: "draft",
    id: record.id,
    title: `${productLabel(productType)} expense draft`,
    status: record.status ?? undefined,
    amount: numberOrNull(payload.amount),
    date: typeof payload.expense_date === "string" ? payload.expense_date : null,
    productType,
    reason: `The draft text contains a ${productLabel(productType)} by-product alias.`,
    sourceText
  };
}

export function suggestionFromCandidate(candidate: ExpenseLikeCandidate): ChatActionSuggestion {
  if (candidate.targetType === "draft") {
    return {
      id: `convert-expense-draft-${candidate.id}`,
      kind: "convert_expense_draft_to_byproduct_sale_draft",
      label: "Create by-product sale draft",
      description: `Prepare a ${productLabel(candidate.productType)} sale draft from this expense draft, then cancel the old draft.`,
      target: {
        type: "draft",
        id: candidate.id,
        title: candidate.title,
        status: candidate.status,
        href: `/confirm/${candidate.id}`
      },
      input: {
        kind: "convert_expense_draft_to_byproduct_sale_draft",
        target_id: candidate.id,
        product_type: candidate.productType,
        reason: candidate.reason
      },
      safety_note: "This only changes drafts. The ledger updates later when you confirm the replacement draft."
    };
  }

  return {
    id: `create-sale-draft-from-expense-${candidate.id}`,
    kind: "create_byproduct_sale_draft_from_expense",
    label: "Create by-product sale draft",
    description: `Prepare a ${productLabel(candidate.productType)} sale draft from this expense for review.`,
    target: {
      type: "expense",
      id: candidate.id,
      title: candidate.title,
      status: candidate.status,
      href: `/expenses#${candidate.id}`
    },
    input: {
      kind: "create_byproduct_sale_draft_from_expense",
      target_id: candidate.id,
      product_type: candidate.productType,
      reason: candidate.reason
    },
    safety_note: "This does not remove the original confirmed expense. Review it manually before CA export."
  };
}

export function productLabel(product: ByproductProduct) {
  return product.replaceAll("_", " ");
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
