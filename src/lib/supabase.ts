import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  // Surfaced loudly during dev/build so a missing .env is obvious.
  throw new Error(
    "חסרים משתני סביבה של Supabase. ודא ש-VITE_SUPABASE_URL ו-VITE_SUPABASE_ANON_KEY מוגדרים ב-.env"
  );
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

/** Bucket holding all project files. Private - access via signed URLs only. */
export const PROJECT_FILES_BUCKET = "project-files";

/** Signed URL lifetime, in seconds (1 hour, per security spec). */
export const SIGNED_URL_TTL = 60 * 60;
