import { createHash, randomUUID } from "node:crypto";
import { GEMINI_MODEL, GEMINI_PROVIDER, extractDocumentWithGemini } from "@/lib/ai/gemini";
import type { SupabaseServerClient } from "@/lib/supabase/server";
import { createAuditLog } from "@/lib/services/audit";
import { buildBusinessContext, toExtractionPromptSection } from "@/lib/services/business-context";
import type { DraftType, Json, SourceType } from "@/lib/types";
import {
  documentTypeSchema,
  type ByproductSaleExtraction,
  type ExpenseExtraction,
  type RoughNotesExtraction,
  type TruckSheetExtraction,
  type WeighbridgeExtraction
} from "@/lib/validation/schemas";

type DraftableExtraction = TruckSheetExtraction | ByproductSaleExtraction | ExpenseExtraction;
type StoredExtraction = DraftableExtraction | WeighbridgeExtraction | RoughNotesExtraction;

// Stage 1 (fast, blocks the operator): persist the file and queue an extraction run.
// Returns the in-memory file bytes so the caller can hand them straight to the
// background extractor without re-downloading from storage.
export async function createDocumentForExtraction(
  supabase: SupabaseServerClient,
  input: {
    millId: string;
    userId: string | null;
    file: File | null;
    selectedDocumentType: string;
  }
) {
  const filename = input.file?.name ?? `manual-${Date.now()}.txt`;
  const documentId = randomUUID();
  const now = new Date();
  const safeFilename = filename.replaceAll("/", "-");
  const path = `mills/${input.millId}/documents/${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, "0")}/${documentId}/${safeFilename}`;
  const selectedDocumentType = documentTypeSchema.safeParse(input.selectedDocumentType).success
    ? documentTypeSchema.parse(input.selectedDocumentType)
    : "unknown";
  let fileSize: number | null = input.file?.size ?? 0;
  let mimeType: string | null = input.file?.type || "application/octet-stream";
  const fileBuffer = input.file && input.file.size > 0 ? Buffer.from(await input.file.arrayBuffer()) : null;
  const checksum = fileBuffer ? createHash("sha256").update(fileBuffer).digest("hex") : null;

  if (checksum) {
    const existing = await findExistingDocumentByChecksum(supabase, input.millId, checksum);
    if (existing) return { ...existing, fileBuffer: null, mimeType: null };
  }

  if (input.file && input.file.size > 0) {
    const { error } = await supabase.storage.from("documents").upload(path, input.file, {
      upsert: false,
      contentType: input.file.type || undefined
    });
    if (error) throw error;
  } else {
    fileSize = 0;
    mimeType = "application/octet-stream";
  }

  const { data: document, error: documentError } = await supabase
    .from("documents")
    .insert({
      id: documentId,
      mill_id: input.millId,
      uploaded_by: input.userId,
      storage_bucket: "documents",
      storage_path: path,
      original_filename: filename,
      mime_type: mimeType,
      file_size: fileSize,
      checksum,
      document_type: selectedDocumentType,
      classification_status: "queued",
      extraction_status: "queued",
      status: "draft",
      metadata: { selected_document_type: selectedDocumentType },
      created_by: input.userId,
      updated_by: input.userId
    })
    .select("*")
    .single();

  if (documentError) throw documentError;

  const { data: extractionRun, error: runError } = await supabase
    .from("extraction_runs")
    .insert({
      mill_id: input.millId,
      document_id: document.id,
      run_type: "ocr_vision_extraction",
      model_provider: GEMINI_PROVIDER,
      model_name: GEMINI_MODEL,
      prompt_version: "document_extraction_v1",
      schema_name: "v1_document_extraction",
      schema_version: "v1",
      status: "queued",
      raw_output: {},
      validated_output: {},
      created_by: input.userId,
      updated_by: input.userId
    })
    .select("*")
    .single();

  if (runError) throw runError;

  return { document, extractionRun, duplicate: false as const, fileBuffer, mimeType };
}

