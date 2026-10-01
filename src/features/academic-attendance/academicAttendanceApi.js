import { isSupabaseConfigured, supabase } from "../../lib/supabase";
import { loadAcademicYears } from "../academic-years/academicYearsApi";
import { loadEducationLevels } from "../education-levels/educationLevelsApi";
import { loadGradesAndSections } from "../grades-sections/gradesSectionsApi";

function requireSupabase() {
  if (!isSupabaseConfigured || !supabase) throw new Error("Supabase no está configurado para gestionar asistencia.");
}

function readableError(error, fallback) {
  const message = String(error?.message || error?.details || "");
  if (["PGRST202", "PGRST205", "42703", "42P01"].includes(error?.code) || /schema cache|could not find|does not exist/i.test(message)) return "Falta aplicar la migración 028 de asistencia y tardanzas.";
  if (error?.code === "42501" || /permission denied|row-level security/i.test(message)) return "Tu cuenta no tiene permiso para gestionar asistencia.";
  if (["22023", "23505", "23514"].includes(error?.code)) return message || "Revisa el salón, la fecha y los estados registrados.";
  return message || fallback;
}

export async function loadAttendanceWorkspace() {
  requireSupabase();
  const [years, levels, structure, enrollmentsResult, profilesResult] = await Promise.all([
    loadAcademicYears(),
    loadEducationLevels(),
    loadGradesAndSections(),
    supabase.from("matriculas_estudiantes").select("id,anio_academico_id,seccion_id,estudiante_id,estado,archivado_en").eq("estado", "active").is("archivado_en", null),
    supabase.from("perfiles").select("id,nombre_completo,activo").eq("rol", "estudiante").eq("activo", true),
  ]);
  if (enrollmentsResult.error) throw new Error(readableError(enrollmentsResult.error, "No se pudieron cargar las matrículas."));
  if (profilesResult.error) throw new Error(readableError(profilesResult.error, "No se pudieron cargar los estudiantes."));
  const profiles = new Map((profilesResult.data || []).map((row) => [row.id, row.nombre_completo]));
  return {
    years,
    levels,
    grades: structure.grades,
    sections: structure.sections,
    enrollments: (enrollmentsResult.data || []).map((row) => ({ id: row.id, yearId: row.anio_academico_id, sectionId: row.seccion_id, studentId: row.estudiante_id, studentName: profiles.get(row.estudiante_id) || "Estudiante sin nombre" })),
    attendance: [],
  };
}

export async function loadDailyAttendance(enrollmentIds, date) {
  requireSupabase();
  if (!enrollmentIds.length || !date) return [];
  const { data, error } = await supabase.from("asistencias_estudiantes").select("id,matricula_id,fecha,estado,minutos_tardanza,observacion,actualizado_en").eq("fecha", date).in("matricula_id", enrollmentIds);
  if (error) throw new Error(readableError(error, "No se pudo cargar la asistencia del día."));
  return (data || []).map((row) => ({ id: row.id, enrollmentId: row.matricula_id, date: row.fecha, status: row.estado, lateMinutes: row.minutos_tardanza, note: row.observacion || "", updatedAt: row.actualizado_en }));
}

export async function saveDailyAttendance({ sectionId, date, records }) {
  requireSupabase();
  const { data, error } = await supabase.rpc("guardar_asistencia_diaria", {
    seccion_id_solicitada: sectionId,
    fecha_solicitada: date,
    registros_solicitados: records,
  });
  if (error) throw new Error(readableError(error, "No se pudo guardar la asistencia."));
  return data;
}

export function subscribeToAttendance(onChange) {
  if (!isSupabaseConfigured || !supabase) return () => {};
  const channel = supabase.channel(`academic-attendance-${Date.now()}`);
  ["asistencias_estudiantes", "matriculas_estudiantes", "secciones"].forEach((table) => channel.on("postgres_changes", { event: "*", schema: "public", table }, onChange));
  channel.subscribe();
  return () => { supabase.removeChannel(channel); };
}
