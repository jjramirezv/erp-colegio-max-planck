import { useState } from "react";
import { BookOpen, CalendarDays, Check, Minus, Plus, UserRound, X } from "lucide-react";

const FIELD_CLASS = "min-h-12 w-full rounded-lg border border-[#b7cbc4] bg-white px-4 text-sm font-semibold text-[#16241f] outline-none transition focus:border-[#078462] focus:ring-4 focus:ring-[#078462]/10 disabled:bg-[#f1f5f3]";

export default function AcademicLoadEditor({ entry, teachers, year, busy, onClose, onSave }) {
  const [weeklyHours, setWeeklyHours] = useState(entry.weeklyHours || 1);
  const [teacherId, setTeacherId] = useState(entry.teacherId || "");
  const [startsOn, setStartsOn] = useState(entry.startsOn || year?.startsOn || "");
  const [endsOn, setEndsOn] = useState(entry.endsOn || year?.endsOn || "");
  const complete = Boolean(teacherId) && (entry.scope === "section" || Number(weeklyHours) > 0);

  function changeHours(delta) {
    setWeeklyHours((current) => Math.min(40, Math.max(1, Number(current || 1) + delta)));
  }

  function submit(event) {
    event.preventDefault();
    onSave({ scope: entry.scope, scopeId: entry.scopeId, weeklyHours, teacherId, startsOn, endsOn });
  }

  return (
    <aside className="fixed inset-y-0 right-0 z-50 flex w-full max-w-[470px] flex-col border-l border-[#b8cbc4] bg-white shadow-[-20px_0_55px_rgba(17,45,36,0.13)] 2xl:static 2xl:z-auto 2xl:max-h-[760px] 2xl:rounded-2xl 2xl:border 2xl:shadow-[0_18px_50px_rgba(17,45,36,0.08)]">
      <form className="flex min-h-0 flex-1 flex-col" onSubmit={submit}>
        <header className="flex items-start justify-between gap-5 border-b border-[#d9e5e1] px-6 py-6 sm:px-7">
          <div className="min-w-0">
            <span className="mb-3 inline-flex items-center gap-2 rounded-full bg-[#e7f5ef] px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.14em] text-[#087456]"><BookOpen size={14} /> {entry.scope === "course" ? "Curso del salón" : "Responsable del aula"}</span>
            <h2 className="truncate text-2xl font-extrabold tracking-[-0.03em] text-[#14231e]">{entry.title}</h2>
            <p className="mt-1 text-sm text-[#687971]">{entry.context}</p>
          </div>
          <button type="button" onClick={onClose} className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-[#bad0c8] text-[#1d3029] transition hover:border-[#078462] hover:bg-[#edf8f4]" aria-label="Cerrar editor"><X size={22} /></button>
        </header>

        <div className="min-h-0 flex-1 space-y-7 overflow-y-auto px-6 py-6 sm:px-7">
          <section>
            <div className="mb-3 flex items-center justify-between gap-3">
              <label className="flex items-center gap-2 text-sm font-extrabold text-[#20312b]"><UserRound size={17} className="text-[#078462]" /> Docente asignado</label>
              <span className={`rounded-full px-2.5 py-1 text-[11px] font-extrabold ${complete ? "bg-[#e7f5ef] text-[#087456]" : "bg-[#fff4d5] text-[#946400]"}`}>{complete ? "Carga completa" : "Pendiente"}</span>
            </div>
            <select className={FIELD_CLASS} value={teacherId} onChange={(event) => setTeacherId(event.target.value)}>
              <option value="">Sin docente asignado</option>
              {teachers.map((teacher) => <option key={teacher.id} value={teacher.id}>{teacher.fullName}</option>)}
            </select>
            {!teachers.length && <p className="mt-2 text-xs font-semibold text-[#ad3d35]">Primero crea o activa un usuario con rol Docente.</p>}
          </section>

          {entry.scope === "course" && (
            <section>
              <label className="mb-3 block text-sm font-extrabold text-[#20312b]">Horas pedagógicas por semana</label>
              <div className="grid grid-cols-[48px_1fr_48px] overflow-hidden rounded-xl border border-[#b7cbc4] bg-white">
                <button type="button" onClick={() => changeHours(-1)} className="grid place-items-center border-r border-[#d3e0dc] text-[#087456] hover:bg-[#edf8f4]" aria-label="Restar una hora"><Minus size={18} /></button>
                <input className="h-14 w-full text-center text-xl font-extrabold text-[#14231e] outline-none" type="number" min="1" max="40" value={weeklyHours} onChange={(event) => setWeeklyHours(event.target.value)} />
                <button type="button" onClick={() => changeHours(1)} className="grid place-items-center border-l border-[#d3e0dc] text-[#087456] hover:bg-[#edf8f4]" aria-label="Agregar una hora"><Plus size={18} /></button>
              </div>
              <p className="mt-2 text-xs text-[#6d7d76]">Define la carga total del curso. El horario distribuye estas horas por día.</p>
            </section>
          )}

          <section>
            <h3 className="mb-3 flex items-center gap-2 text-sm font-extrabold text-[#20312b]"><CalendarDays size={17} className="text-[#2387b8]" /> Vigencia de la asignación</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="text-xs font-bold text-[#5d6e67]">Desde<input className={`${FIELD_CLASS} mt-2`} type="date" min={year?.startsOn} max={year?.endsOn} value={startsOn} onChange={(event) => setStartsOn(event.target.value)} /></label>
              <label className="text-xs font-bold text-[#5d6e67]">Hasta<input className={`${FIELD_CLASS} mt-2`} type="date" min={year?.startsOn} max={year?.endsOn} value={endsOn} onChange={(event) => setEndsOn(event.target.value)} /></label>
            </div>
          </section>

          <div className="rounded-xl border-l-4 border-[#2d8fbd] bg-[#eef8fd] px-4 py-3 text-xs leading-5 text-[#355864]">Los cambios se reflejarán en la asignación docente y en la planificación del salón.</div>
        </div>

        <footer className="border-t border-[#d9e5e1] bg-[#fbfdfc] px-6 py-5 sm:px-7">
          <button type="submit" disabled={busy || !startsOn || !endsOn} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#087a5b] px-5 text-sm font-extrabold text-white shadow-[0_10px_24px_rgba(8,122,91,0.18)] transition hover:bg-[#056a4e] disabled:cursor-not-allowed disabled:opacity-50"><Check size={18} /> {busy ? "Guardando…" : "Guardar cambios"}</button>
        </footer>
      </form>
    </aside>
  );
}
