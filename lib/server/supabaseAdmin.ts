import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { freshSupabaseFetch } from "@/lib/supabaseTransport";

/** Service-role client. This module cannot be imported into a client bundle. */
export function supabaseAdmin(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error("Supabase admin env vars missing on server.");
  }
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: freshSupabaseFetch },
  });
}
