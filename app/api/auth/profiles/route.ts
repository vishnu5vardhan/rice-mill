import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth/server";
import { isAdminUser, listUserNames } from "@/lib/auth/users";
import { addProfile, deleteProfile, listProfiles } from "@/lib/auth/profiles";

async function requireAdmin() {
  const session = await getServerSession();
  if (!session) return { ok: false as const, status: 401, error: "Not authenticated." };
  if (!isAdminUser(session.u)) return { ok: false as const, status: 403, error: "Admins only." };
  return { ok: true as const, name: session.u };
}

export async function GET() {
  const admin = await requireAdmin();
  if (!admin.ok) return NextResponse.json({ error: admin.error }, { status: admin.status });
  try {
    return NextResponse.json({ profiles: await listProfiles() });
  } catch {
    return NextResponse.json({ error: "Could not load profiles." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const admin = await requireAdmin();
  if (!admin.ok) return NextResponse.json({ error: admin.error }, { status: admin.status });
  try {
    const body = await request.json().catch(() => ({}));
    const name = String(body?.name ?? "");
    const passcode = String(body?.passcode ?? "");
    const result = await addProfile(name, passcode, admin.name, listUserNames());
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Could not add profile." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const admin = await requireAdmin();
  if (!admin.ok) return NextResponse.json({ error: admin.error }, { status: admin.status });
  try {
    const name = new URL(request.url).searchParams.get("name") ?? "";
    if (!name) return NextResponse.json({ error: "Missing profile name." }, { status: 400 });
    const result = await deleteProfile(name);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Could not delete profile." }, { status: 500 });
  }
}
