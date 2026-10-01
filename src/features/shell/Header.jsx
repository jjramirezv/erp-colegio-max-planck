import { useEffect, useState } from "react";
import { Bell, ChevronDown, LogOut, Menu } from "lucide-react";
import { roles } from "../../data";
import { isSupabaseConfigured } from "../../lib/supabase";
import { loadAnnouncements } from "../announcements/announcementsApi";

export default function Header({ user, onMenu, onLogout, identity, onOpenAnnouncements }) {
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [inbox, setInbox] = useState([]);
  const [notificationError, setNotificationError] = useState("");
  useEffect(() => {
    if (!isSupabaseConfigured) return undefined;
    let active = true;
    const load = () => loadAnnouncements().then((result) => { if (active) { setNotificationError(""); setInbox(result.inbox); } }).catch(() => { if (active) setNotificationError("No se pudieron cargar los comunicados."); });
    load();
    window.addEventListener("mp-announcements-updated", load);
    return () => { active = false; window.removeEventListener("mp-announcements-updated", load); };
  }, [user.id, user.role, notificationOpen]);
  const unread = inbox.filter((item) => !item.seen).length;
  return (
    <header className="sticky top-0 z-20 flex h-[76px] items-center justify-between border-b border-line bg-white px-4 md:px-8">
      <button className="block border-0 bg-transparent text-brand-900 md:hidden" aria-label="Abrir menú" onClick={onMenu}><Menu /></button>
      <div className="hidden items-center gap-6 md:flex">
        <strong className="max-w-[320px] truncate font-display text-lg text-brand-900">{identity?.displayName || "Colegio Max Planck"}</strong>
        <span className="border-l border-line pl-6 text-sm text-muted">Portal educativo</span>
      </div>
      <div className="flex items-center gap-[18px]">
        <div className="relative grid place-items-center">
          <button
            className="relative border-0 bg-transparent text-brand-900"
            aria-label="Notificaciones"
            aria-expanded={notificationOpen}
            onClick={() => setNotificationOpen((current) => !current)}
          >
            <Bell size={19} />
            {unread > 0 ? <i className="absolute -right-[5px] -top-2 grid h-4 min-w-4 place-items-center rounded-full bg-amber px-1 text-[10px] not-italic text-white">{unread}</i> : null}
          </button>
          {notificationOpen ? (
            <section
              aria-label="Notificaciones recientes"
              className="absolute right-0 top-9 z-[80] w-[330px] overflow-hidden rounded-lg border border-[#31574d] bg-white text-ink shadow-[0_16px_40px_#062d2226] max-md:fixed max-md:left-3 max-md:right-3 max-md:top-[68px] max-md:w-auto"
            >
              <header className="flex min-h-[48px] items-center justify-between border-b border-line px-[14px]">
                <strong className="font-display text-sm text-brand-900">Comunicados</strong>
                <button type="button" className="border-0 bg-transparent text-[12px] font-bold text-brand-900" onClick={() => setNotificationOpen(false)}>Cerrar</button>
              </header>
              {notificationError || !inbox.length ? <p className="p-4 text-[13px] text-muted">{notificationError || "No hay comunicados recientes."}</p> : null}
              {inbox.slice(0, 4).map((item) => (
                <button type="button" key={item.id} onClick={() => { setNotificationOpen(false); onOpenAnnouncements?.(); }} className="grid w-full grid-cols-[8px_1fr] gap-[10px] border-0 border-b border-line bg-white px-[14px] py-3 text-left last:border-b-0 hover:bg-brand-50">
                  <span className={`mt-1.5 h-2 w-2 rounded-full ${item.seen ? "bg-line-strong" : "bg-amber"}`} />
                  <span className="grid gap-0.5">
                    <strong className="text-[13px] text-brand-950">{item.title}</strong>
                    <span className="line-clamp-2 text-[12px] leading-[1.4] text-muted">{item.body}</span>
                    <small className="text-[11px] text-[#84918c]">{item.signature} · {new Date(item.publishedAt).toLocaleDateString("es-PE")}</small>
                  </span>
                </button>
              ))}
              {inbox.length ? <button type="button" onClick={() => { setNotificationOpen(false); onOpenAnnouncements?.(); }} className="w-full border-0 bg-canvas py-2.5 text-[12px] font-extrabold text-brand-800">Ver todos los comunicados</button> : null}
            </section>
          ) : null}
        </div>
        <div className="flex items-center gap-[10px] border-l border-line pl-5">
          <span className="grid h-[42px] w-[42px] place-items-center rounded-full bg-brand-900 font-bold text-white">
            {user.name.split(" ").map((n) => n[0]).slice(0, 2).join("")}
          </span>
          <div className="hidden gap-[2px] md:grid">
            <strong className="text-[13px]">{user.name}</strong>
            <small className="text-[11px] text-brand-800">{roles[user.role]}</small>
          </div>
          {user.role !== "estudiante" ? <ChevronDown className="hidden md:block" size={16} /> : null}
        </div>
        <button className="border-0 bg-transparent text-brand-900" onClick={onLogout} title="Cerrar sesión"><LogOut size={18} /></button>
      </div>
    </header>
  );
}
