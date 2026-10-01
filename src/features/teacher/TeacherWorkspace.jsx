import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowRight, BookOpen, CalendarDays, ChevronDown, ClipboardCheck, Clock3, FileCheck2, FolderOpen, GraduationCap, RefreshCw, Users } from "lucide-react";
import PageHeading from "../../components/PageHeading";
import AttendanceRegister from "./AttendanceRegister";
import TeacherGradebook from "./TeacherGradebook";
import { loadTeacherWorkspace } from "./teacherApi";
import { Feedback, Loading, secondaryClass } from "./TeacherUI";
import WeeklyTimetable from "../student/portal/WeeklyTimetable";
import { BUTTON, CARD, Card, CourseBadge, Empty, StatCard } from "../student/portal/ui";
import { DAY_SHORT, coursePalette, hhmm, limaNow, longDate, toMinutes } from "../student/portal/theme";
import { KINDS, evaluationKind, weekdayDate } from "../evaluation-plan/planUtils";

const DESCRIPTIONS = {
  "Mis cursos": "Tus secciones, estudiantes y horario semanal.",
  Asistencia: "Marca la asistencia del día con un toque por estudiante.",
  Calificaciones: "Registra las notas del bimestre en una sola planilla.",
};

function CourseCards({ courses, palette, onNavigate, showRoster = false }) {
  const [open, setOpen] = useState(null);
  return <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{courses.map((course) => {
    const tone = palette.get(course.name);
    const days = [...new Set(course.schedule.map((slot) => slot.day))].sort();
    return <article key={course.id} className={`${CARD} flex flex-col overflow-hidden`}>
      <div className={`h-2 ${tone.bar}`} />
      <div className="flex flex-1 flex-col gap-4 p-5">
        <div className="flex items-start gap-3"><CourseBadge name={course.name} tone={tone} /><div className="min-w-0"><h3 className="m-0 text-[17px] font-extrabold leading-tight text-brand-950">{course.name}</h3><p className="mb-0 mt-1 text-[13px] text-muted">{course.classroom} · {course.year}</p></div></div>
        <div className="flex flex-wrap items-center gap-1.5">{days.length ? days.map((day) => <span key={day} className={`rounded-full px-2.5 py-1 text-[11px] font-extrabold ${tone.soft} ${tone.text}`}>{DAY_SHORT[day]}</span>) : <span className="text-[12px] text-muted">Horario pendiente</span>}</div>
        <dl className="m-0 grid grid-cols-2 gap-2 text-[12px]">
          <div className="rounded-[8px] bg-canvas p-2.5"><dt className="text-muted">Estudiantes</dt><dd className="m-0 text-[15px] font-extrabold text-brand-950">{course.students.length}</dd></div>
          <div className="rounded-[8px] bg-canvas p-2.5"><dt className="text-muted">Horas semanales</dt><dd className="m-0 text-[15px] font-extrabold text-brand-950">{course.weeklyHours || "—"}</dd></div>
        </dl>
        {showRoster ? <div>
          <button type="button" aria-expanded={open === course.id} onClick={() => setOpen(open === course.id ? null : course.id)} className="flex w-full items-center justify-between rounded-[8px] border border-line px-3 py-2 text-[13px] font-bold text-brand-900 hover:bg-brand-50"><span className="flex items-center gap-2"><Users size={15} />Ver estudiantes ({course.students.length})</span><ChevronDown size={16} className={`transition ${open === course.id ? "rotate-180" : ""}`} /></button>
          {open === course.id ? <ol className="m-0 mt-2 max-h-64 list-none overflow-y-auto rounded-[8px] border border-line p-0">{course.students.length ? course.students.map((student, index) => <li key={student.id} className="flex gap-3 border-b border-line px-3 py-2 text-[13px] last:border-0"><span className="w-5 text-right text-muted">{index + 1}</span>{student.name}</li>) : <li className="px-3 py-3 text-[13px] text-muted">Aún no hay estudiantes matriculados.</li>}</ol> : null}
        </div> : null}
        <div className="mt-auto grid grid-cols-3 gap-2">
          <button type="button" className={`${BUTTON} px-2 text-[12px]`} onClick={() => onNavigate("Asistencia")}><ClipboardCheck size={15} />Asistencia</button>
          <button type="button" className={`${BUTTON} px-2 text-[12px]`} onClick={() => onNavigate("Calificaciones")}><FileCheck2 size={15} />Notas</button>
          <button type="button" className={`${BUTTON} px-2 text-[12px]`} onClick={() => onNavigate("Materiales")}><FolderOpen size={15} />Material</button>
        </div>
      </div>
    </article>;
  })}</div>;
}

