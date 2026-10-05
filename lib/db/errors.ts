import { NextResponse } from "next/server";

export function apiError(error: unknown, status = 400) {
  const message = error instanceof Error ? error.message : "Unexpected error";
  return NextResponse.json({ error: message }, { status });
}

export function isAuthContextError(error: unknown) {
  return error instanceof Error && /default mill|Supabase environment|SUPABASE_SERVICE_ROLE_KEY/i.test(error.message);
}
