import { Building2, Check, CircleAlert, Clock3, Save, UsersRound, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

const CONTROL = "min-h-11 w-full rounded-xl border border-[#b7cbc4] bg-white px-3.5 text-sm font-semibold text-[#172720] outline-none transition focus:border-[#087a5b] focus:ring-4 focus:ring-[#087a5b]/10";
const LETTERS = ["A", "B", "C"];

function ClassroomFields({ classroom, index, shifts, onChange }) {
  const shift = shifts.find((item) => String(item.id) === String(classroom.shiftId));
  return <section className="rounded-xl border border-[#cbdad5] bg-white p-4 shadow-[0_5px_18px_rgba(17,45,36,0.035)]">
    <div className="mb-4 flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-full bg-[#eaf5fb] text-sm font-extrabold text-[#177dae]">{index + 1}</span><div><h3 className="font-extrabold text-[#1c2d26]">Sección {classroom.name || LETTERS[index]}</h3><p className="mt-0.5 text-xs text-[#718079]">Configura el turno y la capacidad.</p></div></div>
    <div className="grid gap-4 sm:grid-cols-2"><label className="text-xs font-extrabold text-[#41534b] sm:col-span-2">Nombre<input maxLength="20" className={`${CONTROL} mt-2`} value={classroom.name} onChange={(event) => onChange(index, "name", event.target.value)} placeholder={`Sección ${LETTERS[index]}`} /></label><label className="text-xs font-extrabold text-[#41534b]">Turno<select className={`${CONTROL} mt-2`} value={classroom.shiftId} onChange={(event) => onChange(index, "shiftId", event.target.value)}><option value="">Seleccionar turno</option>{shifts.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label className="text-xs font-extrabold text-[#41534b]">Capacidad<input type="number" min="1" max="200" inputMode="numeric" className={`${CONTROL} mt-2`} value={classroom.capacity} onChange={(event) => onChange(index, "capacity", event.target.value)} /></label></div>
    {shift ? <div className="mt-4 flex items-center gap-2 rounded-lg bg-[#eef7fc] px-3 py-2.5 text-xs font-semibold text-[#276b8b]"><Clock3 size={15} />Horario asignado: {shift.startTime} – {shift.endTime}</div> : null}
  </section>;
}

export default function AcademicClassroomsEditor({ grade, year, sections, shifts, busy, onClose, onSave }) {
  const availableShifts = useMemo(() => shifts.filter((item) => String(item.yearId) === String(year.id) && item.active), [shifts, year.id]);
  const initialRows = sections.length ? sections.slice(0, 3).map((item) => ({ id: item.id, name: item.name, shiftId: item.shiftId || "", capacity: item.capacity || 25 })) : [{ id: null, name: "A", shiftId: availableShifts[0]?.id || "", capacity: 25 }];
  const [classrooms, setClassrooms] = useState(initialRows);
  const [validation, setValidation] = useState("");

  useEffect(() => {
    const close = (event) => { if (event.key === "Escape" && !busy) onClose(); };
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", close);
    return () => { document.body.style.overflow = overflow; document.removeEventListener("keydown", close); };
  }, [busy, onClose]);

  function setCount(count) {
    setClassrooms((current) => Array.from({ length: count }, (_, index) => current[index] || { id: null, name: LETTERS[index], shiftId: availableShifts[0]?.id || "", capacity: 25 }));
    setValidation("");
  }
  function change(index, key, value) {
    setClassrooms((current) => current.map((item, position) => position === index ? { ...item, [key]: value } : item));
    setValidation("");
  }
  function submit(event) {
    event.preventDefault();
    if (!availableShifts.length) return setValidation("Primero configura un turno activo para este año lectivo.");
    const normalizedNames = classrooms.map((item) => item.name.trim().toLocaleLowerCase("es"));
    if (normalizedNames.some((name) => !name)) return setValidation("Todos los salones deben tener un nombre.");
    if (new Set(normalizedNames).size !== normalizedNames.length) return setValidation("Los salones deben tener nombres diferentes.");
    for (const classroom of classrooms) {
      const capacity = Number(classroom.capacity);
      if (!classroom.shiftId) return setValidation("Selecciona un turno para cada salón.");
      if (!Number.isInteger(capacity) || capacity < 1 || capacity > 200) return setValidation("La capacidad debe estar entre 1 y 200 estudiantes.");
    }
    onSave({ gradeId: grade.id, yearId: year.id, classrooms: classrooms.map((item) => ({ ...item, name: item.name.trim(), capacity: Number(item.capacity) })) });
  }

  return <aside className="fixed inset-y-0 right-0 z-50 flex w-full max-w-[480px] flex-col border-l border-[#b8cbc4] bg-[#f8fbfa] shadow-[-24px_0_64px_rgba(10,43,33,0.18)] max-sm:inset-x-0 max-sm:max-w-none 2xl:static 2xl:z-auto 2xl:max-h-[850px] 2xl:rounded-2xl 2xl:border">
    <form className="flex min-h-0 flex-1 flex-col" onSubmit={submit}><header className="relative flex items-start justify-between border-b border-[#d6e1dd] bg-white px-6 py-6"><div><h2 className="text-2xl font-extrabold tracking-[-0.035em] text-[#14231e]">Salones de {grade.name}</h2><p className="mt-1.5 max-w-sm text-sm leading-5 text-[#6a7973]">Define cuántos salones funcionarán y configura cada uno.</p></div><button type="button" onClick={onClose} className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-[#b7cdc5] hover:bg-[#eef8f4]" aria-label="Cerrar"><X size={21} /></button><div className="absolute inset-x-0 bottom-0 h-1 bg-[linear-gradient(90deg,#087a5b_0_43%,#f5c127_43%_71%,#2488b8_71%)]" /></header>
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-6 sm:px-6"><section className="rounded-xl border border-[#cbdad5] bg-white p-4"><h3 className="flex items-center gap-3 font-extrabold text-[#20312a]"><span className="grid h-9 w-9 place-items-center rounded-full bg-[#e9f4fb] text-[#187dad]"><Building2 size={18} /></span>¿Cuántos salones funcionarán?</h3><div className="mt-4 grid grid-cols-3 overflow-hidden rounded-xl border border-[#bfd0c9]">{[1, 2, 3].map((count) => <button type="button" key={count} aria-pressed={classrooms.length === count} onClick={() => setCount(count)} className={`min-h-11 border-r border-[#cbd8d3] text-sm font-extrabold last:border-r-0 ${classrooms.length === count ? "bg-[#2488b8] text-white" : "bg-white text-[#405149] hover:bg-[#f1f7f5]"}`}>{count}</button>)}</div><p className="mt-3 text-xs leading-5 text-[#75837e]">Los grados se crean en Alta Dirección; aquí solo organizas sus salones para {year.name}.</p></section>
        {classrooms.map((classroom, index) => <ClassroomFields key={classroom.id || LETTERS[index]} classroom={classroom} index={index} shifts={availableShifts} onChange={change} />)}
        {!availableShifts.length ? <div className="flex gap-3 rounded-xl border border-[#efd378] bg-[#fff8e4] px-4 py-3 text-sm font-semibold text-[#795b00]"><CircleAlert className="shrink-0" size={18} />No hay turnos activos en este año lectivo.</div> : null}
        {validation ? <div className="flex gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700"><CircleAlert className="shrink-0" size={18} />{validation}</div> : null}
      </div><footer className="flex shrink-0 items-center gap-3 border-t border-[#d6e1dd] bg-white px-5 py-5 sm:px-6"><button type="button" disabled={busy} onClick={onClose} className="min-h-12 px-4 text-sm font-extrabold text-[#52655d] hover:text-[#173028]">Cancelar</button><button disabled={busy || !availableShifts.length} className="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-[#087a5b] text-sm font-extrabold text-white shadow-[0_10px_24px_rgba(8,122,91,0.18)] hover:bg-[#05684d] disabled:opacity-50">{busy ? <Save className="animate-pulse" size={18} /> : <Check size={18} />}{busy ? "Guardando…" : "Guardar salones"}</button></footer></form>
  </aside>;
}
