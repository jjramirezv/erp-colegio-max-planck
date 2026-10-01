import { isSupabaseConfigured, supabase } from "../../lib/supabase";

function requireSupabase() {
  if (!isSupabaseConfigured || !supabase) throw new Error("Supabase no está configurado para gestionar grados y secciones.");
}

function readableError(error, fallback) {
  if (!error) return fallback;
  const message = String(error.message || error.details || "");
  if (["PGRST202", "PGRST205", "42703"].includes(error.code) || /schema cache|could not find|does not exist/i.test(message)) return "Falta ejecutar la migración 008 de gestión de grados y secciones en Supabase.";
  if (error.code === "42501" || /permission denied|row-level security/i.test(message)) return "Tu cuenta no tiene permiso para gestionar grados y secciones.";
  if (error.code === "23505" && /grados_nivel_id_nombre_key|grado.*nivel|mismo nivel/i.test(`${message} ${error.details || ""}`)) return "Ese grado ya está registrado en el nivel seleccionado. Puedes editar el registro existente o escribir otro grado.";
  if (error.code === "23505") return "Ya existe un salón con ese nombre para el grado y año lectivo seleccionados.";
  if (error.code === "23503") return message || "No se puede eliminar porque el registro tiene información relacionada.";
  if (["22023", "23514"].includes(error.code)) return message || "Revisa los datos ingresados.";
  return message || fallback;
}

const mapGrade = (row) => ({ id: row.id, levelId: row.nivel_id, name: row.nombre, order: row.orden, active: row.activo, updatedAt: row.actualizado_en });
const mapSection = (row) => ({ id: row.id, yearId: row.anio_academico_id, gradeId: row.grado_id, name: row.nombre, shiftId: row.turno_jornada_id, shift: row.turno, capacity: row.capacidad, active: row.activo, updatedAt: row.actualizado_en });

export async function loadGradesAndSections() {
  requireSupabase();
  const [gradesResult, sectionsResult] = await Promise.all([
    supabase.from("grados").select("id,nivel_id,nombre,orden,activo,actualizado_en").order("orden").order("nombre"),
    supabase.from("secciones").select("id,anio_academico_id,grado_id,nombre,turno_jornada_id,turno,capacidad,activo,actualizado_en").order("nombre"),
  ]);
  if (gradesResult.error) throw new Error(readableError(gradesResult.error, "No se pudieron cargar los grados."));
  if (sectionsResult.error) throw new Error(readableError(sectionsResult.error, "No se pudieron cargar las secciones."));
  return { grades: (gradesResult.data || []).map(mapGrade), sections: (sectionsResult.data || []).map(mapSection) };
}

export async function saveGradeWithClassrooms(values) {
  requireSupabase();
  const { error } = await supabase.rpc("guardar_grado_con_salones", {
    grado_id_solicitado: values.id || null,
    nivel_id_solicitado: values.levelId,
    nombre_solicitado: values.name,
    orden_solicitado: null,
    activo_solicitado: values.active,
    anio_academico_id_solicitado: values.yearId,
    salones_solicitados: values.classrooms.map((classroom) => ({
      id: classroom.id || null,
      name: classroom.name,
      shiftId: classroom.shiftId,
      capacity: classroom.capacity,
    })),
  });
  if (error) throw new Error(readableError(error, "No se pudo guardar el grado y sus salones."));
}

export async function deleteCompleteGrade(id) {
  requireSupabase();
  const { error } = await supabase.rpc("eliminar_grado_completo", { grado_id_solicitado: id });
  if (error) throw new Error(readableError(error, "No se pudo eliminar el grado."));
}

export function subscribeToGradesAndSections(onChange) {
  if (!isSupabaseConfigured || !supabase) return () => {};
  const channel = supabase.channel(`grades-sections-${Date.now()}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "grados" }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "secciones" }, onChange)
    .subscribe();
  return () => { supabase.removeChannel(channel); };
}
