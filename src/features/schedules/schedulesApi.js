import { isSupabaseConfigured, supabase } from "../../lib/supabase";

function requireSupabase() { if (!isSupabaseConfigured || !supabase) throw new Error("Supabase no está configurado para gestionar horarios."); }
function readable(error, fallback) {
  const message = String(error?.message || error?.details || "");
  if (["PGRST202","PGRST205","42P01","42703"].includes(error?.code) || /does not exist|schema cache|could not find/i.test(message)) return "Falta ejecutar la migración 017 de horarios de clases.";
  if (error?.code === "42501") return "Tu cuenta no tiene permiso para gestionar horarios. Si eres Coordinación Académica, aplica la migración 027.";
  return message || fallback;
}
export async function loadSchedules() {
  requireSupabase();
  const [blocksResult, schedulesResult] = await Promise.all([
    supabase.from("bloques_horarios").select("id,turno_jornada_id,dia_semana,nombre,tipo,hora_inicio,hora_fin,activo").eq("activo",true).not("dia_semana","is",null).order("dia_semana").order("hora_inicio"),
    supabase.from("horarios_clases").select("id,seccion_id,bloque_horario_id,curso_seccion_id,dia_semana,activo").eq("activo",true),
  ]);
  if (blocksResult.error || schedulesResult.error) throw new Error(readable(blocksResult.error || schedulesResult.error,"No se pudo cargar el horario."));
  return {
    blocks:(blocksResult.data||[]).map((row)=>({id:row.id,shiftId:row.turno_jornada_id,day:row.dia_semana,name:row.nombre,type:row.tipo,startTime:String(row.hora_inicio).slice(0,5),endTime:String(row.hora_fin).slice(0,5)})),
    schedules:(schedulesResult.data||[]).map((row)=>({id:row.id,sectionId:row.seccion_id,blockId:row.bloque_horario_id,offeringId:row.curso_seccion_id,day:row.dia_semana})),
  };
}
export async function saveScheduleBlock(values){ requireSupabase(); const {data,error}=await supabase.rpc("guardar_bloque_horario",{bloque_id_solicitado:values.id||null,turno_id_solicitado:values.shiftId,dia_solicitado:values.day,nombre_solicitado:values.name,tipo_solicitado:values.type,hora_inicio_solicitada:values.startTime,hora_fin_solicitada:values.endTime}); if(error)throw new Error(readable(error,"No se pudo guardar el bloque.")); return data; }
export async function deleteScheduleBlock(id){ requireSupabase(); const {error}=await supabase.rpc("eliminar_bloque_horario",{bloque_id_solicitado:id}); if(error)throw new Error(readable(error,"No se pudo eliminar el bloque.")); }
export async function saveScheduledClass(values){ requireSupabase(); const {error}=await supabase.rpc("guardar_clase_horario",{seccion_id_solicitada:values.sectionId,bloque_id_solicitado:values.blockId,dia_solicitado:values.day,curso_id_solicitado:values.offeringId||null}); if(error)throw new Error(readable(error,"No se pudo guardar la clase.")); }
export function subscribeToSchedules(onChange){ if(!isSupabaseConfigured||!supabase)return()=>{}; const channel=supabase.channel(`schedules-${Date.now()}`); ["bloques_horarios","horarios_clases"].forEach((table)=>channel.on("postgres_changes",{event:"*",schema:"public",table},onChange)); channel.subscribe(); return()=>supabase.removeChannel(channel); }
