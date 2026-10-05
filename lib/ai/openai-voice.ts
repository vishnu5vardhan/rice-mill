import { z } from "zod";
import type { DraftType, FieldStatus, Json } from "@/lib/types";

type VoiceScalar = string | number | boolean | null;

export const OPENAI_PROVIDER = "openai";
export const OPENAI_TRANSCRIPTION_MODEL = process.env.OPENAI_TRANSCRIPTION_MODEL || "gpt-4o-mini-transcribe";
export const OPENAI_VOICE_STRUCTURING_MODEL = process.env.OPENAI_VOICE_STRUCTURING_MODEL || "gpt-4o-mini";
export const OPENAI_REALTIME_MODEL = process.env.OPENAI_REALTIME_MODEL || "gpt-realtime-2";
export const OPENAI_REALTIME_TRANSCRIPTION_MODEL = process.env.OPENAI_REALTIME_TRANSCRIPTION_MODEL || OPENAI_TRANSCRIPTION_MODEL;
export const OPENAI_TTS_MODEL = process.env.OPENAI_TTS_MODEL || "gpt-4o-mini-tts";
export const OPENAI_TTS_VOICE = process.env.OPENAI_TTS_VOICE || "coral";

const voiceFieldSchema = z.object({
  field_name: z.string().min(1),
  value: z.union([z.string(), z.number(), z.boolean(), z.null()]),
  confidence: z.number().min(0).max(1).nullable(),
  status: z.enum(["missing", "ai_extracted", "needs_review", "estimated"]),
  required: z.boolean(),
  needs_review: z.boolean()
});

const voiceDraftSchema = z.object({
  draft_type: z.enum(["paddy_inward", "byproduct_sale", "expense", "unknown"]),
  multiple_entries: z.boolean(),
  confidence: z.number().min(0).max(1),
  language: z.string().nullable(),
  fields: z.array(voiceFieldSchema),
  missing_fields: z.array(z.string()),
  ambiguous_fields: z.array(z.string()),
  suggested_next_action: z.string(),
  notes: z.string().nullable()
});

const voiceDraftBatchSchema = z.object({
  entries: z.array(voiceDraftSchema).min(1).max(6),
  notes: z.string().nullable().optional()
});

export type VoiceDraftExtraction = z.infer<typeof voiceDraftSchema>;

const allowedFields: Record<Exclude<DraftType, "payment" | "document_only">, string[]> = {
  paddy_inward: [
    "arrival_date",
    "paddy_source_type",
    "source_party_name",
    "truck_number",
    "truck_sheet_bag_count",
    "physical_bag_count",
    "confirmed_quantity",
    "quantity_unit",
    "moisture_percent",
    "notes"
  ],
  byproduct_sale: [
    "sale_date",
    "dealer_name",
    "product_type",
    "paddy_source_type",
    "quantity",
    "quantity_unit",
    "rate",
    "payment_status",
    "notes"
  ],
  expense: ["expense_date", "expense_category", "vendor_name", "amount", "currency", "notes"]
};

const requiredFields: Record<Exclude<DraftType, "payment" | "document_only">, string[]> = {
  paddy_inward: ["arrival_date", "paddy_source_type", "source_party_name", "confirmed_quantity", "quantity_unit"],
  byproduct_sale: ["sale_date", "product_type", "quantity", "quantity_unit", "rate"],
  expense: ["expense_date", "expense_category", "amount"]
};

const fieldDefaults: Record<Exclude<DraftType, "payment" | "document_only">, Record<string, Json>> = {
  paddy_inward: {
    arrival_date: null,
    paddy_source_type: "unknown",
    source_party_name: null,
    truck_number: null,
    truck_sheet_bag_count: null,
    physical_bag_count: null,
    confirmed_quantity: null,
    quantity_unit: null,
    moisture_percent: null,
    notes: null
  },
  byproduct_sale: {
    sale_date: null,
    dealer_name: null,
    product_type: null,
    paddy_source_type: "unknown",
    quantity: null,
    quantity_unit: "qtl",
    rate: null,
    payment_status: "pending",
    notes: null
  },
  expense: {
    expense_date: null,
    expense_category: "other",
    vendor_name: null,
    amount: null,
    currency: "INR",
    notes: null
  }
};