function Home({ user, courses, palette, onNavigate }) {
  const now = limaNow();
  const today = courses.flatMap((course) => course.schedule.filter((slot) => slot.day === now.weekday).map((slot) => ({ ...slot, course }))).sort((a, b) => a.start.localeCompare(b.start));
  const students = new Set(courses.flatMap((course) => course.students.map((student) => student.studentId))).size;
  // Mismo examen en varios cursos se muestra una sola vez.
  const upcoming = Object.values(courses.flatMap((course) => course.evaluations.filter((item) => item.date && item.date >= now.date && item.state !== "cerrada").map((item) => ({ ...item, course })))
    .reduce((groups, item) => { const key = `${item.date}|${item.title}`; (groups[key] ||= { ...item, key, courses: [] }).courses.push(item.course); return groups; }, {}))
    .sort((a, b) => a.date.localeCompare(b.date)).slice(0, 4);
  return <>
    <section className="relative overflow-hidden rounded-[14px] bg-brand-900 p-6 text-white md:p-8">
      <i aria-hidden="true" className="absolute -right-16 -top-20 h-64 w-64 rounded-full bg-white/5" /><i aria-hidden="true" className="absolute -bottom-24 right-24 h-52 w-52 rounded-full bg-[#f3bd24]/15" />
      <div className="relative">
        <p className="m-0 text-[13px] font-bold text-[#bfe3d6]">{longDate(now.date)}</p>
        <h1 className="mb-0 mt-1 text-3xl font-extrabold tracking-[-0.045em] sm:text-4xl">Hola, {(user?.name || "docente").split(" ")[0]}</h1>
        <p className="mb-0 mt-2 max-w-xl text-[14px] leading-6 text-[#d7ece4]">{today.length ? `Hoy tienes ${today.length} ${today.length === 1 ? "clase" : "clases"}.` : "Hoy no tienes clases programadas."} Aquí tienes lo que necesitas para tu día.</p>
      </div>
    </section>
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      <StatCard icon={BookOpen} label="Cursos a cargo" value={courses.length} onClick={() => onNavigate("Mis cursos")} />
      <StatCard icon={Users} label="Estudiantes" value={students} tone="bg-[#eaf2ff] text-[#1d4d9c]" onClick={() => onNavigate("Mis cursos")} />
      <StatCard icon={Clock3} label="Clases hoy" value={today.length} tone="bg-[#e8f7ee] text-[#146c43]" onClick={() => onNavigate("Asistencia")} />
      <StatCard icon={CalendarDays} label={upcoming[0] ? `Próximo: ${upcoming[0].title}` : "Próximo examen"} value={upcoming[0] ? weekdayDate(upcoming[0].date) : "—"} tone="bg-[#fff6dc] text-[#7a5200]" onClick={() => onNavigate("Calificaciones")} />
    </div>
    <div className="grid items-start gap-5 lg:grid-cols-[1.2fr_1fr]">
      <Card title="Tus clases de hoy" icon={Clock3} action={<button type="button" className="inline-flex items-center gap-1 text-[12px] font-extrabold text-brand-800" onClick={() => onNavigate("Mis cursos")}>Horario semanal<ArrowRight size={15} /></button>}>
        {today.length ? <ol className="m-0 grid list-none gap-2.5 p-0">{today.map((slot) => {
          const tone = palette.get(slot.course.name); const live = now.minutes >= toMinutes(slot.start) && now.minutes < toMinutes(slot.end);
          return <li key={slot.id} className={`flex flex-wrap items-center gap-3 rounded-[10px] border-l-[5px] ${tone.border} ${tone.soft} p-3`}>
            <span className="w-14 text-[13px] font-extrabold">{hhmm(slot.start)}<small className="block text-[11px] font-semibold text-muted">{hhmm(slot.end)}</small></span>
            <span className="min-w-0 flex-1"><strong className={`block text-[14px] ${tone.text}`}>{slot.course.name}{live ? <span className="ml-2 rounded-full bg-red px-2 py-0.5 align-middle text-[10px] font-extrabold uppercase text-white">En curso</span> : null}</strong><small className="block text-[12px] text-[#4d5c57]">{slot.course.classroom} · {slot.course.students.length} estudiantes</small></span>
            <span className="flex gap-2"><button type="button" className={`${BUTTON} min-h-9 px-3 text-[12px]`} onClick={() => onNavigate("Asistencia")}><ClipboardCheck size={14} />Asistencia</button><button type="button" className={`${BUTTON} min-h-9 px-3 text-[12px]`} onClick={() => onNavigate("Calificaciones")}><FileCheck2 size={14} />Notas</button></span>
          </li>;
        })}</ol> : <Empty icon={CalendarDays}>No hay clases programadas para hoy.</Empty>}
      </Card>
      <Card title="Próximos exámenes" icon={FileCheck2} action={<button type="button" className="inline-flex items-center gap-1 text-[12px] font-extrabold text-brand-800" onClick={() => onNavigate("Calificaciones")}>Planilla de notas<ArrowRight size={15} /></button>}>
        {upcoming.length ? <ul className="m-0 grid list-none gap-2.5 p-0">{upcoming.map((item) => { const kind = KINDS[evaluationKind(item.title).key]; return <li key={item.key} className="grid grid-cols-[52px_1fr] items-center gap-3 rounded-[10px] border border-line p-2.5">
          <time className={`grid h-[52px] place-content-center rounded-[8px] text-center ${kind.chip}`}><strong className="text-[18px] leading-none">{Number(item.date.slice(8, 10))}</strong><small className="text-[10px] font-extrabold uppercase">{new Date(`${item.date}T12:00:00`).toLocaleDateString("es-PE", { month: "short" }).replace(".", "")}</small></time>
          <span className="min-w-0"><strong className="block truncate text-[14px]">{item.title}</strong><small className="text-[12px] text-muted">{item.courses.length === courses.length ? "Todos tus cursos" : item.courses.map((course) => `${course.name} (${course.classroom})`).join(", ")}</small></span>
        </li>; })}</ul> : <Empty icon={FileCheck2}>No hay exámenes próximos programados.</Empty>}
      </Card>
    </div>
    <div className="flex items-end justify-between gap-3"><h2 className="m-0 text-[18px] font-extrabold text-brand-950">Mis cursos</h2><button type="button" className="inline-flex items-center gap-1 text-[12px] font-extrabold text-brand-800" onClick={() => onNavigate("Mis cursos")}>Ver estudiantes y horario<ArrowRight size={15} /></button></div>
    <CourseCards courses={courses} palette={palette} onNavigate={onNavigate} />
  </>;
}

