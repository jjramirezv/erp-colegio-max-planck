import { BookOpen, CheckCircle2, CircleAlert, GraduationCap, LoaderCircle, Pencil, RefreshCw, School, UserCheck, UsersRound } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import PageHeading from "../../components/PageHeading";
import { isSupabaseConfigured } from "../../lib/supabase";
import { loadAcademicYears } from "../academic-years/academicYearsApi";
import { loadEducationLevels } from "../education-levels/educationLevelsApi";
import { loadGradesAndSections } from "../grades-sections/gradesSectionsApi";
import TeacherAssignmentDialog from "./TeacherAssignmentDialog";
import { loadTeacherAssignmentsWorkspace, saveTeacherAssignment, subscribeToTeacherAssignments } from "./teacherAssignmentsApi";

const SELECT = "min-h-10 w-full rounded-[6px] border border-line-strong bg-white px-3 text-[10px] font-bold text-ink outline-none focus:border-[#237db3] focus:shadow-[0_0_0_3px_rgba(35,125,179,0.10)]";

function Notice({ children, tone = "error", onRetry }) {
  const success = tone === "success";
  return <div className={`mb-4 flex items-center gap-3 rounded-[7px] border px-4 py-3 text-[10px] ${success ? "border-[#a9d6c5] bg-[#f1faf6] text-brand-900" : "border-[#efb0ad] bg-[#fff6f5] text-[#8f2924]"}`} role={success ? "status" : "alert"}>{success ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <CircleAlert className="h-4 w-4 shrink-0" />}<span className="flex-1 font-semibold">{children}</span>{onRetry ? <button className="inline-flex items-center gap-1 font-extrabold" onClick={onRetry}><RefreshCw className="h-3.5 w-3.5" />Reintentar</button> : null}</div>;
}

function initials(name = "") { return name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "—"; }
function roleLabel(role) { return ({ titular: "Titular", apoyo: "Apoyo", reemplazo: "Reemplazo" })[role] || role; }