const byproductKeywords = ["bran", "thavudu", "broken rice", "broken_rice", "nookalu", "husk", "pottu", "rice sale", "sold", "sale"];
const expenseKeywords = ["electricity", "current", "bill", "paid", "spent", "kharchu", "labour", "labor", "hamali", "kamali", "amali", "coolie", "wages", "diesel", "transport", "maintenance"];
const knownExpenseCategories = ["labour", "transport", "electricity", "maintenance", "diesel", "other"];

export function hasOpenAIConfig() {
  return Boolean(openAIApiKey());
}

export async function createRealtimeVoiceSession() {
  const apiKey = requireOpenAIApiKey();
  const response = await fetch("https://api.openai.com/v1/realtime/client_secrets", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      session: {
        type: "transcription",
        audio: {
          input: {
            transcription: {
              model: OPENAI_REALTIME_TRANSCRIPTION_MODEL,
              language: "en"
            },
            turn_detection: {
              type: "server_vad",
              threshold: 0.5,
              prefix_padding_ms: 150,
              silence_duration_ms: 350
            }
          }
        }
      }
    })
  });

  const raw = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`OpenAI realtime session failed: ${errorMessage(raw, response.statusText)}`);
  }

  const clientSecret = raw?.value ?? raw?.client_secret?.value;
  if (typeof clientSecret !== "string") throw new Error("OpenAI realtime session returned no client secret.");

  return {
    client_secret: clientSecret,
    expires_at: raw?.expires_at ?? raw?.client_secret?.expires_at ?? null,
    model: raw?.session?.audio?.input?.transcription?.model ?? raw?.model ?? OPENAI_REALTIME_TRANSCRIPTION_MODEL
  };
}

export async function transcribeVoiceWithOpenAI(input: { file: File; languageCode?: string | null; prompt?: string | null }) {
  const apiKey = requireOpenAIApiKey();
  const formData = new FormData();
  formData.append("file", input.file);
  formData.append("model", OPENAI_TRANSCRIPTION_MODEL);
  if (input.languageCode) formData.append("language", input.languageCode);
  if (input.prompt) formData.append("prompt", input.prompt);

  const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: formData
  });

  const raw = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`OpenAI transcription failed: ${errorMessage(raw, response.statusText)}`);
  }

  const text = typeof raw.text === "string" ? raw.text.trim() : "";
  if (!text) throw new Error("OpenAI transcription returned no text.");
  return { text, raw: toJson(raw) };
}

export async function synthesizeSpeechWithOpenAI(input: { text: string }) {
  const apiKey = requireOpenAIApiKey();
  const text = input.text.trim();
  if (!text) throw new Error("No text was provided for speech.");

  const response = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: OPENAI_TTS_MODEL,
      voice: OPENAI_TTS_VOICE,
      input: text.slice(0, 4000),
      instructions: "Speak naturally, clearly, and calmly like a practical rice mill assistant. Keep the tone direct and helpful.",
      response_format: "mp3"
    })
  });

  if (!response.ok) {
    const raw = await response.json().catch(() => ({}));
    throw new Error(`OpenAI speech failed: ${errorMessage(raw, response.statusText)}`);
  }

  return {
    audio: await response.arrayBuffer(),
    contentType: response.headers.get("content-type") || "audio/mpeg",
    model: OPENAI_TTS_MODEL,
    voice: OPENAI_TTS_VOICE
  };
}

export async function structureVoiceDraftWithOpenAI(input: { transcript: string; today: string; businessContext?: string | null }) {
  const result = await structureVoiceDraftsWithOpenAI(input);
  return { extraction: result.extractions[0], raw: result.raw };
}

