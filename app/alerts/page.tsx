import { AppShell } from "@/components/AppShell";
import { EmptyState } from "@/components/EmptyState";
import { ErrorNotice } from "@/components/ErrorNotice";
import { InfoCard } from "@/components/InfoCard";
import { resolveAlertAction } from "@/app/actions";
import { getOptionalMillContext } from "@/lib/db/context";

export const dynamic = "force-dynamic";

export default async function AlertsPage() {
  const context = await getOptionalMillContext();
  if (!context) {
    return (
      <AppShell title="Alerts">
        <ErrorNotice message="Default mill is not ready. Check Supabase seed data and NEXT_PUBLIC_DEFAULT_MILL_ID." />
      </AppShell>
    );
  }

  const { data: alerts } = await context.supabase
    .from("alerts")
    .select("*")
    .eq("mill_id", context.millId)
    .in("status", ["open", "snoozed"])
    .order("created_at", { ascending: false });

  return (
    <AppShell title="Alerts">
      <div className="space-y-3">
        {alerts && alerts.length > 0 ? (
          alerts.map((alert) => (
            <InfoCard key={alert.id} title={alert.title} status={alert.severity}>
              <p>{alert.message}</p>
              <pre className="mt-3 overflow-x-auto rounded-md bg-field p-3 text-xs">{JSON.stringify(alert.evidence, null, 2)}</pre>
              <form action={resolveAlertAction.bind(null, alert.id)} className="mt-3 flex gap-2">
                <input
                  name="reason"
                  placeholder="Resolution reason"
                  className="min-w-0 flex-1 rounded-md border border-ink/15 bg-field px-3 py-2"
                />
                <button className="rounded-md bg-leaf px-3 py-2 text-sm font-bold text-white" type="submit">
                  Resolve
                </button>
              </form>
            </InfoCard>
          ))
        ) : (
          <EmptyState message="No actionable alerts." />
        )}
      </div>
    </AppShell>
  );
}
