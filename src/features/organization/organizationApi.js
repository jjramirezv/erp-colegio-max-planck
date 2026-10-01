import { isSupabaseConfigured, supabase } from "../../lib/supabase";

const STAFF_ROLES = ["direccion", "coordinador_academico", "administrativo", "docente"];

function requireSupabase() {
  if (!isSupabaseConfigured || !supabase) throw new Error("Supabase no está configurado para gestionar la estructura institucional.");
}

function readableError(error, fallback) {
  if (!error) return fallback;
  const message = String(error.message || error.details || "");
  if (["PGRST202", "PGRST205", "42703", "42P01"].includes(error.code) || /schema cache|could not find|does not exist/i.test(message)) return "Falta ejecutar la migración 019 de estructura organizacional en Supabase.";
  if (error.code === "42501" || /permission denied|row-level security/i.test(message)) return "Tu cuenta no tiene permiso para modificar la estructura institucional.";
  if (["22023", "23503", "23505", "23514"].includes(error.code)) return message || fallback;
  return message || fallback;
}

const mapArea = (row) => ({ id: row.id, name: row.nombre, description: row.descripcion || "", responsibleId: row.responsable_id || "", active: row.activo, updatedAt: row.actualizado_en });
const mapPosition = (row) => ({ id: row.id, areaId: row.area_id, name: row.nombre, profileId: row.perfil_id || "", description: row.descripcion || "", active: row.activo, updatedAt: row.actualizado_en });
const mapPerson = (row) => ({ id: row.id, name: row.nombre_completo, role: row.rol, active: row.activo });

export async function loadOrganization() {
  requireSupabase();
  const [areasResult, positionsResult, peopleResult] = await Promise.all([
    supabase.from("areas_institucionales").select("id,nombre,descripcion,responsable_id,activo,actualizado_en").order("nombre"),
    supabase.from("cargos_institucionales").select("id,area_id,nombre,perfil_id,descripcion,activo,actualizado_en").order("nombre"),
    supabase.from("perfiles").select("id,nombre_completo,rol,activo").eq("activo", true).in("rol", STAFF_ROLES).order("nombre_completo"),
  ]);
  const error = areasResult.error || positionsResult.error || peopleResult.error;
  if (error) throw new Error(readableError(error, "No se pudo cargar la estructura institucional."));
  return {
    areas: (areasResult.data || []).map(mapArea),
    positions: (positionsResult.data || []).map(mapPosition),
    people: (peopleResult.data || []).map(mapPerson),
  };
}

export async function saveArea(values) {
  requireSupabase();
  const { data, error } = await supabase.rpc("guardar_area_institucional", {
    area_id_solicitada: values.id || null,
    nombre_solicitado: values.name,
    descripcion_solicitada: values.description || "",
    responsable_id_solicitado: values.responsibleId || null,
    activo_solicitado: values.active,
  });
  if (error) throw new Error(readableError(error, "No se pudo guardar el área."));
  return data;
}

export async function savePosition(values) {
  requireSupabase();
  const { data, error } = await supabase.rpc("guardar_cargo_institucional", {
    cargo_id_solicitado: values.id || null,
    area_id_solicitada: values.areaId,
    nombre_solicitado: values.name,
    perfil_id_solicitado: values.profileId || null,
    descripcion_solicitada: values.description || "",
    activo_solicitado: values.active,
  });
  if (error) throw new Error(readableError(error, "No se pudo guardar el cargo."));
  return data;
}

export async function deleteArea(id) {
  requireSupabase();
  const { error } = await supabase.rpc("eliminar_area_institucional", { area_id_solicitada: id });
  if (error) throw new Error(readableError(error, "No se pudo eliminar el área."));
}

export async function deletePosition(id) {
  requireSupabase();
  const { error } = await supabase.rpc("eliminar_cargo_institucional", { cargo_id_solicitado: id });
  if (error) throw new Error(readableError(error, "No se pudo eliminar el cargo."));
}

export function subscribeToOrganization(onChange) {
  if (!isSupabaseConfigured || !supabase) return () => {};
  const channel = supabase.channel(`organization-${Date.now()}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "areas_institucionales" }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "cargos_institucionales" }, onChange)
    .subscribe();
  return () => { supabase.removeChannel(channel); };
}
