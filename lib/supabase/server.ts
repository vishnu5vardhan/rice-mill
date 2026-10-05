import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

export function hasSupabaseEnv() {
  return Boolean(supabaseUrl() && (supabaseServiceRoleKey() || supabasePublishableKey()));
}

export function supabaseUrl() {
  return process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || linkedSupabaseUrl();
}

export function supabasePublishableKey() {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    ""
  );
}

export function supabaseServiceRoleKey() {
  return process.env.SUPABASE_SERVICE_ROLE_KEY || "";
}

export function supabaseEnvStatus() {
  const url = supabaseUrl();
  const key = supabasePublishableKey();
  const serviceRoleKey = supabaseServiceRoleKey();

  return {
    configured: Boolean(url && serviceRoleKey),
    hasUrl: Boolean(url),
    hasPublishableKey: Boolean(key),
    hasServiceRoleKey: Boolean(serviceRoleKey),
    urlSource: process.env.NEXT_PUBLIC_SUPABASE_URL
      ? "NEXT_PUBLIC_SUPABASE_URL"
      : process.env.SUPABASE_URL
        ? "SUPABASE_URL"
        : linkedProjectRef()
          ? "supabase/.temp/project-ref"
          : null
  };
}

export async function createSupabaseServerClient() {
  if (!hasSupabaseEnv()) {
    throw new Error("Supabase environment variables are missing.");
  }

  if (supabaseServiceRoleKey()) {
    return createClient(supabaseUrl(), supabaseServiceRoleKey(), {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    });
  }

  const cookieStore = await cookies();

  return createServerClient(
    supabaseUrl(),
    supabasePublishableKey(),
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: Array<{ name: string; value: string; options: Parameters<typeof cookieStore.set>[2] }>) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // Server Components cannot set cookies. Middleware handles refresh in a full auth build.
          }
        }
      }
    }
  );
}

export type SupabaseServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

function linkedSupabaseUrl() {
  const projectRef = linkedProjectRef();
  return projectRef ? `https://${projectRef}.supabase.co` : "";
}

function linkedProjectRef() {
  const refPath = join(process.cwd(), "supabase", ".temp", "project-ref");
  if (!existsSync(refPath)) return "";

  const ref = readFileSync(refPath, "utf8").trim();
  return /^[a-z0-9]{20}$/.test(ref) ? ref : "";
}
