import { BriefcaseBusiness, Building2, CheckCircle2, ChevronDown, CircleAlert, LoaderCircle, Pencil, Plus, RefreshCw, Trash2, UserRound, UsersRound } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import PageHeading from "../../components/PageHeading";
import { isSupabaseConfigured } from "../../lib/supabase";
import OrganizationDialog from "./OrganizationDialog";
import { deleteArea, deletePosition, loadOrganization, saveArea, savePosition, subscribeToOrganization } from "./organizationApi";

const ROLE_LABELS = { direccion: "Alta Dirección", coordinador_academico: "Coordinación académica", administrativo: "Administración", docente: "Docente" };
const ACCENTS = [
  { icon: "bg-brand-50 text-brand-800", line: "bg-brand-700" },
  { icon: "bg-[#fff8df] text-[#a47700]", line: "bg-[#f3bd24]" },
  { icon: "bg-[#eff8fd] text-[#237db3]", line: "bg-[#237db3]" },
];

function Notice({ children, tone = "error", onRetry }) {
  const success = tone === "success";
  return <div className={`mb-4 flex items-center gap-3 rounded-[7px] border px-4 py-3 text-[10px] ${success ? "border-[#a9d6c5] bg-[#f1faf6] text-brand-900" : "border-[#efb0ad] bg-[#fff6f5] text-[#8f2924]"}`} role={success ? "status" : "alert"}>{success ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <CircleAlert className="h-4 w-4 shrink-0" />}<span className="flex-1 font-semibold">{children}</span>{onRetry ? <button type="button" className="inline-flex items-center gap-1 font-extrabold" onClick={onRetry}><RefreshCw className="h-3.5 w-3.5" />Reintentar</button> : null}</div>;
}

function Person({ person, vacancyLabel = "Sin responsable" }) {
  if (!person) return <span className="inline-flex items-center gap-2 text-[9px] font-bold text-[#a47700]"><span className="grid h-7 w-7 place-items-center rounded-full bg-[#fff8df]"><UserRound className="h-3.5 w-3.5" /></span>{vacancyLabel}</span>;
  const initials = person.name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
  return <span className="flex min-w-0 items-center gap-2"><i className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#eff8fd] text-[8px] not-italic font-extrabold text-[#176d9f]">{initials}</i><span className="min-w-0"><strong className="block truncate text-[9px] text-brand-950">{person.name}</strong><small className="block truncate text-[8px] text-muted">{ROLE_LABELS[person.role] || person.role}</small></span></span>;
}

function PositionRow({ position, person, onEdit, onDelete }) {
  return <article className="grid gap-3 border-t border-line px-4 py-3.5 sm:grid-cols-[1fr_1fr_auto] sm:items-center sm:px-5"><div className="min-w-0"><strong className="block truncate font-sans text-[13px] font-bold text-brand-950">{position.name}</strong><p className="mb-0 mt-1 truncate text-[8px] text-muted">{position.description || "Sin descripción adicional"}</p></div><Person person={person} vacancyLabel="Cargo vacante" /><div className="flex items-center gap-1 sm:justify-end"><span className={`mr-1 inline-flex rounded-full px-2 py-1 text-[8px] font-extrabold ${position.active ? "bg-[#f1faf6] text-brand-800" : "bg-[#f0f3f2] text-muted"}`}>{position.active ? "Activo" : "Inactivo"}</span><button type="button" className="grid h-9 w-9 place-items-center rounded-full text-[#237db3] hover:bg-[#eff8fd]" onClick={onEdit} aria-label={`Editar ${position.name}`}><Pencil className="h-4 w-4" /></button><button type="button" className="grid h-9 w-9 place-items-center rounded-full text-[#a32d28] hover:bg-[#fff1f0]" onClick={onDelete} aria-label={`Eliminar ${position.name}`}><Trash2 className="h-4 w-4" /></button></div></article>;
}

