import { Upload } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { ErrorNotice } from "@/components/ErrorNotice";
import { uploadDocumentAction } from "@/app/actions";
import { getOptionalMillContext } from "@/lib/db/context";
import { supabaseEnvStatus } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function UploadPage() {
  const envStatus = supabaseEnvStatus();

  if (!envStatus.configured) {
    const missing = [
      envStatus.hasUrl ? null : "Supabase URL",
      envStatus.hasServiceRoleKey ? null : "SUPABASE_SERVICE_ROLE_KEY"
    ].filter(Boolean);

    return (
      <AppShell title="Upload">
        <div className="space-y-3">
          <ErrorNotice message={`Supabase is not ready in this local app. Missing: ${missing.join(", ")}.`} />
          <div className="rounded-lg border border-ink/10 bg-white p-4 text-sm shadow-soft">
            <p className="font-bold">Runtime config check</p>
            <p className="mt-2 text-ink/70">
              URL: {envStatus.hasUrl ? `found from ${envStatus.urlSource}` : "missing"}
            </p>
            <p className="mt-1 text-ink/70">
              Key: {envStatus.hasPublishableKey ? "found" : "missing. Add NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local."}
            </p>
            <p className="mt-1 text-ink/70">
              No-sign-in mode: {envStatus.hasServiceRoleKey ? "server key found" : "missing SUPABASE_SERVICE_ROLE_KEY."}
            </p>
          </div>
        </div>
      </AppShell>
    );
  }

  const context = await getOptionalMillContext();
  if (!context) {
    return (
      <AppShell title="Upload">
        <ErrorNotice message="Default mill is not ready. Check Supabase seed data and NEXT_PUBLIC_DEFAULT_MILL_ID before uploading documents." />
      </AppShell>
    );
  }

  return (
    <AppShell title="Upload">
      <form action={uploadDocumentAction} className="space-y-5 rounded-lg border border-ink/10 bg-white p-4 shadow-soft">
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-md bg-leaf text-white">
            <Upload className="h-6 w-6" />
          </span>
          <div>
            <h2 className="text-lg font-bold">Document or photo</h2>
            <p className="text-sm text-ink/65">Upload returns immediately. Gemini reads the image in the background; review and confirm it from the Documents list before anything affects the ledger.</p>
          </div>
        </div>

        <label className="block">
          <span className="text-sm font-bold">File</span>
          <input
            name="file"
            type="file"
            accept="image/*,.pdf"
            className="mt-2 w-full rounded-md border border-ink/15 bg-field px-3 py-3"
          />
        </label>

        <label className="block">
          <span className="text-sm font-bold">Document type</span>
          <select name="document_type" defaultValue="truck_sheet" className="mt-2 h-12 w-full rounded-md border border-ink/15 bg-field px-3">
            <option value="truck_sheet">Truck sheet</option>
            <option value="weighbridge_slip">Weighbridge slip</option>
            <option value="byproduct_sale_bill">By-product sale bill</option>
            <option value="transport_bill">Transport bill</option>
            <option value="labour_note">Labour note</option>
            <option value="electricity_bill">Electricity bill</option>
            <option value="maintenance_bill">Maintenance bill</option>
            <option value="rough_notes">Rough notes</option>
            <option value="unknown">Not sure</option>
          </select>
        </label>

        <button className="tap-target w-full rounded-md bg-leaf px-4 py-3 text-base font-bold text-white" type="submit">
          Upload — review when ready
        </button>
      </form>
    </AppShell>
  );
}
