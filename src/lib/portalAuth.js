import { isSupabaseConfigured, supabase } from "./supabase";

function toPortalUser(authUser, profile) {
  if (!authUser || !profile?.activo) return null;

  return {
    id: authUser.id,
    name: profile.nombre_completo,
    email: authUser.email,
    role: profile.rol,
    status: "Activo",
    authSource: "supabase",
  };
}

async function loadProfile(authUser) {
  if (!authUser) return null;

  const { data, error } = await supabase
    .from("perfiles")
    .select("id, nombre_completo, rol, activo")
    .eq("id", authUser.id)
    .single();

  if (error) {
    if (error.code === "PGRST205" || error.code === "42P01") {
      throw new Error("El acceso del ERP aún no está habilitado en Supabase. Ejecuta primero el esquema y la migración.");
    }
    if (error.code === "PGRST116") {
      throw new Error("Tu cuenta existe, pero todavía no tiene un perfil habilitado en el ERP.");
    }
    throw error;
  }

  if (!data.activo) throw new Error("Tu acceso al ERP está inactivo.");
  return toPortalUser(authUser, data);
}

export async function getCurrentPortalUser() {
  if (!isSupabaseConfigured) return null;
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return loadProfile(data.session?.user);
}

export async function signInPortal(email, password) {
  if (!isSupabaseConfigured) throw new Error("Supabase todavía no está configurado en este portal.");

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error("Credenciales incorrectas o cuenta inactiva.");

  try {
    return await loadProfile(data.user);
  } catch (profileError) {
    await supabase.auth.signOut();
    throw profileError;
  }
}

export async function signOutPortal() {
  if (isSupabaseConfigured) await supabase.auth.signOut();
}

// Envía el correo de recuperación; el enlace vuelve a esta misma dirección del portal.
export async function requestPasswordReset(email) {
  if (!isSupabaseConfigured) throw new Error("Supabase todavía no está configurado en este portal.");
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}${window.location.pathname}` });
  if (error) throw new Error(/rate|seconds/i.test(error.message) ? "Espera un minuto antes de pedir otro correo." : "No se pudo enviar el correo de recuperación.");
}

export async function updatePortalPassword(password) {
  const { error } = await supabase.auth.updateUser({ password });
  if (error) throw new Error(/expired|invalid|session/i.test(error.message) ? "El enlace venció. Pide un nuevo correo de recuperación." : /different|same/i.test(error.message) ? "La nueva contraseña debe ser distinta a la anterior." : "No se pudo guardar la contraseña.");
  await supabase.auth.signOut();
}
