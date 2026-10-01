import { useEffect, useMemo, useState } from "react";
import { ArrowRight, BookOpen, CalendarCheck2, CalendarDays, CircleCheck, Clock3, FileCheck2, FolderOpen, GraduationCap, Megaphone, TimerReset, UserRound, XCircle } from "lucide-react";
import PageHeading from "../../components/PageHeading";
import { loadStudentPortal } from "./studentApi";
import WeeklyTimetable from "./portal/WeeklyTimetable";
import { BUTTON, CARD, Card, CourseBadge, Empty, Pill, StatCard } from "./portal/ui";
import { DAY_SHORT, coursePalette, hhmm, limaNow, longDate, toMinutes } from "./portal/theme";
import { KINDS, columnsOf, currentPeriod, dayMonth, evaluationKind, gradeClass, numericAverage, periodsInOrder, weekdayDate } from "../evaluation-plan/planUtils";

const STATUSES = { presente: "Presente", tardanza: "Tardanza", ausente: "Ausente" };
const STATUS_TONE = { presente: "bg-[#dcf5e6] text-[#146c43]", tardanza: "bg-[#fff1cc] text-[#7a5200]", ausente: "bg-[#ffe1e1] text-[#a1231f]" };
const FAMILY_TITLES = (child) => ({ Horario: [`Horario de ${child}`, "Su semana de clases. Toca un curso para ver el detalle."], Calificaciones: [`Calificaciones de ${child}`, "Notas publicadas por sus docentes, por curso y bimestre."], Asistencia: [`Asistencia de ${child}`, "Registro diario de asistencia y tardanzas."] });
const TITLES = { "Mis cursos": ["Mis cursos", "Tus asignaturas, docentes y días de clase."], Horario: ["Mi horario", "Tu semana de clases. Toca un curso para ver el detalle."], Calificaciones: ["Mis calificaciones", "Resultados que tus docentes publicaron, por curso y periodo."], Asistencia: ["Mi asistencia", "Tu registro diario de asistencia y tardanzas."] };

function ClassroomChip({ enrollment }) {
  return <span className="inline-flex items-center gap-2 rounded-full border border-line-strong bg-white px-4 py-2 text-[12px] font-bold text-brand-900"><GraduationCap className="h-4 w-4" />{enrollment.classroom} · {enrollment.year}</span>;
}

