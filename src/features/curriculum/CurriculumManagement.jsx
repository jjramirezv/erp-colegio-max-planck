import { BookOpen, CheckCircle2, ChevronDown, CircleAlert, FolderOpen, GraduationCap, LoaderCircle, Pencil, Plus, RefreshCw, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import PageHeading from "../../components/PageHeading";
import { isSupabaseConfigured } from "../../lib/supabase";
import { loadAcademicYears } from "../academic-years/academicYearsApi";
import { loadEducationLevels } from "../education-levels/educationLevelsApi";
import { loadGradesAndSections } from "../grades-sections/gradesSectionsApi";
import CurriculumDialog from "./CurriculumDialog";
import { deleteCurricularArea, deleteGradeCourse, loadCurriculum, saveCurricularArea, saveGradeCourse, subscribeToCurriculum } from "./curriculumApi";

const SELECT = "min-h-10 w-full rounded-[6px] border border-line-strong bg-white px-3 text-[10px] font-bold text-ink outline-none focus:border-[#237db3] focus:shadow-[0_0_0_3px_rgba(35,125,179,0.10)]";

function Notice({ children, tone = "error", onRetry }) {
  const success = tone === "success";
  return <div className={`mb-4 flex items-center gap-3 rounded-[7px] border px-4 py-3 text-[10px] ${success ? "border-[#a9d6c5] bg-[#f1faf6] text-brand-900" : "border-[#efb0ad] bg-[#fff6f5] text-[#8f2924]"}`} role={success ? "status" : "alert"}>{success ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <CircleAlert className="h-4 w-4 shrink-0" />}<span className="flex-1 font-semibold">{children}</span>{onRetry ? <button className="inline-flex items-center gap-1 font-extrabold" onClick={onRetry}><RefreshCw className="h-3.5 w-3.5" />Reintentar</button> : null}</div>;
}

function Status({ active }) {
  return <span className={`inline-flex w-fit items-center gap-2 rounded-full border px-2.5 py-1 text-[9px] font-extrabold ${active ? "border-[#a9d6c5] bg-[#f1faf6] text-brand-800" : "border-[#d6dfdc] bg-[#f3f6f5] text-[#66736f]"}`}><i className={`h-1.5 w-1.5 rounded-full ${active ? "bg-brand-700" : "bg-[#82908b]"}`} />{active ? "Activo" : "Inactivo"}</span>;
}

function EmptyCurriculum({ blocked }) {
  return <div className="grid min-h-[230px] place-content-center justify-items-center px-5 text-center"><span className="grid h-12 w-12 place-items-center rounded-full bg-[#eff8fd] text-[#237db3]"><BookOpen className="h-5 w-5" /></span><h3 className="mb-1 mt-3 font-sans text-[15px] font-bold text-brand-950">{blocked ? "Selecciona la estructura académica" : "Aún no hay áreas ni cursos"}</h3><p className="m-0 max-w-[350px] text-[9px] leading-relaxed text-muted">{blocked ? "Necesitas un año, nivel y grado disponibles." : "Usa “Agregar” para crear la primera área curricular."}</p></div>;
}

function AreaGroup({ area, courses, readOnly, direct = false, onEditArea, onDeleteArea, onEditCourse, onDeleteCourse }) {
  const [open, setOpen] = useState(true);
  const GroupIcon = direct ? BookOpen : FolderOpen;
  return <section className="border-t border-line first:border-t-0"><header className="grid min-h-[62px] grid-cols-[1fr_auto] items-center gap-3 bg-[#fbfcfb] px-4 sm:px-5"><button type="button" className="flex min-w-0 items-center gap-3 text-left" onClick={() => setOpen((value) => !value)} aria-expanded={open}><ChevronDown className={`h-4 w-4 shrink-0 text-brand-800 transition ${open ? "" : "-rotate-90"}`} /><span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${direct ? "bg-[#eff8fd] text-[#237db3]" : "bg-brand-50 text-brand-800"}`}><GroupIcon className="h-4 w-4" /></span><span className="min-w-0"><strong className="block truncate font-sans text-[15px] font-bold text-brand-950">{area.name}</strong><small className="text-[8px] text-muted">{direct ? "Cursos sin agrupación curricular" : `${courses.length} curso${courses.length === 1 ? "" : "s"} en este grado`}</small></span></button><div className="flex items-center gap-1">{direct ? null : <><Status active={area.active} />{!readOnly ? <><button className="grid h-9 w-9 place-items-center rounded-full text-[#237db3] hover:bg-[#eff8fd]" onClick={onEditArea} aria-label={`Editar área ${area.name}`}><Pencil className="h-4 w-4" /></button><button className="grid h-9 w-9 place-items-center rounded-full text-[#a32d28] hover:bg-[#fff1f0]" onClick={onDeleteArea} aria-label={`Eliminar área ${area.name}`}><Trash2 className="h-4 w-4" /></button></> : null}</>}</div></header>{open ? courses.length ? <div>{courses.map((course) => <article key={course.id} className="grid gap-3 border-t border-line px-5 py-3.5 pl-12 sm:pl-[72px] lg:grid-cols-[1fr_0.6fr_0.55fr_0.5fr] lg:items-center"><div className="flex items-center gap-3"><BookOpen className="h-4 w-4 shrink-0 text-[#237db3]" /><strong className="text-[10px] text-[#263b34]">{course.name}</strong></div><span className="text-[9px] font-bold text-[#176d9f]">{course.weeklyHours} h semanales</span><Status active={course.active} /><div className="flex items-center gap-1 lg:justify-end">{readOnly ? <span className="text-[8px] font-bold text-muted">Solo consulta</span> : <><button className="grid h-8 w-8 place-items-center rounded-full text-[#237db3] hover:bg-[#eff8fd]" onClick={() => onEditCourse(course)} aria-label={`Editar curso ${course.name}`}><Pencil className="h-3.5 w-3.5" /></button><button className="grid h-8 w-8 place-items-center rounded-full text-[#a32d28] hover:bg-[#fff1f0]" onClick={() => onDeleteCourse(course)} aria-label={`Eliminar curso ${course.name}`}><Trash2 className="h-3.5 w-3.5" /></button></>}</div></article>)}</div> : <p className="m-0 border-t border-line px-5 py-4 pl-12 text-[9px] text-muted sm:pl-[72px]">Sin cursos asignados a este grado.</p> : null}</section>;
}

export default function CurriculumManagement({ user }) {
  const connected = isSupabaseConfigured && user?.authSource === "supabase";
  const [years, setYears] = useState([]); const [levels, setLevels] = useState([]); const [grades, setGrades] = useState([]);
  const [areas, setAreas] = useState([]); const [courses, setCourses] = useState([]); const [subjects, setSubjects] = useState([]);
  const [selectedYear, setSelectedYear] = useState(""); const [selectedLevel, setSelectedLevel] = useState(""); const [selectedGrade, setSelectedGrade] = useState("");
  const [loading, setLoading] = useState(connected); const [busy, setBusy] = useState(false); const [dialog, setDialog] = useState(null);
  const [error, setError] = useState(connected ? "" : "Inicia sesión con una cuenta de Dirección conectada a Supabase."); const [notice, setNotice] = useState("");
  const refreshTimer = useRef(null);

  const refresh = useCallback(async ({ quiet = false } = {}) => {
    if (!connected) return;
    if (!quiet) setLoading(true);
    try {
      const [yearRows, levelRows, structure, curriculum] = await Promise.all([loadAcademicYears(), loadEducationLevels(), loadGradesAndSections(), loadCurriculum()]);
      setYears(yearRows); setLevels(levelRows); setGrades(structure.grades); setAreas(curriculum.areas); setCourses(curriculum.courses); setSubjects(curriculum.subjects); setError("");
      setSelectedYear((current) => current && yearRows.some((item) => String(item.id) === String(current)) ? current : String(yearRows.find((item) => item.status === "activo")?.id || yearRows.find((item) => item.status === "preparacion")?.id || yearRows[0]?.id || ""));
      setSelectedLevel((current) => current && levelRows.some((item) => String(item.id) === String(current)) ? current : String(levelRows.find((item) => item.active)?.id || levelRows[0]?.id || ""));
    } catch (requestError) { setError(requestError.message); }
    finally { setLoading(false); }
  }, [connected]);

  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => { const valid = grades.filter((grade) => String(grade.levelId) === String(selectedLevel)); setSelectedGrade((current) => current && valid.some((grade) => String(grade.id) === String(current)) ? current : String(valid[0]?.id || "")); }, [grades, selectedLevel]);
  useEffect(() => { if (!connected) return undefined; return subscribeToCurriculum(() => { window.clearTimeout(refreshTimer.current); refreshTimer.current = window.setTimeout(() => refresh({ quiet: true }), 180); }); }, [connected, refresh]);
  useEffect(() => () => window.clearTimeout(refreshTimer.current), []);

  const year = years.find((item) => String(item.id) === String(selectedYear));
  const level = levels.find((item) => String(item.id) === String(selectedLevel));
  const grade = grades.find((item) => String(item.id) === String(selectedGrade));
  const levelGrades = useMemo(() => grades.filter((item) => String(item.levelId) === String(selectedLevel)), [grades, selectedLevel]);
  const subjectMap = useMemo(() => new Map(subjects.map((item) => [String(item.id), item])), [subjects]);
  const visibleCourses = useMemo(() => courses.filter((item) => String(item.yearId) === String(selectedYear) && String(item.gradeId) === String(selectedGrade)).map((item) => ({ ...item, name: subjectMap.get(String(item.subjectId))?.name || "Curso no disponible" })), [courses, selectedYear, selectedGrade, subjectMap]);
  const coursesByArea = useMemo(() => { const map = new Map(); for (const course of visibleCourses) map.set(String(course.areaId), [...(map.get(String(course.areaId)) || []), course]); return map; }, [visibleCourses]);
  const blocked = !selectedYear || !selectedLevel || !selectedGrade;
  const readOnly = year?.status === "cerrado";
  const context = { yearId: selectedYear, gradeId: selectedGrade, yearName: year?.name || "Sin año", levelName: level?.name || "Sin nivel", gradeName: grade?.name || "Sin grado" };

  async function saveArea(values) {
    setBusy(true); setError(""); setNotice("");
    try { await saveCurricularArea(values); setDialog(null); setNotice(values.id ? "Área curricular actualizada." : "Área curricular creada."); await refresh({ quiet: true }); }
    catch (requestError) { setError(requestError.message); }
    finally { setBusy(false); }
  }
  async function saveCourse(values) {
    setBusy(true); setError(""); setNotice("");
    try { await saveGradeCourse(values); setDialog(null); setNotice(values.id ? "Curso actualizado en el grado." : "Curso agregado al grado y sus salones."); await refresh({ quiet: true }); }
    catch (requestError) { setError(requestError.message); }
    finally { setBusy(false); }
  }
  async function removeArea(area) {
    if (!window.confirm(`¿Eliminar el área ${area.name}? Solo será posible si no contiene cursos.`)) return;
    setBusy(true); setError(""); setNotice(""); try { await deleteCurricularArea(area.id); setNotice(`${area.name} fue eliminada.`); await refresh({ quiet: true }); } catch (requestError) { setError(requestError.message); } finally { setBusy(false); }
  }
  async function removeCourse(course) {
    if (!window.confirm(`¿Eliminar ${course.name} de ${grade?.name}? Se retirará de todos sus salones si no tiene materiales activos.`)) return;
    setBusy(true); setError(""); setNotice(""); try { await deleteGradeCourse(course.id); setNotice(`${course.name} fue retirado del grado.`); await refresh({ quiet: true }); } catch (requestError) { setError(requestError.message); } finally { setBusy(false); }
  }

  return <section className="mx-auto max-w-[1240px] pb-14 text-ink" aria-busy={loading || busy}>
    <PageHeading standard title="Áreas y cursos" description="Organiza cursos directos o agrupados por área, según cada grado" action={<button aria-label="Agregar" disabled={blocked || readOnly} title={blocked ? "Selecciona un año, nivel y grado" : readOnly ? "El año cerrado es solo de consulta" : "Agregar área o curso"} className="inline-flex min-h-[42px] items-center gap-2 rounded-[5px] bg-[#f3bd24] px-5 text-[10px] font-extrabold text-brand-950 shadow-[0_7px_18px_rgba(139,101,0,0.13)] hover:bg-[#ffd34f] disabled:cursor-not-allowed disabled:opacity-45" onClick={() => setDialog({ initialMode: "course" })}><Plus className="h-4 w-4" /><span>Agregar</span></button>} />
    {error ? <Notice onRetry={connected ? () => refresh() : undefined}>{error}</Notice> : null}{notice ? <Notice tone="success">{notice}</Notice> : null}

    <section className="mb-4 grid gap-3 rounded-[9px] border border-line-strong bg-white p-4 shadow-[0_8px_24px_rgba(7,54,42,0.04)] sm:grid-cols-3"><label className="grid gap-1.5"><span className="text-[8px] font-extrabold uppercase tracking-[0.08em] text-muted">Año lectivo</span><select className={SELECT} value={selectedYear} onChange={(event) => setSelectedYear(event.target.value)}><option value="">Seleccionar año</option>{years.map((item) => <option key={item.id} value={item.id}>{item.name}{item.status === "cerrado" ? " · cerrado" : ""}</option>)}</select></label><label className="grid gap-1.5"><span className="text-[8px] font-extrabold uppercase tracking-[0.08em] text-muted">Nivel educativo</span><select className={SELECT} value={selectedLevel} onChange={(event) => setSelectedLevel(event.target.value)}><option value="">Seleccionar nivel</option>{levels.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label className="grid gap-1.5"><span className="text-[8px] font-extrabold uppercase tracking-[0.08em] text-muted">Grado</span><select className={SELECT} value={selectedGrade} onChange={(event) => setSelectedGrade(event.target.value)}><option value="">Seleccionar grado</option>{levelGrades.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label></section>

    <section className="overflow-visible rounded-[9px] border border-line-strong bg-white shadow-[0_12px_35px_rgba(7,54,42,0.05)]"><header className="flex min-h-[58px] items-center justify-between border-b border-line px-4 sm:px-5"><div><h2 className="m-0 font-sans text-[14px] font-bold text-brand-950">Plan de estudios</h2><p className="mb-0 mt-1 text-[8px] text-muted">{blocked ? "Selecciona el contexto" : `${grade?.name} · ${visibleCourses.length} curso${visibleCourses.length === 1 ? "" : "s"}`}</p></div>{loading ? <LoaderCircle className="h-4 w-4 animate-spin text-brand-800" /> : <span className="hidden items-center gap-2 text-[9px] font-bold text-[#176d9f] sm:flex"><GraduationCap className="h-4 w-4" />{level?.name || ""}</span>}</header>
      {loading ? <div className="grid min-h-[260px] place-content-center justify-items-center gap-3 text-[10px] text-muted"><LoaderCircle className="h-6 w-6 animate-spin text-[#237db3]" />Cargando…</div> : blocked || (!areas.length && !visibleCourses.length) ? <EmptyCurriculum blocked={blocked} /> : <>{coursesByArea.get("null")?.length ? <AreaGroup area={{ id: "direct", name: "Cursos generales", active: true }} courses={coursesByArea.get("null")} direct readOnly={readOnly} onEditCourse={(course) => setDialog({ course, initialMode: "course" })} onDeleteCourse={removeCourse} /> : null}{areas.map((area) => <AreaGroup key={area.id} area={area} courses={coursesByArea.get(String(area.id)) || []} readOnly={readOnly} onEditArea={() => setDialog({ area, initialMode: "area" })} onDeleteArea={() => removeArea(area)} onEditCourse={(course) => setDialog({ course, initialMode: "course" })} onDeleteCourse={removeCourse} />)}</>}
    </section>

    {dialog ? <CurriculumDialog key={`${dialog.area?.id || dialog.course?.id || "new"}-${dialog.initialMode}`} initialMode={dialog.initialMode} area={dialog.area} course={dialog.course} areas={areas} context={context} busy={busy} requestError={error} onClose={() => { if (!busy) setDialog(null); }} onSaveArea={saveArea} onSaveCourse={saveCourse} /> : null}
  </section>;
}
