import { NextResponse } from "next/server";
import { requireMillContext } from "@/lib/db/context";
import { apiError, isAuthContextError } from "@/lib/db/errors";

export async function GET() {
  try {
    const context = await requireMillContext();
    const { data, error } = await context.supabase
      .from("tasks")
      .select("*")
      .eq("mill_id", context.millId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return NextResponse.json({ tasks: data });
  } catch (error) {
    return apiError(error, isAuthContextError(error) ? 401 : 400);
  }
}
