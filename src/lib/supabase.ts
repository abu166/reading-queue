import { createClient } from "@supabase/supabase-js";
export const configured = Boolean(
  import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY,
);
export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL || "https://unconfigured.supabase.co",
  import.meta.env.VITE_SUPABASE_ANON_KEY || "unconfigured",
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  },
);
export const callbackUrl = () =>
  new URL(import.meta.env.BASE_URL, window.location.origin).href;
