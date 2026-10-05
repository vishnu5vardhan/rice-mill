import Link from "next/link";

const nav = [
  { href: "/dashboard", label: "Home" },
  { href: "/voice", label: "Speak" },
  { href: "/upload", label: "Upload" },
  { href: "/documents", label: "Docs" },
  { href: "/manual", label: "Manual" },
  { href: "/paddy", label: "Paddy" },
  { href: "/sales", label: "Sales" },
  { href: "/expenses", label: "Expenses" },
  { href: "/ask", label: "Ask" },
  { href: "/tasks", label: "Tasks" },
  { href: "/alerts", label: "Alerts" },
  { href: "/reports/ca-export", label: "CA" },
  { href: "/setup", label: "Setup" },
  { href: "/profiles", label: "Users" }
];

export function AppShell({
  title,
  children,
  wide = false
}: {
  title: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div className={`mx-auto flex min-h-screen w-full flex-col bg-field ${wide ? "max-w-6xl" : "max-w-3xl"}`}>
      <header className="sticky top-0 z-10 border-b border-ink/10 bg-field/95 px-4 py-4 backdrop-blur">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-leaf">Rice Mill Intelligence</p>
          <h1 className="mt-1 text-2xl font-bold text-ink">{title}</h1>
        </div>
        <nav className="mt-4 flex gap-2 overflow-x-auto pb-1">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-md border border-ink/10 bg-white px-3 py-2 text-sm font-semibold text-ink shadow-sm"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </header>
      <div className="flex-1 px-4 py-5">{children}</div>
    </div>
  );
}
