import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, BookOpenCheck, CalendarDays, CheckCircle2, ChevronRight, Clock3, GraduationCap, LoaderCircle, Pencil, RefreshCw, School, UsersRound } from "lucide-react";
import { isSupabaseConfigured } from "../../lib/supabase";
import { loadAcademicWorkspace, subscribeToAcademicChanges } from "../academic/academicApi";
import { EMPTY_WORKSPACE } from "../academic/constants";
import AcademicLoadEditor from "./AcademicLoadEditor";
import { saveAcademicLoadEntry } from "./academicLoadApi";

const SELECT_CLASS = "min-h-12 w-full appearance-none rounded-xl border border-[#b6cbc3] bg-white px-4 pr-10 text-sm font-bold text-[#1d3029] outline-none transition focus:border-[#087a5b] focus:ring-4 focus:ring-[#087a5b]/10 disabled:bg-[#eff4f2]";

function Selector({ label, icon: Icon, value, onChange, children, disabled }) {
  return <label className="block min-w-0"><span className="mb-2 flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-[0.13em] text-[#687a73]"><Icon size={15} className="text-[#1687b5]" />{label}</span><div className="relative"><select className={SELECT_CLASS} value={value} onChange={onChange} disabled={disabled}>{children}</select><ChevronRight size={17} className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 rotate-90 text-[#456159]" /></div></label>;
}

function Metric({ label, value, detail, color }) {
  return <div className="min-w-0 border-b border-[#d5e1dd] px-5 py-4 last:border-b-0 sm:border-b-0 sm:border-r sm:last:border-r-0"><p className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-[#708079]">{label}</p><div className="mt-1 flex items-end gap-2"><strong className="text-3xl font-extrabold tracking-[-0.04em] text-[#14231e]">{value}</strong><span className={`mb-1 h-2.5 w-2.5 rounded-full ${color}`} /></div><p className="mt-1 truncate text-xs text-[#75837e]">{detail}</p></div>;
}

function EmptyState({ hasSection, isInitial }) {
  return <div className="grid min-h-[330px] place-items-center px-6 py-12 text-center"><div className="max-w-md"><span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-[#eef7fb] text-[#2588b7]"><BookOpenCheck size={30} /></span><h3 className="mt-5 text-xl font-extrabold text-[#172720]">{hasSection ? "No hay cursos configurados" : "Selecciona un salón"}</h3><p className="mt-2 text-sm leading-6 text-[#6c7b75]">{hasSection ? (isInitial ? "Este salón aún no está disponible para asignar un responsable." : "Alta Dirección debe agregar los cursos de este grado antes de distribuir horas y docentes.") : "Elige el año, nivel, grado y sección para revisar su carga académica."}</p></div></div>;
}

export function AcademicLoadView({ workspace, loading, error, feedback, refreshing, saving, onRefresh, onSave }) {
  const [yearId, setYearId] = useState("");
  const [levelId, setLevelId] = useState("");
  const [gradeId, setGradeId] = useState("");
  const [sectionId, setSectionId] = useState("");
  const [selectedKey, setSelectedKey] = useState("");
  const years = useMemo(() => [...workspace.years].sort((a, b) => String(b.startsOn).localeCompare(String(a.startsOn))), [workspace.years]);
  const levels = useMemo(() => [...workspace.levels].sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0)), [workspace.levels]);
  const grades = useMemo(() => workspace.grades.filter((item) => String(item.levelId) === String(levelId)).sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0)), [workspace.grades, levelId]);
  const sections = useMemo(() => workspace.sections.filter((item) => String(item.academicYearId) === String(yearId) && String(item.gradeId) === String(gradeId)), [workspace.sections, yearId, gradeId]);

  useEffect(() => { if (years.length && !years.some((item) => String(item.id) === String(yearId))) setYearId(String(years.find((item) => item.active)?.id || years[0].id)); }, [years, yearId]);
  useEffect(() => { if (levels.length && !levels.some((item) => String(item.id) === String(levelId))) setLevelId(String(levels[0].id)); }, [levels, levelId]);
  useEffect(() => { if (!grades.some((item) => String(item.id) === String(gradeId))) setGradeId(grades[0] ? String(grades[0].id) : ""); }, [grades, gradeId]);
  useEffect(() => { if (!sections.some((item) => String(item.id) === String(sectionId))) setSectionId(sections[0] ? String(sections[0].id) : ""); }, [sections, sectionId]);

  const year = years.find((item) => String(item.id) === String(yearId));
  const level = levels.find((item) => String(item.id) === String(levelId));
  const grade = grades.find((item) => String(item.id) === String(gradeId));
  const section = sections.find((item) => String(item.id) === String(sectionId));
  const teachers = useMemo(() => workspace.profiles.filter((item) => item.role === "docente" && item.active).sort((a, b) => a.fullName.localeCompare(b.fullName, "es")), [workspace.profiles]);
  const subjectMap = useMemo(() => new Map(workspace.subjects.map((item) => [String(item.id), item])), [workspace.subjects]);
  const teacherMap = useMemo(() => new Map(teachers.map((item) => [String(item.id), item])), [teachers]);
  const isInitial = level?.materialScope === "section";

  const rows = useMemo(() => {
    if (!section) return [];
    if (isInitial) {
      const assignment = workspace.assignments.find((item) => String(item.sectionId) === String(section.id) && item.active && !item.archivedAt);
      return [{ key: `section-${section.id}`, scope: "section", scopeId: section.id, title: "Responsable integral del aula", context: `${grade?.name || "Grado"} · Sección ${section.name}`, weeklyHours: null, teacherId: assignment?.teacherId || "", teacherName: teacherMap.get(String(assignment?.teacherId))?.fullName || "Sin docente", startsOn: assignment?.startsOn, endsOn: assignment?.endsOn }];
    }
    return workspace.offerings.filter((item) => String(item.sectionId) === String(section.id) && item.active && !item.archivedAt).map((item) => {
      const assignment = workspace.assignments.find((value) => String(value.courseOfferingId) === String(item.id) && value.active && !value.archivedAt);
      const subject = subjectMap.get(String(item.subjectId));
      return { key: `course-${item.id}`, scope: "course", scopeId: item.id, title: item.displayName || subject?.name || "Curso", context: `${grade?.name || "Grado"} · Sección ${section.name}`, weeklyHours: item.weeklyHours || 0, teacherId: assignment?.teacherId || "", teacherName: teacherMap.get(String(assignment?.teacherId))?.fullName || "Sin docente", startsOn: assignment?.startsOn, endsOn: assignment?.endsOn };
    }).sort((a, b) => a.title.localeCompare(b.title, "es"));
  }, [section, isInitial, workspace.assignments, workspace.offerings, grade, subjectMap, teacherMap]);

  useEffect(() => { if (selectedKey && !rows.some((item) => item.key === selectedKey)) setSelectedKey(""); }, [rows, selectedKey]);
  const selectedEntry = rows.find((item) => item.key === selectedKey);
  const totalHours = rows.reduce((sum, item) => sum + Number(item.weeklyHours || 0), 0);
  const assigned = rows.filter((item) => item.teacherId).length;
  const pending = rows.filter((item) => !item.teacherId || (item.scope === "course" && !item.weeklyHours)).length;
  async function saveAndClose(values) { if (await onSave(values)) setSelectedKey(""); }

  if (loading) return <div className="grid min-h-[560px] place-items-center"><LoaderCircle className="animate-spin text-[#087a5b]" size={38} /></div>;
  if (error) return <div className="mx-auto mt-16 max-w-xl rounded-2xl border border-red-200 bg-red-50 p-8 text-center"><AlertCircle className="mx-auto text-red-600" /><h2 className="mt-3 text-xl font-extrabold">No se pudo cargar la información</h2><p className="mt-2 text-sm text-red-800">{error}</p><button onClick={onRefresh} className="mt-5 rounded-xl bg-[#087a5b] px-5 py-3 text-sm font-extrabold text-white">Reintentar</button></div>;

  return (
    <div className="mx-auto max-w-[1480px] px-4 py-6 sm:px-7 lg:px-9 lg:py-9">
      <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="mb-2 text-xs font-extrabold uppercase tracking-[0.18em] text-[#2387b8]">Coordinación académica</p><h1 className="text-3xl font-extrabold tracking-[-0.045em] text-[#14231e] sm:text-4xl">Carga académica</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-[#66766f] sm:text-base">Distribuye las horas y el docente responsable de cada curso por salón.</p></div><button onClick={onRefresh} disabled={refreshing} className="inline-flex min-h-11 items-center justify-center gap-2 self-start rounded-xl border border-[#9dbbb0] bg-white px-4 text-sm font-extrabold text-[#08684f] hover:bg-[#eff8f4] disabled:opacity-50"><RefreshCw size={17} className={refreshing ? "animate-spin" : ""} />Actualizar</button></div>

      {feedback?.text && <div className={`mb-5 flex items-center gap-3 rounded-xl border px-4 py-3 text-sm font-bold ${feedback.type === "error" ? "border-red-200 bg-red-50 text-red-800" : "border-emerald-200 bg-emerald-50 text-emerald-800"}`}>{feedback.type === "error" ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}{feedback.text}</div>}
      <section className="overflow-hidden rounded-2xl border border-[#aec5bc] bg-white shadow-[0_16px_45px_rgba(17,45,36,0.055)]"><div className="h-1.5 bg-[linear-gradient(90deg,#087a5b_0_58%,#f6c329_58%_79%,#2488b8_79%)]" /><div className="grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-4 xl:p-6">
        <Selector label="Año lectivo" icon={CalendarDays} value={yearId} onChange={(e) => setYearId(e.target.value)} disabled={!years.length}><option value="">Sin años lectivos</option>{years.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Selector>
        <Selector label="Nivel educativo" icon={School} value={levelId} onChange={(e) => setLevelId(e.target.value)} disabled={!levels.length}><option value="">Sin niveles</option>{levels.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Selector>
        <Selector label="Grado" icon={GraduationCap} value={gradeId} onChange={(e) => setGradeId(e.target.value)} disabled={!grades.length}><option value="">Sin grados</option>{grades.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Selector>
        <Selector label="Sección" icon={UsersRound} value={sectionId} onChange={(e) => setSectionId(e.target.value)} disabled={!sections.length}><option value="">Sin secciones</option>{sections.map((item) => <option key={item.id} value={item.id}>Sección {item.name}</option>)}</Selector>
      </div></section>

      <section className="mt-5 grid overflow-hidden rounded-2xl border border-[#c1d2cc] bg-white sm:grid-cols-2 lg:grid-cols-4"><Metric label={isInitial ? "Responsables" : "Cursos programados"} value={rows.length} detail={section ? `${grade?.name} · Sección ${section.name}` : "Sin salón seleccionado"} color="bg-[#087a5b]" /><Metric label="Horas semanales" value={isInitial ? "—" : totalHours} detail={isInitial ? "Gestión integral del aula" : "Total planificado"} color="bg-[#f2be21]" /><Metric label="Docentes asignados" value={assigned} detail={`${teachers.length} docentes disponibles`} color="bg-[#2488b8]" /><Metric label="Pendientes" value={pending} detail={pending ? "Requieren atención" : "Carga completa"} color={pending ? "bg-[#dc744c]" : "bg-[#38a176]"} /></section>

      <div className={`mt-5 grid gap-5 ${selectedEntry ? "2xl:grid-cols-[minmax(0,1fr)_470px]" : ""}`}>
        <section className="min-w-0 overflow-hidden rounded-2xl border border-[#aec5bc] bg-white shadow-[0_16px_45px_rgba(17,45,36,0.05)]">
          <header className="flex items-center justify-between gap-4 border-b border-[#d8e3df] px-5 py-5 sm:px-6"><div><h2 className="text-lg font-extrabold text-[#172720]">Plan semanal del salón</h2><p className="mt-1 text-xs text-[#6f7e78]">Selecciona una fila para completar o modificar su carga.</p></div>{pending === 0 && rows.length > 0 && <span className="hidden items-center gap-1.5 rounded-full bg-[#e8f6f0] px-3 py-1.5 text-xs font-extrabold text-[#087456] sm:inline-flex"><CheckCircle2 size={15} />Completo</span>}</header>
          {!rows.length ? <EmptyState hasSection={Boolean(section)} isInitial={isInitial} /> : <><div className="hidden overflow-x-auto md:block"><table className="w-full min-w-[760px] border-collapse text-left"><thead><tr className="bg-[#f4f8f6] text-[11px] font-extrabold uppercase tracking-[0.1em] text-[#62736c]"><th className="px-6 py-4">Curso</th><th className="px-4 py-4">Horas semanales</th><th className="px-4 py-4">Docente asignado</th><th className="px-4 py-4">Estado</th><th className="px-6 py-4 text-right">Acción</th></tr></thead><tbody>{rows.map((row) => { const complete = row.teacherId && (row.scope === "section" || row.weeklyHours); return <tr key={row.key} onClick={() => setSelectedKey(row.key)} className={`cursor-pointer border-t border-[#e0e8e5] transition hover:bg-[#f3faf7] ${selectedKey === row.key ? "bg-[#edf8f4] shadow-[inset_4px_0_0_#078462]" : ""}`}><td className="px-6 py-5"><p className="font-extrabold text-[#172720]">{row.title}</p><p className="mt-1 text-xs text-[#75837e]">{row.context}</p></td><td className="px-4 py-5"><span className="inline-flex items-center gap-2 font-extrabold text-[#263730]"><Clock3 size={16} className="text-[#d49a00]" />{row.scope === "course" ? `${row.weeklyHours || 0} h` : "Integral"}</span></td><td className="px-4 py-5 text-sm font-semibold text-[#405149]">{row.teacherName}</td><td className="px-4 py-5"><span className={`rounded-full px-3 py-1.5 text-xs font-extrabold ${complete ? "bg-[#e6f4ee] text-[#087456]" : "bg-[#fff2d1] text-[#956300]"}`}>{complete ? "Completo" : "Pendiente"}</span></td><td className="px-6 py-5 text-right"><button onClick={(event) => { event.stopPropagation(); setSelectedKey(row.key); }} className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[#a9c0b7] text-[#087456] hover:bg-white" aria-label={`Editar ${row.title}`}><Pencil size={17} /></button></td></tr>; })}</tbody></table></div><div className="divide-y divide-[#e0e8e5] md:hidden">{rows.map((row) => <button key={row.key} onClick={() => setSelectedKey(row.key)} className="flex w-full items-center justify-between gap-4 px-5 py-5 text-left hover:bg-[#f3faf7]"><div className="min-w-0"><p className="truncate font-extrabold text-[#172720]">{row.title}</p><p className="mt-1 truncate text-xs text-[#687972]">{row.teacherName} · {row.scope === "course" ? `${row.weeklyHours || 0} h` : "Gestión integral"}</p></div><ChevronRight className="shrink-0 text-[#087456]" size={20} /></button>)}</div></>}
        </section>
        {selectedEntry && <><div className="fixed inset-0 z-40 bg-[#0b3025]/45 backdrop-blur-[2px] 2xl:hidden" onClick={() => setSelectedKey("")} /><AcademicLoadEditor key={selectedEntry.key} entry={selectedEntry} teachers={teachers} year={year} busy={saving} onClose={() => setSelectedKey("")} onSave={saveAndClose} /></>}
      </div>
    </div>
  );
}

export default function AcademicLoadManagement({ user }) {
  const remote = isSupabaseConfigured && user?.authSource === "supabase";
  const [workspace, setWorkspace] = useState(EMPTY_WORKSPACE);
  const [loading, setLoading] = useState(remote);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [error, setError] = useState(remote ? "" : "Conecta una sesión de Supabase para gestionar la carga académica real.");
  const refresh = useCallback(async (quiet = false) => { if (!remote) return; quiet ? setRefreshing(true) : setLoading(true); try { setWorkspace(await loadAcademicWorkspace()); setError(""); } catch (loadError) { setError(loadError.message); } finally { setLoading(false); setRefreshing(false); } }, [remote]);
  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => remote ? subscribeToAcademicChanges(() => refresh(true)) : undefined, [remote, refresh]);
  async function save(values) { setSaving(true); setFeedback(null); try { await saveAcademicLoadEntry(values); await refresh(true); setFeedback({ type: "success", text: "La carga académica se guardó correctamente." }); return true; } catch (saveError) { setFeedback({ type: "error", text: saveError.message }); return false; } finally { setSaving(false); } }
  return <AcademicLoadView workspace={workspace} loading={loading} error={error} feedback={feedback} refreshing={refreshing} saving={saving} onRefresh={() => refresh()} onSave={save} />;
}
