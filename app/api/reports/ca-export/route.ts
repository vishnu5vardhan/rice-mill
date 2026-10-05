import { NextResponse } from "next/server";
import { requireMillContext } from "@/lib/db/context";
import { apiError, isAuthContextError } from "@/lib/db/errors";
import { buildCaExportPreview } from "@/lib/reports/ca-export";

export async function GET() {
  try {
    const context = await requireMillContext();
    const [{ data: businessEvents }, { data: tasks }, { data: disputedLots }, { data: alerts }] = await Promise.all([
      context.supabase.from("business_events").select("*").eq("mill_id", context.millId),
      context.supabase.from("tasks").select("*").eq("mill_id", context.millId).in("status", ["open", "in_progress"]),
      context.supabase.from("paddy_lots").select("*").eq("mill_id", context.millId).eq("status", "disputed"),
      context.supabase.from("alerts").select("*").eq("mill_id", context.millId).in("status", ["open", "snoozed"])
    ]);

    return NextResponse.json({
      preview: buildCaExportPreview({
        businessEvents: businessEvents ?? [],
        tasks: tasks ?? [],
        disputedLots: disputedLots ?? [],
        alerts: alerts ?? []
      })
    });
  } catch (error) {
    return apiError(error, isAuthContextError(error) ? 401 : 400);
  }
}
