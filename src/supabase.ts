import type { SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();

let clientRequest: Promise<SupabaseClient> | null = null;

export const isSupabaseConfigured = Boolean(
  supabaseUrl && supabasePublishableKey,
);

export function getSupabaseClient() {
  if (!supabaseUrl || !supabasePublishableKey)
    return Promise.reject(new Error("Supabase is not configured."));
  if (!clientRequest) {
    clientRequest = import("@supabase/supabase-js").then(({ createClient }) =>
      createClient(supabaseUrl, supabasePublishableKey),
    );
  }
  return clientRequest;
}