export default function TeacherWorkspace({ section, user, onNavigate = () => {} }) {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const refresh = useCallback(async () => {
    if (!user?.id || user.authSource !== "supabase") {
      setCourses([]);
      setError("No se pudo recuperar tu sesión. Recarga el portal e inicia sesión con tu cuenta docente.");
      setLoading(false);
      return;
    }
    if (user.role !== "docente") {
      setCourses([]);
      setError("Este panel requiere una cuenta docente activa.");
      setLoading(false);
      return;
    }
    if (!window.dispatchEvent(new Event("mp-before-navigation", { cancelable: true }))) return;
    setLoading(true); setError("");
    try { setCourses(await loadTeacherWorkspace()); }
    catch (requestError) { setError(requestError.message); setCourses([]); }
    finally { setLoading(false); }
  }, [user?.id, user?.authSource, user?.role]);
  useEffect(() => { refresh(); }, [refresh]);
  const palette = useMemo(() => coursePalette(courses.map((course) => course.name)), [courses]);
  // Horario del docente: cada bloque muestra el curso y su salón.
  const schedule = courses.flatMap((course) => course.schedule.map((slot) => ({ ...slot, id: `${course.id}-${slot.id}`, course: course.name, teachers: course.classroom })));
  const home = section === "Inicio";

  return <section className="mx-auto max-w-[1240px] space-y-5 pb-14 text-ink" aria-busy={loading}>
    {!home || error || loading || !courses.length ? <PageHeading standard title={home ? "Panel docente" : section} description={home ? "Tus cursos asignados y las herramientas para trabajar con tus estudiantes." : DESCRIPTIONS[section]} action={<button className={secondaryClass} disabled={loading} onClick={refresh}><RefreshCw size={15} />Actualizar</button>} /> : null}
    <Feedback error={error} onRetry={refresh} />
    {loading ? <section className={CARD}><Loading /></section> : error ? null
      : !courses.length ? <Empty icon={GraduationCap} title="Aún no tienes cursos asignados">Dirección o Coordinación Académica debe asignarte un curso en un año lectivo activo. Tus estudiantes y horarios aparecerán aquí cuando estén registrados.</Empty>
      : home ? <Home user={user} courses={courses} palette={palette} onNavigate={onNavigate} />
      : section === "Asistencia" ? <AttendanceRegister courses={courses} />
      : section === "Calificaciones" ? <TeacherGradebook courses={courses} />
      : <>
        <Card title="Mi horario semanal" icon={CalendarDays} bodyClassName="p-4 md:p-5"><WeeklyTimetable schedule={schedule} palette={palette} /></Card>
        <CourseCards courses={courses} palette={palette} onNavigate={onNavigate} showRoster />
      </>}
  </section>;
}
