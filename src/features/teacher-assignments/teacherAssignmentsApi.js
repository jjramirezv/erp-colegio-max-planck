import { isSupabaseConfigured, supabase } from "../../lib/supabase";

function requireSupabase() {
  if (!isSupabaseConfigured || !supabase) throw new Error("Supabase no está configurado para gestionar la asignación docente.");
}

function readableError(error, fallback) {
  const message = String(error?.message || error?.details || "");
  if (["PGRST202", "PGRST205", "42703", "42P01"].includes(error?.code) || /schema cache|could not find|does not exist/i.test(message)) return "Falta ejecutar la migración 015 de asignación docente en Supabase.";
  if (error?.code === "42501" || /permission denied|row-level security/i.test(message)) return "Tu cuenta no tiene permiso para gestionar asignaciones docentes.";
  if (["22023", "23505", "23514"].includes(error?.code)) return message || "Revisa los datos de la asignación.";
  return message || fallback;
}

export async function loadTeacherAssignmentsWorkspace() {
  requireSupabase();
  const [teachersResult, offeringsResult, assignmentsResult, subjectsResult] = await Promise.all([
    supabase.from("perfiles").select("id,nombre_completo,rol,activo").eq("rol", "docente").eq("activo", true).order("nombre_completo"),
    supabase.from("cursos_seccion").select("id,anio_academico_id,seccion_id,asignatura_id,nombre_visible,horas_semanales,activo,archivado_en").eq("activo", true).is("archivado_en", null).order("id"),
    supabase.from("asignaciones_docentes").select("id,curso_seccion_id,seccion_id,docente_id,rol_asignacion,inicia_en,termina_en,activo,archivado_en").eq("activo", true).is("archivado_en", null).order("id"),
    supabase.from("asignaturas").select("id,nombre,activo,archivado_en").eq("activo", true).is("archivado_en", null).order("nombre"),
  ]);
  for (const result of [teachersResult, offeringsResult, assignmentsResult, subjectsResult]) {
    if (result.error) throw new Error(readableError(result.error, "No se pudo cargar la asignación docente."));
  }
  return {
    teachers: (teachersResult.data || []).map((row) => ({ id: row.id, name: row.nombre_completo })),
    offerings: (offeringsResult.data || []).map((row) => ({ id: row.id, yearId: row.anio_academico_id, sectionId: row.seccion_id, subjectId: row.asignatura_id, visibleName: row.nombre_visible, weeklyHours: row.horas_semanales })),
    assignments: (assignmentsResult.data || []).map((row) => ({ id: row.id, offeringId: row.curso_seccion_id, sectionId: row.seccion_id, teacherId: row.docente_id, role: row.rol_asignacion, startsOn: row.inicia_en, endsOn: row.termina_en })),
    subjects: (subjectsResult.data || []).map((row) => ({ id: row.id, name: row.nombre })),
  };
}

export async function saveTeacherAssignment(values) {
  requireSupabase();
  const { data, error } = await supabase.rpc("guardar_asignacion_docente", {
    curso_seccion_id_solicitado: values.offeringId || null,
    seccion_id_solicitada: values.sectionId || null,
    docente_id_solicitado: values.teacherId || null,
    rol_asignacion_solicitado: values.role,
    inicia_en_solicitado: values.startsOn,
    termina_en_solicitado: values.endsOn,
  });
  if (error) throw new Error(readableError(error, "No se pudo guardar la asignación docente."));
  return data;
}

export function subscribeToTeacherAssignments(onChange) {
  if (!isSupabaseConfigured || !supabase) return () => {};
  const channel = supabase.channel(`teacher-assignments-${Date.now()}`);
  ["asignaciones_docentes", "cursos_seccion", "perfiles"].forEach((table) => channel.on("postgres_changes", { event: "*", schema: "public", table }, onChange));
  channel.subscribe();
  return () => { supabase.removeChannel(channel); };
}