export async function structureVoiceDraftsWithOpenAI(input: { transcript: string; today: string; businessContext?: string | null }) {
  const apiKey = requireOpenAIApiKey();
  const systemContent = input.businessContext && input.businessContext.trim()
    ? `${voiceStructuringSystemPrompt(input.today, "batch")}\n\n${input.businessContext.trim()}`
    : voiceStructuringSystemPrompt(input.today, "batch");
  const userContent = `Transcript:
${input.transcript}

Create every clear draft entry from this transcript. If one note contains sales and expenses, return separate entries. If details are missing, still create each draft and put missing required fields in missing_fields.`;
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: OPENAI_VOICE_STRUCTURING_MODEL,
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemContent },
        { role: "user", content: userContent }
      ]
    })
  });

  const raw = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`OpenAI voice structuring failed: ${errorMessage(raw, response.statusText)}`);
  }

  const content = raw?.choices?.[0]?.message?.content;
  if (typeof content !== "string") throw new Error("OpenAI voice structuring returned no JSON content.");

  const parsed = parseVoiceDraftResponse(JSON.parse(content));
  const normalized = parsed.entries.map(normalizeVoiceDraftExtraction).map(reclassifyVoiceDraftExtraction);
  return { extractions: normalized, raw: toJson(raw) };
}

function parseVoiceDraftResponse(value: unknown): z.infer<typeof voiceDraftBatchSchema> {
  const object = value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
  if (Array.isArray(object.entries)) return voiceDraftBatchSchema.parse(object);
  return voiceDraftBatchSchema.parse({ entries: [voiceDraftSchema.parse(value)] });
}

export function normalizeVoiceDraftExtraction(extraction: VoiceDraftExtraction): VoiceDraftExtraction {
  if (extraction.draft_type === "unknown") return extraction;

  const draftType = extraction.draft_type;
  const allowed = new Set(allowedFields[draftType]);
  const required = new Set(requiredFields[draftType]);
  const existing = new Map(
    extraction.fields
      .filter((field) => allowed.has(field.field_name))
      .map((field) => [field.field_name, field])
  );

  const fields = allowedFields[draftType].map((fieldName) => {
    const field = existing.get(fieldName);
    const fallbackValue = fieldDefaults[draftType][fieldName] ?? null;
    const value = field ? normalizeVoiceValue(fieldName, field.value) : scalarValue(fallbackValue);
    const missing = value === null || value === "";
    const approximate = field?.status === "estimated";
    const status: FieldStatus = missing
      ? "missing"
      : approximate
        ? "estimated"
        : field?.needs_review
          ? "needs_review"
          : "ai_extracted";

    return {
      field_name: fieldName,
      value,
      confidence: field?.confidence ?? (missing ? null : extraction.confidence),
      status,
      required: required.has(fieldName),
      needs_review: Boolean(field?.needs_review || approximate)
    };
  });

  const missingFields = Array.from(new Set([
    ...extraction.missing_fields,
    ...fields.filter((field) => field.required && field.status === "missing").map((field) => field.field_name)
  ]));

  return { ...extraction, fields, missing_fields: missingFields };
}

function reclassifyVoiceDraftExtraction(extraction: VoiceDraftExtraction): VoiceDraftExtraction {
  if (extraction.draft_type === "unknown") return extraction;

  const fieldMap = new Map(extraction.fields.map((field) => [field.field_name, field]));
  const text = JSON.stringify({
    fields: extraction.fields.map((field) => [field.field_name, field.value]),
    notes: extraction.notes,
    action: extraction.suggested_next_action
  }).toLowerCase();
  const hasByproductSignal = byproductKeywords.some((keyword) => text.includes(keyword));
  const hasExpenseSignal = expenseKeywords.some((keyword) => text.includes(keyword));
  const hasSaleShape = hasFieldValue(fieldMap, "product_type") || hasFieldValue(fieldMap, "dealer_name") || hasFieldValue(fieldMap, "rate");
  const hasExpenseShape = hasFieldValue(fieldMap, "expense_category") || hasFieldValue(fieldMap, "amount") || hasFieldValue(fieldMap, "vendor_name");

  if (extraction.draft_type === "expense" && hasByproductSignal && (hasSaleShape || !hasExpenseSignal)) {
    return normalizeVoiceDraftExtraction({
      ...extraction,
      draft_type: "byproduct_sale",
      fields: remapFields(extraction.fields, "byproduct_sale")
    });
  }

  if (extraction.draft_type === "byproduct_sale" && hasExpenseSignal && (hasExpenseShape || !hasSaleShape)) {
    return normalizeVoiceDraftExtraction({
      ...extraction,
      draft_type: "expense",
      fields: remapFields(extraction.fields, "expense")
    });
  }

  return extraction;
}

