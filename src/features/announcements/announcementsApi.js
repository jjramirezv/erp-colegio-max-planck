import { supabase } from "../../lib/supabase";

function readable(error, fallback) {
  const message = String(error?.message || "");
  if (error?.code === "PGRST202") return "Los comunicados aún no están habilitados. Aplica la migración de comunicados.";
  return message || fallback;
}

export async function loadAnnouncements() {
  if (!supabase) return { inbox: [], sent: [] };
  const { data, error } = await supabase.rpc("listar_comunicados");
  if (error) throw new Error(readable(error, "No se pudieron cargar los comunicados."));
  return { inbox: data?.inbox || [], sent: data?.sent || [] };
}

export async function saveAnnouncement(values) {
  const { data, error } = await supabase.rpc("guardar_comunicado", {
    comunicado: values.id || null, titulo: values.title, contenido: values.body, destinos: values.audience,
    seccion: values.sectionId ? Number(values.sectionId) : null, destacado: Boolean(values.featured),
    desde: values.featured ? values.featuredFrom : null, hasta: values.featured ? values.featuredTo : null, publicar: Boolean(values.publish),
  });
  if (error) throw new Error(readable(error, "No se pudo guardar el comunicado."));
  return data;
}

export async function archiveAnnouncement(id) {
  const { error } = await supabase.rpc("archivar_comunicado", { comunicado: id });
  if (error) throw new Error(readable(error, "No se pudo archivar el comunicado."));
}

export async function markAnnouncementSeen(id) {
  const { error } = await supabase.rpc("marcar_comunicado_visto", { comunicado: id });
  if (error) throw new Error(readable(error, "No se pudo marcar como leído."));
  window.dispatchEvent(new Event("mp-announcements-updated"));
}
