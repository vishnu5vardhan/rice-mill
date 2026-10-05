import { NextResponse } from "next/server";
import { requireMillContext } from "@/lib/db/context";
import { apiError, isAuthContextError } from "@/lib/db/errors";
import { getDraftWithFields } from "@/lib/services/drafts";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const context = await requireMillContext();
    const draft = await getDraftWithFields(context.supabase, context.millId, id);
    return NextResponse.json(draft);
  } catch (error) {
    return apiError(error, isAuthContextError(error) ? 401 : 404);
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const context = await requireMillContext();
    const body = await request.json();
    const { field_name, value } = body;
    const { data, error } = await context.supabase
      .from("draft_entry_fields")
      .update({
        value,
        status: value === null || value === "" ? "missing" : "draft",
        updated_by: context.userId
      })
      .eq("mill_id", context.millId)
      .eq("draft_entry_id", id)
      .eq("field_name", field_name)
      .select("*")
      .single();
    if (error) throw error;
    return NextResponse.json({ field: data });
  } catch (error) {
    return apiError(error, isAuthContextError(error) ? 401 : 400);
  }
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const context = await requireMillContext();
    const { data, error } = await context.supabase
      .from("draft_entries")
      .update({ status: "cancelled", updated_by: context.userId })
      .eq("mill_id", context.millId)
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw error;
    return NextResponse.json({ draft: data });
  } catch (error) {
    return apiError(error, isAuthContextError(error) ? 401 : 400);
  }
}
