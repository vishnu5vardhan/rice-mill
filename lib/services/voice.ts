import { createHash, randomUUID } from "node:crypto";
import type { SupabaseServerClient } from "@/lib/supabase/server";
import { createAuditLog } from "@/lib/services/audit";
import type { DraftEntry, DraftField, Json, SourceType } from "@/lib/types";
import { getCachedVoicePromptContext, promptFingerprint } from "@/lib/services/voice-prompt-context";
import {
  OPENAI_PROVIDER,
  OPENAI_TRANSCRIPTION_MODEL,
  OPENAI_VOICE_STRUCTURING_MODEL,
  payloadFromVoiceExtraction,
  structureVoiceDraftsWithOpenAI,
  transcribeVoiceWithOpenAI,
  type VoiceDraftExtraction
} from "@/lib/ai/openai-voice";
import {
  hasSarvamConfig,
  SARVAM_STT_MODE,
  SARVAM_STT_MODEL,
  transcribeVoiceWithSarvam
} from "@/lib/ai/sarvam-voice";

type VoiceLanguage = "auto" | "en-IN" | "te-IN";
type VoiceTranscriptionProvider = "auto" | "openai" | "sarvam";

export async function createVoiceDraft(
  supabase: SupabaseServerClient,
  input: {
    millId: string;
    userId: string | null;
    file: File | null;
    typedNote?: string | null;
    language?: string | null;
    transcriptionProvider?: string | null;
  }
) {
  const inputCaptureId = randomUUID();
  const now = new Date();
  const typedNote = input.typedNote?.trim() || null;
  const language = normalizeVoiceLanguage(input.language);
  const transcriptionProvider = normalizeTranscriptionProvider(input.transcriptionProvider);
  let audioStoragePath: string | null = null;
  let audioStorageBucket: string | null = null;
  let audioMetadata: Record<string, Json> = {
    requested_language: language,
    requested_transcription_provider: transcriptionProvider
  };

  if (input.file && input.file.size > 0) {
    const safeName = (input.file.name || `voice-${Date.now()}.webm`).replaceAll("/", "-");
    const contentType = cleanAudioMimeType(input.file.type);
    audioStorageBucket = "documents";
    audioStoragePath = `mills/${input.millId}/voice/${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, "0")}/${inputCaptureId}/${safeName}`;
    const fileBuffer = Buffer.from(await input.file.arrayBuffer());
    audioMetadata = {
      ...audioMetadata,
      original_filename: safeName,
      mime_type: contentType,
      file_size: input.file.size,
      checksum: createHash("sha256").update(fileBuffer).digest("hex")
    };

    const { error } = await supabase.storage.from(audioStorageBucket).upload(audioStoragePath, fileBuffer, {
      upsert: false,
      contentType
    });
    throwIfDbError("Saving voice audio", error);
  }

  if (!input.file && !typedNote) throw new Error("Record a voice note or type a short note.");

  const { data: capture, error: captureError } = await supabase
    .from("input_captures")
    .insert({
      id: inputCaptureId,
      mill_id: input.millId,
      capture_type: "voice",
      source_type: "voice",
      raw_text: typedNote,
      transcript: typedNote,
      audio_storage_bucket: audioStorageBucket,
      audio_storage_path: audioStoragePath,
      metadata: audioMetadata,
      status: "draft",
      created_by: input.userId,
      updated_by: input.userId
    })
    .select("*")
    .single();
  throwIfDbError("Saving voice capture", captureError);

  let transcript = typedNote ?? "";
  if (input.file && input.file.size > 0) {
    transcript = await transcribeAudio(supabase, {
      millId: input.millId,
      userId: input.userId,
      inputCaptureId: capture.id,
      file: input.file,
      language,
      transcriptionProvider
    });
  }

  const { drafts, extractionRunId } = await structureAndCreateDrafts(supabase, {
    millId: input.millId,
    userId: input.userId,
    inputCaptureId: capture.id,
    transcript
  });
  const primaryDraft = drafts[0];
  if (!primaryDraft) throw new Error("Voice draft creation returned no drafts.");

  await createAuditLog(supabase, {
    millId: input.millId,
    actorId: input.userId,
    action: "voice_draft_created",
    entityType: drafts.length > 1 ? "draft_entries" : "draft_entry",
    entityId: primaryDraft.id,
    afterValue: {
      input_capture_id: capture.id,
      extraction_run_id: extractionRunId,
      transcript,
      draft_ids: drafts.map((draft) => draft.id)
    },
    sourceType: "voice",
    sourceId: capture.id
  });

  return { draft: primaryDraft, drafts, inputCapture: capture, transcript };
}

