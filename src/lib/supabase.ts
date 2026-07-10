import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL?.trim();
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

function initSupabase(): { client: SupabaseClient | null; configured: boolean } {
  if (!url || !anonKey || url === "undefined" || anonKey === "undefined") {
    return { client: null, configured: false };
  }

  try {
    return {
      client: createClient(url, anonKey, {
        auth: {
          detectSessionInUrl: true,
          flowType: "implicit",
          persistSession: true,
        },
      }),
      configured: true,
    };
  } catch (error) {
    console.error("Failed to initialize Supabase client:", error);
    return { client: null, configured: false };
  }
}

const { client, configured } = initSupabase();

export const supabase = client;
export const supabaseConfigured = configured;
