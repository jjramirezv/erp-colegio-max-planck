import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const rolesPermitidos = new Set(["direccion", "coordinador_academico", "administrativo", "docente", "estudiante", "familia"]);

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

function keyFromEnvironment(kind: "publishable" | "secret") {
  const modernName = kind === "publishable" ? "SUPABASE_PUBLISHABLE_KEYS" : "SUPABASE_SECRET_KEYS";
  const modern = Deno.env.get(modernName);
  if (modern) return JSON.parse(modern).default;
  return Deno.env.get(kind === "publishable" ? "SUPABASE_ANON_KEY" : "SUPABASE_SERVICE_ROLE_KEY");
}

function cleanText(value: unknown) { return String(value || "").trim(); }
function validEmail(value: string) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value); }

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "Método no permitido." }, 405);

  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const publishableKey = keyFromEnvironment("publishable");
    const secretKey = keyFromEnvironment("secret");
    const authorization = request.headers.get("Authorization") || "";
    if (!url || !publishableKey || !secretKey || !authorization.startsWith("Bearer ")) return json({ error: "No se pudo validar la sesión administrativa." }, 401);

    const callerClient = createClient(url, publishableKey, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false } });
    const adminClient = createClient(url, secretKey, { auth: { autoRefreshToken: false, persistSession: false } });
    const token = authorization.replace("Bearer ", "");
    const { data: authData, error: authError } = await callerClient.auth.getUser(token);
    if (authError || !authData.user) return json({ error: "La sesión expiró. Vuelve a ingresar." }, 401);

    const actorId = authData.user.id;
    const { data: actor } = await adminClient.from("perfiles").select("rol,activo").eq("id", actorId).single();
    if (!actor?.activo || actor.rol !== "direccion") return json({ error: "Solo Alta Dirección puede gestionar credenciales." }, 403);

    const body = await request.json();
    const action = cleanText(body.action);

    if (action === "listar") {
      async function loadAllAuthUsers() {
        const collected = []; const perPage = 1000;
        for (let page = 1; ; page += 1) {
          const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage });
          if (error) throw error;
          collected.push(...(data.users || []));
          if ((data.users || []).length < perPage) return collected;
        }
      }
      async function loadAllProfiles() {
        const collected = []; const pageSize = 1000;
        for (let start = 0; ; start += pageSize) {
          const { data, error } = await adminClient.from("perfiles").select("id,nombre_completo,rol,activo,creado_en,actualizado_en").range(start, start + pageSize - 1);
          if (error) throw error;
          collected.push(...(data || []));
          if ((data || []).length < pageSize) return collected;
        }
      }
      const [authUsers, profiles] = await Promise.all([loadAllAuthUsers(), loadAllProfiles()]);
      const authMap = new Map(authUsers.map((user) => [user.id, user]));
      // Los estudiantes se gestionan en Accesos de estudiantes, no junto al personal.
      const users = profiles.filter((profile) => profile.rol !== "estudiante").map((profile) => {
        const authUser = authMap.get(profile.id);
        return { id: profile.id, name: profile.nombre_completo, email: authUser?.email || "", role: profile.rol, active: profile.activo, createdAt: profile.creado_en, updatedAt: profile.actualizado_en, lastSignInAt: authUser?.last_sign_in_at || null };
      }).sort((a, b) => a.name.localeCompare(b.name, "es"));
      return json({ users });
    }

    if (action === "crear") {
      const name = cleanText(body.name); const email = cleanText(body.email).toLowerCase(); const password = String(body.password || ""); const role = cleanText(body.role);
      if (name.length < 3) return json({ error: "Escribe el nombre completo." }, 400);
      if (!validEmail(email)) return json({ error: "Escribe un correo válido." }, 400);
      if (password.length < 10) return json({ error: "La contraseña temporal debe tener al menos 10 caracteres." }, 400);
      if (!rolesPermitidos.has(role)) return json({ error: "Selecciona un rol válido." }, 400);
      const { data: created, error: createError } = await adminClient.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { nombre_completo: name } });
      if (createError || !created.user) return json({ error: createError?.message || "No se pudo crear la credencial." }, 400);
      const { error: profileError } = await adminClient.from("perfiles").insert({ id: created.user.id, nombre_completo: name, rol: role, activo: true });
      if (profileError) { await adminClient.auth.admin.deleteUser(created.user.id); throw profileError; }
      await adminClient.from("auditoria_usuarios").insert({ accion: "crear", usuario_objetivo_id: created.user.id, usuario_objetivo_correo: email, realizado_por: actorId, detalle: { rol: role } });
      return json({ ok: true, id: created.user.id });
    }

    const userId = cleanText(body.userId);
    if (!userId) return json({ error: "No se recibió el usuario." }, 400);
    if (userId === actorId && (action === "eliminar" || body.active === false || (body.role && body.role !== "direccion"))) return json({ error: "No puedes eliminar, desactivar ni cambiar el rol de tu propia cuenta." }, 400);

    if (action === "actualizar") {
      const name = cleanText(body.name); const email = cleanText(body.email).toLowerCase(); const password = String(body.password || ""); const role = cleanText(body.role); const active = body.active !== false;
      if (name.length < 3 || !validEmail(email) || !rolesPermitidos.has(role)) return json({ error: "Revisa el nombre, correo y rol." }, 400);
      if (password && password.length < 10) return json({ error: "La nueva contraseña debe tener al menos 10 caracteres." }, 400);
      const authChanges: Record<string, unknown> = { email, email_confirm: true, user_metadata: { nombre_completo: name } };
      if (password) authChanges.password = password;
      const { error: updateAuthError } = await adminClient.auth.admin.updateUserById(userId, authChanges);
      if (updateAuthError) return json({ error: updateAuthError.message }, 400);
      const { error: updateProfileError } = await adminClient.from("perfiles").update({ nombre_completo: name, rol: role, activo: active }).eq("id", userId);
      if (updateProfileError) throw updateProfileError;
      await adminClient.from("auditoria_usuarios").insert({ accion: "actualizar", usuario_objetivo_id: userId, usuario_objetivo_correo: email, realizado_por: actorId, detalle: { rol: role, activo: active, clave_actualizada: Boolean(password) } });
      return json({ ok: true });
    }

    if (action === "eliminar") {
      const email = cleanText(body.email);
      await adminClient.from("auditoria_usuarios").insert({ accion: "eliminar", usuario_objetivo_id: userId, usuario_objetivo_correo: email, realizado_por: actorId });
      const { error: deleteError } = await adminClient.auth.admin.deleteUser(userId);
      if (deleteError) return json({ error: deleteError.message }, 400);
      return json({ ok: true });
    }

    return json({ error: "Acción no reconocida." }, 400);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Ocurrió un error al gestionar la cuenta." }, 500);
  }
});
