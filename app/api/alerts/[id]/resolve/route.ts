import { NextResponse } from "next/server";
import { requireMillContext } from "@/lib/db/context";
import { apiError, isAuthContextError } from "@/lib/db/errors";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const context = await requireMillContext();
    const body = await request.json().catch(() => ({}));
    const { data, error } = await context.supabase
      .from("alerts")
      .update({
        status: "resolved",
        resolved_by: context.userId,
        resolved_at: new Date().toISOString(),
        metadata: { resolution_reason: body.reason ?? null },
        updated_by: context.userId
      })
      .eq("mill_id", context.millId)
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw error;
    return NextResponse.json({ alert: data });
  } catch (error) {
    return apiError(error, isAuthContextError(error) ? 401 : 400);
  }
}
