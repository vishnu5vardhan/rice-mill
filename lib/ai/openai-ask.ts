import { z } from "zod";
import type { Json } from "@/lib/types";

export const OPENAI_ASK_MODEL = process.env.OPENAI_ASK_MODEL || process.env.OPENAI_VOICE_STRUCTURING_MODEL || "gpt-4o-mini";

const groundedAnswerSchema = z.object({
  answer: z.string().min(1),
  confidence: z.enum(["low", "medium", "high"]),
  missing_data: stringListSchema().default([]),
  evidence_notes: stringListSchema().default([]),
  suggested_actions: stringListSchema().default([])
});

export type GroundedAskAnswer = z.infer<typeof groundedAnswerSchema>;

export function hasOpenAIAskConfig() {
  return Boolean(openAIApiKey());
}

export async function answerWithOpenAI(input: {
  question: string;
  today: string;
  snapshot: Json;
  history?: Array<{ role: "user" | "assistant"; content: string }>;
}) {
  const apiKey = openAIApiKey();
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is missing. Add it before using open chat Ask.");
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: OPENAI_ASK_MODEL,
      temperature: 0.1,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt(input.today) },
        {
          role: "user",
          content: JSON.stringify({
            current_question: input.question,
            recent_chat_history: input.history?.slice(-6) ?? [],
            rice_mill_database_snapshot: input.snapshot
          })
        }
      ]
    })
  });

  const raw = (await response.json().catch(() => ({}))) as unknown;
  if (!response.ok) {
    throw new Error(`OpenAI Ask failed: ${errorMessage(raw, response.statusText)}`);
  }

  const content = responseContent(raw);
  if (!content) throw new Error("OpenAI Ask returned no answer content.");

  return {
    parsed: groundedAnswerSchema.parse(JSON.parse(content)),
    raw: toJson(raw),
    model: OPENAI_ASK_MODEL
  };
}

function systemPrompt(today: string) {
  return `You are the Rice Mill Intelligence System assistant.

Today is ${today}.

You answer only from the provided rice_mill_database_snapshot. Do not invent records, totals, truck numbers, rates, parties, dates, or documents.

Rules:
- AI is not the source of truth. Confirmed business events, stock events, paddy lots, tasks, alerts, documents, and audit-linked evidence are the source.
- If the snapshot does not contain enough data, say exactly what is missing.
- Separate confirmed, pending/incomplete, and disputed data.
- For stock/profit/CA questions, never claim final truth unless the relevant confirmed records exist.
- Give the owner a short practical answer first, then mention evidence in simple words.
- Keep the language simple. If the user's question is in Telugu/Hindi, answer in that language as much as possible.
- Return JSON only with keys: answer, confidence, missing_data, evidence_notes, suggested_actions.`;
}

function stringListSchema() {
  return z.preprocess((value) => {
    if (typeof value === "string") return value.trim() ? [value.trim()] : [];
    if (Array.isArray(value)) return value.map((item) => String(item)).filter(Boolean);
    return [];
  }, z.array(z.string()));
}

function responseContent(raw: unknown) {
  if (!raw || typeof raw !== "object") return null;
  const choice = (raw as { choices?: Array<{ message?: { content?: unknown } }> }).choices?.[0];
  return typeof choice?.message?.content === "string" ? choice.message.content : null;
}

function openAIApiKey() {
  return process.env.OPENAI_API_KEY || "";
}

function errorMessage(raw: unknown, fallback: string) {
  if (raw && typeof raw === "object" && "error" in raw) {
    const error = (raw as { error?: { message?: string } }).error;
    if (error?.message) return error.message;
  }
  return fallback;
}

function toJson(value: unknown): Json {
  return JSON.parse(JSON.stringify(value ?? null)) as Json;
}
