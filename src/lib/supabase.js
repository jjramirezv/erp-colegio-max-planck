import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

// Enlace de "recuperar contraseña": se detecta antes de que Supabase procese y limpie la URL.
export const recoveryInUrl = typeof window !== "undefined" && /type=recovery/.test(window.location.hash);
// Enlace vencido o ya usado (Supabase devuelve error_code en la URL).
export const authLinkError = typeof window !== "undefined" && /error_code=/.test(window.location.hash) ? "El enlace de recuperación venció o ya fue usado. Pide uno nuevo desde “¿Olvidaste tu contraseña?”." : "";

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);
export const isDemoAuthEnabled = !isSupabaseConfigured && import.meta.env.VITE_ENABLE_DEMO_AUTH !== "false";

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;
