import { Calculator, CheckCircle2, CircleAlert, GraduationCap, ListChecks, LoaderCircle, Pencil, Plus, RefreshCw, ShieldCheck } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import PageHeading from "../../components/PageHeading";
import { isSupabaseConfigured } from "../../lib/supabase";
import { loadAcademicYears } from "../academic-years/academicYearsApi";
import { loadEducationLevels } from "../education-levels/educationLevelsApi";
import EvaluationDialog from "./EvaluationDialog";
import { loadEvaluationConfigurations, saveEvaluationConfiguration, subscribeToEvaluationConfigurations } from "./evaluationApi";

const SELECT = "min-h-11 min-w-[210px] rounded-[6px] border border-line-strong bg-white px-3 text-[10px] font-bold text-brand-950 outline-none focus:border-[#237db3] focus:shadow-[0_0_0_3px_rgba(35,125,179,0.12)]";
const SCALE_LABELS = { cualitativa: "Escala cualitativa", numerica: "Escala numérica" };
const CALCULATION_LABELS = { ultimo_logro: "Último logro alcanzado", promedio_periodos: "Promedio de periodos" };
const ACHIEVEMENT_TONES = ["#07845f", "#237db3", "#d89e00", "#4a9b72", "#6e7c77", "#8a6a3b", "#3d7e8c", "#506f60"];

function Notice({ children, tone = "error", onRetry }) {
  const success = tone === "success";
  return <div className={`mb-4 flex items-center gap-3 rounded-[7px] border px-4 py-3 text-[10px] ${success ? "border-[#a9d6c5] bg-[#f1faf6] text-brand-900" : "border-[#efb0ad] bg-[#fff6f5] text-[#8f2924]"}`} role={success ? "status" : "alert"}>{success ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <CircleAlert className="h-4 w-4 shrink-0" />}<span className="flex-1 font-semibold">{children}</span>{onRetry ? <button className="inline-flex items-center gap-1 font-extrabold" onClick={onRetry}><RefreshCw className="h-3.5 w-3.5" />Reintentar</button> : null}</div>;
}

function EmptyEvaluation({ missingYear, missingLevel }) {
  const title = missingYear ? "Primero crea un año lectivo" : missingLevel ? "Primero crea un nivel educativo" : "Este nivel aún no tiene evaluación configurada";
  const detail = missingYear ? "La evaluación debe quedar vinculada a una vigencia académica." : missingLevel ? "Cada configuración se aplica a un nivel educativo." : "Usa la acción superior para definir su sistema y escala.";
  return <div className="grid min-h-[260px] place-content-center justify-items-center px-5 text-center"><span className="grid h-12 w-12 place-items-center rounded-full bg-[#eff8fd] text-[#237db3]"><GraduationCap className="h-5 w-5" /></span><h3 className="mb-1 mt-3 font-sans text-[15px] font-extrabold text-brand-950">{title}</h3><p className="m-0 max-w-[330px] text-[9px] leading-relaxed text-muted">{detail}</p></div>;
}

