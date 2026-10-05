import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { EmptyState } from "@/components/EmptyState";
import { ErrorNotice } from "@/components/ErrorNotice";
import { FieldEditor } from "@/components/FieldEditor";
import { StatusBadge } from "@/components/StatusBadge";
import { SubmitButton } from "@/components/SubmitButton";
import { confirmVoiceReviewDraftAction, reclassifyVoiceReviewDraftAction } from "@/app/actions";
import { requireMillContext } from "@/lib/db/context";
import type { DraftEntry, DraftField } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function VoiceReviewPage({ params }: { params: Promise<{ captureId: string }> }) {
  const { captureId } = await params;

  try {
    const context = await requireMillContext();
    const { data: capture, error: captureError } = await context.supabase
      .from("input_captures")
      .select("id,transcript,raw_text,created_at,status,metadata")
      .eq("mill_id", context.millId)
      .eq("id", captureId)
      .single();
    if (captureError) throw captureError;

    const { data: drafts, error: draftsError } = await context.supabase
      .from("draft_entries")
      .select("*")
      .eq("mill_id", context.millId)
      .eq("input_capture_id", captureId)
      .order("created_at", { ascending: true });
    if (draftsError) throw draftsError;

    const draftRows = (drafts ?? []) as DraftEntry[];
    const draftIds = draftRows.map((draft) => draft.id);
    const { data: fields, error: fieldsError } = draftIds.length
      ? await context.supabase
          .from("draft_entry_fields")
          .select("*")
          .eq("mill_id", context.millId)
          .in("draft_entry_id", draftIds)
          .order("created_at", { ascending: true })
      : { data: [], error: null };
    if (fieldsError) throw fieldsError;

    const fieldsByDraft = new Map<string, DraftField[]>();
    for (const field of (fields ?? []) as DraftField[]) {
      const draftEntryId = String((field as DraftField & { draft_entry_id?: string }).draft_entry_id);
      fieldsByDraft.set(draftEntryId, [...(fieldsByDraft.get(draftEntryId) ?? []), field]);
    }

    const pendingCount = draftRows.filter((draft) => draft.status === "pending_confirmation").length;
    const transcript = String(capture.transcript ?? capture.raw_text ?? "").trim();

    return (
      <AppShell title="Voice Review" wide>
        <section className="rounded-lg border border-ink/10 bg-white p-4 shadow-soft">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.08em] text-leaf">Voice note</p>
              <h2 className="mt-1 text-xl font-bold text-ink">
                {draftRows.length} draft{draftRows.length === 1 ? "" : "s"} captured
              </h2>
              <p className="mt-2 text-sm leading-6 text-ink/65">
                Review every card from this one spoken note. Confirming a card updates only that record.
              </p>
            </div>
            <div className="rounded-md border border-ink/10 bg-field px-3 py-2 text-sm font-bold text-ink/70">
              {pendingCount} pending
            </div>
          </div>

          {transcript ? (
            <details className="mt-4 rounded-md border border-ink/10 bg-field p-3 text-sm">
              <summary className="cursor-pointer font-bold">Transcript</summary>
              <p className="mt-3 whitespace-pre-wrap leading-6 text-ink/70">{transcript}</p>
            </details>
          ) : null}
        </section>

        {draftRows.length ? (
          <section className="mt-5 grid gap-4">
            {draftRows.map((draft, index) => {
              const draftFields = fieldsByDraft.get(draft.id) ?? [];
              const destination = draftDestination(draft.draft_type);
              const action = confirmVoiceReviewDraftAction.bind(
                null,
                captureId,
                draft.id,
                draftFields.map((field) => field.field_name)
              );
              const isPending = draft.status === "pending_confirmation";

              return (
                <article key={draft.id} className="rounded-lg border border-ink/10 bg-white p-4 shadow-sm">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-xs font-bold uppercase text-ink/45">Draft {index + 1}</p>
                      <h3 className="mt-1 text-lg font-bold capitalize text-ink">{draft.draft_type.replaceAll("_", " ")}</h3>
                      <p className={`mt-2 inline-flex rounded px-2 py-1 text-xs font-bold uppercase ${destination.className}`}>
                        Goes to {destination.label}
                      </p>
                    </div>
                    <StatusBadge status={draft.status} />
                  </div>

                  {draftFields.length ? (
                    <form action={action} className="mt-4">
                      <div className="grid gap-3 md:grid-cols-2">
                        {draftFields.map((field) => (
                          <FieldEditor key={field.id ?? field.field_name} field={field} />
                        ))}
                      </div>
                      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
                        <div className="sm:w-72">
                          <SubmitButton
                            idleText={isPending ? "Confirm this draft" : "Update this draft"}
                            pendingText="Saving draft..."
                          />
                        </div>
                        <Link href={`/confirm/${draft.id}`} className="rounded-md border border-ink/10 px-4 py-3 text-center text-sm font-bold text-ink">
                          Open full review
                        </Link>
                      </div>
                    </form>
                  ) : (
                    <p className="mt-4 rounded-md bg-field p-3 text-sm text-ink/60">No fields were created for this draft.</p>
                  )}
                  <div className="mt-3 flex flex-wrap gap-2 border-t border-ink/10 pt-3">
                    {draft.draft_type !== "byproduct_sale" ? (
                      <form action={reclassifyVoiceReviewDraftAction.bind(null, captureId, draft.id, "byproduct_sale")}>
                        <button type="submit" className="rounded-md border border-leaf/25 px-3 py-2 text-xs font-bold text-leaf">
                          Move to Sales
                        </button>
                      </form>
                    ) : null}
                    {draft.draft_type !== "expense" ? (
                      <form action={reclassifyVoiceReviewDraftAction.bind(null, captureId, draft.id, "expense")}>
                        <button type="submit" className="rounded-md border border-rust/25 px-3 py-2 text-xs font-bold text-rust">
                          Move to Expenses
                        </button>
                      </form>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </section>
        ) : (
          <div className="mt-5">
            <EmptyState message="No drafts were created from this voice note." />
          </div>
        )}
      </AppShell>
    );
  } catch (error) {
    return (
      <AppShell title="Voice Review">
        <ErrorNotice message={error instanceof Error ? error.message : "Voice review could not be loaded."} />
      </AppShell>
    );
  }
}

function draftDestination(draftType: string) {
  if (draftType === "byproduct_sale") return { label: "Sales", className: "bg-leaf/15 text-leaf" };
  if (draftType === "expense") return { label: "Expenses", className: "bg-rust/10 text-rust" };
  if (draftType === "paddy_inward") return { label: "Paddy", className: "bg-grain/50 text-ink" };
  return { label: "Review", className: "bg-ink/10 text-ink/70" };
}