function cleanAudioMimeType(mimeType: string) {
  const clean = mimeType.split(";")[0] || "audio/webm";
  if (["audio/webm", "audio/mp4", "audio/mpeg", "audio/wav"].includes(clean)) return clean;
  return "audio/webm";
}

async function transcribeAudio(
  supabase: SupabaseServerClient,
  input: {
    millId: string;
    userId: string | null;
    inputCaptureId: string;
    file: File;
    language: VoiceLanguage;
    transcriptionProvider: VoiceTranscriptionProvider;
  }
) {
  const provider = chooseTranscriptionProvider(input.transcriptionProvider, input.language);
  const { data: run, error: runError } = await supabase
    .from("extraction_runs")
    .insert({
      mill_id: input.millId,
      input_capture_id: input.inputCaptureId,
      run_type: "voice_transcription",
      model_provider: provider,
      model_name: provider === "sarvam" ? SARVAM_STT_MODEL : OPENAI_TRANSCRIPTION_MODEL,
      prompt_version: "voice_transcription_v2",
      schema_name: "plain_transcript",
      schema_version: "v1",
      status: "running",
      raw_output: { requested_language: input.language },
      validated_output: {},
      started_at: new Date().toISOString(),
      created_by: input.userId,
      updated_by: input.userId
    })
    .select("id")
    .single();
  throwIfDbError("Creating transcription run", runError);
  if (!run) throw new Error("Creating transcription run failed: no run id returned.");

  try {
    const transcriptionFile = await normalizeAudioFileForProvider(input.file);
    const result = provider === "sarvam"
      ? await transcribeVoiceWithSarvam({
          file: transcriptionFile,
          languageCode: sarvamLanguageCode(input.language),
          mode: input.language === "te-IN" ? "translate" : SARVAM_STT_MODE
        })
      : await transcribeVoiceWithOpenAI({
          file: transcriptionFile,
          languageCode: openAiLanguageCode(input.language),
          prompt: voiceTranscriptionPrompt(input.language)
        });
    const finishedAt = new Date().toISOString();
    const { error: updateRunError } = await supabase
      .from("extraction_runs")
      .update({
        status: "succeeded",
        raw_output: result.raw,
        validated_output: {
          transcript: result.text,
          provider,
          requested_language: input.language,
          detected_language: "languageCode" in result ? result.languageCode : input.language,
          language_probability: "languageProbability" in result ? result.languageProbability : null
        },
        finished_at: finishedAt,
        updated_by: input.userId
      })
      .eq("id", run.id);
    throwIfDbError("Saving transcription run", updateRunError);

    const { error: updateCaptureError } = await supabase
      .from("input_captures")
      .update({ transcript: result.text, updated_by: input.userId })
      .eq("id", input.inputCaptureId);
    throwIfDbError("Saving voice transcript", updateCaptureError);

    return result.text;
  } catch (error) {
    await supabase
      .from("extraction_runs")
      .update({
        status: "failed",
        error: error instanceof Error ? error.message : "Voice transcription failed.",
        finished_at: new Date().toISOString(),
        updated_by: input.userId
      })
      .eq("id", run.id);
    throw error;
  }
}

async function normalizeAudioFileForProvider(file: File) {
  const cleanType = cleanAudioMimeType(file.type);
  if (cleanType === file.type) return file;
  const safeName = (file.name || "voice-note.webm").replaceAll("/", "-");
  return new File([await file.arrayBuffer()], safeName, { type: cleanType });
}

