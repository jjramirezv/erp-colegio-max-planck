import { useEffect, useMemo, useState } from "react";
import { Lock, Save } from "lucide-react";
import usePendingEdits from "./usePendingEdits";
import { loadGradesFor, saveGrades } from "./teacherApi";
import { CourseSelect, Empty, Feedback, Loading, panelClass, primaryClass } from "./TeacherUI";
import { KINDS, currentPeriod, dayMonth, evaluationKind, gradeClass, limaToday, numericAverage, periodsInOrder } from "../evaluation-plan/planUtils";

const GRADABLE = ["programada", "en_curso"];
const key = (evaluationId, enrollmentId) => `${evaluationId}:${enrollmentId}`;

function validGrade(value, scale) {
  if (value === "") return true;
  if (scale.type !== "numerica") return scale.levels.some((level) => level.code === value);
  if (!/^\d+([.,]\d+)?$/.test(value)) return false;
  const number = Number(value.replace(",", "."));
  const decimals = (value.split(/[.,]/)[1] || "").length;
  return number >= scale.min && number <= scale.max && decimals <= scale.decimals;
}

// Planilla del periodo: estudiantes en filas y evaluaciones en columnas; se guarda todo con un botón.
export default function TeacherGradebook({ courses }) {
  const today = limaToday();
  const [courseId, setCourseId] = useState(String(courses[0].id));
  const course = courses.find((item) => String(item.id) === courseId) || courses[0];
  const periods = useMemo(() => periodsInOrder(course.evaluations), [course]);
  const [period, setPeriod] = useState(() => currentPeriod(courses[0].evaluations, today));
  const [showUpcoming, setShowUpcoming] = useState(false);
  const [saved, setSaved] = useState({});
  const [edits, setEdits] = useState({});
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [retry, setRetry] = useState(0);
  const scale = course.scale;

  const inPeriod = useMemo(() => course.evaluations.filter((item) => item.period === period).sort((a, b) => (a.date || "").localeCompare(b.date || "") || evaluationKind(a.title).order - evaluationKind(b.title).order), [course, period]);
  const nextUpcoming = inPeriod.find((item) => item.date && item.date > today);
  const columns = showUpcoming ? inPeriod : inPeriod.filter((item) => !item.date || item.date <= today || item === nextUpcoming);
  const hiddenCount = inPeriod.length - columns.length;
  const dirtyKeys = Object.keys(edits).filter((cell) => edits[cell] !== (saved[cell]?.value ?? ""));
  const invalidKeys = dirtyKeys.filter((cell) => !validGrade(edits[cell].trim(), scale || { type: "numerica" }));
  const dirty = dirtyKeys.length > 0;
  usePendingEdits(dirty, busy);

  useEffect(() => {
    let active = true;
    setSaved({}); setEdits({}); setError(""); setMessage(""); setLoadError("");
    if (!inPeriod.length) return undefined;
    setLoading(true);
    loadGradesFor(inPeriod.map((item) => item.id)).then((records) => {
      if (active) setSaved(Object.fromEntries(records.map((row) => [key(row.evaluacion_id, row.matricula_id), { value: row.valor, note: row.observacion || "" }])));
    }).catch((failure) => { if (active) setLoadError(failure.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [inPeriod, retry]);

  function canDiscard() { return !dirty || window.confirm("Hay notas sin guardar. ¿Deseas descartarlas?"); }
  const value = (evaluation, student) => edits[key(evaluation.id, student.id)] ?? saved[key(evaluation.id, student.id)]?.value ?? "";
  function change(evaluation, student, next) { setEdits((current) => ({ ...current, [key(evaluation.id, student.id)]: next })); setMessage(""); }
  function move(event, row, column) {
    const target = { ArrowDown: [row + 1, column], Enter: [row + 1, column], ArrowUp: [row - 1, column] }[event.key];
    if (!target) return;
    event.preventDefault();
    document.querySelector(`[data-cell="${target[0]}-${target[1]}"]`)?.focus();
  }

  async function save() {
    setError(""); setMessage("");
    if (invalidKeys.length) { setError(scale.type === "numerica" ? `Revisa las celdas en rojo: la nota debe estar entre ${scale.min} y ${scale.max}${scale.decimals ? ` con hasta ${scale.decimals} decimales` : " sin decimales"}.` : "Revisa las celdas en rojo."); return; }
    if (dirtyKeys.some((cell) => saved[cell]?.value && !edits[cell].trim())) { setError("No se puede borrar una nota guardada. Escribe el valor corregido."); return; }
    setBusy(true);
    const byEvaluation = new Map();
    for (const cell of dirtyKeys) {
      if (!edits[cell].trim()) continue;
      const [evaluationId, enrollmentId] = cell.split(":").map(Number);
      if (!byEvaluation.has(evaluationId)) byEvaluation.set(evaluationId, []);
      byEvaluation.get(evaluationId).push({ enrollmentId, value: edits[cell].trim().replace(",", "."), note: saved[cell]?.note || "" });
    }
    let count = 0;
    try {
      for (const [evaluationId, records] of byEvaluation) {
        await saveGrades(evaluationId, records);
        count += records.length;
        setSaved((current) => ({ ...current, ...Object.fromEntries(records.map((row) => [key(evaluationId, row.enrollmentId), { value: row.value, note: row.note }])) }));
        setEdits((current) => { const next = { ...current }; records.forEach((row) => delete next[key(evaluationId, row.enrollmentId)]); return next; });
      }
      setMessage(`Calificaciones guardadas: ${count} ${count === 1 ? "nota" : "notas"}.`);
    } catch (failure) { setError(`${failure.message}${count ? ` Se guardaron ${count} notas antes del error.` : ""}`); }
    finally { setBusy(false); }
  }

  const locked = (evaluation) => busy || course.yearState === "cerrado" || !GRADABLE.includes(evaluation.state);
  const cellInput = (evaluation, student, row, column) => {
    const cell = key(evaluation.id, student.id); const current = value(evaluation, student);
    const changed = dirtyKeys.includes(cell); const invalid = invalidKeys.includes(cell);
    const common = { "aria-label": `Calificación de ${student.name} en ${evaluation.title}`, "data-cell": `${row}-${column}`, disabled: locked(evaluation), onKeyDown: (event) => move(event, row, column), onFocus: (event) => event.target.select?.() };
    const tone = invalid ? "bg-red-soft text-red ring-2 ring-red" : changed ? "bg-[#fff8e1] ring-2 ring-[#f3bd24]" : current ? gradeClass(current) : "bg-white";
    const className = `h-9 w-14 rounded-md border border-line text-center text-[13px] font-extrabold outline-none focus:ring-2 focus:ring-brand-800 disabled:cursor-not-allowed disabled:opacity-60 ${tone}`;
    return scale.type === "numerica"
      ? <input {...common} inputMode="decimal" className={className} value={current} onChange={(event) => change(evaluation, student, event.target.value)} />
      : <select {...common} className={`${className} w-16 px-0`} value={current} onChange={(event) => change(evaluation, student, event.target.value)}><option value="">·</option>{scale.levels.map((level) => <option key={level.code} value={level.code}>{level.code}</option>)}</select>;
  };

  return <>
    <Feedback error={loadError || error} message={message} onRetry={loadError ? () => setRetry((current) => current + 1) : undefined} />
    <section className={panelClass}>
      <header className="grid gap-4 border-b border-line bg-canvas p-5 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
        <CourseSelect courses={courses} value={courseId} disabled={busy} onChange={(next) => { if (canDiscard()) { const nextCourse = courses.find((item) => String(item.id) === next); setCourseId(next); setPeriod(currentPeriod(nextCourse?.evaluations || [], today)); } }} />
        <div className="flex flex-wrap gap-2" role="group" aria-label="Periodo">{periods.map((item) => <button key={item} type="button" aria-pressed={period === item} disabled={busy} onClick={() => { if (item !== period && canDiscard()) setPeriod(item); }} className={`min-h-10 rounded-full border px-4 text-xs font-extrabold ${period === item ? "border-brand-900 bg-brand-900 text-white" : "border-line-strong bg-white text-[#42524c] hover:border-brand-800"}`}>{item}</button>)}</div>
      </header>
      {!course.evaluations.length ? <Empty title="Aún no hay evaluaciones">Coordinación Académica debe generar el plan de evaluaciones de este curso.</Empty>
        : !scale ? <Empty title="Falta configurar la escala de notas">Dirección debe definir la escala de este nivel y año lectivo antes de registrar notas.</Empty>
        : !course.students.length ? <Empty title="No hay estudiantes matriculados">Cuando Coordinación matricule estudiantes en esta sección, aparecerán aquí.</Empty>
        : loading ? <Loading /> : loadError ? null : <>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-line px-5 py-3 text-xs text-muted">
            <span>Escala {scale.type === "numerica" ? `${scale.min} a ${scale.max}` : scale.levels.map((level) => level.code).join(" · ")}. Escribe la nota y pulsa <kbd className="rounded border border-line bg-canvas px-1">Enter</kbd> para bajar al siguiente estudiante.</span>
            {hiddenCount || showUpcoming ? <label className="ml-auto flex items-center gap-2 font-bold text-brand-900"><input type="checkbox" className="accent-[#047857]" checked={showUpcoming} onChange={(event) => setShowUpcoming(event.target.checked)} />Mostrar próximas ({inPeriod.filter((item) => item.date > today).length})</label> : null}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[13px]">
              <thead><tr className="bg-canvas">
                <th className="sticky left-0 z-10 min-w-[210px] bg-canvas px-4 py-3 text-left text-[11px] font-extrabold uppercase tracking-[0.05em] text-muted">Estudiante</th>
                {columns.map((evaluation) => { const kind = evaluationKind(evaluation.title); const future = evaluation.date && evaluation.date > today; return <th key={evaluation.id} title={evaluation.title} className={`min-w-[66px] px-1 py-2 text-center ${future ? "opacity-60" : ""}`}>
                  <span className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-extrabold ${KINDS[kind.key].chip}`}>{GRADABLE.includes(evaluation.state) ? null : <Lock size={10} />}{kind.short}</span>
                  <small className="mt-0.5 block text-[10px] font-semibold text-muted">{evaluation.date ? dayMonth(evaluation.date) : "Sin fecha"}</small>
                </th>; })}
                <th className="min-w-[70px] px-3 py-3 text-center text-[11px] font-extrabold uppercase tracking-[0.05em] text-muted">Prom.</th>
              </tr></thead>
              <tbody>{course.students.map((student, row) => {
                const average = scale.type === "numerica" ? numericAverage(inPeriod.map((evaluation) => saved[key(evaluation.id, student.id)]?.value)) : null;
                return <tr key={student.id} className="border-t border-line hover:bg-brand-50/40">
                  <th scope="row" className="sticky left-0 z-10 bg-white px-4 py-2 text-left font-bold text-brand-950"><span className="mr-2 inline-block w-5 text-right text-xs font-normal text-muted">{row + 1}</span>{student.name}</th>
                  {columns.map((evaluation, column) => <td key={evaluation.id} className="px-1 py-1.5 text-center">{cellInput(evaluation, student, row, column)}</td>)}
                  <td className="px-3 py-1.5 text-center"><span className={`inline-grid h-9 min-w-[46px] place-items-center rounded-md px-2 font-black ${average == null ? "text-muted" : gradeClass(average)}`}>{average ?? "—"}</span></td>
                </tr>;
              })}</tbody>
            </table>
          </div>
          <footer className="sticky bottom-0 flex flex-wrap items-center justify-between gap-4 border-t border-line bg-canvas p-4">
            <span className="text-xs text-muted">{dirty ? <strong className="text-[#8a6100]">{dirtyKeys.length} {dirtyKeys.length === 1 ? "nota sin guardar" : "notas sin guardar"}</strong> : "Todo guardado."} Las celdas con candado son de solo consulta.</span>
            <button type="button" className={primaryClass} disabled={busy || !dirty} onClick={save}><Save size={16} />{busy ? "Guardando…" : `Guardar calificaciones${dirty ? ` (${dirtyKeys.length})` : ""}`}</button>
          </footer>
        </>}
    </section>
  </>;
}
