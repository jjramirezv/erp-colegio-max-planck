import { isSupabaseConfigured, supabase } from "../../lib/supabase";

export const EMPTY_IDENTITY = {
  displayName: "Colegio Max Planck",
  officialName: "",
  shortName: "",
  modularCode: "",
  localCode: "",
  ruc: "",
  managementType: "",
  educationMode: "",
  ugel: "",
  creationResolution: "",
  motto: "",
  address: "",
  district: "",
  province: "",
  department: "",
  phone: "",
  email: "",
  website: "",
  logoPath: "",
  updatedAt: "",
};

export const DEFAULT_PUBLIC_BRAND = {
  displayName: EMPTY_IDENTITY.displayName,
  logoPath: "",
  logoUrl: "",
  updatedAt: "",
};

const SELECT_FIELDS = "nombre_publico,razon_social,nombre_corto,codigo_modular,codigo_local,ruc,tipo_gestion,modalidad_educativa,ugel,resolucion_creacion,lema_institucional,direccion,distrito,provincia,departamento,telefono,correo,sitio_web,logo_path,actualizado_en";

function requireSupabase() {
  if (!isSupabaseConfigured || !supabase) throw new Error("Supabase no está configurado para este módulo.");
}

function readableError(error, fallback) {
  if (error?.code === "PGRST205" || error?.code === "PGRST202" || /schema cache|could not find/i.test(error?.message || "")) return "Falta ejecutar la migración de marca institucional en Supabase.";
  if (error?.code === "42501" || /permission denied|row-level security/i.test(error?.message || "")) return "Tu cuenta no tiene permiso para modificar la identidad institucional.";
  return error?.message || fallback;
}

function fromRow(row) {
  if (!row) return { ...EMPTY_IDENTITY };
  return {
    displayName: row.nombre_publico || row.nombre_corto || row.razon_social || EMPTY_IDENTITY.displayName,
    officialName: row.razon_social || "",
    shortName: row.nombre_corto || "",
    modularCode: row.codigo_modular || "",
    localCode: row.codigo_local || "",
    ruc: row.ruc || "",
    managementType: row.tipo_gestion || "",
    educationMode: row.modalidad_educativa || "",
    ugel: row.ugel || "",
    creationResolution: row.resolucion_creacion || "",
    motto: row.lema_institucional || "",
    address: row.direccion || "",
    district: row.distrito || "",
    province: row.provincia || "",
    department: row.departamento || "",
    phone: row.telefono || "",
    email: row.correo || "",
    website: row.sitio_web || "",
    logoPath: row.logo_path || "",
    updatedAt: row.actualizado_en || "",
  };
}

function toPublicBrand(row) {
  const logoPath = row?.logo_path || "";
  const updatedAt = row?.actualizado_en || "";
  return {
    displayName: row?.nombre_publico || DEFAULT_PUBLIC_BRAND.displayName,
    logoPath,
    logoUrl: institutionalLogoUrl(logoPath, updatedAt),
    updatedAt,
  };
}

export async function loadInstitutionalIdentity() {
  requireSupabase();
  const { data, error } = await supabase.from("configuracion_institucional").select(SELECT_FIELDS).eq("id", 1).maybeSingle();
  if (error) throw new Error(readableError(error, "No se pudieron cargar los datos institucionales."));
  return fromRow(data);
}

export async function loadPublicInstitutionalBrand() {
  requireSupabase();
  const { data, error } = await supabase.rpc("obtener_marca_institucional");
  if (error) throw new Error(readableError(error, "No se pudo cargar la marca institucional."));
  return toPublicBrand(data?.[0]);
}

export async function saveInstitutionalBrand(values) {
  requireSupabase();
  const { data, error } = await supabase.rpc("guardar_marca_institucional", {
    nombre_publico_solicitado: values.displayName,
    logo_path_solicitado: values.logoPath || null,
  });
  if (error) throw new Error(readableError(error, "No se pudo guardar la marca institucional."));
  return toPublicBrand(data?.[0]);
}

export async function uploadInstitutionalLogo(file) {
  requireSupabase();
  if (!file) return "";
  if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) throw new Error("El logo debe ser PNG, JPG o WEBP.");
  if (file.size > 2 * 1024 * 1024) throw new Error("El logo no debe superar los 2 MB.");
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) throw new Error("La sesión ha vencido. Vuelve a ingresar al portal.");
  const path = `identity/logo-${authData.user.id}`;
  const { error } = await supabase.storage.from("institutional-assets").upload(path, file, { upsert: true, contentType: file.type, cacheControl: "3600" });
  if (error) throw new Error(readableError(error, "No se pudo cargar el logo institucional."));
  return path;
}

export function institutionalLogoUrl(path, version = "") {
  if (!path || !supabase) return "";
  const { data } = supabase.storage.from("institutional-assets").getPublicUrl(path);
  return version ? `${data.publicUrl}?v=${encodeURIComponent(version)}` : data.publicUrl;
}