function remapFields(fields: VoiceDraftExtraction["fields"], draftType: Exclude<DraftType, "payment" | "document_only">) {
  const fieldMap = new Map(fields.map((field) => [field.field_name, field]));
  const amount = fieldMap.get("amount");
  const rate = fieldMap.get("rate");
  const quantity = fieldMap.get("quantity");
  const date = fieldMap.get("sale_date") ?? fieldMap.get("expense_date");
  const notes = fieldMap.get("notes");

  if (draftType === "expense") {
    return [
      cloneField("expense_date", date?.value ?? null, date),
      cloneField("expense_category", inferExpenseCategory(fields), fieldMap.get("expense_category")),
      cloneField("vendor_name", fieldMap.get("vendor_name")?.value ?? fieldMap.get("dealer_name")?.value ?? null, fieldMap.get("vendor_name") ?? fieldMap.get("dealer_name")),
      cloneField("amount", amount?.value ?? rate?.value ?? null, amount ?? rate),
      cloneField("currency", fieldMap.get("currency")?.value ?? "INR", fieldMap.get("currency")),
      cloneField("notes", notes?.value ?? null, notes)
    ];
  }

  if (draftType === "byproduct_sale") {
    return [
      cloneField("sale_date", date?.value ?? null, date),
      cloneField("dealer_name", fieldMap.get("dealer_name")?.value ?? fieldMap.get("vendor_name")?.value ?? null, fieldMap.get("dealer_name") ?? fieldMap.get("vendor_name")),
      cloneField("product_type", inferProductType(fields), fieldMap.get("product_type")),
      cloneField("paddy_source_type", fieldMap.get("paddy_source_type")?.value ?? "unknown", fieldMap.get("paddy_source_type")),
      cloneField("quantity", quantity?.value ?? null, quantity),
      cloneField("quantity_unit", fieldMap.get("quantity_unit")?.value ?? "qtl", fieldMap.get("quantity_unit")),
      cloneField("rate", rate?.value ?? amount?.value ?? null, rate ?? amount),
      cloneField("payment_status", fieldMap.get("payment_status")?.value ?? "pending", fieldMap.get("payment_status")),
      cloneField("notes", notes?.value ?? null, notes)
    ];
  }

  return fields;
}

function cloneField(fieldName: string, value: VoiceScalar, source?: VoiceDraftExtraction["fields"][number]) {
  return {
    field_name: fieldName,
    value,
    confidence: source?.confidence ?? null,
    status: source?.status ?? (value === null || value === "" ? "missing" : "needs_review"),
    required: Object.values(requiredFields).some((fields) => fields.includes(fieldName)),
    needs_review: source?.needs_review ?? true
  } satisfies VoiceDraftExtraction["fields"][number];
}

function hasFieldValue(fieldMap: Map<string, VoiceDraftExtraction["fields"][number]>, fieldName: string) {
  const value = fieldMap.get(fieldName)?.value;
  return value !== null && value !== undefined && value !== "";
}

function inferProductType(fields: VoiceDraftExtraction["fields"]) {
  const text = JSON.stringify(fields.map((field) => field.value)).toLowerCase();
  if (text.includes("nookalu") || text.includes("broken")) return "broken_rice";
  if (text.includes("pottu") || text.includes("husk")) return "husk";
  if (text.includes("rice") && !text.includes("broken")) return "rice";
  return "bran";
}

function inferExpenseCategory(fields: VoiceDraftExtraction["fields"]) {
  const text = JSON.stringify(fields.map((field) => field.value)).toLowerCase();
  if (text.includes("electricity") || text.includes("current")) return "electricity";
  if (text.includes("diesel") || text.includes("transport")) return "transport";
  if (text.includes("maintenance")) return "maintenance";
  if (text.includes("hamali") || text.includes("kamali") || text.includes("amali") || text.includes("coolie") || text.includes("labour") || text.includes("labor") || text.includes("wages")) return "labour";
  const existing = fields.find((field) => field.field_name === "expense_category")?.value;
  return typeof existing === "string" && knownExpenseCategories.includes(existing) ? existing : "other";
}

