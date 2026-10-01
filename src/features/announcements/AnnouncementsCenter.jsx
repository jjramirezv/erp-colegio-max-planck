import { useCallback, useEffect, useState } from "react";
import { Archive, BellRing, Eye, Megaphone, Pencil, Plus, RefreshCw, Send, UserRound } from "lucide-react";
import PageHeading from "../../components/PageHeading";
import { BUTTON, CARD, Empty, Pill } from "../student/portal/ui";
import { loadImportCatalog } from "../student-import/importApi";
import { loadTeacherWorkspace } from "../teacher/teacherApi";
import AnnouncementEditor, { AUDIENCES } from "./AnnouncementEditor";
import { archiveAnnouncement, loadAnnouncements, markAnnouncementSeen, saveAnnouncement } from "./announcementsApi";

const AUDIENCE_LABEL = Object.fromEntries([...AUDIENCES, ["administrativo", "Administración"], ["coordinador_academico", "Coordinación"], ["direccion", "Dirección"]]);
const MANAGERS = ["direccion", "coordinador_academico"];
const shortDate = (value) => value ? new Intl.DateTimeFormat("es-PE", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${String(value).slice(0, 10)}T12:00:00Z`)).replace(".", "") : "";
const when = (value) => {
  const days = Math.floor((Date.now() - new Date(value).getTime()) / 86400000);
  return days <= 0 ? "Hoy" : days === 1 ? "Ayer" : days < 7 ? `Hace ${days} días` : new Intl.DateTimeFormat("es-PE", { day: "numeric", month: "long" }).format(new Date(value));
};
const fromInstitution = (signature = "") => /^(Dirección|Coordinación)/.test(signature);
const todayLima = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Lima" }).format(new Date());

function InboxCard({ item, open, onToggle }) {
  const institutional = fromInstitution(item.signature);
  return <article className={`${CARD} overflow-hidden ${item.seen ? "" : "border-l-4 !border-l-brand-800"}`}>
    <button type="button" aria-expanded={open} onClick={onToggle} className="flex w-full items-start gap-4 p-4 text-left sm:p-5">
      <span className={`grid h-11 w-11 flex-none place-items-center rounded-full ${institutional ? "bg-brand-100 text-brand-900" : "bg-[#eaf2ff] text-[#1d4d9c]"}`}>{institutional ? <Megaphone size={19} /> : <UserRound size={19} />}</span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2"><strong className="text-[15px] text-brand-950">{item.title}</strong>{item.seen ? null : <span className="rounded-full bg-brand-800 px-2 py-0.5 text-[10px] font-extrabold uppercase text-white">Nuevo</span>}{item.featured ? <span className="rounded-full bg-[#fff1cc] px-2 py-0.5 text-[10px] font-extrabold uppercase text-[#7a5200]">Importante</span> : null}</span>
        <small className="mt-0.5 block text-[12px] text-muted">{item.signature} · {when(item.publishedAt)}{item.section ? ` · ${item.section}` : ""}</small>
        <span className={`mt-2 block whitespace-pre-wrap text-[14px] leading-6 text-[#33423d] ${open ? "" : "line-clamp-2"}`}>{item.body}</span>
        {!open && item.body.length > 140 ? <span className="mt-1 block text-[12px] font-extrabold text-brand-800">Leer completo</span> : null}
      </span>
    </button>
  </article>;
}

function SentCard({ item, onEdit, onPublish, onArchive, busy }) {
  const today = todayLima();
  const featuredState = !item.featured ? null : today < item.featuredFrom ? "Programado" : today > item.featuredTo ? "Terminó" : "Activo";
  return <article className={`${CARD} flex flex-col gap-3 p-4 sm:p-5`}>
    <div className="flex flex-wrap items-start gap-2">
      <strong className="min-w-0 flex-1 text-[15px] text-brand-950">{item.title}</strong>
      <span className={`rounded-full px-2.5 py-1 text-[11px] font-extrabold ${item.published ? "bg-[#dcf5e6] text-[#146c43]" : "bg-[#fff1cc] text-[#7a5200]"}`}>{item.published ? "Publicado" : "Borrador"}</span>
    </div>
    <p className="m-0 line-clamp-2 whitespace-pre-wrap text-[13px] text-[#52615c]">{item.body}</p>
    <div className="flex flex-wrap gap-1.5 text-[11px] font-bold">
      {item.audience.map((role) => <span key={role} className="rounded-full bg-canvas px-2.5 py-1 text-[#42524c] ring-1 ring-line">{AUDIENCE_LABEL[role] || role}</span>)}
      <span className="rounded-full bg-canvas px-2.5 py-1 text-[#42524c] ring-1 ring-line">{item.section || "Todo el colegio"}</span>
      {item.featured ? <span className="inline-flex items-center gap-1 rounded-full bg-[#fff1cc] px-2.5 py-1 text-[#7a5200]"><BellRing size={12} />Aviso al ingresar · {shortDate(item.featuredFrom)} – {shortDate(item.featuredTo)} · {featuredState}</span> : null}
    </div>
    <div className="flex flex-wrap items-center gap-2 border-t border-line pt-3">
      <small className="mr-auto flex items-center gap-1.5 text-[12px] text-muted">{item.published ? <><Eye size={14} />Visto por {item.seenCount}</> : "Solo tú lo ves"}{item.mine ? "" : ` · ${item.signature}`}</small>
      {!item.published ? <button type="button" disabled={busy} className="inline-flex min-h-9 items-center gap-1.5 rounded-[8px] bg-brand-900 px-3 text-[12px] font-bold text-white" onClick={onPublish}><Send size={14} />Publicar</button> : null}
      <button type="button" disabled={busy} className={`${BUTTON} min-h-9 px-3 text-[12px]`} onClick={onEdit}><Pencil size={14} />Editar</button>
      <button type="button" disabled={busy} aria-label={`Archivar ${item.title}`} className={`${BUTTON} min-h-9 px-3 text-[12px] text-[#a1231f]`} onClick={onArchive}><Archive size={14} /></button>
    </div>
  </article>;
}

export default function AnnouncementsCenter({ user }) {
  const manager = MANAGERS.includes(user.role);
  const writer = manager || user.role === "docente";
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [tab, setTab] = useState(manager ? "sent" : "inbox");
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [open, setOpen] = useState(null);
  const [editor, setEditor] = useState(null);
  const [sections, setSections] = useState([]);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");
  const [notice, setNotice] = useState("");

  const refresh = useCallback(async () => {
    setError("");
    try { setData(await loadAnnouncements()); } catch (failure) { setError(failure.message); setData({ inbox: [], sent: [] }); }
  }, []);
  useEffect(() => { refresh(); }, [refresh]);

  async function openEditor(announcement = null) {
    setActionError("");
    try {
      if (!sections.length) {
        if (manager) setSections((await loadImportCatalog()).sections.map((item) => ({ id: item.id, label: `${item.level} · ${item.grade} ${item.section}` })));
        else setSections([...new Map((await loadTeacherWorkspace()).map((course) => [course.sectionId, { id: course.sectionId, label: course.classroom }])).values()]);
      }
      setEditor({ announcement });
    } catch (failure) { setActionError(failure.message); }
  }
  async function run(action, message) {
    setBusy(true); setActionError("");
    try { await action(); setNotice(message); setTimeout(() => setNotice(""), 3500); await refresh(); return true; }
    catch (failure) { setActionError(failure.message); return false; }
    finally { setBusy(false); }
  }
  function toggle(item) {
    setOpen(open === item.id ? null : item.id);
    if (!item.seen) {
      setData((current) => ({ ...current, inbox: current.inbox.map((entry) => entry.id === item.id ? { ...entry, seen: true } : entry) }));
      markAnnouncementSeen(item.id).catch(() => {});
    }
  }

  const unread = data?.inbox.filter((item) => !item.seen).length || 0;
  const inbox = (data?.inbox || []).filter((item) => !unreadOnly || !item.seen);
  return <section className="mx-auto max-w-[980px] space-y-5 pb-14">
    <PageHeading standard title="Comunicados" description={manager ? "Envía avisos a toda la comunidad o a un salón. Marca los importantes para mostrarlos al ingresar." : writer ? "Avisos del colegio y mensajes para los estudiantes y familias de tus salones." : "Avisos del colegio y de tus docentes."}
      action={<div className="flex gap-2"><button type="button" className={BUTTON} onClick={refresh}><RefreshCw size={15} />Actualizar</button>{writer ? <button type="button" className="inline-flex min-h-10 items-center gap-2 rounded-[7px] bg-brand-900 px-4 text-[13px] font-bold text-white hover:bg-brand-800" onClick={() => openEditor()}><Plus size={16} />Nuevo comunicado</button> : null}</div>} />
    {error ? <div role="alert" className="rounded-[10px] border border-[#efb0ad] bg-[#fff6f5] p-4 text-[13px] font-semibold text-[#8f2924]">{error}</div> : null}
    {actionError && !editor ? <div role="alert" className="rounded-[10px] border border-[#efb0ad] bg-[#fff6f5] p-4 text-[13px] font-semibold text-[#8f2924]">{actionError}</div> : null}
    {writer ? <div className="flex flex-wrap gap-2" role="tablist">
      <Pill active={tab === "inbox"} onClick={() => setTab("inbox")}>Recibidos{unread ? ` · ${unread} nuevos` : ""}</Pill>
      <Pill active={tab === "sent"} onClick={() => setTab("sent")}>{manager ? "Publicados por el colegio" : "Enviados por mí"} · {data?.sent.length || 0}</Pill>
    </div> : null}
    {!data ? <p role="status" className="text-[13px] text-muted">Cargando comunicados…</p>
      : tab === "inbox" ? <>
        {data.inbox.length ? <div className="flex gap-2"><Pill active={!unreadOnly} onClick={() => setUnreadOnly(false)}>Todos · {data.inbox.length}</Pill><Pill active={unreadOnly} onClick={() => setUnreadOnly(true)}>No leídos · {unread}</Pill></div> : null}
        {inbox.length ? <div className="grid gap-3">{inbox.map((item) => <InboxCard key={item.id} item={item} open={open === item.id} onToggle={() => toggle(item)} />)}</div>
          : <Empty icon={Megaphone} title={data.inbox.length ? "Estás al día" : "No hay comunicados publicados"}>{data.inbox.length ? "Ya leíste todos los comunicados." : "Los avisos del colegio aparecerán aquí cuando se publiquen."}</Empty>}
      </>
      : data.sent.length ? <div className="grid gap-3 md:grid-cols-2">{data.sent.map((item) => <SentCard key={item.id} item={item} busy={busy}
          onEdit={() => openEditor(item)}
          onPublish={() => run(() => saveAnnouncement({ ...item, publish: true }), "Comunicado publicado.")}
          onArchive={() => { if (window.confirm(`¿Archivar “${item.title}”? Dejará de mostrarse.`)) run(() => archiveAnnouncement(item.id), "Comunicado archivado."); }} />)}</div>
        : <Empty icon={Send} title="Aún no hay comunicados enviados">Pulsa “Nuevo comunicado” para avisar a {manager ? "toda la comunidad o a un salón" : "los estudiantes y familias de tus salones"}.</Empty>}
    <div className="pointer-events-none fixed bottom-4 right-4 z-[95]" role="status" aria-live="polite">{notice ? <span className="block rounded-[8px] border border-[#99c9b5] bg-white px-4 py-3 text-[13px] font-bold text-brand-800 shadow-lg">{notice}</span> : null}</div>
    {editor ? <AnnouncementEditor announcement={editor.announcement} manager={manager} sections={sections} busy={busy} error={actionError}
      onClose={() => { setEditor(null); setActionError(""); }}
      onSave={async (values) => { if (await run(() => saveAnnouncement(values), values.publish ? "Comunicado publicado." : "Borrador guardado.")) { setEditor(null); setTab("sent"); } }} /> : null}
  </section>;
}
