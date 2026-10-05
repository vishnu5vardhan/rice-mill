import { NextResponse } from "next/server";
import { requireMillContext } from "@/lib/db/context";
import { apiError, isAuthContextError } from "@/lib/db/errors";
import { createManualDraft } from "@/lib/services/drafts";
import type { DraftField } from "@/lib/types";

export async function POST(request: Request) {
  try {
    const context = await requireMillContext();
    const body = await request.json();
    const payload = body.payload ?? {};
    const fields: DraftField[] = body.fields ?? Object.entries(payload).map(([field_name, value]) => ({
      field_name,
      value,
      status: value === null || value === "" ? "missing" : "draft",
      confidence: null,
      required: ["arrival_date", "confirmed_quantity", "quantity_unit"].includes(field_name),
      needs_review: false,
      source_type: "manual"
    }));
    const draft = await createManualDraft(context.supabase, {
      millId: context.millId,
      userId: context.userId,
      draftType: body.draft_type ?? "paddy_inward",
      payload,
      fields
    });
    return NextResponse.json({ draft });
  } catch (error) {
    return apiError(error, isAuthContextError(error) ? 401 : 400);
  }
}
