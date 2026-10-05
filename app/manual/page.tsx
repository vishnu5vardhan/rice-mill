import { AppShell } from "@/components/AppShell";
import { createManualDraftAction } from "@/app/actions";

const today = new Date().toISOString().slice(0, 10);

export default function ManualPage() {
  return (
    <AppShell title="Manual Entry">
      <div className="space-y-5">
        <ManualCard
          title="Paddy inward"
          detail="Save a partial truck entry. Missing fields become tasks after confirmation."
        >
          <input type="hidden" name="draft_type" value="paddy_inward" />
          <Field label="Arrival date" name="arrival_date" type="date" defaultValue={today} />
          <Select label="Source type" name="paddy_source_type" options={["government", "private", "farmer_custom", "own_purchase", "unknown"]} />
          <Field label="Center / party" name="source_party_name" />
          <Field label="Truck number" name="truck_number" />
          <Field label="Truck sheet bags" name="truck_sheet_bag_count" inputMode="decimal" />
          <Field label="Physical bag count" name="physical_bag_count" inputMode="decimal" />
          <Field label="Government app quantity" name="app_quantity" inputMode="decimal" />
          <Field label="Confirmed quantity" name="confirmed_quantity" inputMode="decimal" />
          <Select label="Unit" name="quantity_unit" options={["bag", "kg", "qtl", "tonne"]} />
          <Field label="Moisture %" name="moisture_percent" inputMode="decimal" />
          <Field label="Notes" name="notes" />
        </ManualCard>

        <ManualCard
          title="By-product sale"
          detail="Record bran, broken rice, or husk sale and let confirmation create the ledger event."
        >
          <input type="hidden" name="draft_type" value="byproduct_sale" />
          <Field label="Sale date" name="sale_date" type="date" defaultValue={today} />
          <Field label="Dealer" name="dealer_name" />
          <Select label="Product" name="product_type" options={["bran", "broken_rice", "husk"]} />
          <Field label="Quantity" name="quantity" inputMode="decimal" />
          <Select label="Unit" name="quantity_unit" options={["qtl", "kg", "tonne"]} />
          <Field label="Rate" name="rate" inputMode="decimal" />
          <Select
            label="Payment received"
            name="payment_status"
            options={["pending", "partial", "paid", "cancelled"]}
            labels={{ pending: "awaiting receipt", partial: "partially received", paid: "received", cancelled: "cancelled" }}
          />
          <Field label="Notes" name="notes" />
        </ManualCard>

        <ManualCard title="Expense" detail="Capture labour, transport, electricity, or maintenance cost.">
          <input type="hidden" name="draft_type" value="expense" />
          <Field label="Expense date" name="expense_date" type="date" defaultValue={today} />
          <Select label="Category" name="expense_category" options={["labour", "transport", "electricity", "maintenance", "other"]} />
          <Field label="Vendor" name="vendor_name" />
          <Field label="Amount" name="amount" inputMode="decimal" />
          <Field label="Notes" name="notes" />
        </ManualCard>
      </div>
    </AppShell>
  );
}

function ManualCard({
  title,
  detail,
  children
}: {
  title: string;
  detail: string;
  children: React.ReactNode;
}) {
  return (
    <form action={createManualDraftAction} className="space-y-3 rounded-lg border border-ink/10 bg-white p-4 shadow-soft">
      <div>
        <h2 className="text-lg font-bold">{title}</h2>
        <p className="text-sm text-ink/65">{detail}</p>
      </div>
      {children}
      <button className="tap-target w-full rounded-md bg-leaf px-4 py-3 text-base font-bold text-white" type="submit">
        Save draft for confirmation
      </button>
    </form>
  );
}

function Field({
  label,
  name,
  type = "text",
  defaultValue,
  inputMode
}: {
  label: string;
  name: string;
  type?: string;
  defaultValue?: string;
  inputMode?: "decimal" | "numeric";
}) {
  return (
    <label className="block">
      <span className="text-sm font-bold">{label}</span>
      <input
        name={name}
        type={type}
        defaultValue={defaultValue}
        inputMode={inputMode}
        className="mt-2 h-12 w-full rounded-md border border-ink/15 bg-field px-3 text-base"
      />
    </label>
  );
}

function Select({
  label,
  name,
  options,
  labels
}: {
  label: string;
  name: string;
  options: string[];
  labels?: Record<string, string>;
}) {
  return (
    <label className="block">
      <span className="text-sm font-bold">{label}</span>
      <select name={name} className="mt-2 h-12 w-full rounded-md border border-ink/15 bg-field px-3 text-base">
        <option value="">Missing</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {labels?.[option] ?? option.replaceAll("_", " ")}
          </option>
        ))}
      </select>
    </label>
  );
}
