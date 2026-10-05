import type { SupabaseServerClient } from "@/lib/supabase/server";
import { byproductAliasPromptLine } from "@/lib/byproducts/aliases";

// The mill's operating reality, assembled into one compact object that grounds the AI
// (extraction, voice, ask) and the deterministic checks. Sources are blended per the
// "hybrid" decision: owner-entered master data in mills.metadata.business_context,
// auto-learned entities from confirmed history, and corrections from correction_memory.

// Standard Telangana paddy procurement gunny bag. Editable per mill in Business Setup.
export const DEFAULT_BAG_WEIGHT_KG = 40;

const CONFIRMED = ["confirmed", "reconciled", "locked", "exported"];

export interface MillBusinessConfig {
  bagWeightKg: number;
  defaultQuantityUnit: string | null;
}

export interface BusinessContext extends MillBusinessConfig {
  name: string | null;
  location: string | null;
  centers: string[];
  dealers: string[];
  rateRanges: Array<{
    product_type: string;
    quantity_unit: string;
    min: number;
    max: number;
    avg: number;
    recent: number;
    count: number;
  }>;
  corrections: Array<{ field_name: string; from: string; to: string }>;
}

// Cheap read for the hot path (confirm-time mismatch checks need only the numbers).
export async function getMillBusinessConfig(
  supabase: SupabaseServerClient,
  millId: string
): Promise<MillBusinessConfig> {
  const { data } = await supabase.from("mills").select("metadata").eq("id", millId).maybeSingle();
  return readBusinessConfig(data?.metadata);
}

export async function buildBusinessContext(
  supabase: SupabaseServerClient,
  millId: string
): Promise<BusinessContext> {
  const [{ data: mill }, { data: parties }, { data: lots }, { data: sales }, { data: corrections }] = await Promise.all([
    supabase.from("mills").select("name,location,metadata").eq("id", millId).maybeSingle(),
    supabase.from("parties").select("party_type,name").eq("mill_id", millId).eq("status", "confirmed").limit(300),
    supabase
      .from("paddy_lots")
      .select("metadata,status")
      .eq("mill_id", millId)
      .in("status", CONFIRMED)
      .order("created_at", { ascending: false })
      .limit(200),
    supabase
      .from("byproduct_sales")
      .select("product_type,quantity_unit,rate,metadata,status,sale_date")
      .eq("mill_id", millId)
      .eq("status", "confirmed")
      .not("rate", "is", null)
      .order("sale_date", { ascending: false })
      .limit(300),
    supabase
      .from("correction_memory")
      .select("field_name,original_ai_value,corrected_value,correction_type,created_at")
      .eq("mill_id", millId)
      .eq("status", "confirmed")
      .order("created_at", { ascending: false })
      .limit(60)
  ]);

  const config = readBusinessConfig(mill?.metadata);

  const centers = uniqueStrings([
    ...readStringArray(mill?.metadata, "centers"),
    ...(parties ?? [])
      .filter((p) => p.party_type === "source_center" || p.party_type === "farmer")
      .map((p) => p.name),
    ...(lots ?? []).map((lot) => metaString(lot.metadata, "source_party_name"))
  ]);

  const dealers = uniqueStrings([
    ...readStringArray(mill?.metadata, "dealers"),
    ...(parties ?? []).filter((p) => p.party_type === "dealer").map((p) => p.name),
    ...(sales ?? []).map((sale) => metaString(sale.metadata, "dealer_name"))
  ]);

  return {
    ...config,
    name: typeof mill?.name === "string" ? mill.name : null,
    location: typeof mill?.location === "string" ? mill.location : null,
    centers,
    dealers,
    rateRanges: buildRateRanges(sales ?? []),
    corrections: buildCorrections(corrections ?? [])
  };
}

