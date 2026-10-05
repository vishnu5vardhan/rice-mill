import { apiError } from "@/lib/db/errors";
import { OPENAI_TTS_MODEL, OPENAI_TTS_VOICE, synthesizeSpeechWithOpenAI } from "@/lib/ai/openai-voice";
import {
  SARVAM_TTS_LANGUAGE,
  SARVAM_TTS_MODEL,
  SARVAM_TTS_SPEAKER,
  synthesizeSpeechWithSarvam
} from "@/lib/ai/sarvam-voice";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const text = String(body.text ?? "").trim();
    if (!text) throw new Error("Text is required for speech.");
    const provider = String(body.provider ?? process.env.VOICE_TTS_PROVIDER ?? "openai").toLowerCase();

    if (provider === "sarvam") {
      const result = await synthesizeSpeechWithSarvam({ text });
      return new Response(result.audio, {
        headers: {
          "content-type": result.contentType,
          "cache-control": "no-store",
          "x-tts-provider": "sarvam",
          "x-sarvam-tts-model": SARVAM_TTS_MODEL,
          "x-sarvam-tts-speaker": SARVAM_TTS_SPEAKER,
          "x-sarvam-tts-language": SARVAM_TTS_LANGUAGE
        }
      });
    }

    const result = await synthesizeSpeechWithOpenAI({ text });
    return new Response(result.audio, {
      headers: {
        "content-type": result.contentType,
        "cache-control": "no-store",
        "x-tts-provider": "openai",
        "x-openai-tts-model": OPENAI_TTS_MODEL,
        "x-openai-tts-voice": OPENAI_TTS_VOICE
      }
    });
  } catch (error) {
    return apiError(error, 400);
  }
}
