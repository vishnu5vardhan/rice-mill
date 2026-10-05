export function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-dashed border-ink/20 bg-white/70 p-5 text-sm text-ink/65">
      {message}
    </div>
  );
}
