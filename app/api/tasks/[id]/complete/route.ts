import { NextResponse } from "next/server";
import { requireMillContext } from "@/lib/db/context";
import { apiError, isAuthContextError } from "@/lib/db/errors";

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const context = await requireMillContext();
    const { data, error } = await context.supabase
      .from("tasks")
      .update({ status: "completed", completed_by: context.userId, completed_at: new Date().toISOString(), updated_by: context.userId })
      .eq("mill_id", context.millId)
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw error;
    return NextResponse.json({ task: data });
  } catch (error) {
    return apiError(error, isAuthContextError(error) ? 401 : 400);
  }
}
