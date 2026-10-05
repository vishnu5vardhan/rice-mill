import { createSupabaseServerClient, supabaseServiceRoleKey, type SupabaseServerClient } from "@/lib/supabase/server";

const LOCAL_TEST_MILL_ID = "11111111-1111-4111-8111-111111111111";

export interface MillContext {
  supabase: SupabaseServerClient;
  millId: string;
  userId: string | null;
  role: string;
}

export async function requireMillContext(): Promise<MillContext> {
  if (!supabaseServiceRoleKey()) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is required for no-sign-in single-mill operator mode.");
  }

  const supabase = await createSupabaseServerClient();
  const configuredMillId = process.env.NEXT_PUBLIC_DEFAULT_MILL_ID || process.env.DEFAULT_MILL_ID;
  const mill = await findDefaultMill(supabase, configuredMillId);

  if (!mill) throw new Error("Default mill is not configured for single-mill operator mode.");

  return {
    supabase,
    millId: mill.id,
    userId: null,
    role: "operator"
  };
}

export async function getOptionalMillContext() {
  try {
    return await requireMillContext();
  } catch {
    return null;
  }
}

async function findDefaultMill(supabase: SupabaseServerClient, configuredMillId: string | undefined) {
  const query = supabase
    .from("mills")
    .select("id")
    .eq("status", "active")
    .limit(1);

  const { data: mill, error } = configuredMillId
    ? await query.eq("id", configuredMillId).maybeSingle()
    : await query.order("created_at", { ascending: true }).maybeSingle();

  if (error) throw error;
  if (mill) return mill;
  if (process.env.NODE_ENV === "production") return null;

  return createLocalTestMill(supabase, configuredMillId || LOCAL_TEST_MILL_ID);
}

async function createLocalTestMill(supabase: SupabaseServerClient, millId: string) {
  const { data, error } = await supabase
    .from("mills")
    .upsert({
      id: millId,
      name: "Rice Mill Test",
      location: null,
      status: "active",
      metadata: { single_mill_operator_mode: true, local_test_data: true }
    }, { onConflict: "id" })
    .select("id")
    .single();

  if (error) throw error;
  return data;
}
