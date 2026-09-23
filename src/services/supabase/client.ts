import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL?.trim();
// Supabase renamed the browser-safe key: "anon public" is now "publishable".
// Either variable name works.
const anonKey = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? import.meta.env.VITE_SUPABASE_ANON_KEY)?.trim();

/** True once both env vars are set; otherwise the app stays in browser-only mode. */
export const isSupabaseConfigured = Boolean(url && anonKey);

export const supabase: SupabaseClient = isSupabaseConfigured
  ? createClient(url as string, anonKey as string, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    })
  : // Never used, but keeps the module import-safe when Supabase is not configured.
    (null as unknown as SupabaseClient);

export const ATTACHMENTS_BUCKET = "attachments";
