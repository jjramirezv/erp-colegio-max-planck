import { isSupabaseConfigured, supabase } from "../../lib/supabase";

function messageFor(error, fallback) {
  const message = String(error?.message || error?.details || "");
  if (["PGRST202", "42883"].includes(error?.code) || /guardar_curso_academico|schema cache/i.test(message)) return "Falta aplicar la migración 025 de cursos académicos en Supabase.";
  if (error?.code === "42501") return "Tu cuenta no tiene permiso para gestionar cursos.";
  if (error?.code === "23505") return "Este curso ya pertenece al grado seleccionado.";
  return message || fallback;
}

export async function saveAcademicCourse(values) {
  if (!isSupabaseConfigured || !supabase) throw new Error("Supabase no está configurado.");
  const { data, error } = await supabase.rpc("guardar_curso_academico", {
    curso_grado_id_solicitado: values.id || null,
    anio_academico_id_solicitado: values.yearId,
    grado_id_solicitado: values.gradeId,
    area_curricular_id_solicitada: values.areaId || null,
    nombre_curso_solicitado: values.name,
    horas_semanales_solicitadas: Number(values.weeklyHours),
    activo_solicitado: values.active,
  });
  if (error) throw new Error(messageFor(error, "No se pudo guardar el curso."));
  return data;
}
