import { isSupabaseConfigured, supabase } from "../../lib/supabase";

function requireSupabase() {
  if (!isSupabaseConfigured || !supabase) throw new Error("Supabase no está configurado para gestionar documentos y correlativos.");
}

function readableError(error, fallback) {
  if (!error) return fallback;
  const message = String(error.message || error.details || "");
  if (["PGRST202", "PGRST205", "42703", "42P01"].includes(error.code) || /schema cache|could not find|does not exist/i.test(message)) return "Falta ejecutar la migración 021 de documentos y correlativos en Supabase.";
  if (error.code === "42501" || /permission denied|row-level security/i.test(message)) return "Tu cuenta no tiene permiso para configurar documentos.";
  if (["22023", "23503", "23505", "23514"].includes(error.code)) return message || fallback;
  return message || fallback;
}

const mapDocument = (row) => ({ id: row.id, name: row.nombre, series: row.serie, nextNumber: Number(row.siguiente_numero), digits: Number(row.longitud_numero), active: row.activo, updatedAt: row.actualizado_en });

export async function loadInstitutionalDocuments() {
  requireSupabase();
  const { data, error } = await supabase.from("documentos_institucionales").select("id,nombre,serie,siguiente_numero,longitud_numero,activo,actualizado_en").order("nombre");
  if (error) throw new Error(readableError(error, "No se pudieron cargar los documentos institucionales."));
  return (data || []).map(mapDocument);
}

export async function saveInstitutionalDocument(values) {
  requireSupabase();
  const { data, error } = await supabase.rpc("guardar_documento_institucional", {
    documento_id_solicitado: values.id || null,
    nombre_solicitado: values.name,
    serie_solicitada: values.series,
    siguiente_numero_solicitado: values.nextNumber,
    longitud_numero_solicitada: values.digits,
    activo_solicitado: values.active,
  });
  if (error) throw new Error(readableError(error, "No se pudo guardar el documento."));
  return data;
}

export async function deleteInstitutionalDocument(id) {
  requireSupabase();
  const { error } = await supabase.rpc("eliminar_documento_institucional", { documento_id_solicitado: id });
  if (error) throw new Error(readableError(error, "No se pudo eliminar el documento."));
}

export function subscribeToInstitutionalDocuments(onChange) {
  if (!isSupabaseConfigured || !supabase) return () => {};
  const channel = supabase.channel(`institutional-documents-${Date.now()}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "documentos_institucionales" }, onChange)
    .subscribe();
  return () => { supabase.removeChannel(channel); };
}
