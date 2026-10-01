import { supabase } from "../../lib/supabase";
export async function loadImportCatalog() {
  if (!supabase) throw new Error("Inicia sesión con tu cuenta institucional.");
  const { data, error } = await supabase.rpc("catalogo_importacion_estudiantes");
  if (error) throw new Error("No se pudo cargar la estructura académica. Verifica la conexión y la migración de importación.");
  return data;
}
export async function processBatch(action, yearId, rows, batchId) {
  const { data, error } = await supabase.functions.invoke("importar-estudiantes", { body: { action, yearId, batchId, rows: rows.map(({ row, importId, dni, name, email, password, level, grade, section, parentDni, parentName, parentRelation }) => ({ row, importId, dni, name, email, password, level, grade, section, ...(parentDni ? { parentDni, parentName, parentRelation } : {}) })) } });
  if (error) {
    let message = "No se pudo procesar el lote. Reintenta; las filas ya matriculadas no se duplicarán.";
    try { message = (await error.context.json()).error || message; } catch { /* error de transporte */ }
    throw new Error(message);
  }
  if (!Array.isArray(data?.results) || data.results.length !== rows.length || rows.some((row) => !data.results.some((result) => result.row === row.row))) throw new Error("Respuesta incompleta. Revisa y reintenta el lote.");
  return data.results;
}
async function invoke(body, fallback) {
  if (!supabase) throw new Error("Inicia sesión con tu cuenta institucional.");
  const { data, error } = await supabase.functions.invoke("importar-estudiantes", { body });
  if (error) {
    let message = fallback;
    try { message = (await error.context.json()).error || message; } catch { /* error de transporte */ }
    throw new Error(message);
  }
  return data;
}
export async function startImport({ yearId, sectionId, file, total }) {
  return (await invoke({ action: "iniciar", yearId, sectionId, file, total }, "No se pudo registrar la carga. Verifica que la migración de accesos esté aplicada.")).batchId;
}
export async function loadStudentAccess(yearId) {
  return (await invoke({ action: "accesos", yearId }, "No se pudo cargar la lista de estudiantes.")).students || [];
}
export async function regenerateCredentials(userIds) {
  return (await invoke({ action: "regenerar", userIds }, "No se pudieron generar las claves. Reintenta.")).credentials || [];
}
export async function loadImportHistory() {
  const { data, error } = await supabase.from("importaciones_estudiantes").select("id,archivo,total,cuentas_nuevas,cuentas_existentes,errores,creado_en,actualizado_en,anio:anios_academicos(nombre),autor:perfiles(nombre_completo)").order("creado_en", { ascending: false }).limit(100);
  if (error) throw new Error("No se pudo cargar el historial de cargas.");
  return data;
}
export async function loadImportRows(batchId) {
  const { data, error } = await supabase.from("importaciones_estudiantes_filas").select("fila,dni,nombre,correo,salon,estado,cuenta_nueva,mensaje,procesado_en").eq("importacion_id", batchId).order("fila");
  if (error) throw new Error("No se pudo cargar el detalle de la carga.");
  return data;
}
