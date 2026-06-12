import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabaseConfigured = Boolean(url && anonKey);

// Build a client even when env vars are missing — but guard against crashes.
// The Supabase JS v2 client validates the URL string at construction in
// some builds; using a syntactically valid placeholder avoids that path.
function safeCreate(): SupabaseClient {
  try {
    return createClient(
      url || "https://placeholder.supabase.co",
      anonKey || "sb_publishable_placeholder",
      {
        auth: { persistSession: false, autoRefreshToken: false },
        realtime: { params: { eventsPerSecond: 10 } },
      },
    );
  } catch (e) {
    // Last-resort minimal stub so module load never throws on the client.
    if (typeof window !== "undefined") {
      // eslint-disable-next-line no-console
      console.error("[MAGYC] Supabase init failed", e);
    }
    return createClient("https://placeholder.supabase.co", "sb_publishable_placeholder", {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
}

export const supabase: SupabaseClient = safeCreate();

if (!supabaseConfigured && typeof window !== "undefined") {
  // eslint-disable-next-line no-console
  console.warn(
    "[MAGYC] Supabase env vars missing. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in Vercel.",
  );
}

/**
 * Server-only admin client. Bypasses RLS — never import in client code.
 */
export function supabaseAdmin(): SupabaseClient {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error("Supabase admin env vars missing on server.");
  }
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
