import type { Json, SourceType } from "@/lib/types";
import type { SupabaseServerClient } from "@/lib/supabase/server";

export async function createAuditLog(
  supabase: SupabaseServerClient,
  input: {
    millId: string;
    actorId: string | null;
    action: string;
    entityType: string;
    entityId?: string | null;
    beforeValue?: Json;
    afterValue?: Json;
    sourceType?: SourceType;
    sourceId?: string | null;
  }
) {
  const { error } = await supabase.from("audit_logs").insert({
    mill_id: input.millId,
    actor_id: input.actorId,
    action: input.action,
    entity_type: input.entityType,
    entity_id: input.entityId ?? null,
    before_value: input.beforeValue ?? null,
    after_value: input.afterValue ?? null,
    source_type: input.sourceType ?? null,
    source_id: input.sourceId ?? null
  });

  if (error) {
    throw new Error(`Audit log insert failed: ${error.message}`);
  }
}
