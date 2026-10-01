import { ArrowLeft, ArrowRight, BookOpenCheck, CalendarDays, Check, FileText, X } from "lucide-react";
import { useMemo, useState } from "react";

const INPUT = "min-h-11 w-full rounded-xl border border-[#b8ccc5] bg-white px-3 text-sm font-semibold text-[#20332b] outline-none transition focus:border-[#087a5b] focus:ring-2 focus:ring-[#087a5b]/10";
const TYPES = [
  ["diagnostica", "Diagnóstica"], ["formativa", "Formativa"], ["sumativa", "Sumativa"],
  ["practica", "Práctica"], ["proyecto", "Proyecto"], ["examen", "Examen"],
];

export default function EvaluationEditor({ evaluation, context, courses, periods, busy, onClose, onSave }) {
  const initialCourse = String(evaluation?.courseOfferingId || context.courseId || courses[0]?.id || "");
  const availablePeriods = useMemo(() => periods.filter((item) => String(item.yearId) === String(context.yearId)), [periods, context.yearId]);
  const initialPeriod = String(evaluation?.periodId || context.periodId || availablePeriods[0]?.id || "");
  const initialPeriodData = availablePeriods.find((item) => String(item.id) === initialPeriod);
  const [step, setStep] = useState(1);
  const [values, setValues] = useState({
    id: evaluation?.id || null,
    title: evaluation?.title || "",
    type: evaluation?.type || "formativa",
    description: evaluation?.description || "",
    courseOfferingId: initialCourse,
    periodId: initialPeriod,
    date: evaluation?.date || initialPeriodData?.startsOn || "",
    status: evaluation?.status || "borrador",
    visibleToStudents: evaluation?.visibleToStudents ?? false,
  });
  const [error, setError] = useState("");
  const selectedPeriod = availablePeriods.find((item) => String(item.id) === String(values.periodId));

  function set(field, value) { setValues((current) => ({ ...current, [field]: value })); setError(""); }
  function continueForm() {
    if (!values.title.trim()) return setError("Escribe un nombre claro para la evaluación.");
    if (values.title.trim().length > 120) return setError("El nombre no puede superar 120 caracteres.");
    setStep(2);
  }
  async function submit() {
    if (!values.courseOfferingId || !values.periodId || !values.date) return setError("Completa el curso, periodo y fecha de aplicación.");
    if (selectedPeriod && (values.date < selectedPeriod.startsOn || values.date > selectedPeriod.endsOn)) return setError("La fecha debe encontrarse dentro del periodo seleccionado.");
    await onSave({ ...values, title: values.title.trim(), description: values.description.trim() });
  }

  return (
    <div className="fixed inset-0 z-[80] grid place-items-center bg-[#082c24]/65 p-3 backdrop-blur-[2px] sm:p-6" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onClose(); }}>
      <form
        className="flex max-h-[92vh] w-full max-w-[820px] flex-col overflow-hidden rounded-2xl border border-[#b8ccc5] bg-white shadow-[0_28px_90px_rgba(4,39,30,.3)]"
        onSubmit={(event) => event.preventDefault()}
        onKeyDown={(event) => {
          if (event.key === "Enter" && event.target.tagName !== "TEXTAREA") {
            event.preventDefault();
            if (step === 1) continueForm();
          }
        }}
      >
        <header className="flex items-start justify-between gap-5 border-b border-[#dce7e2] px-5 py-5 sm:px-7">
          <div><h2 className="m-0 text-2xl font-extrabold tracking-[-.035em] text-[#14231e]">{evaluation ? "Editar evaluación" : "Nueva evaluación"}</h2><p className="mb-0 mt-1 text-sm text-[#6d7b75]">Completa una etapa a la vez.</p></div>
          <button type="button" className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-[#b8ccc5] text-[#263a32] hover:bg-[#f2f8f5]" onClick={onClose} aria-label="Cerrar"><X size={20}/></button>
        </header>

        <div className="grid grid-cols-[1fr_auto_1fr] items-center border-b border-[#dce7e2] px-5 py-4 sm:px-10">
          <div className={`flex items-center gap-3 ${step === 1 ? "text-[#087a5b]" : "text-[#52635c]"}`}><span className={`grid h-10 w-10 place-items-center rounded-full border-2 ${step === 1 ? "border-[#087a5b] bg-[#edf8f3]" : "border-[#087a5b] bg-[#087a5b] text-white"}`}>{step === 1 ? <FileText size={18}/> : <Check size={18}/>}</span><span className="hidden text-sm font-extrabold sm:block">Información</span></div>
          <span className="h-px w-14 bg-[#cbdad5] sm:w-32"/>
          <div className={`flex items-center justify-end gap-3 ${step === 2 ? "text-[#087a5b]" : "text-[#84918c]"}`}><span className={`grid h-10 w-10 place-items-center rounded-full border-2 ${step === 2 ? "border-[#087a5b] bg-[#edf8f3]" : "border-[#cbdad5]"}`}><CalendarDays size={18}/></span><span className="hidden text-sm font-extrabold sm:block">Programación</span></div>
        </div>

        <div className="overflow-y-auto px-5 py-6 sm:px-8 sm:py-7">
          {error ? <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-800">{error}</div> : null}
          {step === 1 ? (
            <section className="grid gap-5">
              <div><h3 className="m-0 text-lg font-extrabold text-[#1b3027]">Identifica la evaluación</h3><p className="mb-0 mt-1 text-sm text-[#718079]">Usa un nombre que docentes y estudiantes reconozcan fácilmente.</p></div>
              <label className="grid gap-2"><span className="text-xs font-extrabold text-[#40524a]">Nombre de la evaluación</span><input className={INPUT} maxLength={120} placeholder="Ej. Comprensión lectora · Unidad 1" value={values.title} onChange={(event) => set("title", event.target.value)}/></label>
              <label className="grid gap-2"><span className="text-xs font-extrabold text-[#40524a]">Tipo</span><select className={INPUT} value={values.type} onChange={(event) => set("type", event.target.value)}>{TYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
              <label className="grid gap-2"><span className="text-xs font-extrabold text-[#40524a]">Descripción <small className="font-semibold text-[#7b8983]">(opcional)</small></span><textarea className={`${INPUT} min-h-28 resize-y py-3`} maxLength={500} placeholder="Indica brevemente qué se evaluará." value={values.description} onChange={(event) => set("description", event.target.value)}/></label>
            </section>
          ) : (
            <section className="grid gap-5">
              <div><h3 className="m-0 text-lg font-extrabold text-[#1b3027]">Programa la aplicación</h3><p className="mb-0 mt-1 text-sm text-[#718079]">Relaciona la evaluación con un curso y periodo del año lectivo.</p></div>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="grid gap-2 sm:col-span-2"><span className="text-xs font-extrabold text-[#40524a]">Curso</span><select className={INPUT} value={values.courseOfferingId} onChange={(event) => set("courseOfferingId", event.target.value)}>{courses.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
                <label className="grid gap-2"><span className="text-xs font-extrabold text-[#40524a]">Periodo académico</span><select className={INPUT} value={values.periodId} onChange={(event) => { const period = availablePeriods.find((item) => String(item.id) === event.target.value); setValues((current) => ({ ...current, periodId: event.target.value, date: period?.startsOn || current.date })); setError(""); }}>{availablePeriods.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
                <label className="grid gap-2"><span className="text-xs font-extrabold text-[#40524a]">Fecha de aplicación</span><input type="date" className={INPUT} min={selectedPeriod?.startsOn} max={selectedPeriod?.endsOn} value={values.date} onChange={(event) => set("date", event.target.value)}/></label>
                <label className="grid gap-2"><span className="text-xs font-extrabold text-[#40524a]">Estado</span><select className={INPUT} value={values.status} onChange={(event) => { const nextStatus = event.target.value; setValues((current) => ({ ...current, status: nextStatus, visibleToStudents: nextStatus === "borrador" ? false : current.visibleToStudents })); setError(""); }}><option value="borrador">Borrador</option><option value="programada">Programada</option><option value="en_curso">En curso</option><option value="cerrada">Cerrada</option></select></label>
                <label className={`flex min-h-11 items-center gap-3 rounded-xl border border-[#b8ccc5] px-4 text-sm font-bold ${values.status === "borrador" ? "bg-[#f4f7f6] text-[#8a9691]" : "text-[#40524a]"}`}><input type="checkbox" disabled={values.status === "borrador"} className="h-4 w-4 accent-[#087a5b]" checked={values.visibleToStudents} onChange={(event) => set("visibleToStudents", event.target.checked)}/><BookOpenCheck size={17} className="text-[#2488b8]"/>Visible para estudiantes</label>
              </div>
            </section>
          )}
        </div>

        <footer className="flex items-center justify-between gap-3 border-t border-[#dce7e2] px-5 py-4 sm:px-7">
          {step === 1 ? <button type="button" className="min-h-11 px-3 text-sm font-extrabold text-[#62726b]" onClick={onClose}>Cancelar</button> : <button type="button" className="inline-flex min-h-11 items-center gap-2 px-2 text-sm font-extrabold text-[#52635c]" onClick={() => { setStep(1); setError(""); }}><ArrowLeft size={17}/>Atrás</button>}
          {step === 1 ? <button type="button" className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#087a5b] px-6 text-sm font-extrabold text-white hover:bg-[#07684e]" onClick={continueForm}>Continuar<ArrowRight size={17}/></button> : <button type="button" disabled={busy} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#f5c127] px-6 text-sm font-extrabold text-[#183128] hover:bg-[#ffd451] disabled:opacity-50" onClick={submit}><Check size={17}/>{busy ? "Guardando…" : "Guardar evaluación"}</button>}
        </footer>
      </form>
    </div>
  );
}
