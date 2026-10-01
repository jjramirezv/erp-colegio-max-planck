import { isSupabaseConfigured, supabase } from "../../lib/supabase";

function requireSupabase() {
  if (!isSupabaseConfigured || !supabase) throw new Error("Supabase no está configurado para gestionar turnos y jornadas.");
}

function readableError(error, fallback) {
  if (!error) return fallback;
  const message = String(error.message || error.details || "");
  if (["PGRST202", "PGRST205", "42703"].includes(error.code) || /schema cache|could not find|does not exist/i.test(message)) return "Falta ejecutar la migración 010 de turnos y jornadas en Supabase.";
  if (error.code === "42501" || /permission denied|row-level security/i.test(message)) return "Tu cuenta no tiene permiso para gestionar los turnos.";
  if (error.code === "23505") return message || "Ya existe un turno con ese nombre en el año lectivo seleccionado.";
  if (error.code === "23503") return message || "No se puede eliminar porque el turno está asignado a uno o más salones.";
  if (["22023", "23514"].includes(error.code)) return message || "Revisa los datos del turno.";
  return message || fallback;
}

const mapShift = (row) => ({
  id: row.id,
  yearId: row.anio_academico_id,
  name: row.nombre,
  startTime: String(row.hora_inicio || "").slice(0, 5),
  endTime: String(row.hora_fin || "").slice(0, 5),
  weekdays: row.dias_semana || [],
  active: row.activo,
  updatedAt: row.actualizado_en,
});

export async function loadShiftsJournals() {
  requireSupabase();
  const { data, error } = await supabase
    .from("turnos_jornadas")
    .select("id,anio_academico_id,nombre,hora_inicio,hora_fin,dias_semana,activo,actualizado_en")
    .order("hora_inicio", { ascending: true })
    .order("nombre", { ascending: true });
  if (error) throw new Error(readableError(error, "No se pudieron cargar los turnos."));
  return (data || []).map(mapShift);
}

export async function saveShiftJournal(values) {
  requireSupabase();
  const { data, error } = await supabase.rpc("guardar_turno_jornada", {
    turno_id_solicitado: values.id || null,
    anio_academico_id_solicitado: values.yearId,
    nombre_solicitado: values.name,
    hora_inicio_solicitada: values.startTime,
    hora_fin_solicitada: values.endTime,
    dias_semana_solicitados: values.weekdays,
    activo_solicitado: values.active,
  });
  if (error) throw new Error(readableError(error, "No se pudo guardar el turno."));
  return data;
}

export async function deleteShiftJournal(id) {
  requireSupabase();
  const { error } = await supabase.rpc("eliminar_turno_jornada", { turno_id_solicitado: id });
  if (error) throw new Error(readableError(error, "No se pudo eliminar el turno."));
}

export function subscribeToShiftsJournals(onChange) {
  if (!isSupabaseConfigured || !supabase) return () => {};
  const channel = supabase
    .channel(`shifts-journals-${Date.now()}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "turnos_jornadas" }, onChange)
    .subscribe();
  return () => { supabase.removeChannel(channel); };
}
