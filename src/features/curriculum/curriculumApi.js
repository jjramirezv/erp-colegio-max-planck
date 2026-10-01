import { isSupabaseConfigured, supabase } from "../../lib/supabase";

function requireSupabase() {
  if (!isSupabaseConfigured || !supabase) throw new Error("Supabase no está configurado para gestionar áreas y cursos.");
}

function readableError(error, fallback) {
  if (!error) return fallback;
  const message = String(error.message || error.details || "");
  if (["PGRST202", "PGRST205", "42703", "42P01"].includes(error.code) || /schema cache|could not find|does not exist/i.test(message)) return "Falta ejecutar la migración 011 de áreas y cursos en Supabase.";
  if (error.code === "42501" || /permission denied|row-level security/i.test(message)) return "Tu cuenta no tiene permiso para gestionar áreas y cursos.";
  if (error.code === "23505") return message || "Ese registro ya existe en el contexto seleccionado.";
  if (error.code === "23503") return message || "No se puede eliminar porque todavía tiene información relacionada.";
  if (["22023", "23514"].includes(error.code)) return message || "Revisa los datos ingresados.";
  return message || fallback;
}

export async function loadCurriculum() {
  requireSupabase();
  const [areasResult, plansResult, subjectsResult] = await Promise.all([
    supabase.from("areas_curriculares").select("id,nombre,activo,actualizado_en").order("nombre"),
    supabase.from("cursos_grado").select("id,anio_academico_id,grado_id,area_curricular_id,asignatura_id,horas_semanales,activo,actualizado_en").order("id"),
    supabase.from("asignaturas").select("id,nombre,activo,archivado_en").is("archivado_en", null).order("nombre"),
  ]);
  if (areasResult.error) throw new Error(readableError(areasResult.error, "No se pudieron cargar las áreas curriculares."));
  if (plansResult.error) throw new Error(readableError(plansResult.error, "No se pudieron cargar los cursos por grado."));
  if (subjectsResult.error) throw new Error(readableError(subjectsResult.error, "No se pudo cargar el catálogo de cursos."));
  return {
    areas: (areasResult.data || []).map((row) => ({ id: row.id, name: row.nombre, active: row.activo, updatedAt: row.actualizado_en })),
    courses: (plansResult.data || []).map((row) => ({ id: row.id, yearId: row.anio_academico_id, gradeId: row.grado_id, areaId: row.area_curricular_id, subjectId: row.asignatura_id, weeklyHours: row.horas_semanales, active: row.activo, updatedAt: row.actualizado_en })),
    subjects: (subjectsResult.data || []).map((row) => ({ id: row.id, name: row.nombre, active: row.activo })),
  };
}

export async function saveCurricularArea(values) {
  requireSupabase();
  const { data, error } = await supabase.rpc("guardar_area_curricular", { area_id_solicitada: values.id || null, nombre_solicitado: values.name, activo_solicitado: values.active });
  if (error) throw new Error(readableError(error, "No se pudo guardar el área curricular."));
  return data;
}

export async function deleteCurricularArea(id) {
  requireSupabase();
  const { error } = await supabase.rpc("eliminar_area_curricular", { area_id_solicitada: id });
  if (error) throw new Error(readableError(error, "No se pudo eliminar el área curricular."));
}

export async function saveGradeCourse(values) {
  requireSupabase();
  const { data, error } = await supabase.rpc("guardar_curso_grado", {
    curso_grado_id_solicitado: values.id || null,
    anio_academico_id_solicitado: values.yearId,
    grado_id_solicitado: values.gradeId,
    area_curricular_id_solicitada: values.areaId || null,
    nombre_curso_solicitado: values.name,
    horas_semanales_solicitadas: values.weeklyHours,
    activo_solicitado: values.active,
  });
  if (error) throw new Error(readableError(error, "No se pudo guardar el curso del grado."));
  return data;
}

export async function deleteGradeCourse(id) {
  requireSupabase();
  const { error } = await supabase.rpc("eliminar_curso_grado", { curso_grado_id_solicitado: id });
  if (error) throw new Error(readableError(error, "No se pudo eliminar el curso del grado."));
}

export function subscribeToCurriculum(onChange) {
  if (!isSupabaseConfigured || !supabase) return () => {};
  const channel = supabase.channel(`curriculum-${Date.now()}`);
  ["areas_curriculares", "cursos_grado", "asignaturas"].forEach((table) => channel.on("postgres_changes", { event: "*", schema: "public", table }, onChange));
  channel.subscribe();
  return () => { supabase.removeChannel(channel); };
}
