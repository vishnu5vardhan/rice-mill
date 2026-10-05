import { NextResponse } from "next/server";
import { verifyUser } from "@/lib/auth/users";
import { verifyProfile } from "@/lib/auth/profiles";
import { SESSION_COOKIE, SESSION_TTL_SECONDS, createSessionToken } from "@/lib/auth/session";

export async function POST(request: Request) {
  try {
    if (!process.env.AUTH_SECRET) {
      return NextResponse.json({ error: "Server is missing AUTH_SECRET. Set it before logging in." }, { status: 500 });
    }

    const body = await request.json().catch(() => ({}));
    const name = String(body?.name ?? "").trim();
    const passcode = String(body?.passcode ?? "");

    if (!name || !passcode) {
      return NextResponse.json({ error: "Pick a user and enter the passcode." }, { status: 400 });
    }

    const allowed = verifyUser(name, passcode) || (await verifyProfile(name, passcode));
    if (!allowed) {
      return NextResponse.json({ error: "Wrong user or passcode." }, { status: 401 });
    }

    const token = await createSessionToken(name, SESSION_TTL_SECONDS);
    const response = NextResponse.json({ ok: true });
    response.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_TTL_SECONDS
    });
    return response;
  } catch {
    return NextResponse.json({ error: "Could not sign in. Please try again." }, { status: 400 });
  }
}
