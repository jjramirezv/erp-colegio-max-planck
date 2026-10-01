import { isSupabaseConfigured, supabase } from "../../lib/supabase";

function requireSupabase() {
  if (!isSupabaseConfigured || !supabase) throw new Error("Supabase no está configurado para gestionar los niveles educativos.");
}

function readableError(error, fallback) {
  if (!error) return fallback;
  const message = String(error.message || error.details || "");
  if (["PGRST202", "PGRST205", "42703"].includes(error.code) || /schema cache|could not find|does not exist/i.test(message)) {
    return "Falta ejecutar la migración 007 de gestión de niveles educativos en Supabase.";
  }
  if (error.code === "42501" || /permission denied|row-level security/i.test(message)) return "Tu cuenta no tiene permiso para gestionar los niveles educativos.";
  if (error.code === "23505") return message || "Ya existe un nivel educativo con ese nombre.";
  if (error.code === "23503") return message || "No se puede eliminar porque el nivel tiene grados asociados.";
  if (["22023", "23514"].includes(error.code)) return message || "Revisa los datos del nivel educativo.";
  return message || fallback;
}

function mapLevel(row) {
  return {
    id: row.id,
    name: row.nombre,
    order: row.orden,
    materialScope: row.alcance_material,
    active: row.activo,
    updatedAt: row.actualizado_en,
  };
}

export async function loadEducationLevels() {
  requireSupabase();
  const { data, error } = await supabase
    .from("niveles_educativos")
    .select("id,nombre,orden,alcance_material,activo,actualizado_en")
    .order("orden", { ascending: true })
    .order("nombre", { ascending: true });
  if (error) throw new Error(readableError(error, "No se pudieron cargar los niveles educativos."));
  return (data || []).map(mapLevel);
}

export async function saveEducationLevel(values) {
  requireSupabase();
  const { data, error } = await supabase.rpc("guardar_nivel_educativo", {
    nivel_id_solicitado: values.id || null,
    nombre_solicitado: values.name,
    orden_solicitado: values.order,
    alcance_material_solicitado: values.materialScope,
    activo_solicitado: values.active,
  });
  if (error) throw new Error(readableError(error, "No se pudo guardar el nivel educativo."));
  return data;
}

export async function deleteEducationLevel(id) {
  requireSupabase();
  const { error } = await supabase.rpc("eliminar_nivel_educativo", { nivel_id_solicitado: id });
  if (error) throw new Error(readableError(error, "No se pudo eliminar el nivel educativo."));
}

export function subscribeToEducationLevels(onChange) {
  if (!isSupabaseConfigured || !supabase) return () => {};
  const channel = supabase
    .channel(`education-levels-${Date.now()}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "niveles_educativos" }, onChange)
    .subscribe();
  return () => { supabase.removeChannel(channel); };
}