// Stage 2 (slow, runs in the background): read the bytes, call Gemini, and promote
// the result into a draft. Safe to call from `after()` or a retry action. If no file
// bytes are supplied it re-downloads them from storage, so a retry needs only the ids.
export async function runDocumentExtraction(
  supabase: SupabaseServerClient,
  input: {
    millId: string;
    userId: string | null;
    documentId: string;
    extractionRunId?: string;
    selectedDocumentType?: string | null;
    fileBuffer?: Buffer | null;
    mimeType?: string | null;
  }
) {
  const { data: document, error: documentError } = await supabase
    .from("documents")
    .select("*")
    .eq("mill_id", input.millId)
    .eq("id", input.documentId)
    .single();
  if (documentError) throw documentError;

  const selectedDocumentType = documentTypeSchema.safeParse(input.selectedDocumentType).success
    ? documentTypeSchema.parse(input.selectedDocumentType)
    : documentTypeSchema.safeParse(metadataString(document.metadata, "selected_document_type")).success
      ? documentTypeSchema.parse(metadataString(document.metadata, "selected_document_type"))
      : documentTypeSchema.safeParse(document.document_type).success
        ? documentTypeSchema.parse(document.document_type)
        : "unknown";

  // Reuse the supplied run, or create one (retry path).
  let extractionRunId = input.extractionRunId ?? null;
  if (!extractionRunId) {
    const { data: run, error: runError } = await supabase
      .from("extraction_runs")
      .insert({
        mill_id: input.millId,
        document_id: input.documentId,
        run_type: "ocr_vision_extraction",
        model_provider: GEMINI_PROVIDER,
        model_name: GEMINI_MODEL,
        prompt_version: "document_extraction_v1",
        schema_name: "v1_document_extraction",
        schema_version: "v1",
        status: "queued",
        raw_output: {},
        validated_output: {},
        created_by: input.userId,
        updated_by: input.userId
      })
      .select("id")
      .single();
    if (runError) throw runError;
    extractionRunId = run.id;
  }

  if (!extractionRunId) throw new Error("Could not establish an extraction run for this document.");

  await supabase
    .from("extraction_runs")
    .update({ status: "running", started_at: new Date().toISOString(), updated_by: input.userId })
    .eq("id", extractionRunId);
  await supabase
    .from("documents")
    .update({ extraction_status: "running", updated_by: input.userId })
    .eq("mill_id", input.millId)
    .eq("id", input.documentId);

  let fileBuffer = input.fileBuffer ?? null;
  let mimeType = input.mimeType ?? document.mime_type ?? null;
  if (!fileBuffer) {
    const { data: blob, error: downloadError } = await supabase.storage
      .from(document.storage_bucket)
      .download(document.storage_path);
    if (downloadError) throw downloadError;
    fileBuffer = Buffer.from(await blob.arrayBuffer());
    mimeType = document.mime_type ?? mimeType;
  }

  let draft = null;
  let documentType = selectedDocumentType;

  try {
    if (!fileBuffer) throw new Error("No file bytes were available for Gemini image extraction.");

    // Ground the model in this mill's known centers, dealers, bag weight, rate ranges,
    // and past corrections so it matches handwriting instead of guessing blind.
    const businessContext = toExtractionPromptSection(await buildBusinessContext(supabase, input.millId));

    const gemini = await extractWithRetry({
      fileBuffer,
      mimeType: mimeType || "image/jpeg",
      selectedDocumentType,
      businessContext
    });
    const validated = gemini.validated;
    documentType = validated.documentType;

    await supabase
      .from("extraction_runs")
      .update({
        status: "succeeded",
        raw_output: gemini.rawJson,
        validated_output: {
          document_type: validated.documentType,
          draft_type: validated.draftType,
          source_type: validated.sourceType,
          extraction: validated.extraction,
          missing_fields: validated.missingFields,
          ambiguous_fields: validated.ambiguousFields,
          suggested_next_action: validated.suggestedNextAction
        },
        finished_at: new Date().toISOString(),
        updated_by: input.userId
      })
      .eq("id", extractionRunId);

    await supabase
      .from("documents")
      .update({
        document_type: documentType,
        classification_status: "succeeded",
        extraction_status: "succeeded",
        metadata: {
          selected_document_type: selectedDocumentType,
          model: gemini.model,
          provider: gemini.provider,
          document_type_confidence: validated.documentTypeConfidence,
          missing_fields: validated.missingFields,
          ambiguous_fields: validated.ambiguousFields,
          suggested_next_action: validated.suggestedNextAction
        },
        updated_by: input.userId
      })
      .eq("id", document.id);

    if (validated.extraction && validated.draftType && isDraftableExtraction(validated.extraction)) {
      draft = await createDraftFromExtraction(supabase, {
        millId: input.millId,
        userId: input.userId,
        documentId: document.id,
        extractionRunId,
        draftType: validated.draftType,
        sourceType: validated.sourceType,
        extraction: validated.extraction
      });
    } else if (validated.extraction) {
      await saveDocumentOnlyExtraction(supabase, {
        millId: input.millId,
        userId: input.userId,
        documentId: document.id,
        extractionRunId,
        sourceType: validated.sourceType,
        extraction: validated.extraction
      });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Document extraction failed.";
    await supabase
      .from("extraction_runs")
      .update({
        status: "failed",
        error: message,
        finished_at: new Date().toISOString(),
        updated_by: input.userId
      })
      .eq("id", extractionRunId);

    await supabase
      .from("documents")
      .update({
        classification_status: selectedDocumentType === "unknown" ? "failed" : "succeeded",
        extraction_status: "failed",
        metadata: {
          selected_document_type: selectedDocumentType,
          model: GEMINI_MODEL,
          provider: GEMINI_PROVIDER,
          extraction_error: message
        },
        updated_by: input.userId
      })
      .eq("id", document.id);
  }

  await createAuditLog(supabase, {
    millId: input.millId,
    actorId: input.userId,
    action: "document_extracted",
    entityType: "document",
    entityId: document.id,
    afterValue: { document_type: documentType, draft_id: draft?.id ?? null, extraction_run_id: extractionRunId },
    sourceType: "document",
    sourceId: document.id
  });

  return { document: { ...document, document_type: documentType }, extractionRunId, draft };
}

// Backwards-compatible synchronous path (used by the JSON upload API route): create
// then extract in one call.
export async function uploadDocumentAndMaybeDraft(
  supabase: SupabaseServerClient,
  input: {
    millId: string;
    userId: string | null;
    file: File | null;
    selectedDocumentType: string;
  }
) {
  const created = await createDocumentForExtraction(supabase, input);
  if ("duplicate" in created && created.duplicate === true) {
    return created;
  }
  if ("draft" in created) {
    // findExistingDocumentByChecksum branch already returned a full result.
    return created;
  }

  const { draft } = await runDocumentExtraction(supabase, {
    millId: input.millId,
    userId: input.userId,
    documentId: created.document.id,
    extractionRunId: created.extractionRun.id,
    selectedDocumentType: input.selectedDocumentType,
    fileBuffer: created.fileBuffer,
    mimeType: created.mimeType
  });

  return { document: created.document, extractionRun: created.extractionRun, draft };
}

// One automatic retry: a transient network blip or a malformed JSON response should
// not cost the operator the whole upload.
async function extractWithRetry(input: {
  fileBuffer: Buffer;
  mimeType: string;
  selectedDocumentType?: string | null;
  businessContext?: string | null;
}) {
  try {
    return await extractDocumentWithGemini(input);
  } catch {
    return await extractDocumentWithGemini(input);
  }
}

async function findExistingDocumentByChecksum(
  supabase: SupabaseServerClient,
  millId: string,
  checksum: string
) {
  const { data: document, error: documentError } = await supabase
    .from("documents")
    .select("*")
    .eq("mill_id", millId)
    .eq("checksum", checksum)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (documentError) throw documentError;
  if (!document) return null;

  const [{ data: draft }, { data: extractionRun }] = await Promise.all([
    supabase
      .from("draft_entries")
      .select("*")
      .eq("mill_id", millId)
      .eq("document_id", document.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("extraction_runs")
      .select("*")
      .eq("mill_id", millId)
      .eq("document_id", document.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
  ]);

  return { document, extractionRun, draft, duplicate: true as const };
}

async function createDraftFromExtraction(
  supabase: SupabaseServerClient,
  input: {
    millId: string;
    userId: string | null;
    documentId: string;
    extractionRunId: string;
    draftType: DraftType;
    sourceType: SourceType;
    extraction: DraftableExtraction;
  }
) {
  const fieldRows = input.extraction.fields.map((field) => ({
    mill_id: input.millId,
    extraction_run_id: input.extractionRunId,
    document_id: input.documentId,
    field_name: field.field_name,
    raw_value: field.value,
    normalized_value: field.value,
    confidence: field.confidence,
    status: field.status,
    source_type: input.sourceType,
    source_id: input.documentId,
    needs_review: field.needs_review,
    created_by: input.userId,
    updated_by: input.userId
  }));

  if (fieldRows.length > 0) {
    await supabase.from("extracted_fields").insert(fieldRows);
  }

  const payload = payloadForExtraction(input.extraction);
  const missingFields = input.extraction.fields
    .filter((field) => field.status === "missing" && field.required)
    .map((field) => field.field_name);

  const { data: draftRow, error: draftError } = await supabase
    .from("draft_entries")
    .insert({
      mill_id: input.millId,
      draft_type: input.draftType,
      source_type: input.sourceType,
      source_id: input.documentId,
      document_id: input.documentId,
      extraction_run_id: input.extractionRunId,
      payload,
      missing_fields: missingFields,
      status: "pending_confirmation",
      created_by: input.userId,
      updated_by: input.userId
    })
    .select("*")
    .single();

  if (draftError) throw draftError;

  await supabase.from("draft_entry_fields").insert(
    input.extraction.fields.map((field) => ({
      mill_id: input.millId,
      draft_entry_id: draftRow.id,
      field_name: field.field_name,
      value: field.value,
      source_type: input.sourceType,
      source_id: input.documentId,
      confidence: field.confidence,
      status: field.status,
      required: field.required,
      needs_review: field.needs_review,
      linked_document_id: input.documentId,
      created_by: input.userId,
      updated_by: input.userId
    }))
  );

  return draftRow;
}

async function saveDocumentOnlyExtraction(
  supabase: SupabaseServerClient,
  input: {
    millId: string;
    userId: string | null;
    documentId: string;
    extractionRunId: string;
    sourceType: SourceType;
    extraction: StoredExtraction;
  }
) {
  const fieldRows = input.extraction.fields.map((field) => ({
    mill_id: input.millId,
    extraction_run_id: input.extractionRunId,
    document_id: input.documentId,
    field_name: field.field_name,
    raw_value: field.value,
    normalized_value: field.value,
    confidence: field.confidence,
    status: field.status,
    source_type: input.sourceType,
    source_id: input.documentId,
    needs_review: field.needs_review,
    created_by: input.userId,
    updated_by: input.userId
  }));

  if (fieldRows.length > 0) {
    await supabase.from("extracted_fields").insert(fieldRows);
  }
}

function payloadForExtraction(extraction: DraftableExtraction) {
  if (isTruckSheetExtraction(extraction)) {
    return jsonRecord({
      arrival_date: extraction.arrival_date,
      paddy_source_type: extraction.paddy_source_type,
      source_party_name: extraction.source_party_name,
      truck_number: extraction.truck_number,
      truck_sheet_bag_count: extraction.truck_sheet_bag_count,
      physical_bag_count: extraction.physical_bag_count,
      confirmed_quantity: extraction.confirmed_quantity,
      quantity_unit: extraction.quantity_unit,
      moisture_percent: extraction.moisture_percent,
      notes: extraction.notes
    });
  }

  if (isByproductSaleExtraction(extraction)) {
    return jsonRecord({
      sale_date: extraction.sale_date,
      dealer_name: extraction.dealer_name,
      product_type: extraction.product_type,
      paddy_source_type: extraction.paddy_source_type,
      quantity: extraction.quantity,
      quantity_unit: extraction.quantity_unit,
      rate: extraction.rate,
      subtotal_amount: extraction.subtotal_amount ?? null,
      gst_percent: extraction.gst_percent ?? null,
      tax_amount: extraction.tax_amount ?? null,
      total_amount: extraction.total_amount ?? null,
      payment_status: extraction.payment_status,
      notes: extraction.notes
    });
  }

  return jsonRecord({
    expense_date: extraction.expense_date,
    expense_category: extraction.expense_category,
    vendor_name: extraction.vendor_name,
    amount: extraction.amount,
    currency: extraction.currency,
    notes: extraction.notes
  });
}

function isTruckSheetExtraction(
  extraction: StoredExtraction
): extraction is TruckSheetExtraction {
  return extraction.document_type === "truck_sheet";
}

function isByproductSaleExtraction(
  extraction: StoredExtraction
): extraction is ByproductSaleExtraction {
  return extraction.document_type === "byproduct_sale_bill" || extraction.document_type === "sale_bill";
}

function isDraftableExtraction(extraction: StoredExtraction): extraction is DraftableExtraction {
  return isTruckSheetExtraction(extraction) || isByproductSaleExtraction(extraction) || isExpenseExtraction(extraction);
}

function isExpenseExtraction(extraction: StoredExtraction): extraction is ExpenseExtraction {
  return ["transport_bill", "labour_note", "electricity_bill", "maintenance_bill"].includes(extraction.document_type);
}

function metadataString(metadata: unknown, key: string) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const value = (metadata as Record<string, unknown>)[key];
  return typeof value === "string" ? value : null;
}

function jsonRecord(value: Record<string, unknown>) {
  return JSON.parse(JSON.stringify(value)) as Record<string, Json>;
}
