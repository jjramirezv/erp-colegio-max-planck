import { useEffect, useState } from "react";
import { CheckCheck, MessageSquarePlus, Save } from "lucide-react";
import usePendingEdits from "./usePendingEdits";
import { loadAttendance, saveAttendance, schoolDate } from "./teacherApi";
import { CourseSelect, Empty, Feedback, inputClass, Loading, panelClass, primaryClass, secondaryClass } from "./TeacherUI";

const OPTIONS = [
  ["presente", "Presente", "border-[#6cc596] bg-[#dcf5e6] text-[#146c43]"],
  ["tardanza", "Tardanza", "border-[#f0c24b] bg-[#fff1cc] text-[#7a5200]"],
  ["ausente", "Falta", "border-[#f0a0a0] bg-[#ffe1e1] text-[#a1231f]"],
];

export default function AttendanceRegister({ courses }) {
  const [courseId, setCourseId] = useState(String(courses[0].id));
  const [date, setDate] = useState(schoolDate);
  const [rows, setRows] = useState({});
  const [notesOpen, setNotesOpen] = useState({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [dirty, setDirty] = useState(false);
  const [retry, setRetry] = useState(0);
  const course = courses.find((item) => String(item.id) === courseId) || courses[0];
  const locked = busy || loading || !!loadError || course.yearState === "cerrado";
  useEffect(() => {
    let active = true;
    setLoading(true); setLoadError(""); setError(""); setMessage(""); setRows({}); setNotesOpen({}); setDirty(false);
    loadAttendance(date, course.students).then((records) => {
      if (active) setRows(Object.fromEntries(records.map((row) => [row.matricula_id, { status: row.estado, lateMinutes: row.minutos_tardanza ?? "", note: row.observacion || "" }])));
    }).catch((requestError) => { if (active) setLoadError(requestError.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [course, date, retry]);
  usePendingEdits(dirty, busy);
  function changeSelection(setter, value) {
    if (!dirty || window.confirm("Hay cambios sin guardar. ¿Deseas descartarlos?")) setter(value);
  }
  function update(id, patch) {
    setRows((current) => ({ ...current, [id]: { ...current[id], ...patch } }));
    setDirty(true); setMessage(""); setError("");
  }
  async function save(event) {
    event.preventDefault(); setBusy(true); setError(""); setMessage("");
    try {
      const records = course.students.map((student) => ({ enrollmentId: student.id, ...rows[student.id] }));
      if (records.some((row) => !row.status)) throw new Error("Marca la asistencia de cada estudiante antes de guardar.");
      if (records.some((row) => row.status === "tardanza" && !row.lateMinutes)) throw new Error("Indica los minutos de cada tardanza.");
      await saveAttendance(course.sectionId, date, records);
      setDirty(false); setMessage("Asistencia guardada en el registro institucional.");
    } catch (requestError) { setError(requestError.message); }
    finally { setBusy(false); }
  }
  const counts = Object.fromEntries(OPTIONS.map(([value]) => [value, course.students.filter((student) => rows[student.id]?.status === value).length]));
  const pending = course.students.length - counts.presente - counts.tardanza - counts.ausente;

  return <>
    <Feedback error={loadError || error} message={message} onRetry={loadError ? () => setRetry((value) => value + 1) : undefined} />
    <form className={panelClass} onSubmit={save} aria-busy={loading || busy}>
      <header className="grid items-end gap-4 border-b border-line bg-canvas p-5 md:grid-cols-[1fr_200px]">
        <CourseSelect courses={courses} value={courseId} disabled={busy} onChange={(value) => changeSelection(setCourseId, value)} />
        <label className="grid gap-2 text-xs font-bold text-muted">Fecha<input className={inputClass} type="date" required max={schoolDate()} value={date} disabled={busy} onChange={(event) => { if (event.target.value) changeSelection(setDate, event.target.value); }} /></label>
      </header>
      {loading ? <Loading /> : loadError ? null : !course.students.length ? <Empty title="No hay estudiantes matriculados">Las matrículas activas de esta sección aparecerán aquí.</Empty> : <>
        <div className="flex flex-wrap items-center gap-2 border-b border-line px-5 py-3">
          {OPTIONS.map(([value, label, tone]) => <span key={value} className={`rounded-full border px-3 py-1 text-xs font-extrabold ${tone}`}>{label}: {counts[value]}</span>)}
          <span className="rounded-full border border-line bg-white px-3 py-1 text-xs font-extrabold text-muted">Sin marcar: {pending}</span>
          <button type="button" className={`${secondaryClass} ml-auto`} disabled={locked} onClick={() => { setRows(Object.fromEntries(course.students.map((student) => [student.id, { status: "presente", lateMinutes: "", note: rows[student.id]?.note || "" }]))); setDirty(true); setMessage(""); }}><CheckCheck size={16} />Marcar todos presentes</button>
        </div>
        {course.students.map((student, index) => {
          const row = rows[student.id] || {};
          return <div key={student.id} className="grid items-center gap-3 border-b border-line px-5 py-3 md:grid-cols-[1fr_auto]">
            <strong className="text-sm text-brand-950"><span className="mr-3 inline-block w-5 text-right text-xs font-normal text-muted">{index + 1}</span>{student.name}</strong>
            <div className="flex flex-wrap items-center gap-2">
              <div role="radiogroup" aria-label={"Asistencia de " + student.name} className="flex gap-1.5">
                {OPTIONS.map(([value, label, tone]) => <button key={value} type="button" role="radio" aria-checked={row.status === value} disabled={locked} onClick={() => update(student.id, { status: value, lateMinutes: value === "tardanza" ? row.lateMinutes || "" : "" })}
                  className={`min-h-10 min-w-[70px] rounded-lg border px-2.5 sm:min-w-[84px] sm:px-3 text-xs font-extrabold transition disabled:cursor-not-allowed disabled:opacity-50 ${row.status === value ? tone : "border-line-strong bg-white text-[#52615c] hover:border-brand-800"}`}>{label}</button>)}
              </div>
              {row.status === "tardanza" ? <input aria-label={"Minutos de tardanza de " + student.name} className={`${inputClass} !w-24`} type="number" min="1" max="240" placeholder="Minutos" required disabled={locked} value={row.lateMinutes ?? ""} onChange={(event) => update(student.id, { lateMinutes: event.target.value })} /> : null}
              <button type="button" aria-label={"Observación de " + student.name} aria-expanded={Boolean(notesOpen[student.id] || row.note)} disabled={locked} onClick={() => setNotesOpen((current) => ({ ...current, [student.id]: !current[student.id] }))} className={`grid h-10 w-10 place-items-center rounded-lg border ${row.note ? "border-brand-800 bg-brand-50 text-brand-900" : "border-line-strong text-muted"}`}><MessageSquarePlus size={16} /></button>
            </div>
            {notesOpen[student.id] || row.note ? <input aria-label={"Texto de observación de " + student.name} className={`${inputClass} md:col-span-2`} maxLength={240} placeholder="Observación (opcional)" disabled={locked} value={row.note || ""} onChange={(event) => update(student.id, { note: event.target.value })} /> : null}
          </div>;
        })}
        <footer className="flex flex-wrap items-center justify-between gap-4 bg-canvas p-5"><span className="text-xs text-muted">{course.yearState === "cerrado" ? "Año lectivo cerrado: solo consulta." : dirty ? <strong className="text-[#8a6100]">Tienes cambios sin guardar.</strong> : "La asistencia se comparte con Coordinación Académica."}</span><button type="submit" className={primaryClass} disabled={locked || !dirty}><Save size={16} />{busy ? "Guardando…" : "Guardar asistencia"}</button></footer>
      </>}
    </form>
  </>;
}
