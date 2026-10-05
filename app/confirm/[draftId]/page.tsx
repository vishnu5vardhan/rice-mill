import { AppShell } from "@/components/AppShell";
import { EmptyState } from "@/components/EmptyState";
import { ErrorNotice } from "@/components/ErrorNotice";
import { FieldEditor } from "@/components/FieldEditor";
import { StatusBadge } from "@/components/StatusBadge";
import { SubmitButton } from "@/components/SubmitButton";
import { cancelDraftAction, confirmDraftAction } from "@/app/actions";
import { requireMillContext } from "@/lib/db/context";
import { getDraftWithFields } from "@/lib/services/drafts";

export const dynamic = "force-dynamic";

export default async function ConfirmDraftPage({ params }: { params: Promise<{ draftId: string }> }) {
  const { draftId } = await params;

  try {
    const context = await requireMillContext();
    const { draft, fields } = await getDraftWithFields(context.supabase, context.millId, draftId);
    const { data: siblingDrafts } = draft.source_type === "voice" && draft.input_capture_id
      ? await context.supabase
          .from("draft_entries")
          .select("id,draft_type,status,created_at")
          .eq("mill_id", context.millId)
          .eq("input_capture_id", draft.input_capture_id)
          .neq("id", draft.id)
          .in("status", ["pending_confirmation", "incomplete"])
          .order("created_at", { ascending: true })
      : { data: [] };
    const { data: document } = draft.document_id
      ? await context.supabase
          .from("documents")
          .select("id,storage_bucket,storage_path,original_filename,mime_type,document_type,metadata")
          .eq("mill_id", context.millId)
          .eq("id", draft.document_id)
          .maybeSingle()
      : { data: null };
    const { data: signed } = document
      ? await context.supabase.storage.from(document.storage_bucket).createSignedUrl(document.storage_path, 60 * 10)
      : { data: null };
    const action = confirmDraftAction.bind(null, draft.id, fields.map((field) => field.field_name));
    const isUpdate = draft.status !== "pending_confirmation";

    return (
      <AppShell title={isUpdate ? "Review Entry" : "Confirm"}>
        <div className="mb-4 rounded-lg border border-ink/10 bg-white p-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-bold capitalize">{draft.draft_type.replaceAll("_", " ")}</h2>
            <StatusBadge status={draft.status} />
          </div>
          <p className="mt-2 text-sm text-ink/65">
            {isUpdate
              ? "Update the saved entry from the source document. Fixed missing fields will update the linked record and tasks."
              : "AI fields stay draft until you press confirm. Corrections are saved as memory."}
          </p>
        </div>

        {siblingDrafts?.length ? (
          <div className="mb-4 rounded-lg border border-leaf/20 bg-leaf/10 p-4 text-sm text-ink">
            <p className="font-bold">This voice note created {siblingDrafts.length + 1} drafts.</p>
            <p className="mt-1 text-ink/65">After you confirm this one, the next pending draft from the same voice note will open automatically.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {siblingDrafts.map((item) => (
                <a
                  key={item.id}
                  href={`/confirm/${item.id}`}
                  className="rounded-md border border-leaf/20 bg-white px-3 py-2 text-xs font-bold capitalize text-leaf"
                >
                  {String(item.draft_type).replaceAll("_", " ")}
                </a>
              ))}
            </div>
          </div>
        ) : null}

        {fields.length > 0 ? (
          <div className="grid gap-4 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
            <aside className="rounded-lg border border-ink/10 bg-white p-3 shadow-soft lg:sticky lg:top-28 lg:self-start">
              <p className="mb-2 text-sm font-bold">Source document</p>
              {document && signed?.signedUrl ? (
                document.mime_type?.startsWith("image/") ? (
                  <img
                    src={signed.signedUrl}
                    alt={document.original_filename}
                    className="max-h-[70vh] w-full rounded-md border border-ink/10 object-contain"
                  />
                ) : (
                  <a className="block rounded-md border border-ink/10 bg-field p-4 text-sm font-semibold" href={signed.signedUrl} target="_blank">
                    Open {document.original_filename}
                  </a>
                )
              ) : (
                <p className="rounded-md bg-field p-4 text-sm text-ink/65">No preview is available for this draft.</p>
              )}
              {document ? (
                <div className="mt-3 space-y-1 text-xs text-ink/60">
                  <p>Type: {document.document_type?.replaceAll("_", " ")}</p>
                  <p>{document.original_filename}</p>
                </div>
              ) : null}
            </aside>

            <form action={action} className="space-y-3">
              {fields.map((field) => (
                <FieldEditor key={field.id ?? field.field_name} field={field} />
              ))}
              <div className="flex flex-wrap gap-2">
                <SubmitButton idleText={isUpdate ? "Update saved entry" : "Confirm or save incomplete"} pendingText="Saving entry..." />
              </div>
            </form>
            <form action={cancelDraftAction.bind(null, draft.id)} className="lg:col-start-2">
              <button className="w-full rounded-md border border-rust/40 px-4 py-3 text-sm font-bold text-rust" type="submit">
                Delete draft
              </button>
              <p className="mt-2 text-xs text-ink/55">This marks the draft cancelled. The original document stays saved for audit.</p>
            </form>
          </div>
        ) : (
          <EmptyState message="This draft has no fields to confirm." />
        )}
      </AppShell>
    );
  } catch (error) {
    return (
      <AppShell title="Confirm">
        <ErrorNotice message={error instanceof Error ? error.message : "Draft could not be loaded."} />
      </AppShell>
    );
  }
}
