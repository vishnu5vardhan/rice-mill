export const SARVAM_TTS_MODEL = process.env.SARVAM_TTS_MODEL || "bulbul:v3";
export const SARVAM_TTS_SPEAKER = process.env.SARVAM_TTS_SPEAKER || "shubh";
export const SARVAM_TTS_LANGUAGE = process.env.SARVAM_TTS_LANGUAGE || "en-IN";
export const SARVAM_STT_MODEL = process.env.SARVAM_STT_MODEL || "saaras:v3";
export const SARVAM_STT_MODE = process.env.SARVAM_STT_MODE || "translate";

export function hasSarvamConfig() {
  return Boolean(sarvamApiKey());
}

export async function synthesizeSpeechWithSarvam(input: { text: string }) {
  const apiKey = requireSarvamApiKey();
  const text = input.text.trim();
  if (!text) throw new Error("No text was provided for speech.");

  const response = await fetch("https://api.sarvam.ai/text-to-speech", {
    method: "POST",
    headers: {
      "api-subscription-key": apiKey,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      text: text.slice(0, 2500),
      target_language_code: SARVAM_TTS_LANGUAGE,
      model: SARVAM_TTS_MODEL,
      speaker: SARVAM_TTS_SPEAKER,
      output_audio_codec: "mp3"
    })
  });

  const raw = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`Sarvam speech failed: ${errorMessage(raw, response.statusText)}`);
  }

  const audioBase64 = Array.isArray(raw?.audios) && typeof raw.audios[0] === "string" ? raw.audios[0] : "";
  if (!audioBase64) throw new Error("Sarvam speech returned no audio.");

  return {
    audio: Buffer.from(audioBase64, "base64"),
    contentType: "audio/mpeg",
    model: SARVAM_TTS_MODEL,
    speaker: SARVAM_TTS_SPEAKER,
    language: SARVAM_TTS_LANGUAGE
  };
}

export async function transcribeVoiceWithSarvam(input: {
  file: File;
  languageCode?: string | null;
  mode?: string | null;
}) {
  const apiKey = requireSarvamApiKey();
  const formData = new FormData();
  formData.append("file", input.file);
  formData.append("model", SARVAM_STT_MODEL);

  if (SARVAM_STT_MODEL === "saaras:v3") {
    formData.append("mode", input.mode || SARVAM_STT_MODE);
  }

  const languageCode = input.languageCode || "unknown";
  formData.append("language_code", languageCode);

  const response = await fetch("https://api.sarvam.ai/speech-to-text", {
    method: "POST",
    headers: {
      "api-subscription-key": apiKey
    },
    body: formData
  });

  const raw = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`Sarvam transcription failed: ${errorMessage(raw, response.statusText)}`);
  }

  const text = typeof raw?.transcript === "string" ? raw.transcript.trim() : "";
  if (!text) throw new Error("Sarvam transcription returned no text.");

  return {
    text,
    raw,
    languageCode: typeof raw?.language_code === "string" ? raw.language_code : languageCode,
    languageProbability: typeof raw?.language_probability === "number" ? raw.language_probability : null,
    model: SARVAM_STT_MODEL,
    mode: SARVAM_STT_MODEL === "saaras:v3" ? input.mode || SARVAM_STT_MODE : null
  };
}

function requireSarvamApiKey() {
  const apiKey = sarvamApiKey();
  if (!apiKey) throw new Error("SARVAM_API_KEY is missing. Add it before using Sarvam voice.");
  return apiKey;
}

function sarvamApiKey() {
  return process.env.SARVAM_API_KEY || process.env.SARVAM_AI_API_KEY || process.env.SARVAM_SUBSCRIPTION_KEY || "";
}

function errorMessage(raw: unknown, fallback: string) {
  if (raw && typeof raw === "object" && "error" in raw) {
    const error = (raw as { error?: { message?: string } | string }).error;
    if (typeof error === "string") return error;
    if (error?.message) return error.message;
  }
  return fallback;
}
