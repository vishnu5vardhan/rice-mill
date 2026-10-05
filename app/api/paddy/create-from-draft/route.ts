import { NextResponse } from "next/server";
import { requireMillContext } from "@/lib/db/context";
import { apiError, isAuthContextError } from "@/lib/db/errors";
import { confirmDraft } from "@/lib/services/drafts";

export async function POST(request: Request) {
  try {
    const context = await requireMillContext();
    const body = await request.json();
    const result = await confirmDraft(context.supabase, {
      millId: context.millId,
      userId: context.userId,
      draftId: body.draft_id,
      correctedValues: body.corrected_values ?? {}
    });
    return NextResponse.json(result);
  } catch (error) {
    return apiError(error, isAuthContextError(error) ? 401 : 400);
  }
}
