import { NextResponse } from "next/server";
import { requireMillContext } from "@/lib/db/context";
import { apiError, isAuthContextError } from "@/lib/db/errors";
import { createVoiceDraft } from "@/lib/services/voice";

export async function POST(request: Request) {
  try {
    const context = await requireMillContext();
    const formData = await request.formData();
    const audioValue = formData.get("audio");
    const file = audioValue instanceof File && audioValue.size > 0 ? audioValue : null;
    const typedNote = String(formData.get("text") ?? "").trim();
    const language = String(formData.get("language") ?? "auto");
    const transcriptionProvider = String(formData.get("transcription_provider") ?? "auto");

    const result = await createVoiceDraft(context.supabase, {
      millId: context.millId,
      userId: context.userId,
      file,
      typedNote,
      language,
      transcriptionProvider
    });

    return NextResponse.json({
      input_capture_id: result.inputCapture.id,
      draft_id: result.draft.id,
      draft_ids: result.drafts.map((draft) => draft.id),
      draft_count: result.drafts.length,
      confirm_url: `/confirm/${result.draft.id}`,
      confirm_urls: result.drafts.map((draft) => `/confirm/${draft.id}`),
      review_url: `/voice/review/${result.inputCapture.id}`,
      transcript: result.transcript
    });
  } catch (error) {
    return apiError(error, isAuthContextError(error) ? 401 : 400);
  }
}