function normalizeVoiceLanguage(value: string | null | undefined): VoiceLanguage {
  if (value === "te-IN" || value === "en-IN") return value;
  return "auto";
}

function normalizeTranscriptionProvider(value: string | null | undefined): VoiceTranscriptionProvider {
  if (value === "openai" || value === "sarvam") return value;
  return "auto";
}

function chooseTranscriptionProvider(provider: VoiceTranscriptionProvider, language: VoiceLanguage) {
  if (provider === "sarvam") {
    if (!hasSarvamConfig()) throw new Error("SARVAM_API_KEY is missing. Add it before using Sarvam transcription.");
    return "sarvam";
  }

  if (provider === "openai") return OPENAI_PROVIDER;

  if ((language === "te-IN" || language === "auto") && hasSarvamConfig()) return "sarvam";
  return OPENAI_PROVIDER;
}

function sarvamLanguageCode(language: VoiceLanguage) {
  if (language === "te-IN") return "te-IN";
  if (language === "en-IN") return "en-IN";
  return "unknown";
}

function openAiLanguageCode(language: VoiceLanguage) {
  if (language === "te-IN") return "te";
  if (language === "en-IN") return "en";
  return null;
}

function voiceTranscriptionPrompt(language: VoiceLanguage) {
  const base = [
    "Rice mill operations voice note.",
    "Preserve truck numbers, party names, village/center names, quantities, bags, rates, expense amounts, paddy, bran, broken rice, husk, moisture, government PPC, private farmer, dates.",
    "Do not summarize. Transcribe the operational words clearly so a draft can be created.",
    "Common code-mixed words: vadlu/dhanyam paddy, thavudu bran, nookalu broken rice, pottu husk, basta bags, sarkar government."
  ].join(" ");
  if (language === "te-IN") return `${base} The speaker is likely speaking Telugu or Telugu-English code-mix.`;
  return base;
}

async function structureAndCreateDrafts(
  supabase: SupabaseServerClient,
  input: { millId: string; userId: string | null; inputCaptureId: string; transcript: string }
) {
  const { data: run, error: runError } = await supabase
    .from("extraction_runs")
    .insert({
      mill_id: input.millId,
      input_capture_id: input.inputCaptureId,
      run_type: "voice_structuring",
      model_provider: OPENAI_PROVIDER,
      model_name: OPENAI_VOICE_STRUCTURING_MODEL,
      prompt_version: "voice_to_drafts_v2",
      schema_name: "voice_draft_batch_extraction",
      schema_version: "v2",
      status: "running",
      raw_output: {},
      validated_output: {},
      started_at: new Date().toISOString(),
      created_by: input.userId,
      updated_by: input.userId
    })
    .select("id")
    .single();
  throwIfDbError("Creating voice structuring run", runError);
  if (!run) throw new Error("Creating voice structuring run failed: no run id returned.");

  try {
    const today = new Date().toISOString().slice(0, 10);
    const promptContext = await getCachedVoicePromptContext(supabase, input.millId);
    const promptHash = promptFingerprint({ today, businessContext: promptContext.value });
    const result = await structureVoiceDraftsWithOpenAI({ transcript: input.transcript, today, businessContext: promptContext.value });
    const draftableExtractions = result.extractions.filter((extraction) => extraction.draft_type !== "unknown") as Array<VoiceDraftExtraction & { draft_type: "paddy_inward" | "byproduct_sale" | "expense" }>;

    if (!draftableExtractions.length) {
      throw new Error("I could not identify this as paddy inward, by-product sale, or expense. Try a shorter entry.");
    }

    const { error: updateRunError } = await supabase
      .from("extraction_runs")
      .update({
        status: "succeeded",
        raw_output: result.raw,
        validated_output: {
          entries: draftableExtractions,
          prompt_context_hash: promptHash,
          prompt_context_cache_hit: promptContext.cacheHit
        },
        finished_at: new Date().toISOString(),
        updated_by: input.userId
      })
      .eq("id", run.id);
    throwIfDbError("Saving voice structuring run", updateRunError);

    const drafts: DraftEntry[] = [];
    for (const [index, extraction] of draftableExtractions.entries()) {
      drafts.push(await createDraftFromVoiceExtraction(supabase, {
        millId: input.millId,
        userId: input.userId,
        inputCaptureId: input.inputCaptureId,
        extractionRunId: run.id,
        extraction,
        sequenceIndex: index,
        sequenceTotal: draftableExtractions.length
      }));
    }

    return { drafts, extractionRunId: run.id };
  } catch (error) {
    await supabase
      .from("extraction_runs")
      .update({
        status: "failed",
        error: error instanceof Error ? error.message : "Voice structuring failed.",
        finished_at: new Date().toISOString(),
        updated_by: input.userId
      })
      .eq("id", run.id);
    throw error;
  }
}

