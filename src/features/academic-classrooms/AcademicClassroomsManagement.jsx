import { AlertCircle, Building2, CalendarDays, CheckCircle2, ChevronDown, Clock3, GraduationCap, LoaderCircle, Pencil, RefreshCw, Search, UsersRound } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { isSupabaseConfigured } from "../../lib/supabase";
import AcademicClassroomsEditor from "./AcademicClassroomsEditor";
import { loadAcademicClassroomsWorkspace, saveAcademicClassrooms, subscribeToAcademicClassrooms } from "./academicClassroomsApi";

const EMPTY = { years: [], levels: [], grades: [], sections: [], shifts: [] };
const ACCENTS = ["#2488b8", "#f29c38", "#47a84b", "#8b5cc2", "#e34d55", "#087a5b"];

function shiftSchedule(shift) { return shift ? `${shift.startTime} – ${shift.endTime}` : "Sin horario"; }

function ClassroomRow({ section, shift }) {
  const capacity = Number(section.capacity || 0);
  const enrolled = Number(section.enrolled || 0);
  const percentage = capacity ? Math.min(100, Math.round((enrolled / capacity) * 100)) : 0;
  return <div className="grid gap-4 border-t border-[#e0e8e5] px-5 py-4 sm:grid-cols-[1.2fr_.8fr_.9fr_.8fr_1.25fr] sm:items-center">
    <div className="flex min-w-0 items-center gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#edf7fc] text-[#2488b8]"><UsersRound size={19} /></span><strong className="truncate text-sm text-[#1c2d26]">Sección {section.name}</strong></div>
    <div><span className="block text-[10px] font-bold uppercase tracking-[0.08em] text-[#7a8882] sm:hidden">Turno</span><p className="text-sm font-semibold text-[#405149]">{shift?.name || section.shift || "—"}</p></div>
    <div><span className="block text-[10px] font-bold uppercase tracking-[0.08em] text-[#7a8882] sm:hidden">Horario</span><p className="text-sm font-semibold text-[#405149]">{shiftSchedule(shift)}</p></div>
    <div><span className="block text-[10px] font-bold uppercase tracking-[0.08em] text-[#7a8882] sm:hidden">Capacidad</span><p className="text-sm font-semibold text-[#405149]">{capacity || "—"} estudiantes</p></div>
    <div><div className="flex items-center justify-between gap-3 text-xs"><strong className="text-[#20312a]">{enrolled} / {capacity || "—"}</strong><span className="text-[#74827c]">estudiantes</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-[#e3e9e7]"><i className={`block h-full rounded-full ${percentage >= 90 ? "bg-[#e5a900]" : "bg-[#2488b8]"}`} style={{ width: `${percentage}%` }} /></div></div>
  </div>;
}

function GradeGroup({ grade, sections, shifts, selected, onSelect, accent }) {
  const capacity = sections.reduce((sum, item) => sum + Number(item.capacity || 0), 0);
  const enrolled = sections.reduce((sum, item) => sum + Number(item.enrolled || 0), 0);
  const vacancies = Math.max(0, capacity - enrolled);
  const shiftMap = new Map(shifts.map((item) => [String(item.id), item]));
  return <article className={`overflow-hidden rounded-xl border bg-white transition ${selected ? "border-[#9ebdb2] shadow-[0_12px_34px_rgba(17,45,36,0.075)]" : "border-[#d2dfda]"}`}>
    <button onClick={onSelect} className="relative flex w-full items-center justify-between gap-4 px-5 py-4 text-left hover:bg-[#f7faf9]" aria-expanded={selected}><i className="absolute inset-y-0 left-0 w-1" style={{ backgroundColor: accent }} /><div><h3 className="text-base font-extrabold text-[#172720]">{grade.name}</h3><p className="mt-1 text-xs text-[#697871]">{sections.length} {sections.length === 1 ? "salón" : "salones"} · {vacancies} vacantes</p></div><ChevronDown size={20} className={`shrink-0 text-[#385149] transition ${selected ? "rotate-180" : ""}`} /></button>
    {selected ? <div><div className="hidden grid-cols-[1.2fr_.8fr_.9fr_.8fr_1.25fr] gap-4 border-t border-[#dce6e2] bg-[#f5f8f7] px-5 py-2.5 text-[10px] font-extrabold uppercase tracking-[0.09em] text-[#687a73] sm:grid"><span>Salón</span><span>Turno</span><span>Horario</span><span>Capacidad</span><span>Ocupación</span></div>{sections.length ? sections.map((section) => <ClassroomRow key={section.id} section={section} shift={shiftMap.get(String(section.shiftId))} />) : <div className="grid min-h-[150px] place-items-center border-t border-[#e0e8e5] px-5 text-center"><div><Building2 className="mx-auto text-[#2488b8]" size={27} /><p className="mt-3 font-extrabold text-[#23352d]">Este grado aún no tiene salones</p><p className="mt-1 text-xs text-[#718079]">Usa “Administrar salones” para habilitarlos.</p></div></div>}</div> : null}
  </article>;
}

export function AcademicClassroomsView({ workspace, loading, refreshing, saving, error, feedback, onRefresh, onSave }) {
  const [yearId, setYearId] = useState("");
  const [levelId, setLevelId] = useState("");
  const [gradeId, setGradeId] = useState("");
  const [query, setQuery] = useState("");
  const [editorOpen, setEditorOpen] = useState(false);
  const years = useMemo(() => [...workspace.years].sort((a, b) => String(b.startsOn).localeCompare(String(a.startsOn))), [workspace.years]);
  const levels = useMemo(() => workspace.levels.filter((item) => item.active).sort((a, b) => (a.order || 0) - (b.order || 0)), [workspace.levels]);
  useEffect(() => { if (years.length && !years.some((item) => String(item.id) === yearId)) setYearId(String(years.find((item) => item.status === "activo")?.id || years[0].id)); }, [years, yearId]);
  useEffect(() => { if (levels.length && !levels.some((item) => String(item.id) === levelId)) setLevelId(String(levels[0].id)); }, [levels, levelId]);
  const year = years.find((item) => String(item.id) === yearId);
  const level = levels.find((item) => String(item.id) === levelId);
  const levelGrades = useMemo(() => workspace.grades.filter((item) => item.active && String(item.levelId) === levelId).sort((a, b) => (a.order || 0) - (b.order || 0)), [workspace.grades, levelId]);
  const sectionsFor = useCallback((id) => workspace.sections.filter((item) => item.active && String(item.yearId) === yearId && String(item.gradeId) === String(id)).sort((a, b) => a.name.localeCompare(b.name, "es")), [workspace.sections, yearId]);
  const filteredGrades = useMemo(() => { const value = query.trim().toLocaleLowerCase("es"); return levelGrades.filter((grade) => !value || grade.name.toLocaleLowerCase("es").includes(value) || sectionsFor(grade.id).some((section) => section.name.toLocaleLowerCase("es").includes(value))); }, [levelGrades, query, sectionsFor]);
  useEffect(() => { if (filteredGrades.length && !filteredGrades.some((item) => String(item.id) === gradeId)) setGradeId(String(filteredGrades[0].id)); if (!filteredGrades.length) setGradeId(""); }, [filteredGrades, gradeId]);
  useEffect(() => { setEditorOpen(false); }, [yearId, levelId, gradeId]);
  const grade = filteredGrades.find((item) => String(item.id) === gradeId);
  const selectedSections = grade ? sectionsFor(grade.id) : [];
  const readOnly = year?.status === "cerrado";
  async function submitClassrooms(values) { if (await onSave(values)) setEditorOpen(false); }

  if (loading) return <div className="grid min-h-[560px] place-items-center"><LoaderCircle className="animate-spin text-[#087a5b]" size={38} /></div>;
  return <div className="mx-auto max-w-[1500px] px-4 py-6 font-sans sm:px-7 lg:px-9 lg:py-9">
    <header className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><h1 className="text-3xl font-extrabold tracking-[-0.045em] text-[#14231e] sm:text-4xl">Grados y salones</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-[#66766f] sm:text-base">Organiza los salones habilitados para cada grado durante el año lectivo.</p></div><button disabled={!grade || readOnly} onClick={() => setEditorOpen(true)} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#f5c127] px-5 text-sm font-extrabold text-[#173028] shadow-[0_10px_24px_rgba(177,126,0,0.14)] hover:bg-[#ffd252] disabled:opacity-45"><Pencil size={17} />Administrar salones</button></header>
    {error ? <div className="mb-5 flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-800"><AlertCircle size={18} />{error}</div> : null}{feedback ? <div className={`mb-5 flex items-center gap-3 rounded-xl border px-4 py-3 text-sm font-bold ${feedback.type === "error" ? "border-red-200 bg-red-50 text-red-800" : "border-emerald-200 bg-emerald-50 text-emerald-800"}`}>{feedback.type === "error" ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}{feedback.text}</div> : null}
    <section className="overflow-hidden rounded-2xl border border-[#b4c9c1] bg-white shadow-[0_14px_40px_rgba(17,45,36,0.05)]"><div className="h-1 bg-[linear-gradient(90deg,#087a5b_0_45%,#f5c127_45%_72%,#2488b8_72%)]" /><div className="grid gap-4 p-5 md:grid-cols-[280px_1fr_48px]"><label><span className="mb-2 flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-[0.11em] text-[#687a73]"><CalendarDays size={15} className="text-[#2488b8]" />Año lectivo</span><select className="min-h-12 w-full rounded-xl border border-[#b7cbc4] bg-white px-4 text-sm font-bold outline-none focus:border-[#087a5b]" value={yearId} onChange={(event) => setYearId(event.target.value)}>{years.map((item) => <option key={item.id} value={item.id}>{item.name}{item.status === "cerrado" ? " · cerrado" : ""}</option>)}</select></label><label><span className="mb-2 block text-[11px] font-extrabold uppercase tracking-[0.11em] text-[#687a73]">Buscar grado o salón</span><span className="relative block"><Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#6f7e78]" /><input value={query} onChange={(event) => setQuery(event.target.value)} className="min-h-12 w-full rounded-xl border border-[#b7cbc4] bg-white pl-12 pr-4 text-sm outline-none focus:border-[#087a5b]" placeholder="Ej. 1.º de secundaria o A" /></span></label><button onClick={onRefresh} disabled={refreshing} className="mt-auto grid h-12 w-12 place-items-center rounded-xl border border-[#b7cbc4] text-[#087456] hover:bg-[#eef8f4]" aria-label="Actualizar"><RefreshCw size={18} className={refreshing ? "animate-spin" : ""} /></button></div>
      <nav className="flex overflow-x-auto border-t border-[#dce5e2] px-5" aria-label="Niveles educativos">{levels.map((item) => <button key={item.id} onClick={() => setLevelId(String(item.id))} className={`relative min-h-14 shrink-0 px-5 text-sm font-extrabold ${String(item.id) === levelId ? "text-[#087456]" : "text-[#687870] hover:text-[#20322a]"}`}>{item.name.replace(/^Educación\s+/i, "")}{String(item.id) === levelId ? <i className="absolute inset-x-4 bottom-0 h-1 rounded-t bg-[#087a5b]" /> : null}</button>)}</nav>
    </section>
    {readOnly ? <div className="mt-5 flex items-center gap-3 rounded-xl border border-[#bdd6e5] bg-[#f0f8fc] px-4 py-3 text-sm font-semibold text-[#38667b]"><CalendarDays size={18} />Este año está cerrado y se muestra únicamente para consulta.</div> : null}
    <div className={`mt-5 grid gap-5 ${editorOpen ? "2xl:grid-cols-[minmax(0,1fr)_480px]" : ""}`}><main className="min-w-0 space-y-3">{filteredGrades.length ? filteredGrades.map((item, index) => <GradeGroup key={item.id} grade={item} sections={sectionsFor(item.id)} shifts={workspace.shifts} selected={String(item.id) === gradeId} onSelect={() => setGradeId(String(item.id))} accent={ACCENTS[index % ACCENTS.length]} />) : <div className="grid min-h-[340px] place-items-center rounded-2xl border border-[#c6d6d0] bg-white px-6 text-center"><div><GraduationCap className="mx-auto text-[#2488b8]" size={34} /><h2 className="mt-4 text-xl font-extrabold text-[#172720]">No hay grados disponibles</h2><p className="mt-2 max-w-md text-sm leading-6 text-[#6f7e78]">Alta Dirección debe registrar los grados de {level?.name || "este nivel"} antes de organizar sus salones.</p></div></div>}</main>
      {editorOpen && grade && year ? <><div className="fixed inset-0 z-40 bg-[#0b3025]/45 backdrop-blur-[2px] 2xl:hidden" onClick={() => !saving && setEditorOpen(false)} /><AcademicClassroomsEditor key={`${grade.id}-${year.id}`} grade={grade} year={year} sections={selectedSections} shifts={workspace.shifts} busy={saving} onClose={() => !saving && setEditorOpen(false)} onSave={submitClassrooms} /></> : null}</div>
  </div>;
}

export default function AcademicClassroomsManagement({ user, initialData = null }) {
  const remote = !initialData && isSupabaseConfigured && user?.authSource === "supabase";
  const [workspace, setWorkspace] = useState(initialData || EMPTY);
  const [loading, setLoading] = useState(remote);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(remote || initialData ? "" : "Conecta una sesión de Supabase para gestionar salones reales.");
  const [feedback, setFeedback] = useState(null);
  const timer = useRef(null);
  const refresh = useCallback(async (quiet = false) => { if (!remote) return; quiet ? setRefreshing(true) : setLoading(true); try { setWorkspace(await loadAcademicClassroomsWorkspace()); setError(""); } catch (requestError) { setError(requestError.message); } finally { setLoading(false); setRefreshing(false); } }, [remote]);
  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => { if (!remote) return undefined; return subscribeToAcademicClassrooms(() => { window.clearTimeout(timer.current); timer.current = window.setTimeout(() => refresh(true), 180); }); }, [remote, refresh]);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  async function save(values) { setSaving(true); setFeedback(null); try { if (remote) await saveAcademicClassrooms(values); await refresh(true); setFeedback({ type: "success", text: "Los salones se guardaron correctamente." }); return true; } catch (requestError) { setFeedback({ type: "error", text: requestError.message }); return false; } finally { setSaving(false); } }
  return <AcademicClassroomsView workspace={workspace} loading={loading} refreshing={refreshing} saving={saving} error={error} feedback={feedback} onRefresh={() => refresh()} onSave={save} />;
}
