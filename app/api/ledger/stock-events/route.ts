import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    { error: "Stock events are deterministic ledger output from confirmed business events, not direct API writes." },
    { status: 405 }
  );
}
