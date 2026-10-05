import { NextResponse } from "next/server";
import { requireMillContext } from "@/lib/db/context";
import { apiError, isAuthContextError } from "@/lib/db/errors";
import { calculateStockSummary } from "@/lib/ledger/stock";

export async function GET() {
  try {
    const context = await requireMillContext();
    const { data, error } = await context.supabase
      .from("stock_events")
      .select("product_type,paddy_source_type,quantity_delta,quantity_unit,status")
      .eq("mill_id", context.millId);
    if (error) throw error;
    return NextResponse.json({
      summary: calculateStockSummary((data ?? []).map((row) => ({ ...row, quantity_delta: Number(row.quantity_delta) })))
    });
  } catch (error) {
    return apiError(error, isAuthContextError(error) ? 401 : 400);
  }
}