export function payloadFromVoiceExtraction(extraction: VoiceDraftExtraction) {
  if (extraction.draft_type === "unknown") return {} as Record<string, Json>;
  const payload = { ...fieldDefaults[extraction.draft_type] };
  for (const field of extraction.fields) {
    payload[field.field_name] = field.value as Json;
  }
  return payload;
}

function voiceStructuringSystemPrompt(today: string, mode: "single" | "batch" = "single") {
  return `You convert a rice mill owner's short voice note into rice mill draft entries.

Today is ${today}. If the owner says today, use ${today}.
The owner may speak Telugu, English, Telugu-English code-mix, or romanized Telugu. Understand common rice mill Telugu terms and translate them into the allowed schema.

Allowed draft_type values: paddy_inward, byproduct_sale, expense, unknown.

Primary behavior:
- Prefer creating a useful draft over returning unknown.
- Return unknown only when the transcript is not about rice mill operations or has no operational clue.
- If the entry type is clear but fields are missing, create the draft with missing fields.
- ${mode === "batch" ? "If one voice note contains multiple operational facts, return one entry per fact. Do not drop later facts." : "Create one entry only. If multiple entries are mentioned, set multiple_entries=true."}
- If the owner says both a by-product sale and an expense, return two entries: one byproduct_sale and one expense.
- Sales and expenses must stay separate. Sale words create byproduct_sale. Spending/bill/paid words create expense.
- A by-product sale is NOT an expense even if money/rate is mentioned.
- An electricity/labour/diesel/transport/maintenance bill is NOT a sale even if an amount is mentioned.
- If the transcript has a quantity but no date, use today for arrival_date, sale_date, or expense_date unless the user clearly indicates another date.
- If the transcript has paddy/vadlu/dhanyam and bags/lorry/truck/center/farmer/government/private, choose paddy_inward.
- If the transcript has bran/husk/broken rice/rice sale/dealer/rate/sold, choose byproduct_sale.
- If the transcript has paid/spent/bill/labour/current/electricity/transport/diesel/maintenance/hamali/coolie/wages, choose expense.
- Never invent party names, truck numbers, quantities, rates, or amounts. Missing is better than a fake value.

Rules:
- AI creates draft evidence only. Never mark fields user_confirmed.
- If a value is approximate (around/about/maybe), use status "estimated" and needs_review true.
- If confidence is low or ambiguous, use status "needs_review" and needs_review true.
- Missing useful fields must be included with value null and status "missing".
- Keep government/private/farmer/custom paddy source separate. Use paddy_source_type unknown if not clear.
- For paddy quantity from bags, set confirmed_quantity to the bag count and quantity_unit to "bag" unless a weight unit is clearly spoken.
- If the user says both truck sheet bags and physical bags, map them separately to truck_sheet_bag_count and physical_bag_count.
- For expenses, use currency INR unless another currency is spoken.
- Telugu/rice-mill vocabulary: dhanyam/vadlu/paddy means paddy inward; biyyam/rice means rice; nookalu/broken rice means broken_rice; thavudu/bran means bran; pottu/husk means husk; sarkar/government/centre/PPC means government paddy source; private/raitulu/farmer means private or farmer_custom depending on context; basta/bags means bag count; lorry/truck/bandi may indicate truck_number if a number follows; hamali/kamali/amali/coolie usually means labour expense unless clearly a person's name.
- If Telugu transcription translated a party, place, or truck number imperfectly, keep it as heard and mark needs_review true.
- Apply past owner corrections from the business context as hard vocabulary overrides. For example, if a correction says Kamali -> Hamali, output Hamali.
- Normalize product_type to only: paddy, rice, bran, broken_rice, husk.
- Normalize paddy_source_type to only: government, private, farmer_custom, own_purchase, unknown.
- Normalize common payment words: paid/cash/settled -> paid; pending/credit/due -> pending.

Examples:
- "today government paddy Mallapur 460 bags" => paddy_inward with arrival_date today, paddy_source_type government, source_party_name Mallapur, confirmed_quantity 460, quantity_unit bag.
- "vadlu sarkar center Pambanda nalugu vandala aravai basta" => paddy_inward with paddy_source_type government, source_party_name Pambanda, confirmed_quantity 460, quantity_unit bag.
- "bran sold to Ramesh 20 quintal 1850 rate" => byproduct_sale with product_type bran, dealer_name Ramesh, quantity 20, quantity_unit qtl, rate 1850.
- "thavudu Ramesh ki 20 quintal 1850" => byproduct_sale with product_type bran, dealer_name Ramesh, quantity 20, quantity_unit qtl, rate 1850.
- "paid electricity bill 18000 today" => expense with expense_category electricity, amount 18000, currency INR.
- "diesel ki 5000 kharchu" => expense with expense_category diesel or transport, amount 5000, currency INR.
- "hamali 3000" or "kamali 3000" => expense with expense_category labour, amount 3000, currency INR, and notes preserving the heard word if uncertain.
- "bran Ramesh 20 quintal 1850 and electricity bill 18000" => entries[0] byproduct_sale, entries[1] expense. Never collapse this into only electricity.
- "thavudu sale Ramesh 20 quintal 1850, current bill 18000, hamali 3000" => three entries: byproduct_sale bran, expense electricity, expense labour.
- "Ramesh ki bran 20 qtl 1850 rate, diesel 5000" => two entries: byproduct_sale bran and expense transport.

${mode === "batch" ? `Return ONLY JSON with this shape:
{
  "entries": [
    {
      "draft_type": "paddy_inward" | "byproduct_sale" | "expense" | "unknown",
      "multiple_entries": boolean,
      "confidence": number,
      "language": string | null,
      "fields": [
        { "field_name": string, "value": string | number | boolean | null, "confidence": number | null, "status": "missing" | "ai_extracted" | "needs_review" | "estimated", "required": boolean, "needs_review": boolean }
      ],
      "missing_fields": string[],
      "ambiguous_fields": string[],
      "suggested_next_action": string,
      "notes": string | null
    }
  ],
  "notes": string | null
}` : `Return ONLY JSON with this shape:
{
  "draft_type": "paddy_inward" | "byproduct_sale" | "expense" | "unknown",
  "multiple_entries": boolean,
  "confidence": number,
  "language": string | null,
  "fields": [
    { "field_name": string, "value": string | number | boolean | null, "confidence": number | null, "status": "missing" | "ai_extracted" | "needs_review" | "estimated", "required": boolean, "needs_review": boolean }
  ],
  "missing_fields": string[],
  "ambiguous_fields": string[],
  "suggested_next_action": string,
  "notes": string | null
}`}

Supported paddy_inward fields: arrival_date, paddy_source_type, source_party_name, truck_number, truck_sheet_bag_count, physical_bag_count, confirmed_quantity, quantity_unit, moisture_percent, notes.
Supported byproduct_sale fields: sale_date, dealer_name, product_type, paddy_source_type, quantity, quantity_unit, rate, payment_status, notes.
Supported expense fields: expense_date, expense_category, vendor_name, amount, currency, notes.`;
}

function normalizeVoiceValue(fieldName: string, value: VoiceScalar): VoiceScalar {
  if (value === "" || value === undefined) return null;
  if ([
    "truck_sheet_bag_count",
    "physical_bag_count",
    "confirmed_quantity",
    "moisture_percent",
    "quantity",
    "rate",
    "amount"
  ].includes(fieldName)) {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string") {
      const parsed = Number(value.replace(/,/g, ""));
      return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
  }
  return value ?? null;
}

function scalarValue(value: Json): VoiceScalar {
  if (value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean") return value;
  return null;
}

function requireOpenAIApiKey() {
  const apiKey = openAIApiKey();
  if (!apiKey) throw new Error("OPENAI_API_KEY is missing. Add it before using voice entry.");
  return apiKey;
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
