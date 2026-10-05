import { NextResponse } from "next/server";
import { requireMillContext } from "@/lib/db/context";
import { apiError, isAuthContextError } from "@/lib/db/errors";
import { answerQuestion } from "@/lib/services/ask";

export async function POST(request: Request) {
  try {
    const context = await requireMillContext();
    const body = await request.json();
    const result = await answerQuestion(context.supabase, {
      millId: context.millId,
      userId: context.userId,
      question: body.question ?? "",
      history: Array.isArray(body.history) ? body.history : []
    });
    return NextResponse.json(result);
  } catch (error) {
    return apiError(error, isAuthContextError(error) ? 401 : 400);
  }
}
