import { AppShell } from "@/components/AppShell";
import { EmptyState } from "@/components/EmptyState";
import { ErrorNotice } from "@/components/ErrorNotice";
import { InfoCard } from "@/components/InfoCard";
import { getOptionalMillContext } from "@/lib/db/context";
import { saleAmountLines } from "@/lib/sales/display";

export const dynamic = "force-dynamic";

// A by-product sale is money the mill RECEIVES, so frame the status as receipt, not payment out.
function receiptLabel(status: string) {
  const labels: Record<string, string> = {
    pending: "Awaiting receipt",
    partial: "Partially received",
    paid: "Received",
    cancelled: "Cancelled"
  };
  return labels[status] ?? status;
}

export default async function SalesPage() {
  const context = await getOptionalMillContext();
  if (!context) {
    return (
      <AppShell title="Sales">
        <ErrorNotice message="Default mill is not ready. Check Supabase seed data and NEXT_PUBLIC_DEFAULT_MILL_ID." />
      </AppShell>
    );
  }

  const [{ data: sales }, { data: alerts }] = await Promise.all([
    context.supabase.from("byproduct_sales").select("*").eq("mill_id", context.millId).order("sale_date", { ascending: false }),
    context.supabase
      .from("alerts")
      .select("id,linked_entity_id,status")
      .eq("mill_id", context.millId)
      .eq("alert_type", "byproduct_low_rate")
      .in("status", ["open", "snoozed"])
  ]);

  const alertIds = new Set((alerts ?? []).map((alert) => alert.linked_entity_id));

  return (
    <AppShell title="Sales">
      <div className="space-y-3">
        {sales && sales.length > 0 ? (
          sales.map((sale) => {
            const amount = saleAmountLines(sale);

            return (
              <InfoCard key={sale.id} id={sale.id} title={`${sale.product_type.replaceAll("_", " ")} sale`} status={alertIds.has(sale.id) ? "low rate" : sale.status}>
                <p>{amount.rateLine}</p>
                {amount.subtotalLine ? <p>{amount.subtotalLine}</p> : null}
                {amount.taxLine ? <p>{amount.taxLine}</p> : null}
                <p>{amount.totalLine}</p>
                <p>Payment received: {receiptLabel(sale.payment_status)}</p>
              </InfoCard>
            );
          })
        ) : (
          <EmptyState message="No by-product sales yet." />
        )}
      </div>
    </AppShell>
  );
}
