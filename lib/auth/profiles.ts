// Login profiles that admins add from inside the app.
//
// Persistence: stored in the existing mills row under metadata.login_profiles.
// This needs NO database schema change and works on Vercel (shared across all
// serverless instances). Passcodes are stored only as PBKDF2 hashes + per-user
// salt — never in plaintext.
//
// Admins themselves are defined in env (APP_USERS); profiles created here are
// regular (non-admin) logins.

import { requireMillContext } from "@/lib/db/context";

const METADATA_KEY = "login_profiles";
const PBKDF2_ITERATIONS = 100_000;

interface StoredProfile {
  name: string;
  salt: string;
  hash: string;
  created_at: string;
  created_by: string | null;
}

export interface ProfileSummary {
  name: string;
  created_at: string;
  created_by: string | null;
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

async function derive(passcode: string, salt: Uint8Array): Promise<string> {
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(passcode),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: salt as BufferSource, iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
    keyMaterial,
    256
  );
  return bytesToBase64Url(new Uint8Array(bits));
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i += 1) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}

function readProfiles(metadata: unknown): StoredProfile[] {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return [];
  const list = (metadata as Record<string, unknown>)[METADATA_KEY];
  if (!Array.isArray(list)) return [];
  return list.filter(
    (item): item is StoredProfile =>
      Boolean(item) &&
      typeof (item as StoredProfile).name === "string" &&
      typeof (item as StoredProfile).salt === "string" &&
      typeof (item as StoredProfile).hash === "string"
  );
}

async function loadMillAndProfiles() {
  const context = await requireMillContext();
  const { data, error } = await context.supabase
    .from("mills")
    .select("metadata")
    .eq("id", context.millId)
    .single();
  if (error) throw error;
  return {
    supabase: context.supabase,
    millId: context.millId,
    metadata: (data?.metadata ?? {}) as Record<string, unknown>,
    profiles: readProfiles(data?.metadata)
  };
}

async function saveProfiles(
  supabase: Awaited<ReturnType<typeof requireMillContext>>["supabase"],
  millId: string,
  metadata: Record<string, unknown>,
  profiles: StoredProfile[]
) {
  // Merge so we never clobber other metadata keys (e.g. operator-mode flags).
  const nextMetadata = { ...metadata, [METADATA_KEY]: profiles };
  const { error } = await supabase.from("mills").update({ metadata: nextMetadata }).eq("id", millId);
  if (error) throw error;
}

export async function listProfileNames(): Promise<string[]> {
  try {
    const { profiles } = await loadMillAndProfiles();
    return profiles.map((profile) => profile.name);
  } catch {
    return [];
  }
}

export async function listProfiles(): Promise<ProfileSummary[]> {
  const { profiles } = await loadMillAndProfiles();
  return profiles.map((profile) => ({
    name: profile.name,
    created_at: profile.created_at,
    created_by: profile.created_by ?? null
  }));
}

export async function verifyProfile(name: string, passcode: string): Promise<boolean> {
  try {
    const { profiles } = await loadMillAndProfiles();
    const profile = profiles.find((candidate) => candidate.name === name);
    if (!profile) return false;
    const computed = await derive(passcode, base64UrlToBytes(profile.salt));
    return timingSafeEqual(computed, profile.hash);
  } catch {
    return false;
  }
}

export async function addProfile(
  name: string,
  passcode: string,
  createdBy: string | null,
  reservedNames: string[]
): Promise<{ ok: true } | { ok: false; error: string }> {
  const cleanName = name.trim();
  if (cleanName.length < 2) return { ok: false, error: "Name must be at least 2 characters." };
  if (passcode.length < 4) return { ok: false, error: "Passcode must be at least 4 characters." };

  const { supabase, millId, metadata, profiles } = await loadMillAndProfiles();

  const taken = [...reservedNames, ...profiles.map((profile) => profile.name)].map((value) =>
    value.toLowerCase()
  );
  if (taken.includes(cleanName.toLowerCase())) {
    return { ok: false, error: "That name is already in use." };
  }

  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await derive(passcode, salt);
  const next: StoredProfile[] = [
    ...profiles,
    {
      name: cleanName,
      salt: bytesToBase64Url(salt),
      hash,
      created_at: new Date().toISOString(),
      created_by: createdBy
    }
  ];

  await saveProfiles(supabase, millId, metadata, next);
  return { ok: true };
}

export async function deleteProfile(name: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const { supabase, millId, metadata, profiles } = await loadMillAndProfiles();
  const next = profiles.filter((profile) => profile.name !== name);
  if (next.length === profiles.length) return { ok: false, error: "Profile not found." };
  await saveProfiles(supabase, millId, metadata, next);
  return { ok: true };
}
