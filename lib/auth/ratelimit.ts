// The AI "meter" — a fixed-window request counter to stop runaway cost on the
// paid AI endpoints (transcription, TTS, realtime sessions, ask).
//
// On Vercel each request can hit a fresh serverless instance, so an in-memory
// counter is NOT reliable in production. When UPSTASH_REDIS_REST_URL +
// UPSTASH_REDIS_REST_TOKEN are set, we use Upstash Redis (shared across all
// instances) via its REST API with plain fetch — no extra npm package.
//
// When those env vars are absent (e.g. local dev), we fall back to a per-process
// in-memory counter so the app still runs. Set them on Vercel for a real meter.
//
// Tune the cap with AI_RATELIMIT_PER_MIN (default 20 requests / minute / IP).

const WINDOW_SECONDS = 60;

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number; // unix seconds when the window resets
}

function limitPerMinute(): number {
  const parsed = Number(process.env.AI_RATELIMIT_PER_MIN);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 20;
}

export async function checkAiRateLimit(identifier: string): Promise<RateLimitResult> {
  const limit = limitPerMinute();
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (url && token) {
    try {
      return await upstashFixedWindow(url, token, identifier, limit);
    } catch {
      // If Upstash is unreachable, degrade to the in-memory meter rather than
      // letting the request through unmetered or hard-failing the user.
      return memoryFixedWindow(identifier, limit);
    }
  }

  return memoryFixedWindow(identifier, limit);
}

async function upstashFixedWindow(
  url: string,
  token: string,
  identifier: string,
  limit: number
): Promise<RateLimitResult> {
  const windowIndex = Math.floor(Date.now() / 1000 / WINDOW_SECONDS);
  const key = `airl:${identifier}:${windowIndex}`;
  const reset = (windowIndex + 1) * WINDOW_SECONDS;

  // Pipeline: increment the counter, then (re)set its expiry so old windows
  // clean themselves up.
  const response = await fetch(`${url}/pipeline`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify([
      ["INCR", key],
      ["EXPIRE", key, String(WINDOW_SECONDS)]
    ]),
    cache: "no-store"
  });

  if (!response.ok) throw new Error(`Upstash returned ${response.status}`);

  const result = (await response.json()) as Array<{ result?: number; error?: string }>;
  const count = Number(result?.[0]?.result ?? 0);
  const success = count <= limit;
  return { success, limit, remaining: Math.max(0, limit - count), reset };
}

// Per-process fallback. Good enough for local dev / a single warm instance.
const memoryBuckets = new Map<string, { count: number; windowIndex: number }>();

function memoryFixedWindow(identifier: string, limit: number): RateLimitResult {
  const windowIndex = Math.floor(Date.now() / 1000 / WINDOW_SECONDS);
  const reset = (windowIndex + 1) * WINDOW_SECONDS;
  const bucket = memoryBuckets.get(identifier);

  if (!bucket || bucket.windowIndex !== windowIndex) {
    memoryBuckets.set(identifier, { count: 1, windowIndex });
    return { success: true, limit, remaining: limit - 1, reset };
  }

  bucket.count += 1;
  const success = bucket.count <= limit;
  return { success, limit, remaining: Math.max(0, limit - bucket.count), reset };
}
