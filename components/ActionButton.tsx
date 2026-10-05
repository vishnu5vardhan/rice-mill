import Link from "next/link";
import type { LucideIcon } from "lucide-react";

export function ActionButton({
  href,
  icon: Icon,
  label,
  detail
}: {
  href: string;
  icon: LucideIcon;
  label: string;
  detail?: string;
}) {
  return (
    <Link
      href={href}
      className="tap-target flex items-center gap-3 rounded-lg border border-ink/10 bg-white p-4 shadow-soft"
    >
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-leaf text-white">
        <Icon aria-hidden className="h-6 w-6" />
      </span>
      <span>
        <span className="block text-lg font-bold text-ink">{label}</span>
        {detail ? <span className="mt-1 block text-sm text-ink/65">{detail}</span> : null}
      </span>
    </Link>
  );
}
