import { CalendarRange, CheckCircle2, CircleAlert, Clock3, LoaderCircle, Pencil, Plus, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import PageHeading from "../../components/PageHeading";
import { isSupabaseConfigured } from "../../lib/supabase";
import { loadAcademicYears } from "../academic-years/academicYearsApi";
import AcademicPeriodsDialog from "./AcademicPeriodsDialog";
import { loadAcademicPeriods, saveAcademicPeriods, subscribeToAcademicPeriods } from "./academicPeriodsApi";

const SYSTEM_LABELS = { bimestres: "4 bimestres", trimestres: "3 trimestres", semestres: "2 semestres" };
const TONES = ["#07845f", "#237db3", "#d89e00", "#4a9b72"];
const SELECT = "min-h-11 min-w-[220px] rounded-[6px] border border-line-strong bg-white px-3 text-[10px] font-bold text-brand-950 outline-none focus:border-[#237db3] focus:shadow-[0_0_0_3px_rgba(35,125,179,0.12)]";

function formatDate(date, withYear = false) {
  if (!date) return "Sin fecha";
  return new Intl.DateTimeFormat("es-PE", { day: "2-digit", month: "short", ...(withYear ? { year: "numeric" } : {}) }).format(new Date(`${date}T12:00:00`)).replaceAll(".", "");
}

function daysBetween(startsOn, endsOn) {
  return Math.floor((new Date(`${endsOn}T12:00:00`) - new Date(`${startsOn}T12:00:00`)) / 86400000) + 1;
}

function periodStatus(period) {
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Lima" });
  if (today < period.startsOn) return { label: "Próximo", className: "border-[#b7d7ea] bg-[#eff8fd] text-[#176d9f]" };
  if (today > period.endsOn) return { label: "Finalizado", className: "border-[#d6dfdc] bg-[#f3f6f5] text-[#66736f]" };
  return { label: "En curso", className: "border-[#ead38c] bg-[#fff8df] text-[#755711]" };
}

function Notice({ children, tone = "error", onRetry }) {
  const success = tone === "success";
  return <div className={`mb-4 flex items-center gap-3 rounded-[7px] border px-4 py-3 text-[10px] ${success ? "border-[#a9d6c5] bg-[#f1faf6] text-brand-900" : "border-[#efb0ad] bg-[#fff6f5] text-[#8f2924]"}`} role={success ? "status" : "alert"}>{success ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <CircleAlert className="h-4 w-4 shrink-0" />}<span className="flex-1 font-semibold">{children}</span>{onRetry ? <button className="inline-flex items-center gap-1 font-extrabold" onClick={onRetry}><RefreshCw className="h-3.5 w-3.5" />Reintentar</button> : null}</div>;
}

function EmptyPeriods({ blocked }) {
  return <div className="grid min-h-[250px] place-content-center justify-items-center px-5 text-center"><span className="grid h-12 w-12 place-items-center rounded-full bg-[#eff8fd] text-[#237db3]"><CalendarRange className="h-5 w-5" /></span><h3 className="mb-1 mt-3 font-sans text-[15px] font-extrabold text-brand-950">{blocked ? "Primero crea un año lectivo" : "Aún no hay periodos configurados"}</h3><p className="m-0 max-w-[330px] text-[9px] leading-relaxed text-muted">{blocked ? "Los periodos necesitan las fechas y la organización definidas en Años lectivos." : "Usa la acción superior para revisar la propuesta y guardar las fechas reales."}</p></div>;
}

function PeriodRow({ period, index }) {
  const status = periodStatus(period);
  return <article className="grid gap-3 border-b border-line px-4 py-4 last:border-b-0 sm:grid-cols-[1.1fr_1fr_0.55fr_auto] sm:items-center sm:px-5"><div className="flex items-center gap-3"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-[10px] font-extrabold text-white" style={{ backgroundColor: TONES[index] }}>{period.number}</span><div><strong className="block text-[10px] text-brand-950">{period.name}</strong><small className="mt-0.5 block text-[8px] text-muted">Periodo {period.number}</small></div></div><div><small className="block text-[8px] font-bold uppercase tracking-[0.07em] text-muted sm:hidden">Fechas</small><span className="text-[10px] font-semibold text-[#42524c]">{formatDate(period.startsOn)} — {formatDate(period.endsOn)}</span></div><div className="flex items-center gap-2 text-[9px] font-bold text-[#52615c]"><Clock3 className="h-3.5 w-3.5 text-[#237db3]" />{daysBetween(period.startsOn, period.endsOn)} días</div><div className="flex items-center sm:justify-end"><span className={`inline-flex rounded-full border px-2.5 py-1 text-[8px] font-extrabold ${status.className}`}>{status.label}</span></div></article>;
}

export default function AcademicPeriodsManagement({ user }) {
  const connected = isSupabaseConfigured && user?.authSource === "supabase";
  const [years, setYears] = useState([]);
  const [periods, setPeriods] = useState([]);
  const [selectedYear, setSelectedYear] = useState("");
  const [loading, setLoading] = useState(connected);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(connected ? "" : "Inicia sesión con una cuenta de Dirección conectada a Supabase.");
  const [notice, setNotice] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const refreshTimer = useRef(null);

  const refresh = useCallback(async ({ quiet = false } = {}) => {
    if (!connected) return;
    if (!quiet) setLoading(true);
    try {
      const [yearRows, periodRows] = await Promise.all([loadAcademicYears(), loadAcademicPeriods()]);
      setYears(yearRows); setPeriods(periodRows); setError("");
      setSelectedYear((current) => current && yearRows.some((year) => String(year.id) === String(current)) ? current : String(yearRows.find((year) => year.status === "activo")?.id || yearRows.find((year) => year.status === "preparacion")?.id || yearRows[0]?.id || ""));
    } catch (requestError) { setError(requestError.message); }
    finally { setLoading(false); }
  }, [connected]);

  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => {
    if (!connected) return undefined;
    return subscribeToAcademicPeriods(() => {
      window.clearTimeout(refreshTimer.current);
      refreshTimer.current = window.setTimeout(() => refresh({ quiet: true }), 180);
    });
  }, [connected, refresh]);
  useEffect(() => () => window.clearTimeout(refreshTimer.current), []);

  const currentYear = useMemo(() => years.find((year) => String(year.id) === String(selectedYear)), [years, selectedYear]);
  const visiblePeriods = useMemo(() => periods.filter((period) => String(period.yearId) === String(selectedYear)).sort((a, b) => a.number - b.number), [periods, selectedYear]);
  const blocked = !currentYear;
  const readOnly = currentYear?.status === "cerrado";

  async function save(values) {
    setBusy(true); setError(""); setNotice("");
    try {
      await saveAcademicPeriods(currentYear.id, values);
      setDialogOpen(false);
      setNotice("Los periodos académicos se guardaron correctamente.");
      await refresh({ quiet: true });
    } catch (requestError) { setError(requestError.message); }
    finally { setBusy(false); }
  }

  return <section className="mx-auto max-w-[1240px] pb-14 text-ink" aria-busy={loading || busy}>
    <PageHeading standard title="Periodos académicos" description="Define las fechas de evaluación dentro de cada año lectivo" action={<button type="button" aria-label={visiblePeriods.length ? "Editar periodos" : "Configurar periodos"} disabled={blocked || readOnly} className="inline-flex min-h-[42px] items-center gap-2 rounded-[5px] bg-[#f3bd24] px-5 text-[10px] font-extrabold text-brand-950 shadow-[0_7px_18px_rgba(139,101,0,0.13)] hover:bg-[#ffd34f] disabled:cursor-not-allowed disabled:opacity-45" onClick={() => setDialogOpen(true)}>{visiblePeriods.length ? <Pencil className="h-4 w-4" /> : <Plus className="h-4 w-4" />}<span className="hidden sm:inline">{visiblePeriods.length ? "Editar periodos" : "Configurar periodos"}</span></button>} />
    {error ? <Notice onRetry={connected ? () => refresh() : undefined}>{error}</Notice> : null}
    {notice ? <Notice tone="success">{notice}</Notice> : null}

    <section className="mb-4 flex flex-wrap items-end gap-3 rounded-[9px] border border-line-strong bg-white p-4 shadow-[0_8px_24px_rgba(7,54,42,0.04)]">
      <label className="grid gap-1.5"><span className="text-[8px] font-extrabold uppercase tracking-[0.08em] text-muted">Año lectivo</span><select className={SELECT} value={selectedYear} onChange={(event) => { setSelectedYear(event.target.value); setNotice(""); }}><option value="">Seleccionar año</option>{years.map((year) => <option key={year.id} value={year.id}>{year.name}{year.status === "cerrado" ? " · cerrado" : ""}</option>)}</select></label>
      {currentYear ? <div className="flex flex-1 flex-wrap items-center gap-x-5 gap-y-1 text-[9px] text-muted sm:justify-end"><span><strong className="text-brand-900">{SYSTEM_LABELS[currentYear.periodSystem]}</strong></span><span>{formatDate(currentYear.startsOn, true)} — {formatDate(currentYear.endsOn, true)}</span>{readOnly ? <span className="font-bold">Solo consulta</span> : null}</div> : null}
    </section>

    {visiblePeriods.length ? <section className="mb-4 overflow-hidden rounded-[9px] border border-line-strong bg-white shadow-[0_12px_35px_rgba(7,54,42,0.05)]"><div className="flex h-2" aria-hidden="true">{visiblePeriods.map((period, index) => <i key={period.id} className="flex-1" style={{ backgroundColor: TONES[index] }} />)}</div><div className="grid gap-1 px-4 py-4 sm:grid-cols-[1fr_auto] sm:items-center sm:px-5"><div><h2 className="m-0 font-sans text-[14px] font-bold text-brand-950">Distribución del año</h2><p className="mb-0 mt-1 text-[8px] text-muted">{visiblePeriods.length} periodos configurados para {currentYear?.name}</p></div><div className="mt-3 flex min-w-0 overflow-hidden rounded-full bg-[#edf2f0] sm:mt-0 sm:w-[330px]">{visiblePeriods.map((period, index) => <span key={period.id} className="h-2 flex-1 border-r-2 border-white last:border-r-0" title={period.name} style={{ backgroundColor: TONES[index] }} />)}</div></div></section> : null}

    <section className="overflow-hidden rounded-[9px] border border-line-strong bg-white shadow-[0_12px_35px_rgba(7,54,42,0.05)]">
      <header className="flex min-h-[58px] items-center justify-between border-b border-line px-4 sm:px-5"><div><h2 className="m-0 font-sans text-[14px] font-bold text-brand-950">Periodos del año</h2><p className="mb-0 mt-1 text-[8px] text-muted">{visiblePeriods.length ? `${visiblePeriods.length} registrados` : "Sin registros"}</p></div>{loading ? <LoaderCircle className="h-4 w-4 animate-spin text-brand-800" /> : null}</header>
      {loading ? <div className="grid min-h-[250px] place-content-center justify-items-center gap-3 text-[10px] text-muted"><LoaderCircle className="h-6 w-6 animate-spin text-[#237db3]" />Cargando...</div> : visiblePeriods.length ? <>{visiblePeriods.map((period, index) => <PeriodRow key={period.id} period={period} index={index} />)}</> : <EmptyPeriods blocked={blocked} />}
    </section>

    {dialogOpen && currentYear ? <AcademicPeriodsDialog year={currentYear} periods={visiblePeriods} busy={busy} requestError={error} onClose={() => { if (!busy) setDialogOpen(false); }} onSave={save} /> : null}
  </section>;
}
