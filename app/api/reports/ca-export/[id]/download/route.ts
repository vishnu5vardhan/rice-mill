import { NextResponse } from "next/server";
import { requireMillContext } from "@/lib/db/context";
import { apiError, isAuthContextError } from "@/lib/db/errors";
import { caExportCsv } from "@/lib/reports/ca-export";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const url = new URL(request.url);
    const format = url.searchParams.get("format") === "csv" ? "csv" : "json";
    const context = await requireMillContext();
    const { data: snapshot, error } = await context.supabase
      .from("export_snapshots")
      .select("id,summary,period_start,period_end,version")
      .eq("mill_id", context.millId)
      .eq("id", id)
      .single();
    if (error) throw error;

    const basename = `ca-export-${snapshot.period_start}-to-${snapshot.period_end}-v${snapshot.version}`;
    if (format === "csv") {
      return new Response(caExportCsv(snapshot.summary as never), {
        headers: {
          "content-type": "text/csv; charset=utf-8",
          "content-disposition": `attachment; filename="${basename}.csv"`
        }
      });
    }

    return new Response(JSON.stringify(snapshot.summary, null, 2), {
      headers: {
        "content-type": "application/json; charset=utf-8",
        "content-disposition": `attachment; filename="${basename}.json"`
      }
    });
  } catch (error) {
    return apiError(error, isAuthContextError(error) ? 401 : 400);
  }
}
