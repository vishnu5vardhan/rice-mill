import { AppShell } from "@/components/AppShell";
import { AskClient } from "@/components/AskClient";

export default function AskPage() {
  return (
    <AppShell title="Ask" wide>
      <AskClient />
    </AppShell>
  );
}