// Grounding text appended to the Gemini extraction prompt.
export function toExtractionPromptSection(ctx: BusinessContext): string {
  const lines: string[] = [
    "Business context for THIS mill. Use it to disambiguate unclear handwriting, but do NOT force a value when the document clearly says something else."
  ];
  lines.push(`- Bag weight: 1 bag = ${ctx.bagWeightKg} kg. Convert bag counts to kg with this factor when needed.`);
  lines.push(`- Telangana by-product slang aliases: ${byproductAliasPromptLine()}. Treat these as draft suggestions, not confirmed truth.`);
  if (ctx.defaultQuantityUnit) lines.push(`- Default quantity unit: ${ctx.defaultQuantityUnit}.`);
  if (ctx.centers.length) {
    lines.push(
      `- Known source centers / villages: ${ctx.centers.slice(0, 40).join("; ")}. If a handwritten center closely matches one of these, use that exact spelling.`
    );
  }
  if (ctx.dealers.length) {
    lines.push(`- Known dealers / buyers: ${ctx.dealers.slice(0, 40).join("; ")}.`);
  }
  if (ctx.rateRanges.length) {
    lines.push(
      `- Typical by-product rates (per unit): ${ctx.rateRanges
        .map((r) => `${r.product_type}/${r.quantity_unit} ~ ${r.min}-${r.max}`)
        .join("; ")}. A value far outside its range is likely a misread.`
    );
  }
  if (ctx.corrections.length) {
    lines.push(
      `- Past owner corrections are mandatory vocabulary overrides for this mill (AI value -> correct value): ${ctx.corrections
        .slice(0, 25)
        .map((c) => `${c.field_name}: "${c.from}" -> "${c.to}"`)
        .join("; ")}.`
    );
  }
  return lines.join("\n");
}

// Compact profile injected into the Ask snapshot and the voice prompt.
export function toAskProfile(ctx: BusinessContext) {
  return {
    mill_name: ctx.name,
    location: ctx.location,
    bag_weight_kg: ctx.bagWeightKg,
    default_quantity_unit: ctx.defaultQuantityUnit,
    known_source_centers: ctx.centers.slice(0, 50),
    known_dealers: ctx.dealers.slice(0, 50),
    typical_byproduct_rate_ranges: ctx.rateRanges
  };
}

function buildRateRanges(sales: Array<{ product_type: string; quantity_unit: string; rate: number | string | null }>) {
  const map = new Map<string, number[]>();
  for (const sale of sales) {
    if (sale.rate === null) continue;
    const rate = Number(sale.rate);
    if (!Number.isFinite(rate)) continue;
    const key = `${sale.product_type}:${sale.quantity_unit}`;
    const rates = map.get(key) ?? [];
    rates.push(rate);
    map.set(key, rates);
  }

  return Array.from(map.entries()).map(([key, rates]) => {
    const [product_type, quantity_unit] = key.split(":");
    const sorted = [...rates].sort((a, b) => a - b);
    return {
      product_type,
      quantity_unit,
      min: sorted[0],
      max: sorted[sorted.length - 1],
      avg: round(rates.reduce((sum, value) => sum + value, 0) / rates.length),
      recent: rates[0], // sales are ordered newest-first
      count: rates.length
    };
  });
}

function buildCorrections(
  rows: Array<{ field_name: string; original_ai_value: unknown; corrected_value: unknown; correction_type: string }>
) {
  const seen = new Set<string>();
  const result: Array<{ field_name: string; from: string; to: string }> = [];
  for (const row of rows) {
    if (!["party_mapping", "truck_number", "document_type", "field_value"].includes(row.correction_type)) continue;
    const from = scalarToShortString(row.original_ai_value);
    const to = scalarToShortString(row.corrected_value);
    if (!from || !to || from === to) continue;
    const dedupeKey = `${row.field_name}:${from}->${to}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    result.push({ field_name: row.field_name, from, to });
  }
  return result;
}

function readBusinessConfig(metadata: unknown): MillBusinessConfig {
  const context = nestedObject(metadata, "business_context");
  const bag = Number(context.bag_weight_kg);
  return {
    bagWeightKg: Number.isFinite(bag) && bag > 0 ? bag : DEFAULT_BAG_WEIGHT_KG,
    defaultQuantityUnit: typeof context.default_quantity_unit === "string" ? context.default_quantity_unit : null
  };
}

function readStringArray(metadata: unknown, key: string): string[] {
  const context = nestedObject(metadata, "business_context");
  const value = context[key];
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function nestedObject(metadata: unknown, key: string): Record<string, unknown> {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return {};
  const value = (metadata as Record<string, unknown>)[key];
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function metaString(metadata: unknown, key: string): string | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const value = (metadata as Record<string, unknown>)[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function scalarToShortString(value: unknown): string | null {
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed && trimmed.length <= 60 ? trimmed : null;
  }
  return null;
}

function uniqueStrings(values: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const trimmed = value?.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(trimmed);
  }
  return result;
}

function round(value: number) {
  return Math.round(value * 100) / 100;
}
