import { AppShell } from "@/components/AppShell";
import { EmptyState } from "@/components/EmptyState";
import { ErrorNotice } from "@/components/ErrorNotice";
import { InfoCard } from "@/components/InfoCard";
import { SubmitButton } from "@/components/SubmitButton";
import { AlertTriangle, CheckCircle2, Download, FileSpreadsheet, Lock, PackageOpen } from "lucide-react";
import { generateCaExportAction } from "@/app/actions";
import { getOptionalMillContext } from "@/lib/db/context";
import { buildCaExportPreview, currentMonthPeriod } from "@/lib/reports/ca-export";

export const dynamic = "force-dynamic";

export default async function CaExportPreviewPage() {
  const context = await getOptionalMillContext();
  if (!context) {
    return (
      <AppShell title="CA Preview">
        <ErrorNotice message="Default mill is not ready. Check Supabase seed data and NEXT_PUBLIC_DEFAULT_MILL_ID." />
      </AppShell>
    );
  }

  const { periodStart, periodEnd, label } = currentMonthPeriod();
  const [{ data: events }, { data: tasks }, { data: lots }, { data: alerts }, { data: snapshots }] = await Promise.all([
    context.supabase
      .from("business_events")
      .select("*")
      .eq("mill_id", context.millId)
      .gte("event_date", periodStart)
      .lte("event_date", periodEnd)
      .order("event_date", { ascending: false }),
    context.supabase.from("tasks").select("*").eq("mill_id", context.millId).in("status", ["open", "in_progress"]),
    context.supabase.from("paddy_lots").select("*").eq("mill_id", context.millId).eq("status", "disputed"),
    context.supabase.from("alerts").select("*").eq("mill_id", context.millId).in("status", ["open", "snoozed"]),
    context.supabase
      .from("export_snapshots")
      .select("id,period_start,period_end,version,status,generated_at,summary")
      .eq("mill_id", context.millId)
      .eq("export_type", "ca_monthly")
      .order("generated_at", { ascending: false })
      .limit(5)
  ]);

  const preview = buildCaExportPreview({
    businessEvents: events ?? [],
    tasks: tasks ?? [],
    disputedLots: lots ?? [],
    alerts: alerts ?? []
  });

  const quality = exportQuality(preview.summary);
  const confirmedRows = preview.confirmed.slice(0, 12);
  const missingRows = preview.missing.slice(0, 8);
  const disputedRows = preview.disputed.slice(0, 8);

  return (
    <AppShell title="CA Preview">
      <section className="rounded-lg border border-ink/10 bg-white p-4 shadow-soft">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.08em] text-leaf">Monthly CA pack</p>
            <h2 className="mt-1 text-xl font-bold text-ink">Data quality preview</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-ink/65">
              Preview for {label}. Generate an export snapshot to lock confirmed records and download CA-ready JSON or Excel-compatible CSV. Missing and disputed items stay visible.
            </p>
          </div>
          <form action={generateCaExportAction}>
            <SubmitButton idleText="Generate export" pendingText="Generating..." />
          </form>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <MetricCard
            icon={<CheckCircle2 className="h-5 w-5" />}
            label="Ready"
            value={preview.summary.confirmed_count}
            caption="Confirmed ledger records"
            tone="leaf"
          />
          <MetricCard
            icon={<AlertTriangle className="h-5 w-5" />}
            label="Missing"
            value={preview.summary.missing_count}
            caption="Open data-quality tasks"
            tone="grain"
          />
          <MetricCard
            icon={<PackageOpen className="h-5 w-5" />}
            label="Disputed"
            value={preview.summary.disputed_count}
            caption="Records needing review"
            tone="rust"
          />
        </div>

        <div className="mt-5 rounded-md border border-ink/10 bg-field p-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-bold text-ink">Export confidence: {quality.confidence}</p>
              <p className="mt-1 text-xs font-medium text-ink/60">{quality.message}</p>
            </div>
            <div className="flex items-center gap-2 text-xs font-bold text-ink/60">
              <Lock className="h-4 w-4" />
              Confirmed records lock as exported
            </div>
          </div>
        </div>
      </section>

      <section className="mt-5">
        <InfoCard title="Generated exports" status={snapshots?.length ? "exported" : "none"}>
          {snapshots?.length ? (
            <div className="space-y-2">
              {snapshots.map((snapshot) => (
                <div key={snapshot.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-ink/10 bg-field px-3 py-2">
                  <div>
                    <p className="font-bold">{snapshot.period_start} to {snapshot.period_end} · v{snapshot.version}</p>
                    <p className="text-xs text-ink/55">Generated {new Date(snapshot.generated_at).toLocaleString()} · {snapshot.status}</p>
                  </div>
                  <div className="flex gap-2">
                    <a className="rounded-md border border-ink/15 px-3 py-2 text-xs font-bold" href={`/api/reports/ca-export/${snapshot.id}/download?format=csv`}>
                      CSV
                    </a>
                    <a className="rounded-md border border-ink/15 px-3 py-2 text-xs font-bold" href={`/api/reports/ca-export/${snapshot.id}/download?format=json`}>
                      JSON
                    </a>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p>No export snapshots generated yet.</p>
          )}
        </InfoCard>
      </section>

      <section className="mt-5 grid gap-3">
        <InfoCard title="What is missing" status={preview.summary.missing_count ? "incomplete" : "confirmed"}>
          {missingRows.length ? (
            <div className="space-y-2">
              {missingRows.map((task) => (
                <ReviewRow
                  key={task.id}
                  title={task.title}
                  meta={[
                    task.missing_field_name ? `Field: ${task.missing_field_name}` : null,
                    task.linked_entity_type ? `Linked to: ${task.linked_entity_type}` : null
                  ]}
                />
              ))}
              {preview.missing.length > missingRows.length ? (
                <p className="text-xs font-semibold text-ink/55">+{preview.missing.length - missingRows.length} more missing-data items</p>
              ) : null}
            </div>
          ) : (
            <p>No missing-data tasks are open.</p>
          )}
        </InfoCard>

        <InfoCard title="Disputed review" status={preview.summary.disputed_count ? "disputed" : "confirmed"}>
          {disputedRows.length ? (
            <div className="space-y-2">
              {disputedRows.map((item) => (
                <ReviewRow
                  key={String(item.id)}
                  title={rowTitle(item)}
                  meta={[rowStatus(item), rowDate(item)].filter(Boolean)}
                />
              ))}
            </div>
          ) : (
            <p>No disputed records are waiting for CA review.</p>
          )}
        </InfoCard>
      </section>

      <section className="mt-5 rounded-lg border border-ink/10 bg-white shadow-sm">
        <div className="flex items-center justify-between gap-3 border-b border-ink/10 p-4">
          <div>
            <h2 className="text-lg font-bold">Confirmed records</h2>
            <p className="mt-1 text-sm text-ink/60">First {confirmedRows.length} records shown for CA preview.</p>
          </div>
          <FileSpreadsheet className="h-5 w-5 text-leaf" />
        </div>
        {confirmedRows.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-left text-sm">
              <thead className="bg-field text-xs uppercase text-ink/55">
                <tr>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Summary</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink/10">
                {confirmedRows.map((event) => (
                  <tr key={event.id}>
                    <td className="whitespace-nowrap px-4 py-3 font-semibold">{event.event_date}</td>
                    <td className="px-4 py-3">{event.event_type.replaceAll("_", " ")}</td>
                    <td className="px-4 py-3 font-semibold capitalize text-leaf">{event.status}</td>
                    <td className="px-4 py-3 text-ink/65">{payloadSummary(event.payload)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-4">
            <EmptyState message="No confirmed records are ready for CA preview." />
          </div>
        )}
      </section>

      <section className="mt-5 space-y-3">
        <details className="rounded-lg border border-ink/10 bg-white p-4 text-xs">
          <summary className="cursor-pointer text-sm font-bold">Raw preview data</summary>
        {preview.summary.confirmed_count || preview.summary.missing_count || preview.summary.disputed_count ? (
          <pre className="mt-3 max-h-[32rem] overflow-auto rounded-md bg-field p-4">
            {JSON.stringify(preview, null, 2)}
          </pre>
        ) : (
          <EmptyState message="No CA preview data yet." />
        )}
        </details>
      </section>
    </AppShell>
  );
}

function MetricCard({
  icon,
  label,
  value,
  caption,
  tone
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  caption: string;
  tone: "leaf" | "grain" | "rust";
}) {
  const toneClasses = {
    leaf: "bg-leaf/10 text-leaf",
    grain: "bg-grain/35 text-ink",
    rust: "bg-rust/10 text-rust"
  };

  return (
    <div className="rounded-md border border-ink/10 bg-field p-4">
      <div className={`flex h-9 w-9 items-center justify-center rounded-full ${toneClasses[tone]}`}>{icon}</div>
      <p className="mt-3 text-xs font-bold uppercase text-ink/50">{label}</p>
      <p className="mt-1 text-3xl font-bold text-ink">{value}</p>
      <p className="mt-1 text-xs font-medium text-ink/55">{caption}</p>
    </div>
  );
}

function ReviewRow({ title, meta }: { title: string; meta: Array<string | null | undefined> }) {
  const cleanMeta = meta.filter(Boolean);

  return (
    <div className="rounded-md border border-ink/10 bg-field px-3 py-2">
      <p className="font-bold text-ink">{title}</p>
      {cleanMeta.length ? <p className="mt-1 text-xs font-medium text-ink/55">{cleanMeta.join(" · ")}</p> : null}
    </div>
  );
}

function exportQuality(summary: { confirmed_count: number; missing_count: number; disputed_count: number }) {
  if (summary.disputed_count > 0) {
    return {
      confidence: "Low",
      message: "Disputed records exist. Review them before sending a final export to the CA."
    };
  }

  if (summary.missing_count > 0) {
    return {
      confidence: "Medium",
      message: "Confirmed records can be previewed, but missing-data items must be shown separately."
    };
  }

  if (summary.confirmed_count > 0) {
    return {
      confidence: "High",
      message: "No missing or disputed records were found in the current preview set."
    };
  }

  return {
    confidence: "No data",
    message: "Add and confirm records before generating a CA export."
  };
}

function rowTitle(row: unknown) {
  const record = asRecord(row);
  return String(record.title ?? record.event_type ?? record.lot_code ?? record.alert_type ?? "Record");
}

function rowStatus(row: unknown) {
  const record = asRecord(row);
  return record.status ? `Status: ${String(record.status)}` : null;
}

function rowDate(row: unknown) {
  const record = asRecord(row);
  return record.event_date ? `Date: ${String(record.event_date)}` : null;
}

function payloadSummary(payload: unknown) {
  const record = asRecord(payload);
  const keys = ["source_party_name", "party_name", "product_type", "amount", "quantity", "quantity_unit", "truck_number"];
  const parts = keys
    .map((key) => {
      const value = record[key];
      return value === null || value === undefined || value === "" ? null : `${key.replaceAll("_", " ")}: ${String(value)}`;
    })
    .filter(Boolean);

  return parts.length ? parts.slice(0, 3).join(" · ") : "Confirmed event payload available";
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
