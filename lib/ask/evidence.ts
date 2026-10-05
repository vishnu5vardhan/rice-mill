export function separateByRecordStatus<T extends { status: string }>(rows: T[]) {
  return {
    confirmed: rows.filter((row) => ["confirmed", "reconciled", "locked", "exported"].includes(row.status)),
    pending: rows.filter((row) => ["draft", "pending_confirmation", "incomplete", "estimated"].includes(row.status)),
    disputed: rows.filter((row) => row.status === "disputed")
  };
}
