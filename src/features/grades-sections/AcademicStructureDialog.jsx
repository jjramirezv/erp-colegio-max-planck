import { ArrowLeft, ArrowRight, Building2, Check, CircleAlert, GraduationCap, LoaderCircle, Save, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

const INPUT = "min-h-11 w-full rounded-[6px] border border-line-strong bg-white px-3 text-[11px] font-semibold text-ink outline-none transition focus:border-[#237db3] focus:shadow-[0_0_0_3px_rgba(35,125,179,0.12)]";
const LETTERS = ["A", "B", "C"];

function Field({ label, hint, children }) {
  return <label className="grid gap-1.5"><span className="text-[9px] font-extrabold text-[#46554f]">{label}</span>{children}{hint ? <small className="text-[8px] text-muted">{hint}</small> : null}</label>;
}

function createClassroom(index, existing, defaultShiftId = "") {
  return existing || { id: null, name: LETTERS[index], shiftId: defaultShiftId, capacity: 25 };
}

export default function AcademicStructureDialog({ grade, gradeSections, levels, years, shifts, initialLevelId, initialYearId, busy, requestError, onClose, onSave }) {
  const initialYear = gradeSections[0]?.yearId || initialYearId || years.find((year) => year.status === "activo")?.id || "";
  const initialYearShifts = shifts.filter((shift) => String(shift.yearId) === String(initialYear) && shift.active);
  const initialClassrooms = gradeSections.length ? gradeSections.slice(0, 3).map((section) => ({ id: section.id, name: section.name, shiftId: section.shiftId || initialYearShifts.find((shift) => shift.name.toLocaleLowerCase("es") === section.shift.toLocaleLowerCase("es"))?.id || "", capacity: section.capacity || 25 })) : [createClassroom(0, null, initialYearShifts[0]?.id || "")];
  const [step, setStep] = useState(1);
  const [values, setValues] = useState({ id: grade?.id || null, levelId: grade?.levelId || initialLevelId || "", name: grade?.name || "", active: grade?.active ?? true, yearId: initialYear, classrooms: initialClassrooms });
  const [validation, setValidation] = useState("");
  const availableYears = useMemo(() => years.filter((year) => year.status !== "cerrado" || String(year.id) === String(values.yearId)), [years, values.yearId]);
  const availableShifts = useMemo(() => shifts.filter((shift) => String(shift.yearId) === String(values.yearId) && (shift.active || values.classrooms.some((classroom) => String(classroom.shiftId) === String(shift.id)))), [shifts, values.yearId, values.classrooms]);
  const set = (key, value) => { setValues((current) => ({ ...current, [key]: value })); setValidation(""); };

  useEffect(() => {
    function closeOnEscape(event) { if (event.key === "Escape" && !busy) onClose(); }
    document.addEventListener("keydown", closeOnEscape);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", closeOnEscape); document.body.style.overflow = previousOverflow; };
  }, [busy, onClose]);

  function validateGrade() {
    if (!values.levelId) return "Selecciona un nivel educativo.";
    if (!values.name.trim()) return "Escribe el nombre del grado.";
    return "";
  }

  function continueToClassrooms() {
    const error = validateGrade();
    if (error) return setValidation(error);
    setValidation(""); setStep(2);
  }

  function setClassroomCount(count) {
    setValues((current) => ({ ...current, classrooms: Array.from({ length: count }, (_, index) => createClassroom(index, current.classrooms[index], availableShifts[0]?.id || "")) }));
    setValidation("");
  }

  function updateClassroom(index, key, value) {
    setValues((current) => ({ ...current, classrooms: current.classrooms.map((classroom, position) => position === index ? { ...classroom, [key]: value } : classroom) }));
    setValidation("");
  }

  function submit(event) {
    event.preventDefault();
    if (step === 1) return continueToClassrooms();
    if (busy) return;
    const gradeError = validateGrade();
    if (gradeError) { setStep(1); return setValidation(gradeError); }
    if (!values.yearId) return setValidation("Selecciona el año lectivo de los salones.");
    for (const classroom of values.classrooms) {
      if (!classroom.name.trim()) return setValidation("Todos los salones deben tener un nombre.");
      if (!classroom.shiftId) return setValidation("Selecciona un turno para cada salón.");
      const capacity = Number(classroom.capacity);
      if (!Number.isInteger(capacity) || capacity < 1 || capacity > 200) return setValidation("La capacidad de cada salón debe estar entre 1 y 200.");
    }
    onSave({ ...values, levelId: Number(values.levelId), yearId: Number(values.yearId), name: values.name.trim(), classrooms: values.classrooms.map((classroom) => ({ ...classroom, name: classroom.name.trim(), capacity: Number(classroom.capacity) })) });
  }

  return <div className="fixed inset-0 z-[200] grid place-items-center bg-[rgba(2,35,27,0.56)] p-0 backdrop-blur-[2px] sm:p-5" role="dialog" aria-modal="true" aria-labelledby="grade-wizard-title">
    <button type="button" className="absolute inset-0 cursor-default" aria-label="Cerrar formulario" onClick={onClose} />
    <form noValidate onSubmit={submit} className="relative flex h-full w-full flex-col overflow-hidden bg-white shadow-[0_24px_90px_rgba(1,36,27,0.26)] sm:h-auto sm:max-h-[calc(100vh-40px)] sm:max-w-[680px] sm:rounded-[12px]">
      <div className="grid h-1 shrink-0 grid-cols-[1.8fr_1fr_1fr]"><i className="bg-brand-800" /><i className="bg-[#f3bd24]" /><i className="bg-[#237db3]" /></div>
      <header className="shrink-0 border-b border-line px-5 py-4 sm:px-7 sm:py-5"><div className="flex items-start justify-between"><div><h2 id="grade-wizard-title" className="m-0 font-sans text-[22px] font-bold leading-tight text-brand-950">{grade ? "Editar grado y salones" : "Nuevo grado"}</h2><p className="mb-0 mt-1 text-[9px] text-muted">Completa la configuración en dos pasos breves.</p></div><button type="button" className="grid h-9 w-9 place-items-center rounded-full text-brand-900 hover:bg-brand-50" onClick={onClose} aria-label="Cerrar"><X className="h-5 w-5" /></button></div>
        <ol className="mt-4 grid grid-cols-[1fr_44px_1fr] items-center"><li className={`flex items-center gap-2 text-[9px] font-extrabold ${step === 1 ? "text-brand-800" : "text-brand-700"}`}><span className={`grid h-7 w-7 place-items-center rounded-full ${step === 1 ? "bg-brand-700 text-white" : "bg-brand-50 text-brand-700"}`}>{step > 1 ? <Check className="h-3.5 w-3.5" /> : "1"}</span>Datos del grado</li><i className="h-px bg-line-strong" /><li className={`flex items-center justify-end gap-2 text-[9px] font-extrabold ${step === 2 ? "text-[#176d9f]" : "text-muted"}`}><span className={`grid h-7 w-7 place-items-center rounded-full ${step === 2 ? "bg-[#237db3] text-white" : "border border-line-strong bg-white"}`}>2</span>Salones</li></ol>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-7 sm:py-6">
        {step === 1 ? <div className="grid gap-4">
          <section className="rounded-[9px] border border-line-strong p-4 sm:p-5"><div className="mb-4 flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-full bg-brand-50 text-brand-800"><GraduationCap className="h-5 w-5" /></span><div><h3 className="m-0 font-sans text-[15px] font-bold text-brand-950">Información del grado</h3><p className="mb-0 mt-0.5 text-[8px] text-muted">Selecciona el nivel y escribe el grado tal como lo reconoce el colegio.</p></div></div><div className="grid gap-4 sm:grid-cols-2"><Field label="Nivel educativo"><select className={INPUT} value={values.levelId} onChange={(event) => set("levelId", event.target.value)}><option value="">Seleccionar nivel</option>{levels.filter((level) => level.active || String(level.id) === String(values.levelId)).map((level) => <option key={level.id} value={level.id}>{level.name}</option>)}</select></Field><Field label="Nombre del grado" hint="Ejemplos: 3 años, 1.er grado o 2.º de secundaria"><input autoFocus maxLength="40" className={INPUT} value={values.name} onChange={(event) => set("name", event.target.value)} placeholder="Escribe el nombre del grado" /></Field></div></section>
          <section className="flex items-center justify-between rounded-[9px] border border-line-strong p-4 sm:p-5"><div><h3 className="m-0 font-sans text-[14px] font-bold text-brand-950">Estado del grado</h3><p className="mb-0 mt-1 text-[8px] text-muted">Habilítalo para utilizarlo en la gestión académica.</p></div><button type="button" role="switch" aria-checked={values.active} aria-label="Grado habilitado" className={`relative h-7 w-12 rounded-full transition ${values.active ? "bg-brand-700" : "bg-[#b7c3bf]"}`} onClick={() => set("active", !values.active)}><span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition ${values.active ? "left-6" : "left-1"}`} /></button></section>
        </div> : <div className="grid gap-4">
          <section className="rounded-[9px] border border-line-strong p-4 sm:p-5"><div className="mb-4 flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-full bg-[#eff8fd] text-[#237db3]"><Building2 className="h-5 w-5" /></span><div><h3 className="m-0 font-sans text-[15px] font-bold text-brand-950">¿Cuántos salones tendrá este grado?</h3><p className="mb-0 mt-0.5 text-[8px] text-muted">Cada salón corresponde a una sección física: A, B o C.</p></div></div><div className="grid grid-cols-3 gap-2">{[1, 2, 3].map((count) => <button key={count} type="button" aria-pressed={values.classrooms.length === count} className={`min-h-[58px] rounded-[7px] border font-sans text-[21px] font-bold transition ${values.classrooms.length === count ? "border-brand-700 bg-brand-50 text-brand-900 shadow-[0_0_0_2px_rgba(4,120,87,0.08)]" : "border-line-strong bg-white text-muted hover:border-brand-700"}`} onClick={() => setClassroomCount(count)}>{count}</button>)}</div></section>
          <section className="rounded-[9px] border border-line-strong p-4 sm:p-5"><Field label="Año lectivo"><select className={INPUT} value={values.yearId} onChange={(event) => { const yearId = event.target.value; const firstShiftId = shifts.find((shift) => String(shift.yearId) === String(yearId) && shift.active)?.id || ""; setValues((current) => ({ ...current, yearId, classrooms: current.classrooms.map((classroom) => ({ ...classroom, id: null, shiftId: firstShiftId })) })); setValidation(""); }}><option value="">Seleccionar año</option>{availableYears.map((year) => <option key={year.id} value={year.id}>{year.name}</option>)}</select></Field><div className="mb-2 mt-5"><h3 className="m-0 font-sans text-[14px] font-bold text-brand-950">Salones del grado</h3><p className="mb-0 mt-1 text-[8px] text-muted">Ajusta el nombre, turno y capacidad de cada salón.</p></div>{availableShifts.length ? <div className="grid gap-3">{values.classrooms.map((classroom, index) => <div key={classroom.id || LETTERS[index]} className="grid gap-3 rounded-[7px] bg-[#f8faf9] p-3 sm:grid-cols-[38px_1fr_160px_105px] sm:items-end"><span className="grid h-9 w-9 place-items-center rounded-[6px] bg-brand-100 font-sans text-[13px] font-bold text-brand-900">{LETTERS[index]}</span><Field label="Nombre"><input maxLength="20" className={INPUT} value={classroom.name} onChange={(event) => updateClassroom(index, "name", event.target.value)} /></Field><Field label="Turno"><select className={INPUT} value={classroom.shiftId} onChange={(event) => updateClassroom(index, "shiftId", event.target.value)}><option value="">Seleccionar turno</option>{availableShifts.map((shift) => <option key={shift.id} value={shift.id}>{shift.name} · {shift.startTime}–{shift.endTime}</option>)}</select></Field><Field label="Capacidad"><input type="number" min="1" max="200" inputMode="numeric" className={INPUT} value={classroom.capacity} onChange={(event) => updateClassroom(index, "capacity", event.target.value)} /></Field></div>)}</div> : <div className="mt-4 rounded-[7px] border border-[#f0d37a] bg-[#fff9e8] p-4 text-[9px] font-semibold text-[#765800]">Primero configura un turno activo para este año en “Turnos y jornadas”.</div>}</section>
        </div>}
        {validation || requestError ? <div className="mt-4 flex items-start gap-2 rounded-[6px] border border-[#efb0ad] bg-[#fff6f5] p-3 text-[9px] font-semibold text-[#8f2924]" role="alert"><CircleAlert className="h-4 w-4 shrink-0" />{validation || requestError}</div> : null}
      </div>

      <footer className="flex min-h-[70px] shrink-0 items-center justify-between gap-2 border-t border-line bg-[#fbfcfb] px-5 sm:px-7"><button type="button" disabled={busy} className="inline-flex min-h-10 items-center gap-2 rounded-[5px] border border-line-strong bg-white px-4 text-[10px] font-bold text-brand-900 hover:bg-brand-50" onClick={step === 1 ? onClose : () => { setStep(1); setValidation(""); }}>{step === 1 ? "Cancelar" : <><ArrowLeft className="h-4 w-4" />Anterior</>}</button><button type="submit" disabled={busy} className="inline-flex min-h-10 items-center gap-2 rounded-[5px] bg-[#f3bd24] px-5 text-[10px] font-extrabold text-brand-950 hover:bg-[#ffd34f] disabled:opacity-50">{busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : step === 1 ? <ArrowRight className="h-4 w-4" /> : <Save className="h-4 w-4" />}{busy ? "Guardando…" : step === 1 ? "Continuar" : grade ? "Guardar grado y salones" : "Crear grado y salones"}</button></footer>
    </form>
  </div>;
}
