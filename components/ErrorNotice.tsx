export function ErrorNotice({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-rust/20 bg-rust/10 p-4 text-sm font-medium text-rust">
      {message}
    </div>
  );
}
