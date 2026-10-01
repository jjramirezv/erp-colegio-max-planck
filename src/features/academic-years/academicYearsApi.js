import { isSupabaseConfigured, supabase } from "../../lib/supabase";

function requireSupabase() {
  if (!isSupabaseConfigured || !supabase) throw new Error("Supabase no está configurado para gestionar los años lectivos.");
}

function readableError(error, fallback) {
  if (!error) return fallback;
  const message = String(error.message || error.details || "");
  if (["PGRST202", "PGRST205", "42703"].includes(error.code) || /schema cache|could not find|does not exist/i.test(message)) {
    return "Falta ejecutar la migración 006 de gestión de años lectivos en Supabase.";
  }
  if (error.code === "42501" || /permission denied|row-level security/i.test(message)) {
    return "Tu cuenta no tiene permiso para gestionar los años lectivos.";
  }
  if (error.code === "23505") return message.includes("año lectivo activo") ? message : "Ya existe un año lectivo con ese nombre o hay otro año activo.";
  if (error.code === "23503") return "No se puede eliminar porque el año ya tiene información académica relacionada.";
  if (["22023", "23514"].includes(error.code)) return message || "Revisa las fechas y la organización académica.";
  return message || fallback;
}

function mapYear(row) {
  return {
    id: row.id,
    name: row.nombre,
    startsOn: row.inicia_en,
    endsOn: row.termina_en,
    periodSystem: row.sistema_periodos,
    active: row.activo,
    status: row.estado,
    createdAt: row.creado_en,
    updatedAt: row.actualizado_en,
  };
}

export async function loadAcademicYears() {
  requireSupabase();
  const { data, error } = await supabase
    .from("anios_academicos")
    .select("id,nombre,inicia_en,termina_en,sistema_periodos,activo,estado,creado_en,actualizado_en")
    .order("inicia_en", { ascending: false });
  if (error) throw new Error(readableError(error, "No se pudieron cargar los años lectivos."));
  return (data || []).map(mapYear);
}

export async function saveAcademicYear(values) {
  requireSupabase();
  const { data, error } = await supabase.rpc("guardar_anio_lectivo", {
    anio_id_solicitado: values.id || null,
    nombre_solicitado: values.name,
    inicia_en_solicitado: values.startsOn,
    termina_en_solicitado: values.endsOn,
    sistema_periodos_solicitado: values.periodSystem,
  });
  if (error) throw new Error(readableError(error, "No se pudo guardar el año lectivo."));
  return data;
}

async function callYearAction(functionName, id, fallback) {
  requireSupabase();
  const { error } = await supabase.rpc(functionName, { anio_id_solicitado: id });
  if (error) throw new Error(readableError(error, fallback));
}

export const activateAcademicYear = (id) => callYearAction("activar_anio_lectivo", id, "No se pudo activar el año lectivo.");
export const closeAcademicYear = (id) => callYearAction("cerrar_anio_lectivo", id, "No se pudo cerrar el año lectivo.");
export const deleteAcademicYear = (id) => callYearAction("eliminar_anio_en_preparacion", id, "No se pudo eliminar el año lectivo.");

export function subscribeToAcademicYears(onChange) {
  if (!isSupabaseConfigured || !supabase) return () => {};
  const channel = supabase
    .channel(`academic-years-${Date.now()}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "anios_academicos" }, onChange)
    .subscribe();
  return () => { supabase.removeChannel(channel); };
}
