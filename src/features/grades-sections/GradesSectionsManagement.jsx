import { Building2, CalendarDays, CheckCircle2, CircleAlert, GraduationCap, LoaderCircle, Pencil, Plus, RefreshCw, School, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import PageHeading from "../../components/PageHeading";
import { isSupabaseConfigured } from "../../lib/supabase";
import { loadAcademicYears } from "../academic-years/academicYearsApi";
import { loadEducationLevels } from "../education-levels/educationLevelsApi";
import { loadShiftsJournals } from "../shifts-journals/shiftsJournalsApi";
import AcademicStructureDialog from "./AcademicStructureDialog";
import { deleteCompleteGrade, loadGradesAndSections, saveGradeWithClassrooms, subscribeToGradesAndSections } from "./gradesSectionsApi";

const SELECT = "min-h-10 rounded-[6px] border border-line-strong bg-white px-3 text-[10px] font-bold text-ink outline-none focus:border-[#237db3] focus:shadow-[0_0_0_3px_rgba(35,125,179,0.10)]";

function Notice({ children, tone = "error", onRetry }) {
  const success = tone === "success";
  return <div className={`mb-4 flex items-center gap-3 rounded-[7px] border px-4 py-3 text-[10px] ${success ? "border-[#a9d6c5] bg-[#f1faf6] text-brand-900" : "border-[#efb0ad] bg-[#fff6f5] text-[#8f2924]"}`} role={success ? "status" : "alert"}>{success ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <CircleAlert className="h-4 w-4 shrink-0" />}<span className="flex-1 font-semibold">{children}</span>{onRetry ? <button className="inline-flex items-center gap-1 font-extrabold" onClick={onRetry}><RefreshCw className="h-3.5 w-3.5" />Reintentar</button> : null}</div>;
}

function EmptyState({ blocked }) {
  return <div className="grid min-h-[210px] place-content-center justify-items-center px-5 text-center"><span className="grid h-12 w-12 place-items-center rounded-full bg-[#eff8fd] text-[#237db3]"><GraduationCap className="h-5 w-5" /></span><h3 className="mb-1 mt-3 font-sans text-[15px] font-bold text-brand-950">{blocked ? "Completa la configuración anterior" : "Aún no hay grados registrados"}</h3><p className="m-0 max-w-[350px] text-[9px] leading-relaxed text-muted">{blocked ? "Necesitas al menos un nivel educativo y un año lectivo disponible." : "Usa “Nuevo grado” para registrar el grado y sus salones."}</p></div>;
}

function Status({ active }) {
  return <span className={`inline-flex w-fit items-center gap-2 rounded-full border px-2.5 py-1 text-[9px] font-extrabold ${active ? "border-[#a9d6c5] bg-[#f1faf6] text-brand-800" : "border-[#d6dfdc] bg-[#f3f6f5] text-[#66736f]"}`}><i className={`h-1.5 w-1.5 rounded-full ${active ? "bg-brand-700" : "bg-[#82908b]"}`} />{active ? "Activo" : "Inactivo"}</span>;
}

function GradeRow({ grade, level, classrooms, yearClosed, onEdit, onDelete }) {
  return <article className="grid gap-3 border-t border-line px-4 py-4 first:border-t-0 sm:px-5 lg:grid-cols-[1fr_1fr_1.35fr_0.55fr_0.55fr] lg:items-center lg:gap-4">
    <strong className="font-sans text-[15px] font-bold text-brand-950">{grade.name}</strong>
    <span className="flex items-center gap-2 text-[9px] font-bold text-[#42524c]"><School className="h-4 w-4 text-brand-700" />{level?.name || "Nivel no disponible"}</span>
    <div className="flex flex-wrap items-center gap-2">{classrooms.length ? classrooms.map((classroom) => <span key={classroom.id} className="inline-flex items-center gap-1.5 rounded-[5px] border border-[#b7d7ea] bg-[#f1f8fc] px-2 py-1 text-[8px] font-bold text-[#176d9f]"><Building2 className="h-3 w-3" />Salón {classroom.name}<small className="text-muted">· {classroom.shift}</small></span>) : <span className="text-[8px] text-muted">Sin salones este año</span>}</div>
    <Status active={grade.active} />
    <div className="flex items-center gap-1 lg:justify-end">{yearClosed ? <span className="text-[8px] font-bold text-muted">Solo consulta</span> : <><button className="grid h-9 w-9 place-items-center rounded-full text-[#237db3] hover:bg-[#eff8fd]" onClick={onEdit} aria-label={`Editar ${grade.name}`}><Pencil className="h-4 w-4" /></button><button className="grid h-9 w-9 place-items-center rounded-full text-[#a32d28] hover:bg-[#fff1f0]" onClick={onDelete} aria-label={`Eliminar ${grade.name}`}><Trash2 className="h-4 w-4" /></button></>}</div>
  </article>;
}

export default function GradesSectionsManagement({ user }) {
  const connected = isSupabaseConfigured && user?.authSource === "supabase";
  const [levels, setLevels] = useState([]);
  const [years, setYears] = useState([]);
  const [grades, setGrades] = useState([]);
  const [sections, setSections] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [selectedLevel, setSelectedLevel] = useState("");
  const [selectedYear, setSelectedYear] = useState("");
  const [loading, setLoading] = useState(connected);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(connected ? "" : "Inicia sesión con una cuenta de Dirección conectada a Supabase.");
  const [notice, setNotice] = useState("");
  const [dialog, setDialog] = useState(null);
  const refreshTimer = useRef(null);

  const refresh = useCallback(async ({ quiet = false } = {}) => {
    if (!connected) return;
    if (!quiet) setLoading(true);
    try {
      const [levelRows, yearRows, structure, shiftRows] = await Promise.all([loadEducationLevels(), loadAcademicYears(), loadGradesAndSections(), loadShiftsJournals()]);
      setLevels(levelRows); setYears(yearRows); setGrades(structure.grades); setSections(structure.sections); setShifts(shiftRows); setError("");
      setSelectedLevel((current) => current && levelRows.some((level) => String(level.id) === String(current)) ? current : String(levelRows.find((level) => level.active)?.id || levelRows[0]?.id || ""));
      setSelectedYear((current) => current && yearRows.some((year) => String(year.id) === String(current)) ? current : String(yearRows.find((year) => year.status === "activo")?.id || yearRows.find((year) => year.status === "preparacion")?.id || yearRows[0]?.id || ""));
    } catch (requestError) { setError(requestError.message); }
    finally { setLoading(false); }
  }, [connected]);

  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => {
    if (!connected) return undefined;
    return subscribeToGradesAndSections(() => { window.clearTimeout(refreshTimer.current); refreshTimer.current = window.setTimeout(() => refresh({ quiet: true }), 180); });
  }, [connected, refresh]);
  useEffect(() => () => window.clearTimeout(refreshTimer.current), []);

  const levelMap = useMemo(() => new Map(levels.map((level) => [String(level.id), level])), [levels]);
  const yearMap = useMemo(() => new Map(years.map((year) => [String(year.id), year])), [years]);
  const visibleGrades = useMemo(() => grades.filter((grade) => !selectedLevel || String(grade.levelId) === String(selectedLevel)), [grades, selectedLevel]);
  const sectionsByGrade = useMemo(() => {
    const map = new Map();
    for (const section of sections) {
      if (selectedYear && String(section.yearId) !== String(selectedYear)) continue;
      const key = String(section.gradeId);
      map.set(key, [...(map.get(key) || []), section]);
    }
    return map;
  }, [sections, selectedYear]);
  const currentYear = yearMap.get(String(selectedYear));
  const blocked = !levels.some((level) => level.active) || !years.some((year) => year.status !== "cerrado") || !shifts.some((shift) => shift.active && years.some((year) => String(year.id) === String(shift.yearId) && year.status !== "cerrado"));
  const actionDisabled = blocked || currentYear?.status === "cerrado";

  async function save(values) {
    if (!connected) return setError("Conecta el portal con Supabase para guardar el grado y sus salones.");
    setBusy(true); setError(""); setNotice("");
    try { await saveGradeWithClassrooms(values); setDialog(null); setNotice(values.id ? "Grado y salones actualizados." : "Grado y salones creados."); await refresh({ quiet: true }); }
    catch (requestError) { setError(requestError.message); }
    finally { setBusy(false); }
  }

  async function remove(grade) {
    if (!connected) return setError("Conecta el portal con Supabase para eliminar el grado.");
    if (!window.confirm(`¿Eliminar ${grade.name} y sus salones? Solo será posible si todavía no tienen información académica.`)) return;
    setBusy(true); setError(""); setNotice("");
    try { await deleteCompleteGrade(grade.id); setNotice(`${grade.name} y sus salones fueron eliminados.`); await refresh({ quiet: true }); }
    catch (requestError) { setError(requestError.message); }
    finally { setBusy(false); }
  }

  function openDialog(grade = null) {
    if (!grade && actionDisabled) return;
    setError(connected ? "" : error);
    setDialog({ grade, gradeSections: grade ? sectionsByGrade.get(String(grade.id)) || [] : [] });
  }

  return <section className="mx-auto max-w-[1240px] pb-14 text-ink" aria-busy={loading || busy}>
    <PageHeading standard title="Grados y salones" description="Registra cada grado y define cuántos salones tendrá en el año lectivo" action={<button aria-label="Nuevo grado" disabled={actionDisabled} title={actionDisabled ? "Necesitas un nivel, un año lectivo y al menos un turno activo" : "Nuevo grado"} className="inline-flex min-h-[42px] items-center gap-2 rounded-[5px] bg-[#f3bd24] px-5 text-[10px] font-extrabold text-brand-950 shadow-[0_7px_18px_rgba(139,101,0,0.13)] hover:bg-[#ffd34f] disabled:cursor-not-allowed disabled:opacity-45" onClick={() => openDialog()}><Plus className="h-4 w-4" /><span className="hidden sm:inline">Nuevo grado</span></button>} />
    {error ? <Notice onRetry={connected ? () => refresh() : undefined}>{error}</Notice> : null}{notice ? <Notice tone="success">{notice}</Notice> : null}

    <section className="mb-4 flex flex-wrap items-end gap-3 rounded-[9px] border border-line-strong bg-white p-4 shadow-[0_8px_24px_rgba(7,54,42,0.04)]"><label className="grid min-w-[220px] gap-1.5"><span className="text-[8px] font-extrabold uppercase tracking-[0.08em] text-muted">Nivel educativo</span><select className={SELECT} value={selectedLevel} onChange={(event) => setSelectedLevel(event.target.value)}><option value="">Todos los niveles</option>{levels.map((level) => <option key={level.id} value={level.id}>{level.name}</option>)}</select></label><label className="grid min-w-[220px] gap-1.5"><span className="text-[8px] font-extrabold uppercase tracking-[0.08em] text-muted">Año lectivo de los salones</span><select className={SELECT} value={selectedYear} onChange={(event) => setSelectedYear(event.target.value)}><option value="">Todos los años</option>{years.map((year) => <option key={year.id} value={year.id}>{year.name}{year.status === "cerrado" ? " · cerrado" : ""}</option>)}</select></label>{currentYear?.status === "cerrado" ? <span className="ml-auto text-[9px] font-bold text-muted">Año cerrado · solo consulta</span> : null}</section>

    <section className="overflow-visible rounded-[9px] border border-line-strong bg-white shadow-[0_12px_35px_rgba(7,54,42,0.05)]"><header className="flex min-h-[58px] items-center justify-between border-b border-line px-4 sm:px-5"><div><h2 className="m-0 font-sans text-[14px] font-bold text-brand-950">Grados registrados</h2><p className="mb-0 mt-1 text-[8px] text-muted">{visibleGrades.length} registro{visibleGrades.length === 1 ? "" : "s"}</p></div>{loading ? <LoaderCircle className="h-4 w-4 animate-spin text-brand-800" /> : null}</header>
      {loading ? <div className="grid min-h-[260px] place-content-center justify-items-center gap-3 text-[10px] text-muted"><LoaderCircle className="h-6 w-6 animate-spin text-[#237db3]" />Cargando…</div> : visibleGrades.length ? <><div className="hidden grid-cols-[1fr_1fr_1.35fr_0.55fr_0.55fr] gap-4 border-b border-line bg-[#f8faf9] px-5 py-3 text-[8px] font-extrabold uppercase tracking-[0.08em] text-muted lg:grid"><span>Grado</span><span>Nivel</span><span>Salones</span><span>Estado</span><span className="text-right">Acciones</span></div>{visibleGrades.map((grade) => <GradeRow key={grade.id} grade={grade} level={levelMap.get(String(grade.levelId))} classrooms={sectionsByGrade.get(String(grade.id)) || []} yearClosed={currentYear?.status === "cerrado"} onEdit={() => openDialog(grade)} onDelete={() => remove(grade)} />)}</> : <EmptyState blocked={blocked} />}
    </section>

    {dialog ? <AcademicStructureDialog key={`${dialog.grade?.id || "new"}-${selectedYear}`} grade={dialog.grade} gradeSections={dialog.gradeSections} levels={levels} years={years} shifts={shifts} initialLevelId={selectedLevel} initialYearId={selectedYear} busy={busy} requestError={error} onClose={() => { if (!busy) setDialog(null); }} onSave={save} /> : null}
  </section>;
}