function AreaCard({ area, index, positions, peopleById, open, onToggle, onAddPosition, onEdit, onDelete, onEditPosition, onDeletePosition }) {
  const accent = ACCENTS[index % ACCENTS.length];
  const responsible = peopleById.get(area.responsibleId);
  return <article className="relative overflow-hidden rounded-[9px] border border-line-strong bg-white shadow-[0_8px_25px_rgba(7,54,42,0.04)]"><i className={`absolute left-0 top-0 h-full w-1 ${accent.line}`} />
    <header className="grid gap-3 p-4 pl-5 sm:grid-cols-[1fr_230px_auto] sm:items-center sm:px-5 sm:pl-6"><button type="button" className="flex min-w-0 items-center gap-3 text-left" onClick={onToggle} aria-expanded={open}><span className={`grid h-10 w-10 shrink-0 place-items-center rounded-[8px] ${accent.icon}`}><Building2 className="h-5 w-5" /></span><span className="min-w-0"><strong className="block truncate font-sans text-[16px] font-bold text-brand-950">{area.name}</strong><small className="mt-0.5 block truncate text-[8px] text-muted">{area.description || `${positions.length} cargo${positions.length === 1 ? "" : "s"}`}</small></span><ChevronDown className={`ml-auto h-4 w-4 shrink-0 text-muted transition sm:hidden ${open ? "rotate-180" : ""}`} /></button><Person person={responsible} /><div className="flex items-center gap-1"><button type="button" className="inline-flex min-h-9 items-center gap-1.5 rounded-[5px] border border-[#9cc8df] bg-white px-3 text-[9px] font-extrabold text-[#176d9f] hover:bg-[#eff8fd]" onClick={onAddPosition}><Plus className="h-3.5 w-3.5" />Cargo</button><button type="button" className="grid h-9 w-9 place-items-center rounded-full text-[#237db3] hover:bg-[#eff8fd]" onClick={onEdit} aria-label={`Editar ${area.name}`}><Pencil className="h-4 w-4" /></button><button type="button" className="grid h-9 w-9 place-items-center rounded-full text-[#a32d28] hover:bg-[#fff1f0]" onClick={onDelete} aria-label={`Eliminar ${area.name}`}><Trash2 className="h-4 w-4" /></button><button type="button" className="hidden h-9 w-9 place-items-center rounded-full text-muted hover:bg-[#f4f7f6] sm:grid" onClick={onToggle} aria-label={open ? "Contraer área" : "Expandir área"}><ChevronDown className={`h-4 w-4 transition ${open ? "rotate-180" : ""}`} /></button></div></header>
    {open ? <section className="border-t border-line bg-[#fcfdfc]">{positions.length ? positions.map((position) => <PositionRow key={position.id} position={position} person={peopleById.get(position.profileId)} onEdit={() => onEditPosition(position)} onDelete={() => onDeletePosition(position)} />) : <div className="flex min-h-[86px] items-center justify-center px-5 text-center text-[9px] text-muted">Esta área aún no tiene cargos registrados.</div>}</section> : null}
  </article>;
}