function ConfigurationView({ configuration }) {
  const ScaleIcon = configuration.scaleType === "cualitativa" ? ListChecks : Calculator;
  return <div><section className="grid border-b border-line sm:grid-cols-2"><div className="flex items-center gap-4 p-5 sm:border-r sm:border-line"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-brand-50 text-brand-800"><ScaleIcon className="h-5 w-5" /></span><div><small className="text-[8px] font-extrabold uppercase tracking-[0.08em] text-muted">Sistema</small><strong className="mt-1 block font-sans text-[16px] text-brand-950">{SCALE_LABELS[configuration.scaleType]}</strong></div></div><div className="flex items-center gap-4 p-5"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#fff5ca] text-[#8b6500]"><ShieldCheck className="h-5 w-5" /></span><div><small className="text-[8px] font-extrabold uppercase tracking-[0.08em] text-muted">Resultado final</small><strong className="mt-1 block font-sans text-[16px] text-brand-950">{CALCULATION_LABELS[configuration.finalCalculation]}</strong></div></div></section>{configuration.scaleType === "cualitativa" ? <section><header className="border-b border-line px-5 py-4"><h3 className="m-0 font-sans text-[14px] font-bold text-brand-950">Niveles de logro</h3><p className="mb-0 mt-1 text-[8px] text-muted">Ordenados desde el logro más alto hasta el más bajo</p></header><div>{configuration.achievementLevels.map((item, index) => <article key={item.id || `${item.code}-${index}`} className="grid gap-3 border-b border-line px-5 py-4 last:border-b-0 sm:grid-cols-[70px_1fr_auto] sm:items-center"><span className="grid h-10 w-10 place-items-center rounded-full text-[10px] font-extrabold text-white" style={{ backgroundColor: ACHIEVEMENT_TONES[index] }}>{item.code}</span><div><strong className="block text-[10px] text-brand-950">{item.name}</strong><small className="mt-0.5 block text-[8px] text-muted">Nivel {index + 1}</small></div><span className={`w-fit rounded-full border px-2.5 py-1 text-[8px] font-extrabold ${item.satisfactory ? "border-[#a9d6c5] bg-[#f1faf6] text-brand-800" : "border-[#d6dfdc] bg-[#f3f6f5] text-[#66736f]"}`}>{item.satisfactory ? "Satisfactorio" : "En proceso"}</span></article>)}</div></section> : <section className="p-5 sm:p-7"><div className="mx-auto max-w-[760px]"><div className="mb-4 flex items-end justify-between gap-4"><div><small className="text-[8px] font-extrabold uppercase tracking-[0.08em] text-muted">Rango permitido</small><strong className="mt-1 block font-sans text-[26px] text-brand-950">{configuration.minimum} — {configuration.maximum}</strong></div><div className="text-right"><small className="text-[8px] font-extrabold uppercase tracking-[0.08em] text-muted">Nota aprobatoria</small><strong className="mt-1 block font-sans text-[22px] text-[#237db3]">{configuration.passing}</strong></div></div><div className="relative h-3 overflow-hidden rounded-full bg-[#e6eeeb]"><i className="absolute inset-y-0 left-0 bg-[#f3bd24]" style={{ width: `${Math.max(0, Math.min(100, ((configuration.passing - configuration.minimum) / (configuration.maximum - configuration.minimum)) * 100))}%` }} /><i className="absolute inset-y-0 right-0 bg-brand-700" style={{ width: `${Math.max(0, Math.min(100, ((configuration.maximum - configuration.passing) / (configuration.maximum - configuration.minimum)) * 100))}%` }} /></div><p className="mb-0 mt-3 text-[9px] text-muted">Se admitirán {configuration.decimals === 0 ? "valores enteros" : `${configuration.decimals} decimal${configuration.decimals === 1 ? "" : "es"}`}.</p></div></section>}</div>;
}

