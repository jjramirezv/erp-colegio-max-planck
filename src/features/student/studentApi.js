import { supabase } from "../../lib/supabase";

export async function loadStudentPortal() {
  if (!supabase) throw new Error("Inicia sesión con tu cuenta institucional para consultar tu información.");
  const { data, error } = await supabase.rpc("cargar_panel_estudiante");
  if (error) throw new Error(error.code === "PGRST202"
    ? "El portal del estudiante aún no está habilitado. Comunícate con administración."
    : "No se pudo cargar tu información escolar. Inténtalo nuevamente.");
  return data;
}
