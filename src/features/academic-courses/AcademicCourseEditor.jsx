import { useState } from "react";
import { BookOpen, Check, Clock3, Layers3, X } from "lucide-react";

const CONTROL = "min-h-12 w-full rounded-xl border border-[#b7cbc4] bg-white px-4 text-sm font-semibold text-[#172720] outline-none transition focus:border-[#087a5b] focus:ring-4 focus:ring-[#087a5b]/10";

export default function AcademicCourseEditor({ course, context, areas, busy, onClose, onSave }) {
  const [name, setName] = useState(course?.name || "");
  const [areaId, setAreaId] = useState(course?.areaId || "");
  const [weeklyHours, setWeeklyHours] = useState(course?.weeklyHours || 1);
  const [active, setActive] = useState(course?.active ?? true);
  const [validation, setValidation] = useState("");

  function submit(event) {
    event.preventDefault();
    const cleanName = name.trim();
    const hours = Number(weeklyHours);
    if (!cleanName) return setValidation("Escribe el nombre del curso.");
    if (!Number.isInteger(hours) || hours < 1 || hours > 40) return setValidation("Las horas sugeridas deben estar entre 1 y 40.");
    setValidation("");
    onSave({ id: course?.id, yearId: context.yearId, gradeId: context.gradeId, name: cleanName, areaId, weeklyHours: hours, active });
  }

  return <aside className="fixed inset-y-0 right-0 z-50 flex w-full max-w-[455px] flex-col border-l border-[#b7cac3] bg-white shadow-[-22px_0_58px_rgba(14,48,37,0.15)] max-sm:inset-x-0 max-sm:max-w-none 2xl:static 2xl:z-auto 2xl:max-h-[790px] 2xl:rounded-2xl 2xl:border 2xl:shadow-[0_18px_48px_rgba(14,48,37,0.08)]">
    <form className="flex min-h-0 flex-1 flex-col" onSubmit={submit}>
      <header className="relative flex items-start justify-between border-b border-[#d7e3df] px-6 py-6"><div><h2 className="text-2xl font-extrabold tracking-[-0.035em] text-[#14231e]">{course ? "Editar curso" : "Agregar curso"}</h2><p className="mt-1 text-sm text-[#6a7a73]">{context.gradeName} · {context.yearName}</p></div><button type="button" onClick={onClose} className="grid h-11 w-11 place-items-center rounded-xl border border-[#b7cdc5] text-[#1a2e27] hover:bg-[#eef8f4]" aria-label="Cerrar"><X size={21} /></button><div className="absolute inset-x-0 bottom-0 h-1 bg-[linear-gradient(90deg,#087a5b_0_42%,#f6c329_42%_70%,#2488b8_70%)]" /></header>
      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
        <section className="border-b border-[#dce6e2] pb-7"><h3 className="flex items-center gap-3 text-base font-extrabold text-[#11684f]"><span className="grid h-10 w-10 place-items-center rounded-full bg-[#e8f5ef]"><BookOpen size={19} /></span>Identidad del curso</h3><label className="mt-5 block text-sm font-extrabold text-[#293a33]">Nombre del curso<input className={`${CONTROL} mt-2`} maxLength="100" value={name} onChange={(event) => setName(event.target.value)} placeholder="Ej. Comunicación" autoFocus /></label><p className="mt-2 text-right text-xs text-[#7b8883]">{name.length}/100</p></section>
        <section className="pt-7"><h3 className="flex items-center gap-3 text-base font-extrabold text-[#11684f]"><span className="grid h-10 w-10 place-items-center rounded-full bg-[#fff4d2] text-[#8a6500]"><Layers3 size={19} /></span>Organización académica</h3><label className="mt-5 block text-sm font-extrabold text-[#293a33]">Área curricular <span className="font-medium text-[#718079]">(opcional)</span><select className={`${CONTROL} mt-2`} value={areaId} onChange={(event) => setAreaId(event.target.value)}><option value="">Curso general, sin área</option>{areas.filter((area) => area.active || String(area.id) === String(course?.areaId)).map((area) => <option key={area.id} value={area.id}>{area.name}{area.active ? "" : " · inactiva"}</option>)}</select></label><p className="mt-2 text-xs leading-5 text-[#74817c]">En Inicial o cursos generales puedes dejar este campo vacío.</p>
          <label className="mt-5 block text-sm font-extrabold text-[#293a33]">Horas sugeridas por semana<div className="relative mt-2"><Clock3 className="absolute left-4 top-1/2 -translate-y-1/2 text-[#2488b8]" size={18} /><input className={`${CONTROL} pl-12 pr-16`} type="number" min="1" max="40" value={weeklyHours} onChange={(event) => setWeeklyHours(event.target.value)} /><span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-[#708079]">horas</span></div></label><p className="mt-2 text-xs leading-5 text-[#74817c]">Es una referencia para el grado. La distribución específica se completa en Carga académica.</p>
          <div className="mt-6 flex items-center justify-between gap-4 rounded-xl border border-[#c8d8d2] bg-[#f8fbfa] px-4 py-4"><div><p className="text-sm font-extrabold text-[#293a33]">Curso activo</p><p className="mt-1 text-xs text-[#72817b]">Disponible para salones y planificación.</p></div><button type="button" role="switch" aria-checked={active} onClick={() => setActive((value) => !value)} className={`relative h-7 w-12 rounded-full transition ${active ? "bg-[#087a5b]" : "bg-[#aebbb6]"}`}><span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition ${active ? "left-6" : "left-1"}`} /></button></div>
        </section>
        {validation && <p className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{validation}</p>}
      </div>
      <footer className="border-t border-[#d7e3df] bg-[#fbfdfc] px-6 py-5"><button disabled={busy} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#087a5b] px-5 text-sm font-extrabold text-white shadow-[0_10px_24px_rgba(8,122,91,0.18)] hover:bg-[#05684d] disabled:opacity-50"><Check size={18} />{busy ? "Guardando…" : "Guardar curso"}</button></footer>
    </form>
  </aside>;
}
