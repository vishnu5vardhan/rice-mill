export function StatusBadge({ status }: { status: string }) {
  const tone = statusTone(status);
  return (
    <span className={`inline-flex rounded px-2 py-1 text-xs font-bold uppercase ${tone}`}>
      {status.replaceAll("_", " ")}
    </span>
  );
}

function statusTone(status: string) {
  if (["confirmed", "reconciled", "succeeded", "completed", "resolved"].includes(status)) {
    return "bg-leaf/15 text-leaf";
  }
  if (["disputed", "failed", "critical", "high"].includes(status)) {
    return "bg-rust/15 text-rust";
  }
  if (["incomplete", "open", "pending_confirmation", "queued"].includes(status)) {
    return "bg-grain/50 text-ink";
  }
  return "bg-ink/10 text-ink/70";
}
