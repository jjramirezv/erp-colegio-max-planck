import { BookOpen, CheckCircle2, CircleAlert, Layers3, LoaderCircle, Pencil, Plus, RefreshCw, Trash2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import PageHeading from "../../components/PageHeading";
import { isSupabaseConfigured } from "../../lib/supabase";
import EducationLevelDialog from "./EducationLevelDialog";
import { deleteEducationLevel, loadEducationLevels, saveEducationLevel, subscribeToEducationLevels } from "./educationLevelsApi";

function Notice({ children, tone = "error", onRetry }) {
  const success = tone === "success";
  return <div className={`mb-4 flex items-center gap-3 rounded-[7px] border px-4 py-3 text-[10px] ${success ? "border-[#a9d6c5] bg-[#f1faf6] text-brand-900" : "border-[#efb0ad] bg-[#fff6f5] text-[#8f2924]"}`} role={success ? "status" : "alert"}>{success ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <CircleAlert className="h-4 w-4 shrink-0" />}<span className="flex-1 font-semibold">{children}</span>{onRetry ? <button className="inline-flex items-center gap-1 font-extrabold" onClick={onRetry}><RefreshCw className="h-3.5 w-3.5" />Reintentar</button> : null}</div>;
}

function EmptyLevels() {
  return <div className="grid min-h-[210px] place-content-center justify-items-center px-5 text-center"><span className="grid h-12 w-12 place-items-center rounded-full bg-[#eff8fd] text-[#237db3]"><Layers3 className="h-5 w-5" /></span><h3 className="mb-1 mt-3 font-sans text-[15px] font-bold text-brand-950">Aún no hay niveles educativos</h3><p className="m-0 max-w-[320px] text-[9px] leading-relaxed text-muted">Usa “Nuevo nivel” para registrar el primero.</p></div>;
}

function LevelRow({ level, onEdit, onDelete }) {
  const courseScope = level.materialScope === "course";
  const ScopeIcon = courseScope ? BookOpen : Layers3;
  return <article className="grid gap-3 border-t border-line px-4 py-4 first:border-t-0 sm:px-5 lg:grid-cols-[0.35fr_1.2fr_1.25fr_0.65fr_0.65fr] lg:items-center lg:gap-4"><div className="flex items-center gap-2"><span className="grid h-8 w-8 place-items-center rounded-full bg-[#fff5ca] text-[10px] font-extrabold text-[#8b6500]">{level.order}</span><small className="text-[8px] font-bold uppercase tracking-[0.08em] text-muted lg:hidden">Orden</small></div><strong className="font-sans text-[15px] font-bold text-brand-950">{level.name}</strong><div className="flex items-center gap-2"><span className={`grid h-8 w-8 place-items-center rounded-full ${courseScope ? "bg-[#eaf6fc] text-[#237db3]" : "bg-brand-50 text-brand-800"}`}><ScopeIcon className="h-4 w-4" /></span><span><strong className="block text-[9px] text-[#42524c]">{courseScope ? "Por curso" : "Por aula o sección"}</strong><small className="text-[8px] text-muted">{courseScope ? "Materiales por asignatura" : "Materiales compartidos del aula"}</small></span></div><span className={`inline-flex w-fit items-center gap-2 rounded-full border px-2.5 py-1 text-[9px] font-extrabold ${level.active ? "border-[#a9d6c5] bg-[#f1faf6] text-brand-800" : "border-[#d6dfdc] bg-[#f3f6f5] text-[#66736f]"}`}><i className={`h-1.5 w-1.5 rounded-full ${level.active ? "bg-brand-700" : "bg-[#82908b]"}`} />{level.active ? "Activo" : "Inactivo"}</span><div className="flex items-center gap-1 lg:justify-end"><button className="grid h-9 w-9 place-items-center rounded-full text-[#237db3] hover:bg-[#eff8fd]" onClick={onEdit} aria-label={`Editar ${level.name}`}><Pencil className="h-4 w-4" /></button><button className="grid h-9 w-9 place-items-center rounded-full text-[#a32d28] hover:bg-[#fff1f0]" onClick={onDelete} aria-label={`Eliminar ${level.name}`}><Trash2 className="h-4 w-4" /></button></div></article>;
}

export default function EducationLevelsManagement({ user }) {
  const connected = isSupabaseConfigured && user?.authSource === "supabase";
  const [levels, setLevels] = useState([]);
  const [loading, setLoading] = useState(connected);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(connected ? "" : "Inicia sesión con una cuenta de Dirección conectada a Supabase.");
  const [notice, setNotice] = useState("");
  const [dialog, setDialog] = useState(null);
  const refreshTimer = useRef(null);

  const refresh = useCallback(async ({ quiet = false } = {}) => {
    if (!connected) return;
    if (!quiet) setLoading(true);
    try { setLevels(await loadEducationLevels()); setError(""); }
    catch (requestError) { setError(requestError.message); }
    finally { setLoading(false); }
  }, [connected]);

  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => {
    if (!connected) return undefined;
    return subscribeToEducationLevels(() => {
      window.clearTimeout(refreshTimer.current);
      refreshTimer.current = window.setTimeout(() => refresh({ quiet: true }), 180);
    });
  }, [connected, refresh]);
  useEffect(() => () => window.clearTimeout(refreshTimer.current), []);

  async function save(values) {
    if (!connected) return setError("Conecta el portal con Supabase para guardar el nivel educativo.");
    setBusy(true); setError(""); setNotice("");
    try { await saveEducationLevel(values); setDialog(null); setNotice(values.id ? "Nivel educativo actualizado." : "Nivel educativo creado."); await refresh({ quiet: true }); }
    catch (requestError) { setError(requestError.message); }
    finally { setBusy(false); }
  }

  async function remove(level) {
    if (!connected) return setError("Conecta el portal con Supabase para eliminar el nivel educativo.");
    if (!window.confirm(`¿Eliminar el nivel ${level.name}? Solo será posible si todavía no tiene grados asociados.`)) return;
    setBusy(true); setError(""); setNotice("");
    try { await deleteEducationLevel(level.id); setNotice(`${level.name} fue eliminado.`); await refresh({ quiet: true }); }
    catch (requestError) { setError(requestError.message); }
    finally { setBusy(false); }
  }

  const openCreate = () => { setError(connected ? "" : error); setDialog({ level: null }); };

  return <section className="mx-auto max-w-[1240px] pb-14 text-ink" aria-busy={loading || busy}>
    <PageHeading standard title="Niveles educativos" description="Configura los niveles que ofrece el colegio y cómo distribuyen sus materiales" action={<button aria-label="Nuevo nivel" className="inline-flex min-h-[42px] items-center gap-2 rounded-[5px] bg-[#f3bd24] px-5 text-[10px] font-extrabold text-brand-950 shadow-[0_7px_18px_rgba(139,101,0,0.13)] hover:bg-[#ffd34f]" onClick={openCreate}><Plus className="h-4 w-4" /><span className="hidden sm:inline">Nuevo nivel</span></button>} />
    {error ? <Notice onRetry={connected ? () => refresh() : undefined}>{error}</Notice> : null}
    {notice ? <Notice tone="success">{notice}</Notice> : null}

    <section className="overflow-visible rounded-[9px] border border-line-strong bg-white shadow-[0_12px_35px_rgba(7,54,42,0.05)]">
      <header className="flex min-h-[58px] items-center justify-between border-b border-line px-4 sm:px-5"><div><h2 className="m-0 font-sans text-[14px] font-bold text-brand-950">Niveles registrados</h2><p className="mb-0 mt-1 text-[8px] text-muted">{levels.length ? `${levels.length} nivel${levels.length === 1 ? "" : "es"}` : "Sin registros"}</p></div>{loading ? <LoaderCircle className="h-4 w-4 animate-spin text-brand-800" /> : null}</header>
      {loading ? <div className="grid min-h-[260px] place-content-center justify-items-center gap-3 text-[10px] text-muted"><LoaderCircle className="h-6 w-6 animate-spin text-[#237db3]" />Cargando…</div> : levels.length ? <><div className="hidden grid-cols-[0.35fr_1.2fr_1.25fr_0.65fr_0.65fr] gap-4 border-b border-line bg-[#f8faf9] px-5 py-3 text-[8px] font-extrabold uppercase tracking-[0.08em] text-muted lg:grid"><span>Orden</span><span>Nivel</span><span>Distribución de materiales</span><span>Estado</span><span className="text-right">Acciones</span></div>{levels.map((level) => <LevelRow key={level.id} level={level} onEdit={() => setDialog({ level })} onDelete={() => remove(level)} />)}</> : <EmptyLevels />}
    </section>

    {dialog ? <EducationLevelDialog key={dialog.level?.id || "new"} level={dialog.level} busy={busy} requestError={error} onClose={() => { if (!busy) setDialog(null); }} onSave={save} /> : null}
  </section>;
}
