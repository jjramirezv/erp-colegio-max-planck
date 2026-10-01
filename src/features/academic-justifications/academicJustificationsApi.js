import { isSupabaseConfigured, supabase } from "../../lib/supabase";
import { loadAttendanceWorkspace } from "../academic-attendance/academicAttendanceApi";

const BUCKET = "attendance-justifications";

function requireSupabase() { if (!isSupabaseConfigured || !supabase) throw new Error("Supabase no está configurado para gestionar justificaciones."); }
function readableError(error, fallback) { const message = String(error?.message || error?.details || ""); if (["PGRST202", "PGRST205", "42703", "42P01"].includes(error?.code) || /schema cache|could not find|does not exist/i.test(message)) return "Falta aplicar la migración 029 de justificaciones."; if (error?.code === "42501" || /permission denied|row-level security/i.test(message)) return "Tu cuenta no tiene permiso para gestionar justificaciones."; if (["22023", "23505", "23514"].includes(error?.code)) return message || "Revisa los datos de la justificación."; return message || fallback; }

export const loadJustificationsWorkspace = loadAttendanceWorkspace;

export async function loadJustificationCases(enrollmentIds, from, to) {
  requireSupabase();
  if (!enrollmentIds.length || !from || !to) return [];
  const attendanceResult = await supabase.from("asistencias_estudiantes").select("id,matricula_id,fecha,estado,minutos_tardanza,observacion,actualizado_en").in("matricula_id", enrollmentIds).in("estado", ["tardanza", "ausente"]).gte("fecha", from).lte("fecha", to).order("fecha", { ascending: false });
  if (attendanceResult.error) throw new Error(readableError(attendanceResult.error, "No se pudieron cargar las incidencias."));
  const attendance = attendanceResult.data || [];
  if (!attendance.length) return [];
  const justificationResult = await supabase.from("justificaciones_asistencia").select("id,asistencia_id,motivo,detalle,archivo_ruta,archivo_nombre,archivo_mime,archivo_tamano,estado,observacion_revision,presentado_en,revisado_en").in("asistencia_id", attendance.map((item) => item.id));
  if (justificationResult.error) throw new Error(readableError(justificationResult.error, "No se pudieron cargar las justificaciones."));
  const justificationMap = new Map((justificationResult.data || []).map((item) => [String(item.asistencia_id), item]));
  return attendance.map((item) => { const justification = justificationMap.get(String(item.id)); return { id: item.id, enrollmentId: item.matricula_id, date: item.fecha, attendanceStatus: item.estado, lateMinutes: item.minutos_tardanza, attendanceNote: item.observacion || "", justification: justification ? { id: justification.id, reason: justification.motivo, detail: justification.detalle || "", filePath: justification.archivo_ruta, fileName: justification.archivo_nombre, fileMime: justification.archivo_mime, fileSize: justification.archivo_tamano, status: justification.estado, reviewNote: justification.observacion_revision || "", submittedAt: justification.presentado_en, reviewedAt: justification.revisado_en } : null }; });
}

function validateFile(file) { if (!file) return; if (!["application/pdf", "image/jpeg", "image/png"].includes(file.type)) throw new Error("Adjunta un archivo PDF, JPG o PNG."); if (file.size > 8 * 1024 * 1024) throw new Error("El sustento no puede superar 8 MB."); }
function safeName(name) { return String(name).normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-").slice(-100); }

export async function saveJustification({ attendanceId, reason, detail, file, existingPath }) {
  requireSupabase(); validateFile(file);
  let uploadedPath = null;
  try {
    if (file) { uploadedPath = `${attendanceId}/${crypto.randomUUID()}-${safeName(file.name)}`; const uploaded = await supabase.storage.from(BUCKET).upload(uploadedPath, file, { contentType: file.type, upsert: false }); if (uploaded.error) throw uploaded.error; }
    const { data, error } = await supabase.rpc("guardar_justificacion_asistencia", { asistencia_id_solicitada: attendanceId, motivo_solicitado: reason, detalle_solicitado: detail || null, archivo_ruta_solicitada: uploadedPath, archivo_nombre_solicitado: file?.name || null, archivo_mime_solicitado: file?.type || null, archivo_tamano_solicitado: file?.size || null });
    if (error) throw error;
    if (uploadedPath && existingPath && existingPath !== uploadedPath) await supabase.storage.from(BUCKET).remove([existingPath]);
    return data;
  } catch (error) { if (uploadedPath) await supabase.storage.from(BUCKET).remove([uploadedPath]); throw new Error(readableError(error, "No se pudo registrar la justificación.")); }
}

export async function resolveJustification({ id, decision, reviewNote }) { requireSupabase(); const { error } = await supabase.rpc("resolver_justificacion_asistencia", { justificacion_id_solicitada: id, decision_solicitada: decision, observacion_solicitada: reviewNote || null }); if (error) throw new Error(readableError(error, "No se pudo resolver la justificación.")); }
export async function createJustificationPreview(path) { requireSupabase(); const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 300); if (error) throw new Error(readableError(error, "No se pudo abrir el sustento.")); return data.signedUrl; }

export function subscribeToJustifications(onChange) { if (!isSupabaseConfigured || !supabase) return () => {}; const channel = supabase.channel(`academic-justifications-${Date.now()}`); ["justificaciones_asistencia", "asistencias_estudiantes", "matriculas_estudiantes"].forEach((table) => channel.on("postgres_changes", { event: "*", schema: "public", table }, onChange)); channel.subscribe(); return () => { supabase.removeChannel(channel); }; }
