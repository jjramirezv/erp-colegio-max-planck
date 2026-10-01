import { useEffect, useState } from "react";
import { BellRing, LoaderCircle } from "lucide-react";
import { loadAnnouncements, markAnnouncementSeen } from "./announcementsApi";

// Avisos importantes vigentes que el usuario aún no confirmó; se muestran uno a uno al ingresar.
export default function FeaturedAnnouncement({ user, onOpenAll }) {
  const [queue, setQueue] = useState([]);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    loadAnnouncements().then(({ inbox }) => { if (active) setQueue(inbox.filter((item) => item.featured && !item.seen)); }).catch(() => {});
    return () => { active = false; };
  }, [user.id]);
  const item = queue[0];
  if (!item) return null;
  async function acknowledge(next) {
    setBusy(true);
    try { await markAnnouncementSeen(item.id); } catch { /* se mostrará de nuevo en el próximo ingreso */ }
    setBusy(false);
    setQueue((current) => current.slice(1));
    if (next) onOpenAll?.();
  }
  return <div className="fixed inset-0 z-[120] grid place-items-center bg-[#082c24]/65 p-4 backdrop-blur-[2px]">
    <section role="alertdialog" aria-modal="true" aria-labelledby="featured-title" className="w-full max-w-[520px] overflow-hidden rounded-[16px] bg-white shadow-[0_28px_90px_rgba(4,39,30,.35)]">
      <div className="flex items-center gap-3 bg-[#fff6dc] px-6 py-4"><span className="grid h-11 w-11 place-items-center rounded-full bg-[#f3bd24] text-brand-950"><BellRing size={20} /></span><div><small className="block text-[11px] font-extrabold uppercase tracking-[0.08em] text-[#7a5200]">Aviso importante</small><span className="text-[13px] font-bold text-[#5c4300]">{item.signature}{item.section ? ` · ${item.section}` : ""}</span></div>{queue.length > 1 ? <span className="ml-auto rounded-full bg-white px-2.5 py-1 text-[11px] font-extrabold text-[#7a5200]">1 de {queue.length}</span> : null}</div>
      <div className="max-h-[50vh] overflow-y-auto px-6 py-5"><h2 id="featured-title" className="m-0 text-[22px] font-extrabold leading-tight tracking-[-0.03em] text-brand-950">{item.title}</h2><p className="mb-0 mt-3 whitespace-pre-wrap text-[15px] leading-7 text-[#33423d]">{item.body}</p></div>
      <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-line bg-canvas px-6 py-4">
        <button type="button" disabled={busy} className="min-h-11 px-3 text-[13px] font-bold text-brand-800" onClick={() => acknowledge(true)}>Ver todos los comunicados</button>
        <button type="button" disabled={busy} autoFocus className="inline-flex min-h-11 items-center gap-2 rounded-[8px] bg-brand-900 px-6 text-[14px] font-bold text-white hover:bg-brand-800" onClick={() => acknowledge(false)}>{busy ? <LoaderCircle size={16} className="animate-spin" /> : null}Entendido</button>
      </footer>
    </section>
  </div>;
}
