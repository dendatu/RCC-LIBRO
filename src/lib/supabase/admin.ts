import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { requireServiceRoleEnv } from "@/lib/env";

/**
 * Service-role client. Bypasses Row Level Security, so it is reserved for the
 * scheduled notification job and cross-member administrative reports.
 * Must never be imported from a client component.
 */
export function createAdminClient() {
  const { url, serviceKey } = requireServiceRoleEnv();
  return createSupabaseClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { "x-application-name": "rcc-libro" } },
  });
}

export type AdminClient = ReturnType<typeof createAdminClient>;
