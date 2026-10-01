import { BookOpen, CalendarDays, Check, CircleAlert, Clock3, Coffee, Heart, Soup, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

const DAYS = { 1: "Lunes", 2: "Martes", 3: "Miércoles", 4: "Jueves", 5: "Viernes" };
const TYPES = [{ id: "clase", label: "Clase", icon: BookOpen }, { id: "receso", label: "Receso", icon: Coffee }, { id: "reflexion", label: "Reflexión", icon: Heart }, { id: "almuerzo", label: "Almuerzo", icon: Soup }];
const CONTROL = "min-h-12 w-full rounded-xl border border-[#b7cbc4] bg-white px-4 text-sm font-semibold text-[#172720] outline-none focus:border-[#087a5b] focus:ring-4 focus:ring-[#087a5b]/10";

export default function AcademicScheduleEditor({ block, defaultDay, shift, courses, selectedOfferingId, busy, onClose, onSave, onDelete }) {
  const [day, setDay] = useState(Number(block?.day || defaultDay || shift.weekdays?.[0] || 1));
  const [startTime, setStartTime] = useState(block?.startTime || shift.startTime || "07:00");
  const [endTime, setEndTime] = useState(block?.endTime || "07:50");
  const [type, setType] = useState(block?.type || "clase");
  const [offeringId, setOfferingId] = useState(String(selectedOfferingId || courses[0]?.id || ""));
  const [validation, setValidation] = useState("");
  const selectedCourse = useMemo(() => courses.find((item) => String(item.id) === offeringId), [courses, offeringId]);

  useEffect(() => {
    const close = (event) => { if (event.key === "Escape" && !busy) onClose(); };
    const overflow = document.body.style.overflow; document.body.style.overflow = "hidden"; document.addEventListener("keydown", close);
    return () => { document.body.style.overflow = overflow; document.removeEventListener("keydown", close); };
  }, [busy, onClose]);

  function submit(event) {
    event.preventDefault();
    if (!day || !startTime || !endTime || endTime <= startTime) return setValidation("Selecciona un día y un rango horario válido.");
    if (startTime < shift.startTime || endTime > shift.endTime) return setValidation(`El bloque debe estar dentro del turno ${shift.startTime} – ${shift.endTime}.`);
    if (type === "clase" && !offeringId) return setValidation("Selecciona un curso que ya tenga docente asignado.");
    const defaultNames = { clase: selectedCourse?.name || "Clase", receso: "Receso", reflexion: "Reflexión", almuerzo: "Almuerzo" };
    onSave({ id: block?.id || null, shiftId: shift.id, day, startTime, endTime, type, name: defaultNames[type], offeringId: type === "clase" ? Number(offeringId) : null, previousType: block?.type || null });
  }

  return <aside className="fixed inset-y-0 right-0 z-50 flex w-full max-w-[455px] flex-col border-l border-[#b7cac3] bg-white shadow-[-22px_0_58px_rgba(14,48,37,0.16)] max-sm:inset-x-0 max-sm:max-w-none 2xl:static 2xl:z-auto 2xl:max-h-[850px] 2xl:rounded-2xl 2xl:border">
    <form className="flex min-h-0 flex-1 flex-col" onSubmit={submit}><header className="relative flex items-start justify-between border-b border-[#d8e3df] px-6 py-6"><div><h2 className="text-2xl font-extrabold tracking-[-0.035em] text-[#14231e]">{block ? "Editar bloque" : "Nuevo bloque"}</h2><p className="mt-1 text-sm text-[#6c7b75]">{shift.name} · {shift.startTime} – {shift.endTime}</p></div><button type="button" onClick={onClose} className="grid h-11 w-11 place-items-center rounded-xl border border-[#b7cdc5] hover:bg-[#eef8f4]" aria-label="Cerrar"><X size={21} /></button><div className="absolute inset-x-0 bottom-0 h-1 bg-[linear-gradient(90deg,#087a5b_0_42%,#f6c329_42%_70%,#2488b8_70%)]" /></header>
      <div className="min-h-0 flex-1 space-y-7 overflow-y-auto px-6 py-6"><section><h3 className="mb-4 flex items-center gap-3 font-extrabold text-[#1d3028]"><span className="grid h-9 w-9 place-items-center rounded-full bg-[#edf7fc] text-[#2488b8]"><CalendarDays size={18} /></span>1. Día y horario</h3><label className="text-xs font-extrabold text-[#41534b]">Día<select className={`${CONTROL} mt-2`} value={day} onChange={(event) => { setDay(Number(event.target.value)); setValidation(""); }}>{(shift.weekdays || []).filter((value) => value <= 5).map((value) => <option key={value} value={value}>{DAYS[value]}</option>)}</select></label><div className="mt-4 grid grid-cols-2 gap-4"><label className="text-xs font-extrabold text-[#41534b]">Hora de inicio<input type="time" min={shift.startTime} max={shift.endTime} className={`${CONTROL} mt-2`} value={startTime} onChange={(event) => setStartTime(event.target.value)} /></label><label className="text-xs font-extrabold text-[#41534b]">Hora de fin<input type="time" min={shift.startTime} max={shift.endTime} className={`${CONTROL} mt-2`} value={endTime} onChange={(event) => setEndTime(event.target.value)} /></label></div></section>
        <section className="border-t border-[#dce6e2] pt-7"><h3 className="mb-4 flex items-center gap-3 font-extrabold text-[#1d3028]"><span className="grid h-9 w-9 place-items-center rounded-full bg-[#fff4d2] text-[#8a6500]"><Clock3 size={18} /></span>2. Tipo de bloque</h3><div className="grid grid-cols-2 gap-3">{TYPES.map(({ id, label, icon: Icon }) => <button key={id} type="button" onClick={() => { setType(id); setValidation(""); }} className={`flex min-h-12 items-center gap-3 rounded-xl border px-4 text-sm font-extrabold ${type === id ? "border-[#087a5b] bg-[#edf8f4] text-[#08684f] shadow-[0_0_0_2px_rgba(8,122,91,0.08)]" : "border-[#c8d7d2] text-[#405149] hover:bg-[#f7faf9]"}`}><Icon size={18} />{label}</button>)}</div></section>
        {type === "clase" ? <section className="border-t border-[#dce6e2] pt-7"><h3 className="mb-4 flex items-center gap-3 font-extrabold text-[#1d3028]"><span className="grid h-9 w-9 place-items-center rounded-full bg-[#e9f5ef] text-[#087a5b]"><BookOpen size={18} /></span>3. Contenido de la clase</h3><label className="text-xs font-extrabold text-[#41534b]">Curso<select className={`${CONTROL} mt-2`} value={offeringId} onChange={(event) => setOfferingId(event.target.value)}><option value="">Seleccionar curso</option>{courses.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.teacherName}</option>)}</select></label>{selectedCourse ? <div className="mt-3 rounded-xl border border-[#c5d7d0] bg-[#f7faf9] px-4 py-3"><p className="text-xs text-[#718079]">Docente asignado</p><strong className="mt-1 block text-sm text-[#20312b]">{selectedCourse.teacherName}</strong></div> : <p className="mt-3 text-xs leading-5 text-[#8a6400]">Solo aparecen cursos con docente asignado.</p>}</section> : null}
        <div className="flex gap-3 rounded-xl border border-[#bfd7e6] bg-[#f0f8fc] px-4 py-3 text-xs font-semibold leading-5 text-[#35677f]"><CircleAlert className="mt-0.5 shrink-0" size={17} />Cada día puede tener una duración diferente.</div>
        {validation ? <div className="flex gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700"><CircleAlert className="shrink-0" size={18} />{validation}</div> : null}
        {block ? <button type="button" disabled={busy} onClick={() => onDelete(block)} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-red-200 text-sm font-extrabold text-red-700 hover:bg-red-50"><Trash2 size={17} />Eliminar bloque</button> : null}
      </div><footer className="flex items-center gap-3 border-t border-[#d8e3df] bg-[#fbfdfc] px-6 py-5"><button type="button" onClick={onClose} className="min-h-12 px-3 text-sm font-extrabold text-[#52655d]">Cancelar</button><button disabled={busy} className="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-[#087a5b] text-sm font-extrabold text-white shadow-[0_10px_24px_rgba(8,122,91,0.18)] hover:bg-[#05684d] disabled:opacity-50"><Check size={18} />{busy ? "Guardando…" : "Guardar bloque"}</button></footer></form>
  </aside>;
}