function TargetRow({ target, assignment, teacher, readOnly, hasTeachers, onEdit }) {
  const Icon = target.kind === "course" ? BookOpen : School;
  return <article className="grid gap-3 border-t border-line px-4 py-4 first:border-t-0 sm:px-5 lg:grid-cols-[1.35fr_.75fr_1.1fr_auto] lg:items-center">
    <div className="flex min-w-0 items-center gap-3"><span className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${target.kind === "course" ? "bg-[#eff8fd] text-[#237db3]" : "bg-[#fff8df] text-[#a47700]"}`}><Icon className="h-4 w-4" /></span><div className="min-w-0"><strong className="block truncate font-sans text-[14px] font-bold text-brand-950">{target.title}</strong><small className="text-[8px] text-muted">{target.kind === "course" ? `${target.weeklyHours || "—"} horas semanales` : "Responsable del aula"}</small></div></div>
    <div><span className="block text-[9px] font-extrabold text-[#42524c]">Salón {target.sectionName}</span><small className="text-[8px] text-muted">{target.shift || "Turno no definido"}</small></div>
    {teacher ? <div className="flex items-center gap-3"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand-800 text-[9px] font-extrabold text-white">{initials(teacher.name)}</span><div className="min-w-0"><strong className="block truncate text-[10px] text-[#263b34]">{teacher.name}</strong><small className="text-[8px] text-muted">{roleLabel(assignment.role)} · {assignment.startsOn} a {assignment.endsOn}</small></div></div> : <span className="inline-flex w-fit items-center gap-2 rounded-full border border-[#ecd789] bg-[#fff9e7] px-3 py-1.5 text-[9px] font-extrabold text-[#8a6500]"><i className="h-1.5 w-1.5 rounded-full bg-[#f3bd24]" />Sin docente</span>}
    <div className="lg:justify-self-end">{readOnly ? <span className="text-[8px] font-bold text-muted">Solo consulta</span> : <button type="button" disabled={!hasTeachers && !assignment} className="inline-flex min-h-9 items-center gap-2 rounded-[5px] border border-[#9cc8df] bg-white px-3 text-[9px] font-extrabold text-[#176d9f] hover:bg-[#eff8fd] disabled:cursor-not-allowed disabled:opacity-45" onClick={onEdit}>{assignment ? <Pencil className="h-3.5 w-3.5" /> : <UserCheck className="h-3.5 w-3.5" />}{assignment ? "Cambiar" : "Asignar"}</button>}</div>
  </article>;
}

export default function TeacherAssignmentsManagement({ user }) {
  const connected = isSupabaseConfigured && user?.authSource === "supabase";
  const [years, setYears] = useState([]); const [levels, setLevels] = useState([]); const [grades, setGrades] = useState([]); const [sections, setSections] = useState([]);
  const [teachers, setTeachers] = useState([]); const [offerings, setOfferings] = useState([]); const [assignments, setAssignments] = useState([]); const [subjects, setSubjects] = useState([]);
  const [selectedYear, setSelectedYear] = useState(""); const [selectedLevel, setSelectedLevel] = useState(""); const [selectedGrade, setSelectedGrade] = useState("");
  const [loading, setLoading] = useState(connected); const [busy, setBusy] = useState(false); const [error, setError] = useState(connected ? "" : "Inicia sesión con una cuenta de Dirección conectada a Supabase."); const [notice, setNotice] = useState(""); const [dialog, setDialog] = useState(null); const timer = useRef(null);
  const refresh = useCallback(async ({ quiet = false } = {}) => {
    if (!connected) return; if (!quiet) setLoading(true);
    try {
      const [yearRows, levelRows, structure, workspace] = await Promise.all([loadAcademicYears(), loadEducationLevels(), loadGradesAndSections(), loadTeacherAssignmentsWorkspace()]);
      setYears(yearRows); setLevels(levelRows); setGrades(structure.grades); setSections(structure.sections); setTeachers(workspace.teachers); setOfferings(workspace.offerings); setAssignments(workspace.assignments); setSubjects(workspace.subjects); setError("");
      setSelectedYear((current) => current && yearRows.some((item) => String(item.id) === String(current)) ? current : String(yearRows.find((item) => item.status === "activo")?.id || yearRows.find((item) => item.status === "preparacion")?.id || yearRows[0]?.id || ""));
      setSelectedLevel((current) => current && levelRows.some((item) => String(item.id) === String(current)) ? current : String(levelRows.find((item) => item.active)?.id || levelRows[0]?.id || ""));
    } catch (requestError) { setError(requestError.message); } finally { setLoading(false); }
  }, [connected]);
  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => connected ? subscribeToTeacherAssignments(() => { window.clearTimeout(timer.current); timer.current = window.setTimeout(() => refresh({ quiet: true }), 180); }) : undefined, [connected, refresh]);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const currentYear = years.find((item) => String(item.id) === String(selectedYear));
  const currentLevel = levels.find((item) => String(item.id) === String(selectedLevel));
  const levelGrades = useMemo(() => grades.filter((item) => item.active && String(item.levelId) === String(selectedLevel)), [grades, selectedLevel]);
  useEffect(() => { setSelectedGrade((current) => current && levelGrades.some((item) => String(item.id) === String(current)) ? current : String(levelGrades[0]?.id || "")); }, [levelGrades]);
  const currentGrade = levelGrades.find((item) => String(item.id) === String(selectedGrade));
  const visibleSections = useMemo(() => sections.filter((item) => item.active && String(item.yearId) === String(selectedYear) && String(item.gradeId) === String(selectedGrade)), [sections, selectedYear, selectedGrade]);
  const subjectMap = useMemo(() => new Map(subjects.map((item) => [String(item.id), item])), [subjects]);
  const assignmentMap = useMemo(() => new Map(assignments.map((item) => [`${item.offeringId ? "course" : "section"}:${item.offeringId || item.sectionId}`, item])), [assignments]);
  const teacherMap = useMemo(() => new Map(teachers.map((item) => [String(item.id), item])), [teachers]);
  const targets = useMemo(() => {
    if (!currentLevel || !currentGrade) return [];
    const sectionMap = new Map(visibleSections.map((section) => [String(section.id), section]));
    return offerings.filter((item) => String(item.yearId) === String(selectedYear) && sectionMap.has(String(item.sectionId))).map((item) => { const section = sectionMap.get(String(item.sectionId)); return { kind: "course", id: item.id, title: item.visibleName || subjectMap.get(String(item.subjectId))?.name || "Curso", weeklyHours: item.weeklyHours, gradeName: currentGrade.name, sectionName: section.name, shift: section.shift }; }).sort((a, b) => a.sectionName.localeCompare(b.sectionName, "es") || a.title.localeCompare(b.title, "es"));
  }, [currentLevel, currentGrade, visibleSections, offerings, selectedYear, subjectMap]);
  const assignedCount = targets.filter((target) => assignmentMap.has(`${target.kind}:${target.id}`)).length;
  const readOnly = currentYear?.status === "cerrado";
  const blocked = !selectedYear || !selectedLevel || !selectedGrade;

  async function save(values) {
    setBusy(true); setError(""); setNotice("");
    try { await saveTeacherAssignment(values); setDialog(null); setNotice(values.teacherId ? "Asignación docente guardada." : "Asignación retirada."); await refresh({ quiet: true }); } catch (requestError) { setError(requestError.message); } finally { setBusy(false); }
  }

  return <section className="mx-auto max-w-[1240px] pb-14 text-ink" aria-busy={loading || busy}>
    <PageHeading standard title="Asignación docente" description="Vincula docentes con los cursos y salones del año lectivo" />
    {error ? <Notice onRetry={connected ? () => refresh() : undefined}>{error}</Notice> : null}{notice ? <Notice tone="success">{notice}</Notice> : null}
    <section className="mb-4 grid gap-3 rounded-[9px] border border-line-strong bg-white p-4 shadow-[0_8px_24px_rgba(7,54,42,0.04)] sm:grid-cols-3">
      <label className="grid gap-1.5"><span className="text-[8px] font-extrabold uppercase tracking-[0.08em] text-muted">Año lectivo</span><select className={SELECT} value={selectedYear} onChange={(event) => setSelectedYear(event.target.value)}><option value="">Seleccionar año</option>{years.map((item) => <option key={item.id} value={item.id}>{item.name}{item.status === "cerrado" ? " · cerrado" : ""}</option>)}</select></label>
      <label className="grid gap-1.5"><span className="text-[8px] font-extrabold uppercase tracking-[0.08em] text-muted">Nivel educativo</span><select className={SELECT} value={selectedLevel} onChange={(event) => setSelectedLevel(event.target.value)}><option value="">Seleccionar nivel</option>{levels.filter((item) => item.active).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <label className="grid gap-1.5"><span className="text-[8px] font-extrabold uppercase tracking-[0.08em] text-muted">Grado</span><select className={SELECT} value={selectedGrade} onChange={(event) => setSelectedGrade(event.target.value)}><option value="">Seleccionar grado</option>{levelGrades.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
    </section>
    {!loading && !teachers.length ? <Notice>No hay docentes activos. Primero crea o activa una cuenta con el rol Docente.</Notice> : null}
    {!blocked && targets.length ? <section className="mb-4 overflow-hidden rounded-[9px] border border-line-strong bg-white shadow-[0_8px_24px_rgba(7,54,42,0.04)]"><div className="grid gap-4 p-4 sm:grid-cols-[auto_1fr_auto] sm:items-center sm:px-5"><span className="grid h-11 w-11 place-items-center rounded-full bg-brand-50 text-brand-800"><UsersRound className="h-5 w-5" /></span><div><strong className="font-sans text-[15px] text-brand-950">Cobertura docente</strong><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#e9efed]"><i className="block h-full bg-gradient-to-r from-brand-700 via-[#f3bd24] to-[#237db3]" style={{ width: `${Math.round((assignedCount / targets.length) * 100)}%` }} /></div></div><strong className="text-[11px] text-[#176d9f]">{assignedCount} de {targets.length} asignados</strong></div></section> : null}
    <section className="overflow-hidden rounded-[9px] border border-line-strong bg-white shadow-[0_12px_35px_rgba(7,54,42,0.05)]"><header className="flex min-h-[58px] items-center justify-between border-b border-line px-4 sm:px-5"><div><h2 className="m-0 font-sans text-[14px] font-bold text-brand-950">Cursos por salón</h2><p className="mb-0 mt-1 text-[8px] text-muted">{currentGrade ? `${currentGrade.name} · ${targets.length} asignaciones independientes` : "Selecciona el contexto académico"}</p></div>{loading ? <LoaderCircle className="h-4 w-4 animate-spin text-brand-800" /> : <GraduationCap className="h-5 w-5 text-[#237db3]" />}</header>
      {loading ? <div className="grid min-h-[250px] place-content-center justify-items-center gap-3 text-[10px] text-muted"><LoaderCircle className="h-6 w-6 animate-spin text-[#237db3]" />Cargando…</div> : blocked ? <div className="grid min-h-[230px] place-content-center justify-items-center px-5 text-center"><GraduationCap className="h-8 w-8 text-[#237db3]" /><h3 className="mb-1 mt-3 font-sans text-[15px] text-brand-950">Selecciona año, nivel y grado</h3><p className="m-0 text-[9px] text-muted">La lista se construye con la estructura académica registrada.</p></div> : !visibleSections.length ? <div className="grid min-h-[230px] place-content-center justify-items-center px-5 text-center"><School className="h-8 w-8 text-[#d89e00]" /><h3 className="mb-1 mt-3 font-sans text-[15px] text-brand-950">Este grado aún no tiene salones</h3><p className="m-0 text-[9px] text-muted">Agrégalos primero en “Grados y salones”.</p></div> : !targets.length ? <div className="grid min-h-[230px] place-content-center justify-items-center px-5 text-center"><BookOpen className="h-8 w-8 text-[#237db3]" /><h3 className="mb-1 mt-3 font-sans text-[15px] text-brand-950">Este grado aún no tiene cursos</h3><p className="m-0 text-[9px] text-muted">Configúralos primero en “Áreas y cursos”.</p></div> : targets.map((target) => { const assignment = assignmentMap.get(`${target.kind}:${target.id}`); return <TargetRow key={`${target.kind}-${target.id}`} target={target} assignment={assignment} teacher={teacherMap.get(String(assignment?.teacherId))} readOnly={readOnly} hasTeachers={teachers.length > 0} onEdit={() => setDialog({ target, assignment })} />; })}
    </section>
    {dialog ? <TeacherAssignmentDialog target={dialog.target} assignment={dialog.assignment} year={currentYear} teachers={teachers} busy={busy} requestError={error} onClose={() => { if (!busy) setDialog(null); }} onSave={save} /> : null}
  </section>;
}
