"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Re-runs the server component on an interval so background extraction status
// (Extracting -> Ready to confirm) updates without the operator hitting refresh.
// Only mounted while something is actually in progress.
export function AutoRefresh({ intervalMs = 4000, enabled = true }: { intervalMs?: number; enabled?: boolean }) {
  const router = useRouter();

  useEffect(() => {
    if (!enabled) return;
    const id = setInterval(() => router.refresh(), intervalMs);
    return () => clearInterval(id);
  }, [enabled, intervalMs, router]);

  return null;
}
