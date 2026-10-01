import { isSupabaseConfigured, supabase } from "../../lib/supabase";

function requireSupabase() {
  if (!isSupabaseConfigured || !supabase) throw new Error("Supabase no está configurado para gestionar los periodos académicos.");
}

function readableError(error, fallback) {
  if (!error) return fallback;
  const message = String(error.message || error.details || "");
  if (["PGRST202", "PGRST205", "42703"].includes(error.code) || /schema cache|could not find|does not exist/i.test(message)) return "Falta ejecutar la migración 013 de periodos académicos en Supabase.";
  if (error.code === "42501" || /permission denied|row-level security/i.test(message)) return "Tu cuenta no tiene permiso para gestionar los periodos académicos.";
  if (["22023", "23505", "23514"].includes(error.code)) return message || "Revisa los nombres y fechas de los periodos.";
  return message || fallback;
}

const mapPeriod = (row) => ({
  id: row.id,
  yearId: row.anio_academico_id,
  number: row.numero,
  name: row.nombre,
  startsOn: row.inicia_en,
  endsOn: row.termina_en,
  updatedAt: row.actualizado_en,
});

export async function loadAcademicPeriods() {
  requireSupabase();
  const { data, error } = await supabase
    .from("periodos_academicos")
    .select("id,anio_academico_id,numero,nombre,inicia_en,termina_en,actualizado_en")
    .order("anio_academico_id", { ascending: false })
    .order("numero", { ascending: true });
  if (error) throw new Error(readableError(error, "No se pudieron cargar los periodos académicos."));
  return (data || []).map(mapPeriod);
}

export async function saveAcademicPeriods(yearId, periods) {
  requireSupabase();
  const { error } = await supabase.rpc("guardar_periodos_academicos", {
    anio_academico_id_solicitado: Number(yearId),
    periodos_solicitados: periods.map((period) => ({ nombre: period.name, inicia_en: period.startsOn, termina_en: period.endsOn })),
  });
  if (error) throw new Error(readableError(error, "No se pudieron guardar los periodos académicos."));
}

export function subscribeToAcademicPeriods(onChange) {
  if (!isSupabaseConfigured || !supabase) return () => {};
  const channel = supabase.channel(`academic-periods-${Date.now()}`).on("postgres_changes", { event: "*", schema: "public", table: "periodos_academicos" }, onChange).subscribe();
  return () => { supabase.removeChannel(channel); };
}
