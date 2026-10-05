import { AppShell } from "@/components/AppShell";
import { EmptyState } from "@/components/EmptyState";
import { ErrorNotice } from "@/components/ErrorNotice";
import { InfoCard } from "@/components/InfoCard";
import { getOptionalMillContext } from "@/lib/db/context";

export const dynamic = "force-dynamic";

export default async function ExpensesPage() {
  const context = await getOptionalMillContext();
  if (!context) {
    return (
      <AppShell title="Expenses">
        <ErrorNotice message="Default mill is not ready. Check Supabase seed data and NEXT_PUBLIC_DEFAULT_MILL_ID." />
      </AppShell>
    );
  }

  const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);
  const { data: expenses } = await context.supabase
    .from("expenses")
    .select("*")
    .eq("mill_id", context.millId)
    .order("expense_date", { ascending: false });
  const monthlyTotal = (expenses ?? [])
    .filter((expense) => expense.expense_date >= startOfMonth && expense.status === "confirmed")
    .reduce((sum, expense) => sum + Number(expense.amount ?? 0), 0);

  return (
    <AppShell title="Expenses">
      <div className="mb-4 rounded-lg border border-ink/10 bg-white p-4 shadow-soft">
        <p className="text-sm text-ink/65">Confirmed this month</p>
        <p className="text-2xl font-bold">INR {monthlyTotal}</p>
      </div>

      <div className="space-y-3">
        {expenses && expenses.length > 0 ? (
          expenses.map((expense) => (
            <InfoCard key={expense.id} id={expense.id} title={expense.expense_category} status={expense.status}>
              <p>Amount: INR {expense.amount ?? "missing"}</p>
              <p>Date: {expense.expense_date}</p>
              <p>{expense.notes ?? "No notes"}</p>
            </InfoCard>
          ))
        ) : (
          <EmptyState message="No expenses yet." />
        )}
      </div>
    </AppShell>
  );
}
