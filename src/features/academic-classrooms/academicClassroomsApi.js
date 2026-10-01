import { isSupabaseConfigured, supabase } from "../../lib/supabase";
import { loadAcademicYears } from "../academic-years/academicYearsApi";
import { loadEducationLevels } from "../education-levels/educationLevelsApi";
import { loadGradesAndSections } from "../grades-sections/gradesSectionsApi";
import { loadShiftsJournals } from "../shifts-journals/shiftsJournalsApi";

function requireSupabase() {
  if (!isSupabaseConfigured || !supabase) throw new Error("Supabase no está configurado para gestionar salones.");
}

function readableError(error, fallback) {
  const message = String(error?.message || error?.details || "");
  if (["PGRST202", "PGRST205", "42703", "42P01"].includes(error?.code) || /schema cache|could not find|does not exist/i.test(message)) return "Falta aplicar la migración 026 de salones para Coordinación Académica.";
  if (error?.code === "42501" || /permission denied|row-level security/i.test(message)) return "Tu cuenta no tiene permiso para administrar salones.";
  if (error?.code === "23503") return message || "No puedes retirar un salón que ya tiene información académica asociada.";
  if (["22023", "23505", "23514"].includes(error?.code)) return message || "Revisa la configuración de los salones.";
  return message || fallback;
}

export async function loadAcademicClassroomsWorkspace() {
  requireSupabase();
  const [years, levels, structure, shifts, enrollmentsResult] = await Promise.all([
    loadAcademicYears(),
    loadEducationLevels(),
    loadGradesAndSections(),
    loadShiftsJournals(),
    supabase.from("matriculas_estudiantes").select("seccion_id").eq("estado", "active").is("archivado_en", null),
  ]);
  if (enrollmentsResult.error) throw new Error(readableError(enrollmentsResult.error, "No se pudo consultar la ocupación de los salones."));
  const enrollmentCount = (enrollmentsResult.data || []).reduce((map, row) => map.set(String(row.seccion_id), (map.get(String(row.seccion_id)) || 0) + 1), new Map());
  return {
    years,
    levels,
    grades: structure.grades,
    sections: structure.sections.map((section) => ({ ...section, enrolled: enrollmentCount.get(String(section.id)) || 0 })),
    shifts,
  };
}

export async function saveAcademicClassrooms(values) {
  requireSupabase();
  const { data, error } = await supabase.rpc("guardar_salones_academicos", {
    grado_id_solicitado: values.gradeId,
    anio_academico_id_solicitado: values.yearId,
    salones_solicitados: values.classrooms.map((classroom) => ({
      id: classroom.id || null,
      name: classroom.name,
      shiftId: classroom.shiftId,
      capacity: classroom.capacity,
    })),
  });
  if (error) throw new Error(readableError(error, "No se pudieron guardar los salones."));
  return data;
}

export function subscribeToAcademicClassrooms(onChange) {
  if (!isSupabaseConfigured || !supabase) return () => {};
  const channel = supabase.channel(`academic-classrooms-${Date.now()}`);
  ["secciones", "grados", "turnos_jornadas", "matriculas_estudiantes"].forEach((table) => channel.on("postgres_changes", { event: "*", schema: "public", table }, onChange));
  channel.subscribe();
  return () => { supabase.removeChannel(channel); };
}
