import { NextResponse } from "next/server";
import { apiError } from "@/lib/db/errors";
import { createRealtimeVoiceSession } from "@/lib/ai/openai-voice";

export async function POST() {
  try {
    return NextResponse.json(await createRealtimeVoiceSession());
  } catch (error) {
    return apiError(error, 400);
  }
}
