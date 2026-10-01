import {
  Archive,
  CalendarDays,
  CheckCircle2,
  CircleAlert,
  Eye,
  FileClock,
  LoaderCircle,
  MoreVertical,
  Pencil,
  PlayCircle,
  Plus,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import PageHeading from "../../components/PageHeading";
import { isSupabaseConfigured } from "../../lib/supabase";
import AcademicYearDrawer from "./AcademicYearDrawer";
import {
  activateAcademicYear,
  closeAcademicYear,
  deleteAcademicYear,
  loadAcademicYears,
  saveAcademicYear,
  subscribeToAcademicYears,
} from "./academicYearsApi";

const PERIOD_LABELS = { bimestres: "4 bimestres", trimestres: "3 trimestres", semestres: "2 semestres" };
const STATUS = {
  preparacion: { label: "En preparación", className: "border-[#b7d7ea] bg-[#eff8fd] text-[#176d9f]", dot: "bg-[#237db3]" },
  activo: { label: "Activo", className: "border-[#ead38c] bg-[#fff8df] text-[#755711]", dot: "bg-[#f3bd24]" },
  cerrado: { label: "Cerrado", className: "border-[#d6dfdc] bg-[#f3f6f5] text-[#66736f]", dot: "bg-[#82908b]" },
};

function shortDate(date) {
  if (!date) return "Sin fecha";
  return new Intl.DateTimeFormat("es-PE", { day: "2-digit", month: "short" }).format(new Date(`${date}T12:00:00`)).replace(".", "");
}

function Notice({ children, tone = "error", onRetry }) {
  const success = tone === "success";
  return <div className={`mb-4 flex items-center gap-3 rounded-[7px] border px-4 py-3 text-[10px] ${success ? "border-[#a9d6c5] bg-[#f1faf6] text-brand-900" : "border-[#efb0ad] bg-[#fff6f5] text-[#8f2924]"}`} role={success ? "status" : "alert"}>{success ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <CircleAlert className="h-4 w-4 shrink-0" />}<span className="flex-1 font-semibold">{children}</span>{onRetry ? <button className="inline-flex items-center gap-1 font-extrabold" onClick={onRetry}><RefreshCw className="h-3.5 w-3.5" />Reintentar</button> : null}</div>;
}

function StatusLabel({ status }) {
  const item = STATUS[status] || STATUS.preparacion;
  return <span className={`inline-flex w-fit items-center gap-2 rounded-full border px-2.5 py-1 text-[9px] font-extrabold ${item.className}`}><i className={`h-1.5 w-1.5 rounded-full ${item.dot}`} />{item.label}</span>;
}

function CurrentYearSummary({ activeYear, hasYears }) {
  if (!hasYears) return null;

  if (!activeYear) {
    return (
      <section className="mb-5 flex items-center gap-3 rounded-[9px] border border-[#b7d7ea] bg-[#f1f8fc] px-4 py-3 text-[#176d9f] sm:px-5">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white"><CalendarDays className="h-4 w-4" /></span>
        <p className="m-0 text-[10px] leading-relaxed"><strong className="block text-[11px] text-[#114f74]">Aún no hay un año lectivo activo</strong>Activa uno de los registros en preparación desde su menú de acciones.</p>
      </section>
    );
  }

  return (
    <section className="mb-5 overflow-hidden rounded-[9px] border border-line-strong bg-white shadow-[0_10px_30px_rgba(7,54,42,0.05)] sm:flex sm:items-stretch">
      <div className="flex flex-1 items-center gap-4 bg-[#f1faf6] p-4 sm:p-5">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-[#b7dacd] bg-white text-brand-800"><CalendarDays className="h-5 w-5" /></span>
        <div><small className="text-[9px] font-extrabold text-brand-800">Año lectivo activo</small><strong className="mt-0.5 block font-sans text-[20px] text-brand-950">{activeYear.name}</strong><span className="text-[9px] text-muted">{shortDate(activeYear.startsOn)} — {shortDate(activeYear.endsOn)}</span></div>
      </div>
      <div className="flex items-center border-t border-line bg-[#f1f8fc] px-4 py-3 text-[9px] leading-relaxed text-[#36596d] sm:max-w-[350px] sm:border-l sm:border-t-0 sm:px-5">
        Para activar otra vigencia, primero cierra el año actual desde su menú de acciones.
      </div>
    </section>
  );
}

function RowMenu({ year, onView, onEdit, onActivate, onCloseYear, onDelete }) {
  return (
    <details className="group relative">
      <summary className="grid h-8 w-8 cursor-pointer list-none place-items-center rounded-full text-muted hover:bg-[#f0f5f3] hover:text-brand-900 marker:content-none" aria-label={`Acciones de ${year.name}`}><MoreVertical className="h-4 w-4" /></summary>
      <div className="absolute right-0 top-9 z-20 grid w-[178px] overflow-hidden rounded-[6px] border border-line-strong bg-white p-1 shadow-[0_12px_34px_rgba(2,41,31,0.16)]">
        <button className="flex items-center gap-2 rounded-[4px] px-3 py-2 text-left text-[9px] font-bold hover:bg-brand-50" onClick={onView}><Eye className="h-3.5 w-3.5" />Ver detalle</button>
        {year.status === "preparacion" ? <><button className="flex items-center gap-2 rounded-[4px] px-3 py-2 text-left text-[9px] font-bold hover:bg-[#eff8fd]" onClick={onEdit}><Pencil className="h-3.5 w-3.5 text-[#237db3]" />Editar configuración</button><button className="flex items-center gap-2 rounded-[4px] px-3 py-2 text-left text-[9px] font-bold hover:bg-[#fff8df]" onClick={onActivate}><PlayCircle className="h-3.5 w-3.5 text-[#9a6d00]" />Activar año</button><button className="flex items-center gap-2 rounded-[4px] px-3 py-2 text-left text-[9px] font-bold text-[#a32d28] hover:bg-[#fff1f0]" onClick={onDelete}><Trash2 className="h-3.5 w-3.5" />Eliminar borrador</button></> : null}
        {year.status === "activo" ? <button className="flex items-center gap-2 rounded-[4px] px-3 py-2 text-left text-[9px] font-bold hover:bg-[#f3f6f5]" onClick={onCloseYear}><Archive className="h-3.5 w-3.5" />Cerrar año lectivo</button> : null}
      </div>
    </details>
  );
}

function AcademicYearRow({ year, onView, onEdit, onActivate, onCloseYear, onDelete }) {
  return (
    <article className={`relative grid gap-3 border-t border-line px-4 py-4 first:border-t-0 sm:px-5 lg:grid-cols-[0.72fr_1fr_1fr_0.8fr_0.72fr] lg:items-center lg:gap-4 ${year.status === "activo" ? "before:absolute before:inset-y-0 before:left-0 before:w-1 before:bg-[#f3bd24]" : ""}`}>
      <div className="flex items-center gap-3"><span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${year.status === "activo" ? "bg-[#fff5ca] text-[#8b6500]" : year.status === "preparacion" ? "bg-[#eaf6fc] text-[#237db3]" : "bg-[#eef2f1] text-muted"}`}><CalendarDays className="h-4 w-4" /></span><strong className="font-sans text-[16px] text-brand-950">{year.name}</strong></div>
      <div><small className="block text-[8px] font-bold uppercase tracking-[0.08em] text-muted lg:hidden">Fechas</small><span className="text-[10px] font-semibold text-[#4f5e59]">{shortDate(year.startsOn)} — {shortDate(year.endsOn)}</span></div>
      <div><small className="block text-[8px] font-bold uppercase tracking-[0.08em] text-muted lg:hidden">Organización</small><span className="text-[10px] font-semibold text-[#4f5e59]">{PERIOD_LABELS[year.periodSystem] || year.periodSystem}</span></div>
      <StatusLabel status={year.status} />
      <div className="flex items-center justify-between gap-2 lg:justify-end"><button className="text-[9px] font-extrabold text-[#176d9f] hover:underline" onClick={onView}>Ver detalle</button><RowMenu year={year} onView={onView} onEdit={onEdit} onActivate={onActivate} onCloseYear={onCloseYear} onDelete={onDelete} /></div>
    </article>
  );
}

function EmptyYears() {
  return <div className="grid min-h-[210px] place-content-center justify-items-center px-5 text-center"><span className="grid h-12 w-12 place-items-center rounded-full bg-[#eff8fd] text-[#237db3]"><FileClock className="h-5 w-5" /></span><h3 className="mb-1 mt-3 font-sans text-[15px] font-extrabold text-brand-950">Aún no hay años lectivos</h3><p className="m-0 max-w-[320px] text-[9px] leading-relaxed text-muted">Usa “Nuevo año lectivo” para registrar el primero.</p></div>;
}

export default function AcademicYearsManagement({ user }) {
  const connected = isSupabaseConfigured && user?.authSource === "supabase";
  const [years, setYears] = useState([]);
  const [loading, setLoading] = useState(connected);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(connected ? "" : "Inicia sesión con una cuenta de Dirección conectada a Supabase.");
  const [notice, setNotice] = useState("");
  const [drawer, setDrawer] = useState(null);
  const refreshTimer = useRef(null);

  const refresh = useCallback(async ({ quiet = false } = {}) => {
    if (!connected) return;
    if (!quiet) setLoading(true);
    try { setYears(await loadAcademicYears()); setError(""); }
    catch (requestError) { setError(requestError.message); }
    finally { setLoading(false); }
  }, [connected]);

  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => {
    if (!connected) return undefined;
    return subscribeToAcademicYears(() => {
      window.clearTimeout(refreshTimer.current);
      refreshTimer.current = window.setTimeout(() => refresh({ quiet: true }), 180);
    });
  }, [connected, refresh]);
  useEffect(() => () => window.clearTimeout(refreshTimer.current), []);

  const activeYear = useMemo(() => years.find((year) => year.status === "activo"), [years]);

  async function save(values) {
    if (!connected) return setError("Conecta el portal con Supabase para guardar el año lectivo.");
    setBusy(true); setError(""); setNotice("");
    try { await saveAcademicYear(values); setDrawer(null); setNotice(values.id ? "Año lectivo actualizado." : "Año lectivo creado en preparación."); await refresh({ quiet: true }); }
    catch (requestError) { setError(requestError.message); }
    finally { setBusy(false); }
  }

  async function runAction(action, year, message, question) {
    if (!connected) return setError("Conecta el portal con Supabase para completar esta acción.");
    if (!window.confirm(question)) return;
    setBusy(true); setError(""); setNotice("");
    try { await action(year.id); setNotice(message); await refresh({ quiet: true }); }
    catch (requestError) { setError(requestError.message); }
    finally { setBusy(false); }
  }

  const openCreate = () => { setError(connected ? "" : error); setDrawer({ mode: "create", year: null }); };

  return (
    <section className="mx-auto max-w-[1240px] pb-14 text-ink" aria-busy={loading || busy}>
      <PageHeading standard title="Años lectivos" description="Organiza la vigencia académica y define cómo se divide cada periodo escolar" action={<button aria-label="Nuevo año lectivo" className="inline-flex min-h-[42px] items-center gap-2 rounded-[5px] bg-[#f3bd24] px-5 text-[10px] font-extrabold text-brand-950 shadow-[0_7px_18px_rgba(139,101,0,0.13)] hover:bg-[#ffd34f]" onClick={openCreate}><Plus className="h-4 w-4" /><span className="hidden sm:inline">Nuevo año lectivo</span></button>} />

      {error ? <Notice onRetry={connected ? () => refresh() : undefined}>{error}</Notice> : null}
      {notice ? <Notice tone="success">{notice}</Notice> : null}

      <CurrentYearSummary activeYear={activeYear} hasYears={Boolean(years.length)} />

      <section className="overflow-visible rounded-[9px] border border-line-strong bg-white shadow-[0_12px_35px_rgba(7,54,42,0.05)]">
        <header className="flex min-h-[58px] items-center justify-between border-b border-line px-4 sm:px-5"><div><h2 className="m-0 font-sans text-[14px] font-extrabold text-brand-950">Años lectivos</h2><p className="mb-0 mt-1 text-[8px] text-muted">{years.length ? `${years.length} registro${years.length === 1 ? "" : "s"}` : "Sin registros"}</p></div>{loading ? <LoaderCircle className="h-4 w-4 animate-spin text-brand-800" /> : null}</header>
        {loading ? <div className="grid min-h-[280px] place-content-center justify-items-center gap-3 text-[10px] text-muted"><LoaderCircle className="h-6 w-6 animate-spin text-[#237db3]" />Cargando…</div> : years.length ? <><div className="hidden grid-cols-[0.72fr_1fr_1fr_0.8fr_0.72fr] gap-4 border-b border-line bg-[#f8faf9] px-5 py-3 text-[8px] font-extrabold uppercase tracking-[0.08em] text-muted lg:grid"><span>Año</span><span>Fechas</span><span>Organización académica</span><span>Estado</span><span className="text-right">Acciones</span></div>{years.map((year) => <AcademicYearRow key={year.id} year={year} onView={() => setDrawer({ mode: "view", year })} onEdit={() => setDrawer({ mode: "edit", year })} onActivate={() => runAction(activateAcademicYear, year, `${year.name} ahora es el año lectivo activo.`, `¿Activar el año lectivo ${year.name}? A partir de ese momento podrá recibir la estructura académica.`)} onCloseYear={() => runAction(closeAcademicYear, year, `${year.name} fue cerrado correctamente.`, `¿Cerrar el año lectivo ${year.name}? Quedará disponible solo para consulta.`)} onDelete={() => runAction(deleteAcademicYear, year, `${year.name} fue eliminado.`, `¿Eliminar el año ${year.name} en preparación? Esta acción no se puede deshacer.`)} />)}</> : <EmptyYears />}
      </section>

      {drawer ? <AcademicYearDrawer key={`${drawer.mode}-${drawer.year?.id || "new"}`} mode={drawer.mode} year={drawer.year} busy={busy} requestError={error} onClose={() => { if (!busy) setDrawer(null); }} onSave={save} /> : null}
    </section>
  );
}
