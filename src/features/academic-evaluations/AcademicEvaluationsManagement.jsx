import { AlertCircle, Archive, Sparkles, CalendarCheck2, CalendarDays, CheckCircle2, Clock3, Eye, EyeOff, FileEdit, GraduationCap, LoaderCircle, Pencil, Plus, RefreshCw, School, Search, UsersRound } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import PageHeading from "../../components/PageHeading";
import { isSupabaseConfigured } from "../../lib/supabase";
import EvaluationEditor from "./EvaluationEditor";
import EvaluationPlanDialog from "./EvaluationPlanDialog";
import { KINDS, dayMonth, evaluationKind, limaToday } from "../evaluation-plan/planUtils";

const STATE_DOT = { borrador: "bg-[#e0a100]", programada: "bg-[#2488b8]", en_curso: "bg-[#087a5b]", cerrada: "bg-[#9aa7a2]" };

// Vista del plan: cada periodo como una línea de tiempo de fichas por tipo de evaluación.
function PlanTimeline({ evaluations, periods, onOpen }) {
  const today = limaToday();
  return <div className="grid gap-4 p-4 sm:p-5">{periods.filter((period) => evaluations.some((item) => String(item.periodId) === String(period.id))).map((period) => {
    const items = evaluations.filter((item) => String(item.periodId) === String(period.id)).sort((a, b) => a.date.localeCompare(b.date));
    const current = period.startsOn <= today && today <= period.endsOn;
    return <article key={period.id} className={`rounded-2xl border p-4 ${current ? "border-[#087a5b] bg-[#f6fbf9]" : "border-[#d3e0db]"}`}>
      <header className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1"><h3 className="m-0 text-base font-extrabold text-[#1b3027]">{period.name}</h3>{current ? <span className="rounded-full bg-[#087a5b] px-2.5 py-0.5 text-[10px] font-extrabold uppercase text-white">En curso</span> : null}<small className="text-xs font-semibold text-[#6d7b75]">{dayMonth(period.startsOn)} – {dayMonth(period.endsOn)} · {items.length} evaluaciones</small></header>
      <div className="flex flex-wrap gap-2">{items.map((item) => { const kind = evaluationKind(item.title); const past = item.date < today; return <button key={item.id} type="button" onClick={() => onOpen(item)} disabled={item.status === "cerrada"} title={`${item.title} · ${STATUS[item.status]?.label || item.status}`} aria-label={`Editar ${item.title} del ${dayMonth(item.date)}`}
        className={`relative flex min-w-[76px] flex-col items-start rounded-xl border px-3 py-2 text-left transition hover:-translate-y-0.5 hover:shadow-md disabled:cursor-default disabled:hover:translate-y-0 disabled:hover:shadow-none ${KINDS[kind.key].chip} ${past ? "opacity-70" : ""}`}>
        <i className={`absolute right-2 top-2 h-2 w-2 rounded-full ${STATE_DOT[item.status] || STATE_DOT.borrador}`} />
        <strong className="pr-3 text-xs font-extrabold">{kind.short}</strong><span className="text-[11px] font-semibold">{dayMonth(item.date)}</span>
      </button>; })}</div>
    </article>;
  })}
  <footer className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-[#6d7b75]">{Object.entries({ weekly: "Examen semanal", mid: "Mitad de periodo", final: "Final de periodo", other: "Otras" }).map(([keyName, label]) => <span key={keyName} className="flex items-center gap-1.5"><i className={`h-2.5 w-2.5 rounded-full ${KINDS[keyName].dot}`} />{label}</span>)}<span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-[#2488b8]" />Programada</span><span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-[#9aa7a2]" />Cerrada</span></footer>
  </div>;
}
import { archiveAcademicEvaluation, loadEvaluationsWorkspace, saveAcademicEvaluation, subscribeToAcademicEvaluations } from "./academicEvaluationsApi";

const EMPTY = { years: [], levels: [], grades: [], sections: [], subjects: [], offerings: [], periods: [], evaluations: [] };
const STATUS = {
  borrador: { label: "Borrador", className: "border-[#efd38c] bg-[#fff8e7] text-[#8c6200]" },
  programada: { label: "Programada", className: "border-[#b9d9eb] bg-[#eef8fd] text-[#176d9f]" },
  en_curso: { label: "En curso", className: "border-[#add8c8] bg-[#eef9f4] text-[#087456]" },
  cerrada: { label: "Cerrada", className: "border-[#d0d9d5] bg-[#f3f6f5] text-[#5d6c66]" },
};
const TYPE = { diagnostica: "Diagnóstica", formativa: "Formativa", sumativa: "Sumativa", practica: "Práctica", proyecto: "Proyecto", examen: "Examen" };

function Selector({ label, icon: Icon, children, ...props }) {
  return <label className="min-w-0"><span className="mb-2 flex items-center gap-2 whitespace-nowrap text-[10px] font-extrabold uppercase tracking-[.1em] text-[#687a73]"><Icon size={15} className="text-[#2488b8]"/>{label}</span><select {...props} className="min-h-11 w-full rounded-xl border border-[#b7cbc4] bg-white px-3 text-sm font-bold text-[#25382f] outline-none focus:border-[#087a5b]">{children}</select></label>;
}

function Summary({ value, label, icon: Icon, tone }) {
  return <div className="flex min-h-[92px] items-center gap-4 px-5 py-4"><span className={`grid h-11 w-11 shrink-0 place-items-center rounded-full ${tone}`}><Icon size={20}/></span><span><strong className="block text-2xl font-extrabold tracking-[-.04em] text-[#172b22]">{value}</strong><small className="text-sm font-semibold text-[#6d7c76]">{label}</small></span></div>;
}

function formatDate(value) {
  if (!value) return "Sin fecha";
  return new Intl.DateTimeFormat("es-PE", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}T12:00:00Z`));
}

export function AcademicEvaluationsView({ data, loading, refreshing, busy, error, feedback, onRefresh, onSave, onArchive, onPlanDone }) {
  const [yearId, setYearId] = useState("");
  const [levelId, setLevelId] = useState("");
  const [gradeId, setGradeId] = useState("");
  const [sectionId, setSectionId] = useState("");
  const [courseId, setCourseId] = useState("");
  const [periodId, setPeriodId] = useState("todos");
  const [status, setStatus] = useState("todos");
  const [query, setQuery] = useState("");
  const [editor, setEditor] = useState(null);
  const [planOpen, setPlanOpen] = useState(false);
  const [mode, setMode] = useState("plan");

  const years = useMemo(() => [...data.years].sort((a, b) => String(b.startsOn).localeCompare(String(a.startsOn))), [data.years]);
  const levels = useMemo(() => data.levels.filter((item) => item.active).sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0)), [data.levels]);
  useEffect(() => { if (years.length && !years.some((item) => String(item.id) === yearId)) setYearId(String(years.find((item) => item.active)?.id || years[0].id)); }, [years, yearId]);
  useEffect(() => { if (levels.length && !levels.some((item) => String(item.id) === levelId)) setLevelId(String(levels[0].id)); }, [levels, levelId]);
  const grades = useMemo(() => data.grades.filter((item) => String(item.levelId) === levelId).sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0)), [data.grades, levelId]);
  useEffect(() => { if (!grades.some((item) => String(item.id) === gradeId)) setGradeId(String(grades[0]?.id || "")); }, [grades, gradeId]);
  const sections = useMemo(() => data.sections.filter((item) => item.active && String(item.academicYearId) === yearId && String(item.gradeId) === gradeId), [data.sections, yearId, gradeId]);
  useEffect(() => { if (!sections.some((item) => String(item.id) === sectionId)) setSectionId(String(sections[0]?.id || "")); }, [sections, sectionId]);
  const subjectMap = useMemo(() => new Map(data.subjects.map((item) => [String(item.id), item])), [data.subjects]);
  const courses = useMemo(() => data.offerings.filter((item) => item.active && !item.archivedAt && String(item.sectionId) === sectionId).map((item) => ({ ...item, name: item.displayName || subjectMap.get(String(item.subjectId))?.name || "Curso sin nombre" })).sort((a, b) => a.name.localeCompare(b.name, "es")), [data.offerings, sectionId, subjectMap]);
  useEffect(() => { if (!courses.some((item) => String(item.id) === courseId)) setCourseId(String(courses[0]?.id || "")); }, [courses, courseId]);
  const periods = useMemo(() => data.periods.filter((item) => String(item.yearId) === yearId).sort((a, b) => a.number - b.number), [data.periods, yearId]);
  useEffect(() => { if (periodId !== "todos" && !periods.some((item) => String(item.id) === periodId)) setPeriodId("todos"); }, [periods, periodId]);

  const periodMap = useMemo(() => new Map(data.periods.map((item) => [String(item.id), item])), [data.periods]);
  const scoped = useMemo(() => data.evaluations.filter((item) => String(item.courseOfferingId) === courseId), [data.evaluations, courseId]);
  const filtered = useMemo(() => scoped.filter((item) => (periodId === "todos" || String(item.periodId) === periodId) && (status === "todos" || item.status === status) && (!query.trim() || item.title.toLocaleLowerCase("es").includes(query.trim().toLocaleLowerCase("es")))), [scoped, periodId, status, query]);
  const counts = useMemo(() => scoped.reduce((result, item) => ({ ...result, [item.status]: (result[item.status] || 0) + 1 }), { borrador: 0, programada: 0, en_curso: 0, cerrada: 0 }), [scoped]);
  const canCreate = Boolean(yearId && levelId && gradeId && sectionId && courseId && periods.length);

  async function save(values) { if (await onSave(values)) setEditor(null); }
  async function archive(item) { if (window.confirm(`¿Archivar “${item.title}”? Dejará de mostrarse en la planificación.`)) await onArchive(item.id); }

  if (loading) return <div className="grid min-h-[560px] place-items-center"><LoaderCircle className="animate-spin text-[#087a5b]" size={38}/></div>;
  return (
    <div className="mx-auto max-w-[1500px] px-4 py-6 font-sans sm:px-7 lg:px-9 lg:py-9">
      <PageHeading standard title="Evaluaciones y exámenes" description="Programa los exámenes de cada curso. Usa “Plan estándar” para crear de una vez los semanales, los de mitad y los de fin de bimestre." action={<div className="flex flex-wrap gap-2"><button type="button" disabled={!yearId || !periods.length} className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-[#087a5b] bg-white px-5 text-sm font-extrabold text-[#087a5b] hover:bg-[#f1faf6] disabled:cursor-not-allowed disabled:opacity-45" onClick={() => setPlanOpen(true)}><Sparkles size={18}/>Plan estándar</button><button type="button" aria-label="Nueva evaluación" disabled={!canCreate} className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-[#f5c127] px-5 text-sm font-extrabold text-[#183128] shadow-[0_10px_24px_rgba(173,124,0,.16)] hover:bg-[#ffd451] disabled:cursor-not-allowed disabled:opacity-45" onClick={() => setEditor({ evaluation: null })}><Plus size={18}/><span className="hidden sm:inline">Nueva evaluación</span></button></div>}/>
      {error ? <div className="mb-5 flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-800"><AlertCircle size={18}/>{error}</div> : null}
      {feedback ? <div className={`mb-5 flex items-center gap-3 rounded-xl border px-4 py-3 text-sm font-bold ${feedback.type === "error" ? "border-red-200 bg-red-50 text-red-800" : "border-emerald-200 bg-emerald-50 text-emerald-800"}`}>{feedback.type === "error" ? <AlertCircle size={18}/> : <CheckCircle2 size={18}/>} {feedback.text}</div> : null}

      <section className="overflow-hidden rounded-2xl border border-[#b4c9c1] bg-white shadow-[0_14px_40px_rgba(17,45,36,.05)]">
        <div className="h-1 bg-[linear-gradient(90deg,#087a5b_0_45%,#f5c127_45%_72%,#2488b8_72%)]"/>
        <div className="grid gap-4 p-5 sm:grid-cols-2 xl:grid-cols-[1.15fr_1fr_.8fr_.8fr_1.3fr_1fr_48px]">
          <Selector label="Año lectivo" icon={CalendarDays} value={yearId} onChange={(event) => setYearId(event.target.value)}>{years.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Selector>
          <Selector label="Nivel" icon={School} value={levelId} onChange={(event) => setLevelId(event.target.value)}>{levels.map((item) => <option key={item.id} value={item.id}>{item.name.replace(/^Educación\s+/i, "")}</option>)}</Selector>
          <Selector label="Grado" icon={GraduationCap} value={gradeId} onChange={(event) => setGradeId(event.target.value)}>{grades.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Selector>
          <Selector label="Salón" icon={UsersRound} value={sectionId} onChange={(event) => setSectionId(event.target.value)}>{sections.map((item) => <option key={item.id} value={item.id}>Sección {item.name}</option>)}</Selector>
          <Selector label="Curso" icon={CalendarCheck2} value={courseId} onChange={(event) => setCourseId(event.target.value)}>{courses.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Selector>
          <Selector label="Periodo" icon={Clock3} value={periodId} onChange={(event) => setPeriodId(event.target.value)}><option value="todos">Todos</option>{periods.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Selector>
          <button type="button" className="mt-auto grid h-11 w-12 place-items-center rounded-xl border border-[#b7cbc4] text-[#087456]" onClick={onRefresh} aria-label="Actualizar"><RefreshCw size={18} className={refreshing ? "animate-spin" : ""}/></button>
        </div>
      </section>

      <section className="mt-4 grid divide-y rounded-xl border border-[#c6d6d0] bg-white sm:grid-cols-4 sm:divide-x sm:divide-y-0">
        <Summary label="Borradores" value={counts.borrador} icon={FileEdit} tone="bg-[#fff3cf] text-[#9a7100]"/>
        <Summary label="Programadas" value={counts.programada} icon={CalendarDays} tone="bg-[#eaf4fa] text-[#247da8]"/>
        <Summary label="En curso" value={counts.en_curso} icon={Clock3} tone="bg-[#e8f6ee] text-[#087456]"/>
        <Summary label="Cerradas" value={counts.cerrada} icon={CheckCircle2} tone="bg-[#eef2f0] text-[#607069]"/>
      </section>

      <section className="mt-5 overflow-hidden rounded-2xl border border-[#b4c9c1] bg-white shadow-[0_16px_45px_rgba(17,45,36,.05)]">
        <div className="grid gap-3 border-b border-[#dce6e2] p-4 sm:grid-cols-[1fr_190px_auto]">
          <label className="relative"><Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#75827d]"/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar evaluación" className="min-h-11 w-full rounded-xl border border-[#bdcec8] pl-10 pr-3 text-sm outline-none focus:border-[#087a5b]"/></label>
          <select value={status} onChange={(event) => setStatus(event.target.value)} className="min-h-11 rounded-xl border border-[#bdcec8] px-3 text-sm font-bold"><option value="todos">Todos los estados</option>{Object.entries(STATUS).map(([value, item]) => <option key={value} value={value}>{item.label}</option>)}</select>
        <div className="inline-flex rounded-xl border border-[#bdcec8] p-1" role="group" aria-label="Vista">{[["plan","Plan"],["lista","Lista"]].map(([value,label]) => <button key={value} type="button" aria-pressed={mode === value} onClick={() => setMode(value)} className={`min-h-9 rounded-lg px-4 text-sm font-extrabold ${mode === value ? "bg-[#087a5b] text-white" : "text-[#52635c]"}`}>{label}</button>)}</div></div>
        {!courses.length || !periods.length ? (
          <div className="grid min-h-[360px] place-items-center px-6 text-center"><div><CalendarCheck2 size={38} className="mx-auto text-[#2488b8]"/><h2 className="mt-4 text-xl font-extrabold text-[#1c3027]">Completa la estructura académica</h2><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#718079]">Este salón necesita cursos y periodos académicos antes de programar evaluaciones.</p></div></div>
        ) : filtered.length ? (mode === "plan" ? <PlanTimeline evaluations={filtered} periods={periods} onOpen={(item) => setEditor({ evaluation: item })}/> :
          <div className="divide-y divide-[#e1e9e6]">
            <div className="hidden grid-cols-[minmax(220px,1.5fr)_140px_160px_130px_110px_90px] gap-4 bg-[#f5f8f7] px-5 py-3 text-[10px] font-extrabold uppercase tracking-[.08em] text-[#66766f] lg:grid"><span>Evaluación</span><span>Tipo</span><span>Periodo</span><span>Fecha</span><span>Estado</span><span className="text-right">Acciones</span></div>
            {filtered.map((item) => { const period = periodMap.get(String(item.periodId)); const state = STATUS[item.status] || STATUS.borrador; return <article key={item.id} className="grid gap-4 px-5 py-4 transition hover:bg-[#f8fbfa] lg:grid-cols-[minmax(220px,1.5fr)_140px_160px_130px_110px_90px] lg:items-center"><div className="min-w-0"><h3 className="m-0 truncate text-sm font-extrabold text-[#1d3028]">{item.title}</h3><p className="mb-0 mt-1 flex items-center gap-2 text-xs text-[#75827d]">{item.visibleToStudents ? <><Eye size={13}/>Visible para estudiantes</> : <><EyeOff size={13}/>Aún no visible</>}</p></div><span className="text-sm font-bold text-[#465850]">{TYPE[item.type] || item.type}</span><span className="text-sm font-semibold text-[#52635c]">{period?.name || "Sin periodo"}</span><span className="text-sm font-semibold capitalize text-[#52635c]">{formatDate(item.date)}</span><span className={`w-fit rounded-full border px-3 py-1 text-[10px] font-extrabold ${state.className}`}>{state.label}</span><span className="flex justify-end gap-1"><button type="button" disabled={item.status === "cerrada" || busy} className="grid h-9 w-9 place-items-center rounded-lg text-[#087456] hover:bg-[#eaf6f1] disabled:cursor-not-allowed disabled:opacity-30" onClick={() => setEditor({ evaluation: item })} aria-label={`Editar ${item.title}`}><Pencil size={17}/></button><button type="button" disabled={item.status === "cerrada" || busy} className="grid h-9 w-9 place-items-center rounded-lg text-[#a53c35] hover:bg-[#fff1ef] disabled:cursor-not-allowed disabled:opacity-30" onClick={() => archive(item)} aria-label={`Archivar ${item.title}`}><Archive size={17}/></button></span></article>; })}
          </div>
        ) : (
          <div className="grid min-h-[360px] place-items-center px-6 text-center"><div><CalendarCheck2 size={38} className="mx-auto text-[#2488b8]"/><h2 className="mt-4 text-xl font-extrabold text-[#1c3027]">Aún no hay evaluaciones</h2><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#718079]">Crea la primera evaluación del curso seleccionado cuando tengas lista su programación.</p></div></div>
        )}
      </section>

      {planOpen ? <EvaluationPlanDialog yearId={yearId} level={levels.find((item) => String(item.id) === levelId)} section={sections.find((item) => String(item.id) === sectionId)} periods={periods} onClose={() => setPlanOpen(false)} onDone={(result) => { setPlanOpen(false); onPlanDone?.(result); }}/> : null}
      {editor ? <EvaluationEditor evaluation={editor.evaluation} context={{ yearId, courseId, periodId: periodId === "todos" ? "" : periodId }} courses={courses} periods={periods} busy={busy} onClose={() => setEditor(null)} onSave={save}/> : null}
    </div>
  );
}

export default function AcademicEvaluationsManagement({ user, initialData = null }) {
  const remote = !initialData && isSupabaseConfigured && user?.authSource === "supabase";
  const [data, setData] = useState(initialData || EMPTY);
  const [loading, setLoading] = useState(remote);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(remote || initialData ? "" : "Conecta una sesión de Supabase para gestionar evaluaciones reales.");
  const [feedback, setFeedback] = useState(null);
  const timer = useRef(null);
  const refresh = useCallback(async (quiet = false) => { if (!remote) return; quiet ? setRefreshing(true) : setLoading(true); try { setData(await loadEvaluationsWorkspace()); setError(""); } catch (requestError) { setError(requestError.message); } finally { setLoading(false); setRefreshing(false); } }, [remote]);
  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => { if (!remote) return undefined; const update = () => { clearTimeout(timer.current); timer.current = setTimeout(() => refresh(true), 180); }; return subscribeToAcademicEvaluations(update); }, [remote, refresh]);
  async function save(values) { setBusy(true); setFeedback(null); try { if (remote) await saveAcademicEvaluation(values); setFeedback({ type: "success", text: values.id ? "La evaluación fue actualizada." : "La evaluación fue creada correctamente." }); await refresh(true); return true; } catch (requestError) { setFeedback({ type: "error", text: requestError.message }); return false; } finally { setBusy(false); } }
  async function archive(id) { setBusy(true); setFeedback(null); try { if (remote) await archiveAcademicEvaluation(id); setFeedback({ type: "success", text: "La evaluación fue archivada." }); await refresh(true); } catch (requestError) { setFeedback({ type: "error", text: requestError.message }); } finally { setBusy(false); } }
  async function planDone(result) { setFeedback({ type: "success", text: `Plan estándar generado: ${result.toCreate} evaluaciones nuevas${result.existing ? ` (${result.existing} ya existían y no se duplicaron)` : ""}.` }); await refresh(true); }
  return <AcademicEvaluationsView data={data} loading={loading} refreshing={refreshing} busy={busy} error={error} feedback={feedback} onRefresh={() => refresh()} onSave={save} onArchive={archive} onPlanDone={planDone}/>;
}
