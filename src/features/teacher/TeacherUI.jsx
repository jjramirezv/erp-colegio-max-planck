import { BookOpen, LoaderCircle, RefreshCw } from "lucide-react";

export const panelClass = "overflow-hidden rounded-[9px] border border-line-strong bg-white shadow-[0_12px_35px_rgba(7,54,42,0.05)]";
export const inputClass = "min-h-10 w-full rounded-md border border-line-strong bg-white px-3 text-xs text-ink outline-none focus:border-brand-800 focus:ring-2 focus:ring-brand-100 disabled:bg-canvas disabled:text-muted";
export const primaryClass = "inline-flex min-h-[42px] items-center justify-center gap-2 rounded-[5px] bg-[#f3bd24] px-5 text-xs font-extrabold text-brand-950 hover:bg-[#ffd34f] disabled:cursor-not-allowed disabled:opacity-50";
export const secondaryClass = "inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-line-strong bg-white px-4 text-xs font-bold text-brand-900 hover:bg-brand-50 disabled:opacity-50";

export function Feedback({ error, message, onRetry }) {
  if (!error && !message) return null;
  return <div role={error ? "alert" : "status"} className={`mb-4 flex items-center gap-3 rounded-md border px-4 py-3 text-xs ${error ? "border-red/30 bg-red-soft text-red" : "border-brand-800/25 bg-brand-50 text-brand-900"}`}>
    <span className="flex-1">{error || message}</span>
    {error && onRetry ? <button className="flex items-center gap-2 font-bold" onClick={onRetry}><RefreshCw size={14} />Reintentar</button> : null}
  </div>;
}

export function Loading() {
  return <div role="status" className="grid min-h-[250px] place-content-center justify-items-center gap-3 text-sm text-muted"><LoaderCircle className="animate-spin text-brand-800" />Cargando información…</div>;
}

export function Empty({ title, children }) {
  return <div className="grid min-h-[250px] place-content-center justify-items-center gap-3 px-6 text-center">
    <span className="grid h-12 w-12 place-items-center rounded-full bg-brand-50 text-brand-800"><BookOpen size={22} /></span>
    <h2 className="m-0 text-lg font-extrabold text-brand-950">{title}</h2>
    <p className="m-0 max-w-lg text-sm leading-6 text-muted">{children}</p>
  </div>;
}

export function CourseSelect({ courses, value, onChange, disabled }) {
  return <label className="grid gap-2 text-xs font-bold text-muted">Curso y sección
    <select className={inputClass} value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)}>
      {courses.map((course) => <option key={course.id} value={course.id}>{course.name} · {course.classroom} · {course.year}</option>)}
    </select>
  </label>;
}
