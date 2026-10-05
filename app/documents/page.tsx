import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { AutoRefresh } from "@/components/AutoRefresh";
import { EmptyState } from "@/components/EmptyState";
import { ErrorNotice } from "@/components/ErrorNotice";
import { InfoCard } from "@/components/InfoCard";
import { SubmitButton } from "@/components/SubmitButton";
import { createByproductDraftFromRoughNoteAction, createExpenseDraftFromRoughNoteAction, linkWeighbridgeDocumentAction, retryExtractionAction } from "@/app/actions";
import { getOptionalMillContext } from "@/lib/db/context";
import { inferByproductProduct } from "@/lib/byproducts/aliases";

export const dynamic = "force-dynamic";

const CONFIRMED_STATUSES = ["confirmed", "reconciled", "locked", "exported"];
const PENDING_EXTRACTION = ["queued", "running"];

export default async function DocumentsPage() {
  const context = await getOptionalMillContext();
  if (!context) {
    return (
      <AppShell title="Documents">
        <ErrorNotice message="Default mill is not ready. Check Supabase seed data and NEXT_PUBLIC_DEFAULT_MILL_ID." />
      </AppShell>
    );
  }

  const [{ data: documents }, { data: extractionRuns }, { data: drafts }, { data: businessEvents }, { data: lots }] = await Promise.all([
    context.supabase.from("documents").select("*").eq("mill_id", context.millId).order("created_at", { ascending: false }),
    context.supabase
      .from("extraction_runs")
      .select("document_id,validated_output,status,created_at")
      .eq("mill_id", context.millId)
      .order("created_at", { ascending: false }),
    context.supabase
      .from("draft_entries")
      .select("id,document_id,draft_type,status,created_at")
      .eq("mill_id", context.millId)
      .not("document_id", "is", null)
      .order("created_at", { ascending: false }),
    context.supabase
      .from("business_events")
      .select("id,document_id,draft_entry_id,related_entity_type,related_entity_id,status,updated_at")
      .eq("mill_id", context.millId)
      .not("document_id", "is", null)
      .order("updated_at", { ascending: false }),
    context.supabase
      .from("paddy_lots")
      .select("id,lot_code,truck_number,metadata,status")
      .eq("mill_id", context.millId)
      .order("created_at", { ascending: false })
  ]);

  const latestRunByDocument = new Map<string, unknown>();
  for (const run of extractionRuns ?? []) {
    if (run.document_id && !latestRunByDocument.has(run.document_id)) {
      latestRunByDocument.set(run.document_id, run.validated_output);
    }
  }

  const latestDraftByDocument = new Map<string, { id: string; draft_type: string; status: string }>();
  for (const draft of drafts ?? []) {
    if (draft.document_id && !latestDraftByDocument.has(draft.document_id)) {
      latestDraftByDocument.set(draft.document_id, draft);
    }
  }

  const latestEventByDocument = new Map<string, DocumentBusinessEvent>();
  const latestEventByDraft = new Map<string, DocumentBusinessEvent>();
  for (const event of businessEvents ?? []) {
    if (event.document_id && !latestEventByDocument.has(event.document_id)) {
      latestEventByDocument.set(event.document_id, event);
    }
    if (event.draft_entry_id && !latestEventByDraft.has(event.draft_entry_id)) {
      latestEventByDraft.set(event.draft_entry_id, event);
    }
  }

  const anyExtracting = (documents ?? []).some((document) => PENDING_EXTRACTION.includes(document.extraction_status));

  return (
    <AppShell title="Documents">
      <AutoRefresh enabled={anyExtracting} />
      {anyExtracting ? (
        <p className="mb-3 rounded-md bg-field px-3 py-2 text-sm text-ink/70">
          Reading uploaded photos in the background. This list updates automatically — you can keep uploading.
        </p>
      ) : null}
      <div className="space-y-3">
        {documents && documents.length > 0 ? (
          documents.map((document) => {
            const extraction = extractionObject(latestRunByDocument.get(document.id));
            const roughLines = roughNoteLines(extraction);
            const draft = latestDraftByDocument.get(document.id);
            const event = latestEventByDocument.get(document.id) ?? (draft ? latestEventByDraft.get(draft.id) : undefined);
            const review = reviewState(document.extraction_status, draft, event);
            const entryHref = entryHrefForEvent(event);
            return (
              <InfoCard key={document.id} title={document.original_filename} status={document.document_type}>
                <div className="flex items-center justify-between gap-2">
                  <p className={`text-sm font-bold ${review.tone}`}>{review.label}</p>
                  <p className="text-xs text-ink/55">{new Date(document.uploaded_at).toLocaleString()}</p>
                </div>

                {review.kind === "ready" && draft ? (
                  <Link
                    href={`/confirm/${draft.id}`}
                    className="mt-3 inline-block rounded-md bg-leaf px-4 py-2 text-sm font-bold text-white"
                  >
                    Review &amp; confirm
                  </Link>
                ) : null}

                {entryHref ? (
                  <Link
                    href={entryHref}
                    className="mt-3 inline-block rounded-md border border-rust/40 px-4 py-2 text-sm font-bold text-rust"
                  >
                    Open saved entry
                  </Link>
                ) : null}

                {review.kind === "attention" && draft && !entryHref ? (
                  <Link
                    href={`/confirm/${draft.id}`}
                    className="mt-3 inline-block rounded-md border border-rust/40 px-4 py-2 text-sm font-bold text-rust"
                  >
                    Open entry
                  </Link>
                ) : null}

                {review.kind === "failed" ? (
                  <form action={retryExtractionAction.bind(null, document.id)} className="mt-3">
                    <SubmitButton idleText="Retry extraction" pendingText="Re-queuing..." />
                  </form>
                ) : null}

                {document.document_type === "weighbridge_slip" ? (
                  <form action={linkWeighbridgeDocumentAction} className="mt-3 space-y-2 rounded-md bg-field p-3">
                    <input type="hidden" name="document_id" value={document.id} />
                    <p className="text-sm font-bold">Link weighbridge slip to paddy lot</p>
                    <select name="paddy_lot_id" className="h-11 w-full rounded-md border border-ink/15 bg-white px-3 text-sm">
                      <option value="">Choose lot</option>
                      {(lots ?? []).map((lot) => (
                        <option key={lot.id} value={lot.id}>
                          {lot.lot_code ?? lot.metadata?.source_party_name ?? lot.truck_number ?? lot.id} ({lot.status})
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-ink/60">
                      Net: {String(extraction.net_weight ?? "missing")} {String(extraction.quantity_unit ?? "")}
                    </p>
                    <button className="rounded-md bg-leaf px-3 py-2 text-sm font-bold text-white" type="submit">
                      Link as evidence
                    </button>
                  </form>
                ) : null}

                {document.document_type === "rough_notes" ? (
                  <div className="mt-3 rounded-md bg-field p-3">
                    <p className="text-sm font-bold">Candidate lines only</p>
                    {roughLines.length > 0 ? (
                      <ul className="mt-2 space-y-1 text-sm">
                        {roughLines.map((line, index) => (
                          <li key={`${line}-${index}`} className="flex flex-wrap items-center justify-between gap-2 rounded bg-white px-2 py-1">
                            <span>
                              {line}
                              {inferByproductProduct(line) ? (
                                <span className="ml-2 rounded bg-leaf/10 px-2 py-0.5 text-xs font-bold text-leaf">
                                  {inferByproductProduct(line)?.replaceAll("_", " ")}
                                </span>
                              ) : null}
                            </span>
                            <div className="flex flex-wrap gap-2">
                              {inferByproductProduct(line) ? (
                                <form action={createByproductDraftFromRoughNoteAction.bind(null, document.id)}>
                                  <input type="hidden" name="line_text" value={line} />
                                  <button className="rounded-md bg-leaf px-2 py-1 text-xs font-bold text-white" type="submit">
                                    Create sale draft
                                  </button>
                                </form>
                              ) : null}
                              <form action={createExpenseDraftFromRoughNoteAction.bind(null, document.id)}>
                                <input type="hidden" name="line_text" value={line} />
                                <button className="rounded-md border border-ink/15 px-2 py-1 text-xs font-bold" type="submit">
                                  Create expense draft
                                </button>
                              </form>
                            </div>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-ink/60">No candidate lines extracted yet.</p>
                    )}
                    <p className="mt-2 text-xs text-rust">Rough notes never create ledger events automatically.</p>
                  </div>
                ) : null}
              </InfoCard>
            );
          })
        ) : (
          <EmptyState message="No documents uploaded yet." />
        )}
      </div>
    </AppShell>
  );
}

function reviewState(
  extractionStatus: string,
  draft: { status: string } | undefined,
  event: DocumentBusinessEvent | undefined
): { kind: "ready" | "attention" | "done" | "extracting" | "failed" | "evidence"; label: string; tone: string } {
  if (event) {
    if (CONFIRMED_STATUSES.includes(event.status)) {
      return { kind: "done", label: "Confirmed", tone: "text-ink/60" };
    }
    if (event.status === "disputed") {
      return { kind: "attention", label: "Confirmed with mismatch — review", tone: "text-rust" };
    }
    if (event.status === "incomplete") {
      return { kind: "attention", label: "Saved with missing data", tone: "text-rust" };
    }
  }

  if (draft) {
    if (draft.status === "pending_confirmation") {
      return { kind: "ready", label: "Ready to confirm", tone: "text-leaf" };
    }
    if (CONFIRMED_STATUSES.includes(draft.status)) {
      return { kind: "done", label: "Confirmed", tone: "text-ink/60" };
    }
    if (draft.status === "disputed") {
      return { kind: "attention", label: "Confirmed with mismatch — review", tone: "text-rust" };
    }
    if (draft.status === "incomplete") {
      return { kind: "attention", label: "Saved with missing data", tone: "text-rust" };
    }
    return { kind: "attention", label: `Draft: ${draft.status.replaceAll("_", " ")}`, tone: "text-ink/70" };
  }

  if (PENDING_EXTRACTION.includes(extractionStatus)) {
    return { kind: "extracting", label: "Extracting…", tone: "text-ink/70" };
  }
  if (extractionStatus === "failed") {
    return { kind: "failed", label: "Extraction failed", tone: "text-rust" };
  }
  if (extractionStatus === "succeeded") {
    return { kind: "evidence", label: "Saved as evidence", tone: "text-ink/60" };
  }
  return { kind: "extracting", label: extractionStatus, tone: "text-ink/60" };
}

type DocumentBusinessEvent = {
  id: string;
  document_id: string | null;
  draft_entry_id: string | null;
  related_entity_type: string | null;
  related_entity_id: string | null;
  status: string;
};

function entryHrefForEvent(event: DocumentBusinessEvent | undefined) {
  if (!event?.related_entity_type || !event.related_entity_id) return null;
  if (event.draft_entry_id) return `/confirm/${encodeURIComponent(event.draft_entry_id)}`;

  const anchor = encodeURIComponent(event.related_entity_id);

  if (event.related_entity_type === "paddy_lots" || event.related_entity_type === "paddy_lot") return `/paddy/${anchor}/edit`;
  if (event.related_entity_type === "byproduct_sales" || event.related_entity_type === "byproduct_sale") return `/sales#${anchor}`;
  if (event.related_entity_type === "expenses" || event.related_entity_type === "expense") return `/expenses#${anchor}`;

  return null;
}

function extractionObject(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {} as Record<string, unknown>;
  const record = value as Record<string, unknown>;
  return record.extraction && typeof record.extraction === "object" && !Array.isArray(record.extraction)
    ? record.extraction as Record<string, unknown>
    : record;
}

function roughNoteLines(value: Record<string, unknown>) {
  const lines = Array.isArray(value.candidate_lines) ? value.candidate_lines : [];
  return lines
    .map((line) => {
      if (typeof line === "string") return line;
      if (line && typeof line === "object" && "line_text" in line && typeof line.line_text === "string") return line.line_text;
      return null;
    })
    .filter((line): line is string => Boolean(line));
}
