import { StatusBadge } from "@/components/StatusBadge";

export function InfoCard({
  title,
  status,
  children,
  href,
  id
}: {
  title: string;
  status?: string;
  children?: React.ReactNode;
  href?: string;
  id?: string;
}) {
  const body = (
    <article id={id} className="scroll-mt-24 rounded-lg border border-ink/10 bg-white p-4 shadow-sm target:ring-2 target:ring-leaf/40">
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-base font-bold text-ink">{title}</h2>
        {status ? <StatusBadge status={status} /> : null}
      </div>
      {children ? <div className="mt-3 text-sm leading-6 text-ink/72">{children}</div> : null}
    </article>
  );

  if (!href) return body;
  return <a href={href}>{body}</a>;
}
