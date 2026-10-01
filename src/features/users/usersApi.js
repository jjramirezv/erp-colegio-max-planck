import { isSupabaseConfigured, supabase } from "../../lib/supabase";

async function invoke(body) {
  if (!isSupabaseConfigured || !supabase) throw new Error("Supabase no está configurado para gestionar usuarios.");
  const { data, error } = await supabase.functions.invoke("gestionar-usuario", { body });
  if (error) {
    let message = error.message;
    try { const detail = await error.context?.json(); message = detail?.error || message; } catch { /* respuesta sin JSON */ }
    if (/not found|404/i.test(message)) message = "Falta desplegar la Edge Function gestionar-usuario en Supabase.";
    throw new Error(message || "No se pudo completar la operación.");
  }
  if (data?.error) throw new Error(data.error);
  return data;
}

export async function loadPortalUsers() { return (await invoke({ action: "listar" })).users || []; }
export function createPortalUser(values) { return invoke({ action: "crear", ...values }); }
export function updatePortalUser(values) { return invoke({ action: "actualizar", ...values }); }
export function deletePortalUser(user) { return invoke({ action: "eliminar", userId: user.id, email: user.email }); }
