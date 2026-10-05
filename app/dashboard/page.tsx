import { AlertTriangle, Bell, Camera, Mic, Search, ClipboardList } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { ActionButton } from "@/components/ActionButton";
import { EmptyState } from "@/components/EmptyState";
import { ErrorNotice } from "@/components/ErrorNotice";
import { InfoCard } from "@/components/InfoCard";
import { getOptionalMillContext } from "@/lib/db/context";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const context = await getOptionalMillContext();

  if (!context) {
    return (
      <AppShell title="Home">
        <ErrorNotice message="Supabase is configured, but no active default mill is available for this single-mill app." />
        <div className="mt-5 grid gap-3">
          <ActionButton href="/upload" icon={Camera} label="Upload photo" detail="Create a draft from a truck sheet." />
          <ActionButton href="/ask" icon={Search} label="Ask" detail="Try deterministic evidence-backed questions." />
        </div>
      </AppShell>
    );
  }

  const [{ data: tasks }, { data: alerts }, { data: drafts }] = await Promise.all([
    context.supabase.from("tasks").select("id,title,priority,status").eq("mill_id", context.millId).in("status", ["open", "in_progress"]).limit(3),
    context.supabase.from("alerts").select("id,title,severity,status").eq("mill_id", context.millId).eq("status", "open").limit(3),
    context.supabase.from("draft_entries").select("id,draft_type,status,created_at").eq("mill_id", context.millId).in("status", ["draft", "pending_confirmation", "incomplete"]).limit(3)
  ]);

  return (
    <AppShell title="Home">
      <section className="grid gap-3">
        <ActionButton href="/voice" icon={Mic} label="Speak" detail="Record a short entry and confirm the AI draft." />
        <ActionButton href="/upload" icon={Camera} label="Upload photo" detail="Save original, extract with Gemini, confirm." />
        <ActionButton href="/manual" icon={ClipboardList} label="Manual entry" detail="Fast paddy, sale, or expense draft when photo is not enough." />
        <ActionButton href="/ask" icon={Search} label="Ask" detail="Answers come from deterministic DB queries." />
        <ActionButton href="/tasks" icon={ClipboardList} label="Pending tasks" detail={`${tasks?.length ?? 0} open items shown`} />
        <ActionButton href="/alerts" icon={Bell} label="Alerts" detail={`${alerts?.length ?? 0} open alerts shown`} />
      </section>

      <section className="mt-6 space-y-3">
        <h2 className="text-lg font-bold">Needs confirmation</h2>
        {drafts && drafts.length > 0 ? (
          drafts.map((draft) => (
            <InfoCard key={draft.id} title={draft.draft_type.replaceAll("_", " ")} status={draft.status} href={`/confirm/${draft.id}`}>
              Created {new Date(draft.created_at).toLocaleString()}
            </InfoCard>
          ))
        ) : (
          <EmptyState message="No pending drafts." />
        )}
      </section>

      <section className="mt-6 space-y-3">
        <h2 className="flex items-center gap-2 text-lg font-bold">
          <AlertTriangle className="h-5 w-5 text-rust" /> Latest alerts
        </h2>
        {alerts && alerts.length > 0 ? (
          alerts.map((alert) => (
            <InfoCard key={alert.id} title={alert.title} status={alert.severity}>
              {alert.status}
            </InfoCard>
          ))
        ) : (
          <EmptyState message="No open alerts." />
        )}
      </section>
    </AppShell>
  );
}
