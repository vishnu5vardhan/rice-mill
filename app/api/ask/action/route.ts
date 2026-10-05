import { NextResponse } from "next/server";
import { requireMillContext } from "@/lib/db/context";
import { apiError, isAuthContextError } from "@/lib/db/errors";
import { chatActionInputSchema } from "@/lib/ask/actions";
import { applyChatAction } from "@/lib/services/ask-tools";

export async function POST(request: Request) {
  try {
    const context = await requireMillContext();
    const body = await request.json().catch(() => ({}));
    const action = chatActionInputSchema.parse(body?.action ?? body);
    const result = await applyChatAction(context.supabase, {
      millId: context.millId,
      userId: context.userId,
      action
    });
    return NextResponse.json(result);
  } catch (error) {
    return apiError(error, isAuthContextError(error) ? 401 : 400);
  }
}
