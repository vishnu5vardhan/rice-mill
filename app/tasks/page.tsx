import { ArrowRight, Check, Clock } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { EmptyState } from "@/components/EmptyState";
import { ErrorNotice } from "@/components/ErrorNotice";
import { InfoCard } from "@/components/InfoCard";
import { StatusBadge } from "@/components/StatusBadge";
import { completeTaskAction, snoozeTaskAction } from "@/app/actions";
import { getOptionalMillContext } from "@/lib/db/context";

export const dynamic = "force-dynamic";

export default async function TasksPage() {
  const context = await getOptionalMillContext();
  if (!context) {
    return (
      <AppShell title="Tasks">
        <ErrorNotice message="Default mill is not ready. Check Supabase seed data and NEXT_PUBLIC_DEFAULT_MILL_ID." />
      </AppShell>
    );
  }

  const { data: tasks } = await context.supabase
    .from("tasks")
    .select("*")
    .eq("mill_id", context.millId)
    .in("status", ["open", "in_progress", "snoozed"])
    .order("priority")
    .order("created_at", { ascending: false });

  return (
    <AppShell title="Tasks">
      <div className="space-y-3">
        {tasks && tasks.length > 0 ? (
          tasks.map((task) => {
            const href = taskLinkHref(task.linked_entity_type, task.linked_entity_id);
            return (
              <InfoCard key={task.id} title={task.title} status={task.status}>
                <p>{task.description}</p>
                <p>Missing field: {task.missing_field_name ?? "not specified"}</p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <StatusBadge status={`priority ${task.priority}`} />
                  {href ? (
                    <a className="rounded-md border border-ink/15 px-3 py-2 text-sm font-bold" href={href}>
                      <ArrowRight className="mr-1 inline h-4 w-4" /> Open
                    </a>
                  ) : null}
                  <form action={completeTaskAction.bind(null, task.id)}>
                    <button className="rounded-md bg-leaf px-3 py-2 text-sm font-bold text-white" type="submit">
                      <Check className="mr-1 inline h-4 w-4" /> Complete
                    </button>
                  </form>
                  <form action={snoozeTaskAction.bind(null, task.id)}>
                    <button className="rounded-md border border-ink/15 px-3 py-2 text-sm font-bold" type="submit">
                      <Clock className="mr-1 inline h-4 w-4" /> Snooze
                    </button>
                  </form>
                </div>
              </InfoCard>
            );
          })
        ) : (
          <EmptyState message="No pending missing-data tasks." />
        )}
      </div>
    </AppShell>
  );
}

function taskLinkHref(linkedEntityType: string | null, linkedEntityId: string | null) {
  if (!linkedEntityType || !linkedEntityId) return null;
  const anchor = encodeURIComponent(linkedEntityId);

  if (linkedEntityType === "paddy_lot" || linkedEntityType === "paddy_lots") return `/paddy/${anchor}/edit`;
  if (linkedEntityType === "byproduct_sale" || linkedEntityType === "byproduct_sales") return `/sales#${anchor}`;
  if (linkedEntityType === "expense" || linkedEntityType === "expenses") return `/expenses#${anchor}`;
  if (linkedEntityType === "draft_entry" || linkedEntityType === "draft_entries") return `/confirm/${anchor}`;

  return null;
}
