// Signed session cookie helpers.
//
// Uses the Web Crypto API (globalThis.crypto.subtle) so the SAME code runs in
// both the Edge middleware and the Node route handlers — important for Vercel.
// The cookie is a tamper-proof token: base64url(payload).base64url(HMAC-SHA256).
// Nobody can forge a session without AUTH_SECRET.

export const SESSION_COOKIE = "rm_session";
// 12 hours. The operator just re-enters the passcode after this.
export const SESSION_TTL_SECONDS = 60 * 60 * 12;

interface SessionPayload {
  u: string; // username
  exp: number; // unix seconds
}

function authSecret(): string {
  return process.env.AUTH_SECRET || "";
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlToBytes(value: string): Uint8Array {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) out[i] = binary.charCodeAt(i);
  return out;
}

async function hmac(payloadB64: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payloadB64));
  return bytesToBase64Url(new Uint8Array(signature));
}

// Length-constant string compare so an attacker cannot guess the signature byte
// by byte from response timing.
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i += 1) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}

export async function createSessionToken(username: string, ttlSeconds = SESSION_TTL_SECONDS): Promise<string> {
  const secret = authSecret();
  if (!secret) throw new Error("AUTH_SECRET is not set.");
  const payload: SessionPayload = { u: username, exp: Math.floor(Date.now() / 1000) + ttlSeconds };
  const payloadB64 = bytesToBase64Url(new TextEncoder().encode(JSON.stringify(payload)));
  const signature = await hmac(payloadB64, secret);
  return `${payloadB64}.${signature}`;
}

export async function verifySessionToken(token: string | undefined | null): Promise<{ u: string } | null> {
  if (!token) return null;
  const secret = authSecret();
  if (!secret) return null;

  const [payloadB64, signature] = token.split(".");
  if (!payloadB64 || !signature) return null;

  const expected = await hmac(payloadB64, secret);
  if (!timingSafeEqual(signature, expected)) return null;

  try {
    const payload = JSON.parse(new TextDecoder().decode(base64UrlToBytes(payloadB64))) as SessionPayload;
    if (typeof payload.u !== "string" || typeof payload.exp !== "number") return null;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return { u: payload.u };
  } catch {
    return null;
  }
}
