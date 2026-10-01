import { isSupabaseConfigured, supabase } from "../../lib/supabase";
import { readableAcademicError } from "../academic/academicApi";

export async function saveAcademicLoadEntry(values) {
  if (!isSupabaseConfigured || !supabase) throw new Error("Supabase no está configurado para guardar la carga académica.");

  const weeklyHours = values.scope === "course" ? Number(values.weeklyHours) : null;
  if (values.scope === "course" && (!Number.isInteger(weeklyHours) || weeklyHours < 1 || weeklyHours > 40)) {
    throw new Error("Las horas semanales deben ser un número entre 1 y 40.");
  }
  if (!values.startsOn || !values.endsOn || values.endsOn < values.startsOn) {
    throw new Error("Selecciona una vigencia válida para la asignación.");
  }

  const { data, error } = await supabase.rpc("guardar_carga_academica", {
    curso_seccion_id_solicitado: values.scope === "course" ? values.scopeId : null,
    seccion_id_solicitada: values.scope === "section" ? values.scopeId : null,
    horas_semanales_solicitadas: weeklyHours,
    docente_id_solicitado: values.teacherId || null,
    inicia_en_solicitado: values.startsOn,
    termina_en_solicitado: values.endsOn,
  });

  if (error) throw new Error(readableAcademicError(error, "No se pudo guardar la carga académica."));
  return data;
}
