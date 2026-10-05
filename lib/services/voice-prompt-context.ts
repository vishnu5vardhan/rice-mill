import { createHash } from "node:crypto";
import type { SupabaseServerClient } from "@/lib/supabase/server";
import { buildBusinessContext, toExtractionPromptSection } from "@/lib/services/business-context";

const VOICE_PROMPT_CONTEXT_TTL_MS = 5 * 60 * 1000;
const voicePromptContextCache = new Map<string, { value: string; expiresAt: number }>();

export async function getCachedVoicePromptContext(supabase: SupabaseServerClient, millId: string) {
  const cacheKey = cacheKeyForMill(millId);
  const cached = voicePromptContextCache.get(cacheKey);
  const now = Date.now();
  if (cached && cached.expiresAt > now) return { value: cached.value, cacheHit: true };

  const value = toExtractionPromptSection(await buildBusinessContext(supabase, millId));
  voicePromptContextCache.set(cacheKey, { value, expiresAt: now + VOICE_PROMPT_CONTEXT_TTL_MS });
  return { value, cacheHit: false };
}

export function invalidateVoicePromptContext(millId: string) {
  voicePromptContextCache.delete(cacheKeyForMill(millId));
}

export function promptFingerprint(input: { today: string; businessContext: string }) {
  return createHash("sha256")
    .update(input.today)
    .update("\n")
    .update(input.businessContext)
    .digest("hex")
    .slice(0, 16);
}

function cacheKeyForMill(millId: string) {
  return `voice-prompt:${millId}`;
}
