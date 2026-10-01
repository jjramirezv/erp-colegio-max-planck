import { supabase } from "../../lib/supabase";

export async function loadFamilyPortal() {
  if (!supabase) throw new Error("Inicia sesión con tu cuenta de familia para consultar la información de tus hijos.");
  const { data, error } = await supabase.rpc("cargar_panel_familia");
  if (error) throw new Error(error.code === "PGRST202"
    ? "El portal de familias aún no está habilitado. Comunícate con la secretaría del colegio."
    : "No se pudo cargar la información de tus hijos. Inténtalo nuevamente.");
  return data;
}
