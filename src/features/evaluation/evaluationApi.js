import { isSupabaseConfigured, supabase } from "../../lib/supabase";

function requireSupabase() {
  if (!isSupabaseConfigured || !supabase) throw new Error("Supabase no está configurado para gestionar la evaluación.");
}

function readableError(error, fallback) {
  if (!error) return fallback;
  const message = String(error.message || error.details || "");
  if (["PGRST202", "PGRST205", "42703"].includes(error.code) || /schema cache|could not find|does not exist/i.test(message)) return "Falta ejecutar la migración 014 de configuración de evaluación en Supabase.";
  if (error.code === "42501" || /permission denied|row-level security/i.test(message)) return "Tu cuenta no tiene permiso para configurar la evaluación.";
  if (["22023", "23505", "23514"].includes(error.code)) return message || "Revisa la escala y las reglas de evaluación.";
  return message || fallback;
}

function mapConfiguration(row) {
  return {
    id: row.id,
    yearId: row.anio_academico_id,
    levelId: row.nivel_educativo_id,
    scaleType: row.tipo_escala,
    finalCalculation: row.calculo_final,
    minimum: row.valor_minimo,
    maximum: row.valor_maximo,
    passing: row.valor_aprobatorio,
    decimals: row.decimales,
    achievementLevels: (row.niveles_logro_evaluacion || []).sort((a, b) => a.orden - b.orden).map((level) => ({
      id: level.id,
      order: level.orden,
      code: level.codigo,
      name: level.nombre,
      satisfactory: level.satisfactorio,
    })),
    updatedAt: row.actualizado_en,
  };
}

export async function loadEvaluationConfigurations() {
  requireSupabase();
  const { data, error } = await supabase
    .from("configuraciones_evaluacion")
    .select("id,anio_academico_id,nivel_educativo_id,tipo_escala,calculo_final,valor_minimo,valor_maximo,valor_aprobatorio,decimales,actualizado_en,niveles_logro_evaluacion(id,orden,codigo,nombre,satisfactorio)")
    .order("anio_academico_id", { ascending: false });
  if (error) throw new Error(readableError(error, "No se pudo cargar la configuración de evaluación."));
  return (data || []).map(mapConfiguration);
}

export async function saveEvaluationConfiguration(values) {
  requireSupabase();
  const { data, error } = await supabase.rpc("guardar_configuracion_evaluacion", {
    anio_academico_id_solicitado: Number(values.yearId),
    nivel_educativo_id_solicitado: Number(values.levelId),
    tipo_escala_solicitado: values.scaleType,
    calculo_final_solicitado: values.finalCalculation,
    valor_minimo_solicitado: values.scaleType === "numerica" ? Number(values.minimum) : null,
    valor_maximo_solicitado: values.scaleType === "numerica" ? Number(values.maximum) : null,
    valor_aprobatorio_solicitado: values.scaleType === "numerica" ? Number(values.passing) : null,
    decimales_solicitados: values.scaleType === "numerica" ? Number(values.decimals) : null,
    niveles_logro_solicitados: values.scaleType === "cualitativa" ? values.achievementLevels.map((level) => ({ codigo: level.code, nombre: level.name, satisfactorio: level.satisfactory })) : [],
  });
  if (error) throw new Error(readableError(error, "No se pudo guardar la configuración de evaluación."));
  return data;
}

export function subscribeToEvaluationConfigurations(onChange) {
  if (!isSupabaseConfigured || !supabase) return () => {};
  const channel = supabase
    .channel(`evaluation-config-${Date.now()}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "configuraciones_evaluacion" }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "niveles_logro_evaluacion" }, onChange)
    .subscribe();
  return () => { supabase.removeChannel(channel); };
}
