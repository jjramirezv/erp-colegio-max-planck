import { supabase } from "../../lib/supabase";

async function result(request) {
  const { data, error } = await request;
  if (error) throw new Error(error.message || "No se pudo consultar la información docente.");
  return data;
}

export function schoolDate() {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Lima", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const date = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${date.year}-${date.month}-${date.day}`;
}

export async function loadTeacherWorkspace() {
  if (!supabase) throw new Error("Inicia sesión con tu cuenta institucional para consultar tus cursos.");
  return result(supabase.rpc("cargar_panel_docente"));
}

export async function loadAttendance(date, students) {
  if (!students.length) return [];
  return result(supabase.from("asistencias_estudiantes")
    .select("matricula_id,estado,minutos_tardanza,observacion")
    .in("matricula_id", students.map((student) => student.id)).eq("fecha", date));
}

export function saveAttendance(sectionId, date, records) {
  return result(supabase.rpc("guardar_asistencia_docente", {
    seccion_id_solicitada: sectionId, fecha_solicitada: date, registros_solicitados: records,
  }));
}

export function loadGrades(evaluationId) {
  return result(supabase.from("calificaciones_evaluaciones")
    .select("matricula_id,valor,observacion").eq("evaluacion_id", evaluationId));
}

export function saveGrades(evaluationId, records) {
  return result(supabase.rpc("guardar_calificaciones_docente", {
    evaluacion_id_solicitada: evaluationId, registros_solicitados: records,
  }));
}


// Notas de varias evaluaciones a la vez (planilla del periodo).
export function loadGradesFor(evaluationIds) {
  if (!evaluationIds.length) return Promise.resolve([]);
  return result(supabase.from("calificaciones_evaluaciones")
    .select("evaluacion_id,matricula_id,valor,observacion").in("evaluacion_id", evaluationIds));
}