function Home({ user, child, enrollment, courses, schedule, evaluations, attendance, palette, onNavigate, now }) {
  const today = schedule.filter((row) => row.day === now.weekday).sort((a, b) => a.start.localeCompare(b.start));
  // Agrupa el mismo examen de varios cursos: "Examen semanal 5 · 4 cursos".
  const upcoming = Object.values(evaluations.filter((row) => row.date >= now.date && row.state !== "cerrada").reduce((groups, row) => { const key = `${row.date}|${row.title}`; (groups[key] ||= { ...row, id: key, courses: [] }).courses.push(row.course); return groups; }, {})).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 4);
  const graded = evaluations.filter((row) => row.grade != null).length;
  const attended = attendance.filter((row) => row.status !== "ausente").length;
  return <>
    <section className="relative overflow-hidden rounded-[14px] bg-brand-900 p-6 text-white md:p-8">
      <i aria-hidden="true" className="absolute -right-16 -top-20 h-64 w-64 rounded-full bg-white/5" /><i aria-hidden="true" className="absolute -bottom-24 right-24 h-52 w-52 rounded-full bg-[#f3bd24]/15" />
      <div className="relative flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className="m-0 text-[13px] font-bold text-[#bfe3d6]">{longDate(now.date)}</p>
          <h1 className="mb-0 mt-1 text-3xl font-extrabold tracking-[-0.045em] sm:text-4xl">Hola, {user.name.split(" ")[0]}</h1>
          <p className="mb-0 mt-2 max-w-xl text-[14px] leading-6 text-[#d7ece4]">{child ? (today.length ? `Así va el día de ${child}: hoy tiene ${today.length} ${today.length === 1 ? "clase" : "clases"}.` : `${child} no tiene clases programadas hoy.`) : today.length ? `Hoy tienes ${today.length} ${today.length === 1 ? "clase" : "clases"}. ¡Que tengas un gran día!` : "Hoy no tienes clases programadas."}</p>
        </div>
        {enrollment ? <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-[13px] font-bold"><GraduationCap className="h-4 w-4" />{enrollment.classroom}</span> : null}
      </div>
    </section>
    {enrollment ? <>
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatCard icon={BookOpen} label={child ? "Cursos" : "Mis cursos"} value={courses.length} onClick={() => onNavigate(child ? "Calificaciones" : "Mis cursos")} />
        <StatCard icon={Clock3} label="Clases hoy" value={today.length} tone="bg-[#eaf2ff] text-[#1d4d9c]" onClick={() => onNavigate("Horario")} />
        <StatCard icon={FileCheck2} label="Notas publicadas" value={graded} tone="bg-[#fff6dc] text-[#7a5200]" onClick={() => onNavigate("Calificaciones")} />
        <StatCard icon={CalendarCheck2} label="Asistencia" value={attendance.length ? `${Math.round((attended / attendance.length) * 100)}%` : "—"} hint={`${attendance.length} días registrados`} tone="bg-[#e8f7ee] text-[#146c43]" onClick={() => onNavigate("Asistencia")} />
      </div>
      <div className="grid items-start gap-5 lg:grid-cols-[1.2fr_1fr]">
        <Card title={child ? `Clases de hoy de ${child}` : "Tus clases de hoy"} icon={Clock3} action={<button type="button" className="inline-flex items-center gap-1 text-[12px] font-extrabold text-brand-800" onClick={() => onNavigate("Horario")}>Horario completo<ArrowRight className="h-4 w-4" /></button>}>
          {today.length ? <ol className="m-0 grid list-none gap-2.5 p-0">{today.map((row) => {
            const tone = palette.get(row.course); const live = now.minutes >= toMinutes(row.start) && now.minutes < toMinutes(row.end);
            return <li key={row.id} className={`grid grid-cols-[64px_1fr_auto] items-center gap-3 rounded-[10px] border-l-[5px] ${tone.border} ${tone.soft} p-3`}>
              <span className="text-[13px] font-extrabold">{hhmm(row.start)}<small className="block text-[11px] font-semibold text-muted">{hhmm(row.end)}</small></span>
              <span className="min-w-0"><strong className={`block text-[14px] ${tone.text}`}>{row.course}</strong><small className="block truncate text-[12px] text-[#4d5c57]">{row.teachers || "Docente por asignar"}</small></span>
              {live ? <span className="rounded-full bg-red px-2.5 py-1 text-[10px] font-extrabold uppercase text-white">En curso</span> : null}
            </li>;
          })}</ol> : <Empty icon={CalendarDays}>No hay clases programadas para hoy.</Empty>}
        </Card>
        <Card title="Próximas evaluaciones" icon={FileCheck2} action={<button type="button" className="inline-flex items-center gap-1 text-[12px] font-extrabold text-brand-800" onClick={() => onNavigate("Calendario")}>Calendario<ArrowRight className="h-4 w-4" /></button>}>
          {upcoming.length ? <ul className="m-0 grid list-none gap-2.5 p-0">{upcoming.map((row) => { const tone = row.courses.length === 1 ? palette.get(row.course) : { soft: KINDS[evaluationKind(row.title).key].chip.split(" ")[0], text: KINDS[evaluationKind(row.title).key].chip.split(" ")[1] }; const day = Number(row.date.slice(8, 10)); const month = new Date(`${row.date}T12:00:00`).toLocaleDateString("es-PE", { month: "short" }).replace(".", ""); return <li key={row.id} className="grid grid-cols-[52px_1fr] items-center gap-3 rounded-[10px] border border-line p-2.5">
            <time className={`grid h-[52px] place-content-center rounded-[8px] text-center ${tone.soft} ${tone.text}`}><strong className="text-[18px] leading-none">{day}</strong><small className="text-[10px] font-extrabold uppercase">{month}</small></time>
            <span className="min-w-0"><strong className="block truncate text-[14px]">{row.title}</strong><small className="text-[12px] text-muted">{row.courses.length === 1 ? row.course : row.courses.length === courses.length ? (child ? "Todos sus cursos" : "Todos tus cursos") : row.courses.join(", ")}</small></span>
          </li>; })}</ul> : <Empty icon={FileCheck2}>No tienes evaluaciones próximas publicadas.</Empty>}
        </Card>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {(child ? [["Horario", Clock3, `Semana de clases de ${child}`], ["Calendario", CalendarDays, "Actividades del colegio"], ["Comunicados", Megaphone, "Avisos del colegio para las familias"]] : [["Materiales", FolderOpen, "Libros y recursos de tus cursos"], ["Calendario", CalendarDays, "Actividades del colegio"], ["Comunicados", Megaphone, "Avisos de tus docentes"]]).map(([label, Icon, text]) => <button key={label} type="button" onClick={() => onNavigate(label)} className={`${CARD} group flex items-center gap-3 p-4 text-left transition hover:border-brand-800`}>
          <span className="grid h-10 w-10 place-items-center rounded-full bg-brand-100 text-brand-900"><Icon className="h-5 w-5" /></span>
          <span className="min-w-0 flex-1"><strong className="block text-[14px] text-brand-950">{label}</strong><small className="text-[12px] text-muted">{text}</small></span>
          <ArrowRight className="h-4 w-4 text-muted transition group-hover:translate-x-1 group-hover:text-brand-800" />
        </button>)}
      </div>
    </> : null}
  </>;
}

function Courses({ courses, evaluations, palette, onNavigate }) {
  if (!courses.length) return <Empty icon={BookOpen} title="Sin cursos asignados">Aún no hay cursos asignados a tu sección.</Empty>;
  return <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{courses.map((course) => {
    const tone = palette.get(course.name);
    const days = [...new Set(course.schedule.map((row) => row.day))].sort();
    const published = evaluations.filter((row) => row.course === course.name);
    return <article key={course.id} className={`${CARD} flex flex-col overflow-hidden`}>
      <div className={`h-2 ${tone.bar}`} />
      <div className="flex flex-1 flex-col gap-4 p-5">
        <div className="flex items-start gap-3"><CourseBadge name={course.name} tone={tone} /><div className="min-w-0"><h2 className="m-0 text-[17px] font-extrabold leading-tight text-brand-950">{course.name}</h2><p className="mb-0 mt-1 flex items-center gap-1.5 text-[13px] text-muted"><UserRound className="h-3.5 w-3.5 flex-none" /><span className="truncate">{course.teachers || "Docente por asignar"}</span></p></div></div>
        <div className="flex flex-wrap gap-1.5">{days.length ? days.map((day) => <span key={day} className={`rounded-full px-2.5 py-1 text-[11px] font-extrabold ${tone.soft} ${tone.text}`}>{DAY_SHORT[day]}</span>) : <span className="text-[12px] text-muted">Sin horario publicado</span>}</div>
        <dl className="m-0 grid grid-cols-2 gap-2 text-[12px]">
          <div className="rounded-[8px] bg-canvas p-2.5"><dt className="text-muted">Horas semanales</dt><dd className="m-0 text-[15px] font-extrabold text-brand-950">{course.weeklyHours || "—"}</dd></div>
          <div className="rounded-[8px] bg-canvas p-2.5"><dt className="text-muted">Evaluaciones</dt><dd className="m-0 text-[15px] font-extrabold text-brand-950">{published.length}</dd></div>
        </dl>
        <div className="mt-auto flex gap-2"><button type="button" className={`${BUTTON} flex-1`} onClick={() => onNavigate("Materiales")}><FolderOpen className="h-4 w-4" />Materiales</button><button type="button" className={`${BUTTON} flex-1`} onClick={() => onNavigate("Calificaciones")}><FileCheck2 className="h-4 w-4" />Notas</button></div>
      </div>
    </article>;
  })}</div>;
}

function Grades({ courses, evaluations, palette }) {
  const today = limaNow().date;
  const periods = periodsInOrder(evaluations);
  const [period, setPeriod] = useState(() => currentPeriod(evaluations, today));
  const [detail, setDetail] = useState(null);
  if (!evaluations.length) return <Empty icon={FileCheck2} title="Sin evaluaciones publicadas">Aún no hay evaluaciones publicadas para tus cursos.</Empty>;
  const inPeriod = evaluations.filter((row) => row.period === period);
  const columns = columnsOf(inPeriod);
  const cell = (course, column) => inPeriod.find((row) => row.course === course.name && evaluationKind(row.title).short === column.short);
  const graded = inPeriod.filter((row) => row.grade != null);
  const applied = inPeriod.filter((row) => row.date && row.date <= today);
  const average = numericAverage(graded.map((row) => row.grade));
  const next = [...inPeriod].filter((row) => row.date && row.date > today).sort((a, b) => a.date.localeCompare(b.date))[0];
  return <>
    <div className="flex flex-wrap gap-2" aria-label="Periodo">{periods.map((item) => <Pill key={item} active={period === item} onClick={() => { setPeriod(item); setDetail(null); }}>{item}</Pill>)}</div>
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-3">
      <StatCard icon={GraduationCap} label="Promedio del periodo" value={average ?? "—"} tone={average == null ? undefined : gradeClass(average)} />
      <StatCard icon={CircleCheck} label="Notas registradas" value={`${graded.length} de ${applied.length}`} hint="Evaluaciones ya aplicadas" tone="bg-[#e8f7ee] text-[#146c43]" />
      <div className="col-span-2 xl:col-span-1"><StatCard icon={CalendarDays} label={next ? `Próximo: ${next.title} · ${next.course}` : "Próximo examen"} value={next ? weekdayDate(next.date) : "—"} tone="bg-[#eaf2ff] text-[#1d4d9c]" /></div>
    </div>
    <section className={`${CARD} overflow-hidden`}>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[13px]">
          <thead><tr className="bg-canvas">
            <th className="sticky left-0 z-10 min-w-[170px] bg-canvas px-4 py-3 text-left text-[11px] font-extrabold uppercase tracking-[0.05em] text-muted">Curso</th>
            {columns.map((column) => <th key={column.short} className="min-w-[58px] px-1 py-2 text-center"><span className={`inline-block rounded-md border px-2 py-0.5 text-[11px] font-extrabold ${KINDS[column.key].chip}`}>{column.short}</span><small className="mt-0.5 block text-[10px] font-semibold text-muted">{dayMonth(column.date)}</small></th>)}
            <th className="min-w-[72px] px-3 py-3 text-center text-[11px] font-extrabold uppercase tracking-[0.05em] text-muted">Prom.</th>
          </tr></thead>
          <tbody>{courses.map((course) => {
            const tone = palette.get(course.name);
            const grades = inPeriod.filter((row) => row.course === course.name).map((row) => row.grade);
            const courseAverage = numericAverage(grades);
            return <tr key={course.id} className="border-t border-line">
              <th scope="row" className="sticky left-0 z-10 bg-white px-4 py-2.5 text-left"><span className="flex items-center gap-2.5"><CourseBadge name={course.name} tone={tone} size="h-8 w-8 text-[11px]" /><span className="text-[13px] font-bold text-brand-950">{course.name}</span></span></th>
              {columns.map((column) => {
                const item = cell(course, column);
                if (!item) return <td key={column.short} className="px-1 py-2 text-center text-line-strong">·</td>;
                const future = item.date && item.date > today;
                return <td key={column.short} className="px-1 py-2 text-center">
                  <button type="button" onClick={() => setDetail(item)} title={item.title} aria-label={`${course.name}, ${item.title}: ${item.grade ?? (future ? "próximamente" : "sin nota")}`}
                    className={`mx-auto grid h-9 w-11 place-items-center rounded-lg text-[13px] font-extrabold transition hover:ring-2 hover:ring-brand-700/30 ${item.grade != null ? gradeClass(item.grade) : future ? "border border-dashed border-line text-[10px] font-semibold text-line-strong" : "bg-canvas text-muted"}`}>
                    {item.grade ?? (future ? "" : "–")}
                  </button>
                </td>;
              })}
              <td className="px-3 py-2 text-center"><span className={`inline-grid h-9 min-w-[48px] place-items-center rounded-lg px-2 text-[14px] font-black ${courseAverage == null ? "text-muted" : gradeClass(courseAverage)}`}>{courseAverage ?? "—"}</span></td>
            </tr>;
          })}</tbody>
        </table>
      </div>
      <footer className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-line px-4 py-3 text-[12px] text-muted">
        <span className="flex items-center gap-1.5"><i className="h-3 w-3 rounded bg-[#dcf5e6]" />14 a 20</span>
        <span className="flex items-center gap-1.5"><i className="h-3 w-3 rounded bg-[#fff1cc]" />11 a 13</span>
        <span className="flex items-center gap-1.5"><i className="h-3 w-3 rounded bg-[#ffe1e1]" />0 a 10</span>
        <span className="flex items-center gap-1.5"><i className="h-3 w-3 rounded bg-canvas ring-1 ring-line" />Sin nota aún</span>
        <span className="flex items-center gap-1.5"><i className="h-3 w-3 rounded border border-dashed border-line-strong" />Próximamente</span>
      </footer>
    </section>
    {detail ? <div role="dialog" aria-label={`Detalle de ${detail.title}`} className={`${CARD} flex flex-wrap items-center gap-4 p-4`}>
      <span className={`grid h-12 min-w-[56px] place-items-center rounded-lg px-3 text-[18px] font-black ${detail.grade != null ? gradeClass(detail.grade) : "bg-canvas text-muted"}`}>{detail.grade ?? "—"}</span>
      <div className="min-w-0 flex-1"><strong className="block text-[15px] text-brand-950">{detail.title}</strong><small className="text-[13px] text-muted">{detail.course} · {weekdayDate(detail.date)}{detail.grade == null ? (detail.date > today ? " · Próximamente" : " · Tu docente aún no registra la nota") : ""}</small>{detail.note ? <p className="mb-0 mt-1.5 text-[13px] text-[#42524c]">{detail.note}</p> : null}</div>
      <button type="button" className={BUTTON} onClick={() => setDetail(null)}>Cerrar</button>
    </div> : null}
  </>;
}

function Attendance({ attendance }) {
  const count = (status) => attendance.filter((row) => row.status === status).length;
  const rate = attendance.length ? Math.round(((attendance.length - count("ausente")) / attendance.length) * 100) : null;
  const months = attendance.reduce((groups, row) => { const key = row.date.slice(0, 7); (groups[key] ||= []).push(row); return groups; }, {});
  return <>
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      <StatCard icon={CalendarCheck2} label="Asistencia" value={rate == null ? "—" : `${rate}%`} />
      <StatCard icon={CircleCheck} label="Presente" value={count("presente")} tone="bg-[#e8f7ee] text-[#146c43]" />
      <StatCard icon={TimerReset} label="Tardanza" value={count("tardanza")} tone="bg-[#fff6dc] text-[#7a5200]" />
      <StatCard icon={XCircle} label="Ausente" value={count("ausente")} tone="bg-[#ffe9e9] text-[#a1231f]" />
    </div>
    {attendance.length ? Object.entries(months).sort(([a], [b]) => b.localeCompare(a)).map(([month, rows]) => {
      const label = new Date(`${month}-15T12:00:00`).toLocaleDateString("es-PE", { month: "long", year: "numeric" });
      return <Card key={month} title={label.charAt(0).toUpperCase() + label.slice(1)} icon={CalendarDays} bodyClassName="p-0">
        <ul className="m-0 list-none divide-y divide-line p-0">{[...rows].sort((a, b) => b.date.localeCompare(a.date)).map((row) => <li key={row.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-[14px]">
          <time className="font-semibold">{longDate(row.date)}</time>
          <span className={`rounded-full px-3 py-1 text-[12px] font-extrabold ${STATUS_TONE[row.status] || "bg-canvas"}`}>{STATUSES[row.status] || row.status}{row.lateMinutes ? ` · ${row.lateMinutes} min` : ""}</span>
        </li>)}</ul>
      </Card>;
    }) : <Empty icon={CalendarCheck2} title="Sin registros">Aún no hay registros de asistencia para esta matrícula.</Empty>}
  </>;
}

// Vista de una matrícula: la usan el estudiante y su familia (child = nombre del hijo).
export function EnrollmentView({ user, data, section, onNavigate, child = null }) {
  const [enrollmentId, setEnrollmentId] = useState("");
  const now = limaNow();
  const enrollment = data.find((item) => String(item.id) === enrollmentId) || data[0];
  const courses = useMemo(() => [...(enrollment?.courses || [])].sort((a, b) => a.name.localeCompare(b.name, "es")), [enrollment]);
  const palette = useMemo(() => coursePalette(courses.map((course) => course.name)), [courses]);
  const attendance = enrollment?.attendance || [];
  const schedule = courses.flatMap((course) => course.schedule.map((row) => ({ ...row, course: course.name, teachers: course.teachers }))).sort((a, b) => a.day - b.day || a.start.localeCompare(b.start));
  const evaluations = courses.flatMap((course) => course.evaluations.map((row) => ({ ...row, course: course.name }))).sort((a, b) => b.date.localeCompare(a.date));
  const [title, description] = child ? FAMILY_TITLES(child)[section] || [section, ""] : TITLES[section] || [section, ""];
  const picker = data.length > 1 ? <label className="grid gap-1 text-[12px] font-bold text-muted">Matrícula<select className={BUTTON} value={enrollment.id} onChange={(event) => setEnrollmentId(event.target.value)}>{data.map((item) => <option key={item.id} value={item.id}>{item.year} · {item.classroom}</option>)}</select></label> : null;
  return <>
    {section !== "Inicio" ? <PageHeading standard title={title} description={description} action={enrollment ? picker || <ClassroomChip enrollment={enrollment} /> : null} /> : null}
    {section === "Inicio" ? <Home user={user} child={child} enrollment={enrollment} courses={courses} schedule={schedule} evaluations={evaluations} attendance={attendance} palette={palette} onNavigate={onNavigate} now={now} /> : null}
    {section === "Inicio" && picker ? <div className="flex justify-end">{picker}</div> : null}
    {!enrollment ? <Empty icon={GraduationCap} title="Sin matrícula">{child ? `${child} aún no tiene una matrícula disponible. Consulta con la secretaría del colegio.` : "Aún no tienes una matrícula disponible. Consulta con administración para que vinculen tu cuenta a tu grado y sección."}</Empty> : <>
      {section === "Mis cursos" ? <Courses courses={courses} evaluations={evaluations} palette={palette} onNavigate={onNavigate} /> : null}
      {section === "Horario" ? <Card bodyClassName="p-4 md:p-5"><WeeklyTimetable schedule={schedule} palette={palette} /></Card> : null}
      {section === "Calificaciones" ? <Grades key={enrollment.id} courses={courses} evaluations={evaluations} palette={palette} /> : null}
      {section === "Asistencia" ? <Attendance attendance={attendance} /> : null}
    </>}
  </>;
}

export default function StudentPortal({ user, section, onNavigate }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setData(null); setError("");
    loadStudentPortal().then((result) => { if (active) setData(result); }).catch((failure) => { if (active) setError(failure.message); });
    return () => { active = false; };
  }, [user.id, attempt]);
  return <div className="mx-auto max-w-[1240px] space-y-5 pb-10">
    {error ? <div role="alert" className="flex flex-wrap items-center gap-3 rounded-[10px] border border-[#efb0ad] bg-[#fff6f5] p-4 text-[13px] font-semibold text-[#8f2924]">{error}<button className={BUTTON} onClick={() => setAttempt((value) => value + 1)}>Reintentar</button></div>
      : !data ? <p role="status" className="text-[13px] text-muted">Cargando tu información escolar…</p>
      : <EnrollmentView user={user} data={data} section={section} onNavigate={onNavigate} />}
  </div>;
}
