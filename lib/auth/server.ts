// Server-only session helpers (Server Components + Route Handlers).
// Kept separate from session.ts because this imports next/headers, which must
// NOT be pulled into the Edge middleware bundle.

import { cookies } from "next/headers";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth/session";

export async function getServerSession(): Promise<{ u: string } | null> {
  const cookieStore = await cookies();
  return verifySessionToken(cookieStore.get(SESSION_COOKIE)?.value);
}
