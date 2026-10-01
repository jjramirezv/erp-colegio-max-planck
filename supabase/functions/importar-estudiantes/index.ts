import { createClient } from "npm:@supabase/supabase-js@2";
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { ...cors, "Content-Type": "application/json" } });
function key(kind: "publishable" | "secret") {
  const modern = Deno.env.get(kind === "secret" ? "SUPABASE_SECRET_KEYS" : "SUPABASE_PUBLISHABLE_KEYS");
  return modern ? JSON.parse(modern).default : Deno.env.get(kind === "secret" ? "SUPABASE_SERVICE_ROLE_KEY" : "SUPABASE_ANON_KEY");
}
const RELATIONS = ["madre", "padre", "apoderado", "otro"];
// Apoderado opcional de la fila: correo DNI@familias… y clave inicial = DNI. Varios hijos comparten la misma cuenta.
function guardianOf(row: any) {
  if (!row?.parentDni) return null;
  const dni = String(row.parentDni).trim(); const name = String(row.parentName || "").trim();
  const relation = RELATIONS.includes(row.parentRelation) ? row.parentRelation : "apoderado";
  if (!/^\d{8}$/.test(dni)) throw new Error("El DNI del apoderado debe tener 8 dígitos.");
  if (name.length < 3 || name.length > 160) throw new Error("Escribe el nombre completo del apoderado.");
  if (dni === String(row.dni).trim()) throw new Error("El DNI del apoderado no puede ser el del estudiante.");
  return { dni, name, relation, email: `${dni}@familias.maxplanck.edu.pe` };
}
async function linkGuardian(admin: any, actor: string, studentId: string, guardian: any, importId: string) {
  const { data: plan, error } = await admin.rpc("preparar_apoderado", { actor, dni: guardian.dni, correo: guardian.email });
  if (error) throw new Error(error.message);
  let userId = plan.userId; let created = false;
  if (!userId) {
    const { data, error: createError } = await admin.auth.admin.createUser({ email: guardian.email, password: guardian.dni, email_confirm: true, user_metadata: { nombre_completo: guardian.name }, app_metadata: { family_import_id: importId } });
    if (createError || !data.user) throw new Error(createError?.message || "No se pudo crear la cuenta del apoderado.");
    userId = data.user.id; created = true;
  }
  const { error: linkError } = await admin.rpc("vincular_apoderado", { actor, estudiante: studentId, apoderado: userId, nombre: guardian.name, dni: guardian.dni, parentesco: guardian.relation });
  if (linkError) throw new Error(linkError.message);
  return created;
}
// Guarda el resultado de cada fila y los totales del lote, sin contraseñas.
async function trace(admin: any, batchId: number, rows: any[], results: any[]) {
  const byRow = new Map(rows.map((row) => [row.row, row]));
  const records = results.map((result) => {
    const row = byRow.get(result.row) || {};
    return { importacion_id: batchId, fila: result.row, dni: String(row.dni || ""), nombre: String(row.name || ""), correo: String(row.email || "").toLowerCase(), salon: `${row.level || ""} · ${row.grade || ""} ${row.section || ""}`.trim(), estado: result.status, cuenta_nueva: Boolean(result.accountCreated), mensaje: String(result.message || ""), estudiante_id: result.userId || null, procesado_en: new Date().toISOString() };
  });
  try {
    await admin.from("importaciones_estudiantes_filas").upsert(records, { onConflict: "importacion_id,fila" });
    const { data } = await admin.from("importaciones_estudiantes_filas").select("estado,cuenta_nueva").eq("importacion_id", batchId);
    const all = data || [];
    await admin.from("importaciones_estudiantes").update({ cuentas_nuevas: all.filter((item) => item.estado === "done" && item.cuenta_nueva).length, cuentas_existentes: all.filter((item) => item.estado === "done" && !item.cuenta_nueva).length, errores: all.filter((item) => item.estado === "error").length, actualizado_en: new Date().toISOString() }).eq("id", batchId);
  } catch { /* El historial no debe impedir la matrícula ya confirmada. */ }
}
Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (request.method !== "POST") return json({ error: "Método no permitido." }, 405);
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const token = (request.headers.get("Authorization") || "").replace(/^Bearer /, "");
    const caller = createClient(url, key("publishable"), { auth: { persistSession: false } });
    const { data: auth, error: authError } = await caller.auth.getUser(token);
    if (authError || !auth.user) return json({ error: "Inicia sesión nuevamente." }, 401);
    const admin = createClient(url, key("secret"), { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: actor } = await admin.from("perfiles").select("rol,activo").eq("id", auth.user.id).single();
    if (!actor?.activo || !["direccion", "coordinador_academico"].includes(actor.rol)) return json({ error: "Solo Dirección o Coordinación Académica pueden importar estudiantes." }, 403);
    const text = await request.text();
    if (text.length > 150000) return json({ error: "El lote supera el tamaño permitido." }, 413);
    const { action, rows, yearId, batchId, file, sectionId, total, userIds } = JSON.parse(text);
    const importing = action === "importar";
    if (action === "iniciar") {
      if (!Number.isSafeInteger(Number(yearId)) || !Number.isSafeInteger(Number(total)) || Number(total) < 1 || Number(total) > 3000) return json({ error: "Lote inválido." }, 400);
      const { data, error } = await admin.from("importaciones_estudiantes").insert({ anio_academico_id: Number(yearId), seccion_id: sectionId ? Number(sectionId) : null, archivo: String(file || "estudiantes.csv").slice(0, 255), total: Number(total), realizado_por: auth.user.id }).select("id").single();
      if (error) throw error;
      return json({ batchId: data.id });
    }
    if (action === "accesos") {
      if (!Number.isSafeInteger(Number(yearId)) || Number(yearId) <= 0) return json({ error: "Selecciona un año lectivo." }, 400);
      const { data, error } = await admin.rpc("listar_accesos_estudiantes", { actor: auth.user.id, anio: Number(yearId) });
      if (error) throw error;
      return json({ students: data });
    }
    if (action === "regenerar") {
      if (!Array.isArray(userIds) || userIds.length < 1 || userIds.length > 50 || userIds.some((id) => typeof id !== "string" || !/^[0-9a-f-]{36}$/.test(id))) return json({ error: "Selecciona entre 1 y 50 estudiantes por lote." }, 400);
      const { data: profiles, error } = await admin.from("perfiles").select("id,rol,dni").in("id", userIds);
      if (error) throw error;
      const students = new Map((profiles || []).filter((profile) => profile.rol === "estudiante").map((profile) => [profile.id, profile.dni]));
      const credentials = [];
      for (const id of userIds) {
        // Solo cuentas de estudiante: los accesos del personal siguen en Usuarios.
        if (!students.has(id)) { credentials.push({ id, error: "No es una cuenta de estudiante." }); continue; }
        // La clave de un estudiante es su DNI.
        const password = students.get(id);
        if (!password) { credentials.push({ id, error: "El estudiante no tiene DNI registrado." }); continue; }
        const { data: updated, error: updateError } = await admin.auth.admin.updateUserById(id, { password });
        if (updateError || !updated.user) { credentials.push({ id, error: "No se pudo generar la clave. Reintenta." }); continue; }
        await admin.from("credenciales_estudiantes_eventos").insert({ estudiante_id: id, correo: updated.user.email, realizado_por: auth.user.id });
        credentials.push({ id, email: updated.user.email, password });
      }
      return json({ credentials });
    }
    if (!["validar", "importar"].includes(action) || !Number.isSafeInteger(Number(yearId)) || Number(yearId) <= 0 || !Array.isArray(rows) || rows.length < 1 || rows.length > (importing ? 10 : 50)) return json({ error: "Lote inválido." }, 400);
    const results = [];
    for (const row of rows) {
      let created = false;
      try {
        const fields = ["dni", "name", "email", "level", "grade", "section"];
        if (typeof row?.importId !== "string" || !/^[0-9a-f-]{36}$/.test(row.importId)) throw new Error("Identificador de importación inválido.");
        if (fields.some((field) => typeof row?.[field] !== "string" || row[field].length > 254)) throw new Error("Revisa los campos de la fila.");
        const clean = Object.fromEntries(fields.map((field) => [field, row[field].trim()]));
        clean.email = clean.email.toLowerCase();
        const args = { fila: clean, anio: Number(yearId), actor: auth.user.id };
        const { data: plan, error: planError } = await admin.rpc("preparar_fila_estudiante", args);
        if (planError) throw new Error(planError.message);
        let userId = plan.userId;
        if (!userId && (typeof row.password !== "string" || row.password.length < 8 || row.password.length > 72)) throw new Error("La contraseña nueva debe tener entre 8 y 72 caracteres.");
        if (!userId && /^[=+@\-\t\r]/.test(row.password)) throw new Error("La clave no puede comenzar con =, +, - o @.");
        const guardian = guardianOf(row);
        if (guardian) {
          const { error: guardianError } = await admin.rpc("preparar_apoderado", { actor: auth.user.id, dni: guardian.dni, correo: guardian.email });
          if (guardianError) throw new Error(guardianError.message);
        }
        if (!importing) { results.push({ row: row.row, status: "ready", existing: Boolean(userId), enrolled: plan.enrolled, sectionId: plan.sectionId }); continue; }
        if (!userId) {
          const { data, error } = await admin.auth.admin.createUser({ email: clean.email, password: row.password, email_confirm: true, user_metadata: { nombre_completo: clean.name }, app_metadata: { student_import_id: row.importId } });
          if (error || !data.user) throw new Error(error?.message || "No se pudo crear la cuenta.");
          userId = data.user.id; created = true;
        } else {
          // Recupera una respuesta perdida del mismo lote sin regenerar ni cambiar la clave.
          const { data, error } = await admin.auth.admin.getUserById(userId);
          if (error) throw new Error("No se pudo verificar la cuenta existente. Reintenta.");
          created = data.user?.app_metadata?.student_import_id === row.importId;
        }
        const { error: saveError } = await admin.rpc("confirmar_fila_estudiante", { ...args, usuario: userId });
        if (saveError) throw new Error(saveError.message);
        let message = plan.enrolled ? "Matrícula existente; nombre y DNI actualizados. Conserva su contraseña." : created ? "Cuenta y matrícula creadas." : "Matriculado; conserva su contraseña actual.";
        let parentCreated = false;
        if (guardian) {
          // Un fallo del apoderado no deshace la matrícula: se informa y basta con volver a cargar el archivo.
          try { parentCreated = await linkGuardian(admin, auth.user.id, userId, guardian, row.importId); message += parentCreated ? " Cuenta de familia creada." : " Vinculado a la cuenta de familia existente."; }
          catch (guardianError) { message += ` No se pudo vincular al apoderado: ${guardianError instanceof Error ? guardianError.message : "error de conexión"}. Vuelve a cargar el archivo para reintentar.`; }
        }
        results.push({ row: row.row, status: "done", accountCreated: created, parentCreated, parentEmail: guardian?.email, userId, message });
      } catch (error) {
        // No eliminar Auth tras un fallo de red: la transacción podría haberse confirmado.
        results.push({ row: row?.row, status: "error", accountCreated: created, message: `${created ? "Cuenta creada; matrícula pendiente. Reintenta esta fila. " : ""}${error instanceof Error ? error.message : "No se pudo procesar la fila."}` });
      }
    }
    if (importing && Number.isSafeInteger(Number(batchId)) && Number(batchId) > 0) await trace(admin, Number(batchId), rows, results);
    return json({ results });
  } catch { return json({ error: "No se pudo procesar el lote. Revisa la conexión y vuelve a intentarlo." }, 400); }
});
