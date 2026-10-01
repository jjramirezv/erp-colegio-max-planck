import { isSupabaseConfigured, supabase } from "../../lib/supabase";
import { loadAcademicWorkspace } from "../academic/academicApi";
import { loadAcademicPeriods } from "../academic-periods/academicPeriodsApi";

function requireSupabase() {
  if (!isSupabaseConfigured || !supabase) throw new Error("Supabase no está configurado para gestionar evaluaciones.");
}

function readableError(error, fallback) {
  const message = String(error?.message || error?.details || "");
  if (["PGRST202", "PGRST205", "42703", "42P01"].includes(error?.code) || /schema cache|could not find|does not exist/i.test(message)) return "Falta aplicar la migración 030 de evaluaciones académicas.";
  if (error?.code === "42501" || /permission denied|row-level security/i.test(message)) return "Tu cuenta no tiene permiso para gestionar evaluaciones.";
  if (["22023", "23505", "23514"].includes(error?.code)) return message || "Revisa los datos de la evaluación.";
  return message || fallback;
}

const mapEvaluation = (row) => ({
  id: row.id,
  courseOfferingId: row.curso_seccion_id,
  periodId: row.periodo_academico_id,
  title: row.titulo,
  type: row.tipo,
  description: row.descripcion || "",
  date: row.fecha_aplicacion,
  status: row.estado,
  visibleToStudents: row.visible_estudiantes,
  updatedAt: row.actualizado_en,
});

export async function loadEvaluationsWorkspace() {
  requireSupabase();
  const [academic, periods, evaluationsResult] = await Promise.all([
    loadAcademicWorkspace(),
    loadAcademicPeriods(),
    supabase.from("evaluaciones_academicas").select("id,curso_seccion_id,periodo_academico_id,titulo,tipo,descripcion,fecha_aplicacion,estado,visible_estudiantes,actualizado_en").is("archivado_en", null).order("fecha_aplicacion", { ascending: true }),
  ]);
  if (evaluationsResult.error) throw new Error(readableError(evaluationsResult.error, "No se pudieron cargar las evaluaciones."));
  return { ...academic, periods, evaluations: (evaluationsResult.data || []).map(mapEvaluation) };
}

export async function saveAcademicEvaluation(values) {
  requireSupabase();
  const { data, error } = await supabase.rpc("guardar_evaluacion_academica", {
    evaluacion_id_solicitada: values.id || null,
    curso_seccion_id_solicitado: values.courseOfferingId,
    periodo_academico_id_solicitado: values.periodId,
    titulo_solicitado: values.title,
    tipo_solicitado: values.type,
    descripcion_solicitada: values.description || null,
    fecha_aplicacion_solicitada: values.date,
    estado_solicitado: values.status,
    visible_estudiantes_solicitado: values.visibleToStudents,
  });
  if (error) throw new Error(readableError(error, "No se pudo guardar la evaluación."));
  return data;
}

export async function archiveAcademicEvaluation(id) {
  requireSupabase();
  const { error } = await supabase.rpc("archivar_evaluacion_academica", { evaluacion_id_solicitada: id });
  if (error) throw new Error(readableError(error, "No se pudo archivar la evaluación."));
}

export function subscribeToAcademicEvaluations(onChange) {
  if (!isSupabaseConfigured || !supabase) return () => {};
  const channel = supabase.channel(`academic-evaluations-${Date.now()}`);
  ["evaluaciones_academicas", "cursos_seccion", "periodos_academicos"].forEach((table) => channel.on("postgres_changes", { event: "*", schema: "public", table }, onChange));
  channel.subscribe();
  return () => { supabase.removeChannel(channel); };
}

// Plan estándar: exámenes semanales + semanas de evaluación a mitad y final de cada periodo.
export async function generateEvaluationPlan({ yearId, periodIds, levelId = null, sectionId = null, weeklyDay = 5, weekly = true, midterm = true, final = true, preview = true }) {
  requireSupabase();
  const { data, error } = await supabase.rpc("generar_plan_evaluaciones", {
    anio: Number(yearId), periodos: periodIds.map(Number), nivel: levelId ? Number(levelId) : null, seccion: sectionId ? Number(sectionId) : null,
    dia_semanal: Number(weeklyDay), incluir_semanales: weekly, incluir_medio: midterm, incluir_final: final, solo_previsualizar: preview,
  });
  if (error) throw new Error(readableError(error, "No se pudo generar el plan de evaluaciones."));
  return data;
}