export default function EvaluationManagement({ user }) {
  const connected = isSupabaseConfigured && user?.authSource === "supabase";
  const [years, setYears] = useState([]);
  const [levels, setLevels] = useState([]);
  const [configurations, setConfigurations] = useState([]);
  const [selectedYear, setSelectedYear] = useState("");
  const [selectedLevel, setSelectedLevel] = useState("");
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
      const [yearRows, levelRows, configurationRows] = await Promise.all([loadAcademicYears(), loadEducationLevels(), loadEvaluationConfigurations()]);
      const activeLevels = levelRows.filter((level) => level.active);
      setYears(yearRows); setLevels(activeLevels); setConfigurations(configurationRows); setError("");
      setSelectedYear((current) => current && yearRows.some((year) => String(year.id) === String(current)) ? current : String(yearRows.find((year) => year.status === "activo")?.id || yearRows.find((year) => year.status === "preparacion")?.id || yearRows[0]?.id || ""));
      setSelectedLevel((current) => current && activeLevels.some((level) => String(level.id) === String(current)) ? current : String(activeLevels[0]?.id || ""));
    } catch (requestError) { setError(requestError.message); }
    finally { setLoading(false); }
  }, [connected]);

  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => {
    if (!connected) return undefined;
    return subscribeToEvaluationConfigurations(() => {
      window.clearTimeout(refreshTimer.current);
      refreshTimer.current = window.setTimeout(() => refresh({ quiet: true }), 180);
    });
  }, [connected, refresh]);
  useEffect(() => () => window.clearTimeout(refreshTimer.current), []);

  const currentYear = useMemo(() => years.find((year) => String(year.id) === String(selectedYear)), [years, selectedYear]);
  const currentLevel = useMemo(() => levels.find((level) => String(level.id) === String(selectedLevel)), [levels, selectedLevel]);
  const currentConfiguration = useMemo(() => configurations.find((item) => String(item.yearId) === String(selectedYear) && String(item.levelId) === String(selectedLevel)), [configurations, selectedYear, selectedLevel]);
  const blocked = !currentYear || !currentLevel;
  const readOnly = currentYear?.status === "cerrado";

  async function save(values) {
    setBusy(true); setError(""); setNotice("");
    try {
      await saveEvaluationConfiguration(values);
      setDialogOpen(false);
      setNotice(`La evaluación de ${currentLevel.name} se guardó correctamente.`);
      await refresh({ quiet: true });
    } catch (requestError) { setError(requestError.message); }
    finally { setBusy(false); }
  }

  return <section className="mx-auto max-w-[1240px] pb-14 text-ink" aria-busy={loading || busy}>
    <PageHeading standard title="Escala de notas" description="Define cómo se califica en cada nivel: escala, rango y nota aprobatoria. Los exámenes se programan en Planificación → Evaluaciones y exámenes." action={<button type="button" aria-label={currentConfiguration ? "Editar evaluación" : "Configurar evaluación"} disabled={blocked || readOnly} className="inline-flex min-h-[42px] items-center gap-2 rounded-[5px] bg-[#f3bd24] px-5 text-[10px] font-extrabold text-brand-950 shadow-[0_7px_18px_rgba(139,101,0,0.13)] hover:bg-[#ffd34f] disabled:cursor-not-allowed disabled:opacity-45" onClick={() => setDialogOpen(true)}>{currentConfiguration ? <Pencil className="h-4 w-4" /> : <Plus className="h-4 w-4" />}<span className="hidden sm:inline">{currentConfiguration ? "Editar evaluación" : "Configurar evaluación"}</span></button>} />
    {error ? <Notice onRetry={connected ? () => refresh() : undefined}>{error}</Notice> : null}
    {notice ? <Notice tone="success">{notice}</Notice> : null}

    <section className="mb-4 grid gap-4 rounded-[9px] border border-line-strong bg-white p-4 shadow-[0_8px_24px_rgba(7,54,42,0.04)] sm:grid-cols-[230px_1fr] sm:items-end"><label className="grid gap-1.5"><span className="text-[8px] font-extrabold uppercase tracking-[0.08em] text-muted">Año lectivo</span><select className={SELECT} value={selectedYear} onChange={(event) => { setSelectedYear(event.target.value); setNotice(""); }}><option value="">Seleccionar año</option>{years.map((year) => <option key={year.id} value={year.id}>{year.name}{year.status === "cerrado" ? " · cerrado" : ""}</option>)}</select></label><fieldset className="min-w-0"><legend className="mb-1.5 text-[8px] font-extrabold uppercase tracking-[0.08em] text-muted">Nivel educativo</legend><div className="flex min-w-0 flex-wrap gap-2">{levels.map((level) => { const selected = String(level.id) === String(selectedLevel); const configured = configurations.some((item) => String(item.yearId) === String(selectedYear) && String(item.levelId) === String(level.id)); return <button key={level.id} type="button" aria-pressed={selected} className={`relative min-h-11 rounded-[6px] border px-4 text-[9px] font-extrabold transition ${selected ? "border-brand-700 bg-brand-800 text-white" : "border-line-strong bg-white text-[#46554f] hover:border-brand-600"}`} onClick={() => { setSelectedLevel(String(level.id)); setNotice(""); }}>{level.name}{configured ? <i className={`absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full ${selected ? "bg-[#f3bd24]" : "bg-[#237db3]"}`} /> : null}</button>; })}</div></fieldset></section>

    <section className="overflow-hidden rounded-[9px] border border-line-strong bg-white shadow-[0_12px_35px_rgba(7,54,42,0.05)]"><header className="flex min-h-[62px] items-center justify-between border-b border-line px-4 sm:px-5"><div><h2 className="m-0 font-sans text-[14px] font-bold text-brand-950">{currentLevel?.name || "Configuración del nivel"}</h2><p className="mb-0 mt-1 text-[8px] text-muted">{currentConfiguration ? "Sistema institucional configurado" : "Sin configuración"}{readOnly ? " · solo consulta" : ""}</p></div>{loading ? <LoaderCircle className="h-4 w-4 animate-spin text-brand-800" /> : null}</header>{loading ? <div className="grid min-h-[260px] place-content-center justify-items-center gap-3 text-[10px] text-muted"><LoaderCircle className="h-6 w-6 animate-spin text-[#237db3]" />Cargando…</div> : currentConfiguration ? <ConfigurationView configuration={currentConfiguration} /> : <EmptyEvaluation missingYear={!currentYear} missingLevel={!currentLevel} />}</section>

    <p className="mb-0 mt-4 flex items-center gap-2 text-[8px] leading-relaxed text-muted"><ShieldCheck className="h-4 w-4 shrink-0 text-brand-700" />Los criterios específicos de cada competencia se definirán posteriormente dentro de sus cursos.</p>
    {dialogOpen && currentYear && currentLevel ? <EvaluationDialog year={currentYear} level={currentLevel} configuration={currentConfiguration} busy={busy} requestError={error} onClose={() => { if (!busy) setDialogOpen(false); }} onSave={save} /> : null}
  </section>;
}
