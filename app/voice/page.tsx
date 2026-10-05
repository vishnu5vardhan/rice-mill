import { AppShell } from "@/components/AppShell";
import { VoiceRecorder } from "@/components/VoiceRecorder";

export default function VoicePage() {
  return (
    <AppShell title="Voice Entry">
      <VoiceRecorder />
    </AppShell>
  );
}
