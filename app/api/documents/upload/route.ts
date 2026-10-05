import { NextResponse } from "next/server";
import { requireMillContext } from "@/lib/db/context";
import { apiError, isAuthContextError } from "@/lib/db/errors";
import { uploadDocumentAndMaybeDraft } from "@/lib/services/documents";

export async function POST(request: Request) {
  try {
    const context = await requireMillContext();
    const formData = await request.formData();
    const fileValue = formData.get("file");
    const file = fileValue instanceof File && fileValue.size > 0 ? fileValue : null;
    const selectedDocumentType = String(formData.get("document_type") ?? "unknown");
    const result = await uploadDocumentAndMaybeDraft(context.supabase, {
      millId: context.millId,
      userId: context.userId,
      file,
      selectedDocumentType
    });
    return NextResponse.json(result);
  } catch (error) {
    return apiError(error, isAuthContextError(error) ? 401 : 400);
  }
}
