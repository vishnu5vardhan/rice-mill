import { NextResponse } from "next/server";
import { requireMillContext } from "@/lib/db/context";
import { apiError, isAuthContextError } from "@/lib/db/errors";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const context = await requireMillContext();
    const { data, error } = await context.supabase
      .from("documents")
      .select("*")
      .eq("mill_id", context.millId)
      .eq("id", id)
      .single();
    if (error) throw error;
    return NextResponse.json({ document: data });
  } catch (error) {
    return apiError(error, isAuthContextError(error) ? 401 : 404);
  }
}