export default function OrganizationalStructureManagement({ user }) {
  const connected = isSupabaseConfigured && user?.authSource === "supabase";
  const [data, setData] = useState({ areas: [], positions: [], people: [] });
  const [openIds, setOpenIds] = useState(new Set());
  const [loading, setLoading] = useState(connected); const [busy, setBusy] = useState(false);
  const [error, setError] = useState(connected ? "" : "Inicia sesión con una cuenta de Dirección conectada a Supabase.");
  const [notice, setNotice] = useState(""); const [dialog, setDialog] = useState(null); const refreshTimer = useRef(null);

  const refresh = useCallback(async ({ quiet = false } = {}) => {
    if (!connected) return;
    if (!quiet) setLoading(true);
    try { const next = await loadOrganization(); setData(next); setError(""); setOpenIds((current) => current.size ? current : new Set(next.areas.map((area) => area.id))); }
    catch (requestError) { setError(requestError.message); }
    finally { setLoading(false); }
  }, [connected]);
  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => connected ? subscribeToOrganization(() => { window.clearTimeout(refreshTimer.current); refreshTimer.current = window.setTimeout(() => refresh({ quiet: true }), 180); }) : undefined, [connected, refresh]);
  useEffect(() => () => window.clearTimeout(refreshTimer.current), []);

  const peopleById = useMemo(() => new Map(data.people.map((person) => [person.id, person])), [data.people]);
  const positionsByArea = useMemo(() => data.positions.reduce((result, position) => { (result[position.areaId] ||= []).push(position); return result; }, {}), [data.positions]);
  const vacancyCount = data.positions.filter((position) => !position.profileId && position.active).length;

  async function save(values) {
    setBusy(true); setError(""); setNotice("");
    try { if (dialog.type === "area") await saveArea(values); else await savePosition(values); setDialog(null); setNotice(values.id ? "Los cambios se guardaron correctamente." : dialog.type === "area" ? "Área institucional creada." : "Cargo institucional creado."); await refresh({ quiet: true }); }
    catch (requestError) { setError(requestError.message); }
    finally { setBusy(false); }
  }
  async function remove(type, item) {
    const label = type === "area" ? "el área" : "el cargo";
    if (!window.confirm(`¿Eliminar ${label} “${item.name}”?`)) return;
    setBusy(true); setError(""); setNotice("");
    try { if (type === "area") await deleteArea(item.id); else await deletePosition(item.id); setNotice(`${type === "area" ? "Área" : "Cargo"} eliminado.`); await refresh({ quiet: true }); }
    catch (requestError) { setError(requestError.message); }
    finally { setBusy(false); }
  }

  return <section className="mx-auto max-w-[1240px] pb-14 text-ink" aria-busy={loading || busy}>
    <PageHeading standard title="Estructura organizacional" description="Define las áreas, responsables y cargos del colegio" action={<button type="button" className="inline-flex min-h-[42px] items-center gap-2 rounded-[5px] bg-[#f3bd24] px-5 text-[10px] font-extrabold text-brand-950 shadow-[0_7px_18px_rgba(139,101,0,0.13)] hover:bg-[#ffd34f]" onClick={() => setDialog({ type: "area", item: null })}><Plus className="h-4 w-4" /><span>Nueva área</span></button>} />
    {error ? <Notice onRetry={connected ? () => refresh() : undefined}>{error}</Notice> : null}{notice ? <Notice tone="success">{notice}</Notice> : null}

    <section className="mb-4 grid overflow-hidden rounded-[9px] border border-line-strong bg-white shadow-[0_8px_24px_rgba(7,54,42,0.04)] sm:grid-cols-3"><div className="flex items-center gap-3 border-b border-line p-4 sm:border-b-0 sm:border-r"><span className="grid h-10 w-10 place-items-center rounded-full bg-brand-50 text-brand-800"><Building2 className="h-4 w-4" /></span><div><strong className="block font-sans text-[18px] text-brand-950">{data.areas.filter((area) => area.active).length}</strong><small className="text-[8px] text-muted">Áreas activas</small></div></div><div className="flex items-center gap-3 border-b border-line p-4 sm:border-b-0 sm:border-r"><span className="grid h-10 w-10 place-items-center rounded-full bg-[#eff8fd] text-[#237db3]"><BriefcaseBusiness className="h-4 w-4" /></span><div><strong className="block font-sans text-[18px] text-brand-950">{data.positions.length}</strong><small className="text-[8px] text-muted">Cargos registrados</small></div></div><div className="flex items-center gap-3 p-4"><span className="grid h-10 w-10 place-items-center rounded-full bg-[#fff8df] text-[#a47700]"><UsersRound className="h-4 w-4" /></span><div><strong className="block font-sans text-[18px] text-brand-950">{vacancyCount}</strong><small className="text-[8px] text-muted">Cargos vacantes</small></div></div></section>

    {loading ? <section className="grid min-h-[300px] place-content-center justify-items-center gap-3 rounded-[9px] border border-line-strong bg-white text-[10px] text-muted"><LoaderCircle className="h-6 w-6 animate-spin text-[#237db3]" />Cargando…</section> : data.areas.length ? <div className="grid gap-3">{data.areas.map((area, index) => <AreaCard key={area.id} area={area} index={index} positions={positionsByArea[area.id] || []} peopleById={peopleById} open={openIds.has(area.id)} onToggle={() => setOpenIds((current) => { const next = new Set(current); if (next.has(area.id)) next.delete(area.id); else next.add(area.id); return next; })} onAddPosition={() => setDialog({ type: "position", item: null, area })} onEdit={() => setDialog({ type: "area", item: area })} onDelete={() => remove("area", area)} onEditPosition={(item) => setDialog({ type: "position", item, area })} onDeletePosition={(item) => remove("position", item)} />)}</div> : <section className="grid min-h-[300px] place-content-center justify-items-center rounded-[9px] border border-line-strong bg-white px-5 text-center"><span className="grid h-12 w-12 place-items-center rounded-full bg-[#eff8fd] text-[#237db3]"><Building2 className="h-5 w-5" /></span><h2 className="mb-1 mt-3 font-sans text-[16px] font-bold text-brand-950">Aún no hay áreas institucionales</h2><p className="m-0 text-[9px] text-muted">Usa “Nueva área” para comenzar la estructura desde cero.</p></section>}

    {dialog ? <OrganizationDialog key={`${dialog.type}-${dialog.item?.id || "new"}`} type={dialog.type} item={dialog.item} area={dialog.area} areas={data.areas} people={data.people} busy={busy} requestError={error} onClose={() => { if (!busy) setDialog(null); }} onSave={save} /> : null}
  </section>;
}
