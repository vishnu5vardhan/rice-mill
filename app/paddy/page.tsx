import { AppShell } from "@/components/AppShell";
import { EmptyState } from "@/components/EmptyState";
import { ErrorNotice } from "@/components/ErrorNotice";
import { InfoCard } from "@/components/InfoCard";
import Link from "next/link";
import { getOptionalMillContext } from "@/lib/db/context";

export const dynamic = "force-dynamic";

export default async function PaddyPage() {
  const context = await getOptionalMillContext();
  if (!context) {
    return (
      <AppShell title="Paddy">
        <ErrorNotice message="Default mill is not ready. Check Supabase seed data and NEXT_PUBLIC_DEFAULT_MILL_ID." />
      </AppShell>
    );
  }

  const [{ data: lots }, { data: stockEvents }, { data: tasks }] = await Promise.all([
    context.supabase.from("paddy_lots").select("*").eq("mill_id", context.millId).order("created_at", { ascending: false }),
    context.supabase.from("stock_events").select("*").eq("mill_id", context.millId).eq("product_type", "paddy"),
    context.supabase.from("tasks").select("id,linked_entity_id,status").eq("mill_id", context.millId).in("status", ["open", "in_progress"])
  ]);

  const taskCounts = new Map<string, number>();
  for (const task of tasks ?? []) {
    if (task.linked_entity_id) taskCounts.set(task.linked_entity_id, (taskCounts.get(task.linked_entity_id) ?? 0) + 1);
  }

  return (
    <AppShell title="Paddy">
      <div className="space-y-3">
        {lots && lots.length > 0 ? (
          lots.map((lot) => {
            const stock = (stockEvents ?? []).find((event) => event.related_entity_id === lot.id);
            return (
              <InfoCard key={lot.id} id={lot.id} title={lot.lot_code ?? lot.metadata?.source_party_name ?? "Paddy lot"} status={lot.status}>
                <p>{lot.confirmed_quantity ?? "Missing"} {lot.quantity_unit ?? ""} from {lot.metadata?.source_party_name ?? "unknown source"}</p>
                <p>Truck: {lot.truck_number ?? "missing"} | Moisture: {lot.moisture_percent ?? "missing"}</p>
                <p>Stock impact: {stock ? `${stock.quantity_delta} ${stock.quantity_unit}` : "No confirmed stock event"}</p>
                <p>Missing tasks: {taskCounts.get(lot.id) ?? 0}</p>
                <Link className="mt-3 inline-block rounded-md border border-ink/15 px-3 py-2 text-sm font-bold" href={`/paddy/${lot.id}/edit`}>
                  Edit fields
                </Link>
              </InfoCard>
            );
          })
        ) : (
          <EmptyState message="No paddy lots yet." />
        )}
      </div>
    </AppShell>
  );
}
