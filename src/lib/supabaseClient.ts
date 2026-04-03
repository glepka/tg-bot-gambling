import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY;

if (!supabaseUrl) {
  throw new Error("Missing VITE_SUPABASE_URL env var");
}

if (!supabaseKey) {
  throw new Error("Missing VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY env var");
}

export const supabase = createClient(supabaseUrl, supabaseKey);

