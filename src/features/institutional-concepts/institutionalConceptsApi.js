import { isSupabaseConfigured, supabase } from "../../lib/supabase";

function requireSupabase() {
  if (!isSupabaseConfigured || !supabase) throw new Error("Supabase no está configurado para gestionar los conceptos institucionales.");
}

function readableError(error, fallback) {
  if (!error) return fallback;
  const message = String(error.message || error.details || "");
  if (["PGRST202", "PGRST205", "42703", "42P01"].includes(error.code) || /schema cache|could not find|does not exist/i.test(message)) return "Falta ejecutar la migración 020 de conceptos institucionales en Supabase.";
  if (error.code === "42501" || /permission denied|row-level security/i.test(message)) return "Tu cuenta no tiene permiso para gestionar los conceptos institucionales.";
  if (["22023", "23503", "23505", "23514"].includes(error.code)) return message || fallback;
  return message || fallback;
}

const mapConcept = (row) => ({ id: row.id, name: row.nombre, category: row.categoria, description: row.descripcion || "", active: row.activo, updatedAt: row.actualizado_en });

export async function loadInstitutionalConcepts() {
  requireSupabase();
  const { data, error } = await supabase.from("conceptos_institucionales").select("id,nombre,categoria,descripcion,activo,actualizado_en").order("nombre");
  if (error) throw new Error(readableError(error, "No se pudieron cargar los conceptos institucionales."));
  return (data || []).map(mapConcept);
}

export async function saveInstitutionalConcept(values) {
  requireSupabase();
  const { data, error } = await supabase.rpc("guardar_concepto_institucional", {
    concepto_id_solicitado: values.id || null,
    nombre_solicitado: values.name,
    categoria_solicitada: values.category,
    descripcion_solicitada: values.description || "",
    activo_solicitado: values.active,
  });
  if (error) throw new Error(readableError(error, "No se pudo guardar el concepto."));
  return data;
}

export async function deleteInstitutionalConcept(id) {
  requireSupabase();
  const { error } = await supabase.rpc("eliminar_concepto_institucional", { concepto_id_solicitado: id });
  if (error) throw new Error(readableError(error, "No se pudo eliminar el concepto."));
}

export function subscribeToInstitutionalConcepts(onChange) {
  if (!isSupabaseConfigured || !supabase) return () => {};
  const channel = supabase.channel(`institutional-concepts-${Date.now()}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "conceptos_institucionales" }, onChange)
    .subscribe();
  return () => { supabase.removeChannel(channel); };
}
