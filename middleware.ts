// Edge middleware: the single gate in front of the whole app.
//
//   1) Auth — every page/route requires a valid signed session cookie. No cookie
//      => pages redirect to /login, API calls get a 401. Your existing routes and
//      business logic are untouched; this just runs before them.
//   2) AI meter — the paid AI endpoints are rate-limited per IP so nobody (even a
//      logged-in user) can loop them and burn your OpenAI/Gemini/Sarvam credits.
//
// Runs on Vercel Edge. Only uses Web Crypto + fetch, so it is Vercel-safe.

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth/session";
import { checkAiRateLimit } from "@/lib/auth/ratelimit";

// Reachable without a session.
const PUBLIC_PATHS = ["/login", "/api/auth/login", "/api/auth/logout"];

// Paid AI endpoints that get metered.
const AI_PATHS = [
  "/api/ask",
  "/api/voice/draft",
  "/api/voice/speak",
  "/api/voice/realtime/session"
];

function matchesPath(pathname: string, paths: string[]): boolean {
  return paths.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

function clientId(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  return request.headers.get("x-real-ip") || "unknown";
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1) Authentication
  if (!matchesPath(pathname, PUBLIC_PATHS)) {
    const session = await verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value);
    if (!session) {
      if (pathname.startsWith("/api/")) {
        return NextResponse.json({ error: "Not authenticated. Please log in." }, { status: 401 });
      }
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = "/login";
      loginUrl.search = pathname && pathname !== "/" ? `?next=${encodeURIComponent(pathname)}` : "";
      return NextResponse.redirect(loginUrl);
    }
  }

  // 2) AI meter
  if (matchesPath(pathname, AI_PATHS)) {
    const result = await checkAiRateLimit(clientId(request));
    if (!result.success) {
      return NextResponse.json(
        { error: "Too many requests. Please slow down and try again in a moment." },
        {
          status: 429,
          headers: {
            "Retry-After": String(Math.max(1, result.reset - Math.floor(Date.now() / 1000))),
            "X-RateLimit-Limit": String(result.limit),
            "X-RateLimit-Remaining": String(result.remaining)
          }
        }
      );
    }
  }

  return NextResponse.next();
}

export const config = {
  // Run on everything except Next internals and static asset files.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico|css|js|map|txt|woff|woff2|ttf|otf)$).*)"
  ]
};
