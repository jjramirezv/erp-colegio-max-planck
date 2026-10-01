import { isSupabaseConfigured, supabase } from "../../lib/supabase";

const CACHE_KEY = "mp-general-settings-v1";
export const DEFAULT_GENERAL_SETTINGS = Object.freeze({ sessionTimeoutMinutes: 30, pageSize: 10, maxFileSizeMb: 100, updatedAt: "" });

function requireSupabase() {
  if (!isSupabaseConfigured || !supabase) throw new Error("Supabase no está configurado para gestionar los parámetros generales.");
}

function readableError(error, fallback) {
  const message = String(error?.message || error?.details || "");
  if (["PGRST202", "PGRST205", "42703", "42P01"].includes(error?.code) || /schema cache|could not find|does not exist/i.test(message)) return "Falta ejecutar la migración 022 de parámetros generales en Supabase.";
  if (error?.code === "42501" || /permission denied|row-level security/i.test(message)) return "Tu cuenta no tiene permiso para modificar los parámetros generales.";
  return message || fallback;
}

function mapSettings(row) {
  return row ? {
    sessionTimeoutMinutes: Number(row.minutos_inactividad) || DEFAULT_GENERAL_SETTINGS.sessionTimeoutMinutes,
    pageSize: Number(row.registros_por_pagina) || DEFAULT_GENERAL_SETTINGS.pageSize,
    maxFileSizeMb: Number(row.limite_archivo_mb) || DEFAULT_GENERAL_SETTINGS.maxFileSizeMb,
    updatedAt: row.actualizado_en || "",
  } : { ...DEFAULT_GENERAL_SETTINGS };
}

function cacheSettings(settings) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(settings)); } catch { /* almacenamiento no disponible */ }
  globalThis.window?.dispatchEvent(new CustomEvent("mp-general-settings-updated", { detail: settings }));
  return settings;
}

export function getCachedGeneralSettings() {
  try { return { ...DEFAULT_GENERAL_SETTINGS, ...JSON.parse(localStorage.getItem(CACHE_KEY) || "{}") }; }
  catch { return { ...DEFAULT_GENERAL_SETTINGS }; }
}

export async function loadGeneralSettings() {
  requireSupabase();
  const { data, error } = await supabase.rpc("obtener_parametros_generales");
  if (error) throw new Error(readableError(error, "No se pudieron cargar los parámetros generales."));
  return cacheSettings(mapSettings(data?.[0]));
}

export async function saveGeneralSettings(values) {
  requireSupabase();
  const { data, error } = await supabase.rpc("guardar_parametros_generales", {
    minutos_inactividad_solicitados: values.sessionTimeoutMinutes,
    registros_por_pagina_solicitados: values.pageSize,
    limite_archivo_mb_solicitado: values.maxFileSizeMb,
  });
  if (error) throw new Error(readableError(error, "No se pudieron guardar los parámetros generales."));
  return cacheSettings(mapSettings(data?.[0]));
}
