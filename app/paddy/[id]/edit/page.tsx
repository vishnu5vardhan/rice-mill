import { redirect } from "next/navigation";
import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { ErrorNotice } from "@/components/ErrorNotice";
import { requireMillContext } from "@/lib/db/context";

export const dynamic = "force-dynamic";

export default async function EditPaddyLotPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const context = await requireMillContext();
  const { data: lot, error } = await context.supabase
    .from("paddy_lots")
    .select("id,created_from_business_event_id")
    .eq("mill_id", context.millId)
    .eq("id", id)
    .single();

  if (error) {
    return (
      <AppShell title="Edit Paddy">
        <ErrorNotice message={error.message} />
      </AppShell>
    );
  }

  if (lot.created_from_business_event_id) {
    const { data: event, error: eventError } = await context.supabase
      .from("business_events")
      .select("draft_entry_id")
      .eq("mill_id", context.millId)
      .eq("id", lot.created_from_business_event_id)
      .maybeSingle();
    if (eventError) {
      return (
        <AppShell title="Edit Paddy">
          <ErrorNotice message={eventError.message} />
        </AppShell>
      );
    }
    if (event?.draft_entry_id) redirect(`/confirm/${event.draft_entry_id}`);
  }

  return (
    <AppShell title="Edit Paddy">
      <div className="rounded-lg border border-ink/10 bg-white p-4 shadow-soft">
        <ErrorNotice message="This paddy entry is not linked to a review draft. Use the paddy list for now." />
        <Link className="mt-3 inline-block rounded-md border border-ink/15 px-4 py-3 text-sm font-bold" href={`/paddy#${id}`}>
          Back to paddy
        </Link>
      </div>
    </AppShell>
  );
}
