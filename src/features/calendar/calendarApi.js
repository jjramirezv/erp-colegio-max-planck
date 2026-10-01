import { isSupabaseConfigured, supabase } from "../../lib/supabase";

const LIMA_OFFSET = "-05:00";

function requireSupabase() {
  if (!isSupabaseConfigured || !supabase) throw new Error("Supabase no está configurado para el calendario.");
}

function readableError(error, fallback) {
  if (!error) return fallback;
  if (error.code === "PGRST205" || /schema cache|could not find the table/i.test(error.message || "")) {
    return "Falta aplicar la migración del calendario académico en Supabase.";
  }
  if (error.code === "42501" || /permission denied|row-level security/i.test(error.message || "")) {
    return "Tu cuenta no tiene permiso para realizar esta acción en el calendario.";
  }
  if (error.code === "23505") return "La actividad ya tiene ese destinatario configurado.";
  if (error.code === "23514") return "Revisa las fechas y los datos de la actividad.";
  return error.message || fallback;
}

function toIso(date, time, endOfDay = false) {
  return `${date}T${endOfDay ? "23:59:59" : `${time || "00:00"}:00`}${LIMA_OFFSET}`;
}

function mapActivity(item) {
  const targets = item.destinatarios_actividad || [];
  return {
    id: item.id,
    title: item.titulo,
    description: item.descripcion || "",
    type: item.tipo,
    status: item.estado,
    startsAt: item.inicia_en,
    endsAt: item.termina_en,
    allDay: item.todo_el_dia,
    location: item.lugar || "",
    responsible: item.responsable_nombre || "",
    audienceRoles: targets.filter((target) => target.tipo_destinatario === "rol").map((target) => target.rol),
    audienceAll: targets.some((target) => target.tipo_destinatario === "todos"),
  };
}

export async function loadCalendarActivities({ startsAt, endsAt }) {
  requireSupabase();
  const { data, error } = await supabase
    .from("actividades_calendario")
    .select("id,titulo,descripcion,tipo,estado,inicia_en,termina_en,todo_el_dia,lugar,responsable_nombre,destinatarios_actividad(tipo_destinatario,rol)")
    .lt("inicia_en", endsAt)
    .gt("termina_en", startsAt)
    .neq("estado", "cancelled")
    .order("inicia_en", { ascending: true });

  if (error) throw new Error(readableError(error, "No se pudieron cargar las actividades."));
  return (data || []).map(mapActivity);
}

export async function saveCalendarActivity(values) {
  requireSupabase();
  const startsAt = values.allDay ? toIso(values.startDate, "00:00") : toIso(values.startDate, values.startTime);
  const endsAt = values.allDay ? toIso(values.endDate, "23:59", true) : toIso(values.endDate, values.endTime);
  const { data, error } = await supabase.rpc("guardar_actividad_calendario", {
    actividad_id_solicitada: values.id || null,
    titulo_solicitado: values.title,
    descripcion_solicitada: values.description || "",
    tipo_solicitado: values.type,
    estado_solicitado: values.status,
    inicia_en_solicitado: startsAt,
    termina_en_solicitado: endsAt,
    todo_el_dia_solicitado: values.allDay,
    lugar_solicitado: values.location || "",
    responsable_solicitado: values.responsible || "",
    roles_destinatarios_solicitados: values.audienceRoles || [],
  });
  if (error) throw new Error(readableError(error, "No se pudo guardar la actividad."));
  return data;
}

export async function cancelCalendarActivity(id) {
  requireSupabase();
  const { error } = await supabase.rpc("cancelar_actividad_calendario", { actividad_id_solicitada: id });
  if (error) throw new Error(readableError(error, "No se pudo cancelar la actividad."));
}

export function subscribeToCalendar(onChange) {
  if (!isSupabaseConfigured || !supabase) return () => {};
  const channel = supabase
    .channel(`academic-calendar-${Date.now()}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "actividades_calendario" }, onChange)
    .subscribe();
  return () => { supabase.removeChannel(channel); };
}
