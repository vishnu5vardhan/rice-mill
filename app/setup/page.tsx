import { AppShell } from "@/components/AppShell";
import { ErrorNotice } from "@/components/ErrorNotice";
import { saveBusinessContextAction } from "@/app/actions";
import { getOptionalMillContext } from "@/lib/db/context";
import { buildBusinessContext } from "@/lib/services/business-context";

export const dynamic = "force-dynamic";

// Villages visible in the mill's existing documents — used as a starting point so the
// owner edits a real list instead of a blank box (the "seed" part of the hybrid).
const SEEDED_CENTERS = [
  "Kistapur",
  "Nagulapally",
  "Brahmanapally",
  "Tupran",
  "Vattur",
  "Pambanda",
  "Hasthalpur",
  "Gunreddipally"
];

export default async function SetupPage() {
  const context = await getOptionalMillContext();
  if (!context) {
    return (
      <AppShell title="Business Setup">
        <ErrorNotice message="Default mill is not ready. Check Supabase seed data and NEXT_PUBLIC_DEFAULT_MILL_ID." />
      </AppShell>
    );
  }

  const ctx = await buildBusinessContext(context.supabase, context.millId);
  const centers = ctx.centers.length > 0 ? ctx.centers : SEEDED_CENTERS;

  return (
    <AppShell title="Business Setup">
      <p className="mb-4 text-sm text-ink/65">
        This is the mill&apos;s known reality. The AI uses it to read handwriting accurately and the
        checks use bag weight to reconcile weighbridge slips. Confirmed entries also teach it over time.
      </p>

      <form action={saveBusinessContextAction} className="space-y-4 rounded-lg border border-ink/10 bg-white p-4 shadow-soft">
        <Field label="Mill name" name="name" defaultValue={ctx.name ?? "Rice Mill"} />
        <Field label="Location" name="location" defaultValue={ctx.location ?? ""} />

        <div className="grid grid-cols-2 gap-3">
          <Field label="Bag weight (kg)" name="bag_weight_kg" defaultValue={String(ctx.bagWeightKg)} inputMode="decimal" />
          <label className="block">
            <span className="text-sm font-bold">Default unit</span>
            <select
              name="default_quantity_unit"
              defaultValue={ctx.defaultQuantityUnit ?? "bag"}
              className="mt-2 h-12 w-full rounded-md border border-ink/15 bg-field px-3 text-base"
            >
              {["bag", "kg", "qtl", "tonne"].map((unit) => (
                <option key={unit} value={unit}>
                  {unit}
                </option>
              ))}
            </select>
          </label>
        </div>

        <TextArea
          label="Known source centers / villages"
          name="centers"
          hint="One per line or comma-separated. Helps the AI read handwritten center names."
          defaultValue={centers.join("\n")}
        />

        <TextArea
          label="Known dealers / buyers"
          name="dealers"
          hint="By-product buyers, one per line or comma-separated."
          defaultValue={ctx.dealers.join("\n")}
        />

        {ctx.rateRanges.length > 0 ? (
          <div className="rounded-md bg-field p-3 text-sm">
            <p className="font-bold">Learned by-product rate ranges</p>
            <ul className="mt-2 space-y-1 text-ink/70">
              {ctx.rateRanges.map((range) => (
                <li key={`${range.product_type}:${range.quantity_unit}`}>
                  {range.product_type.replaceAll("_", " ")} / {range.quantity_unit}: {range.min}–{range.max} (avg {range.avg}, {range.count} sales)
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {ctx.corrections.length > 0 ? (
          <div className="rounded-md bg-field p-3 text-sm">
            <p className="font-bold">Learned corrections (fed back to the AI)</p>
            <ul className="mt-2 space-y-1 text-ink/70">
              {ctx.corrections.slice(0, 10).map((correction, index) => (
                <li key={`${correction.field_name}-${index}`}>
                  {correction.field_name}: &quot;{correction.from}&quot; → &quot;{correction.to}&quot;
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <button className="tap-target w-full rounded-md bg-leaf px-4 py-3 text-base font-bold text-white" type="submit">
          Save business context
        </button>
      </form>
    </AppShell>
  );
}

function Field({
  label,
  name,
  defaultValue,
  inputMode
}: {
  label: string;
  name: string;
  defaultValue?: string;
  inputMode?: "decimal" | "numeric";
}) {
  return (
    <label className="block">
      <span className="text-sm font-bold">{label}</span>
      <input
        name={name}
        defaultValue={defaultValue}
        inputMode={inputMode}
        className="mt-2 h-12 w-full rounded-md border border-ink/15 bg-field px-3 text-base"
      />
    </label>
  );
}

function TextArea({
  label,
  name,
  hint,
  defaultValue
}: {
  label: string;
  name: string;
  hint: string;
  defaultValue?: string;
}) {
  return (
    <label className="block">
      <span className="text-sm font-bold">{label}</span>
      <span className="mt-1 block text-xs text-ink/55">{hint}</span>
      <textarea
        name={name}
        defaultValue={defaultValue}
        rows={5}
        className="mt-2 w-full rounded-md border border-ink/15 bg-field px-3 py-2 text-base"
      />
    </label>
  );
}
