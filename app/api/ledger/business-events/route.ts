import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    { error: "Business events are created only by confirming a draft. Use /api/drafts/:id/confirm." },
    { status: 405 }
  );
}