async function createDraftFromVoiceExtraction(
  supabase: SupabaseServerClient,
  input: {
    millId: string;
    userId: string | null;
    inputCaptureId: string;
    extractionRunId: string;
    extraction: VoiceDraftExtraction & { draft_type: "paddy_inward" | "byproduct_sale" | "expense" };
    sequenceIndex?: number;
    sequenceTotal?: number;
  }
) {
  const payload = {
    ...payloadFromVoiceExtraction(input.extraction),
    ...(input.sequenceTotal && input.sequenceTotal > 1
      ? { voice_sequence_index: input.sequenceIndex ?? 0, voice_sequence_total: input.sequenceTotal }
      : {})
  };
  const fields = input.extraction.fields.map((field) => ({
    field_name: field.field_name,
    value: field.value as Json,
    confidence: field.confidence,
    status: field.status,
    required: field.required,
    needs_review: field.needs_review,
    source_type: "voice" as SourceType,
    source_id: input.inputCaptureId
  })) satisfies DraftField[];

  const { error: extractedFieldsError } = await supabase.from("extracted_fields").insert(
    fields.map((field) => ({
      mill_id: input.millId,
      extraction_run_id: input.extractionRunId,
      input_capture_id: input.inputCaptureId,
      field_name: field.field_name,
      raw_value: field.value,
      normalized_value: field.value,
      confidence: field.confidence,
      status: field.status,
      source_type: "voice",
      source_id: input.inputCaptureId,
      needs_review: field.needs_review,
      created_by: input.userId,
      updated_by: input.userId
    }))
  );
  throwIfDbError("Saving voice extracted fields", extractedFieldsError);

  const { data: draft, error: draftError } = await supabase
    .from("draft_entries")
    .insert({
      mill_id: input.millId,
      draft_type: input.extraction.draft_type,
      source_type: "voice",
      source_id: input.inputCaptureId,
      input_capture_id: input.inputCaptureId,
      extraction_run_id: input.extractionRunId,
      payload,
      missing_fields: input.extraction.missing_fields,
      status: "pending_confirmation",
      created_by: input.userId,
      updated_by: input.userId
    })
    .select("*")
    .single();
  throwIfDbError("Creating voice draft", draftError);

  const { error: draftFieldsError } = await supabase.from("draft_entry_fields").insert(
    fields.map((field) => ({
      mill_id: input.millId,
      draft_entry_id: draft.id,
      field_name: field.field_name,
      value: field.value,
      source_type: "voice",
      source_id: input.inputCaptureId,
      confidence: field.confidence,
      status: field.status,
      required: field.required,
      needs_review: field.needs_review,
      created_by: input.userId,
      updated_by: input.userId
    }))
  );
  throwIfDbError("Creating voice draft fields", draftFieldsError);

  return draft as DraftEntry;
}

function throwIfDbError(action: string, error: unknown) {
  if (!error) return;
  const dbError = error as { message?: string; code?: string; details?: string | null; hint?: string | null };
  const parts = [
    dbError.message,
    dbError.code ? `code ${dbError.code}` : null,
    dbError.details ? `details: ${dbError.details}` : null,
    dbError.hint ? `hint: ${dbError.hint}` : null
  ].filter(Boolean);
  throw new Error(`${action} failed${parts.length ? `: ${parts.join("; ")}` : "."}`);
}
