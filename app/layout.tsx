import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Rice Mill Intelligence System",
  description: "Capture, confirm, ledger, and evidence loop for rice mills"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <main className="min-h-screen">{children}</main>
      </body>
    </html>
  );
}
