import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth/session";

// GET so a plain link can log out. Clears the cookie and returns to /login.
export async function GET(request: Request) {
  const loginUrl = new URL("/login", request.url);
  const response = NextResponse.redirect(loginUrl);
  response.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0
  });
  return response;
}
