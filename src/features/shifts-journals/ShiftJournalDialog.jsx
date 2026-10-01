import { CalendarDays, CircleAlert, Clock3, LoaderCircle, Save, X } from "lucide-react";
import { useEffect, useState } from "react";

const INPUT = "min-h-11 w-full rounded-[6px] border border-line-strong bg-white px-3 text-[11px] font-semibold text-ink outline-none transition focus:border-[#237db3] focus:shadow-[0_0_0_3px_rgba(35,125,179,0.12)]";
const DAYS = [
  { id: 1, short: "Lun", name: "Lunes" }, { id: 2, short: "Mar", name: "Martes" },
  { id: 3, short: "Mié", name: "Miércoles" }, { id: 4, short: "Jue", name: "Jueves" },
  { id: 5, short: "Vie", name: "Viernes" }, { id: 6, short: "Sáb", name: "Sábado" },
  { id: 7, short: "Dom", name: "Domingo" },
];

function Field({ label, children }) {
  return <label className="grid gap-1.5"><span className="text-[9px] font-extrabold text-[#46554f]">{label}</span>{children}</label>;
}

export default function ShiftJournalDialog({ shift, years, initialYearId, busy, requestError, onClose, onSave }) {
  const [values, setValues] = useState({ id: shift?.id || null, yearId: shift?.yearId || initialYearId || "", name: shift?.name || "", startTime: shift?.startTime || "07:30", endTime: shift?.endTime || "13:30", weekdays: shift?.weekdays?.length ? shift.weekdays : [1, 2, 3, 4, 5], active: shift?.active ?? true });
  const [validation, setValidation] = useState("");
  const availableYears = years.filter((year) => year.status !== "cerrado" || String(year.id) === String(values.yearId));
  const set = (key, value) => { setValues((current) => ({ ...current, [key]: value })); setValidation(""); };

  useEffect(() => {
    function closeOnEscape(event) { if (event.key === "Escape" && !busy) onClose(); }
    document.addEventListener("keydown", closeOnEscape);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", closeOnEscape); document.body.style.overflow = previousOverflow; };
  }, [busy, onClose]);

  function toggleDay(day) {
    set("weekdays", values.weekdays.includes(day) ? values.weekdays.filter((value) => value !== day) : [...values.weekdays, day].sort());
  }

  function submit(event) {
    event.preventDefault();
    if (busy) return;
    if (!values.yearId) return setValidation("Selecciona un año lectivo.");
    if (!values.name.trim()) return setValidation("Escribe el nombre del turno.");
    if (!values.startTime || !values.endTime || values.endTime <= values.startTime) return setValidation("La hora de salida debe ser posterior a la hora de ingreso.");
    if (!values.weekdays.length) return setValidation("Selecciona al menos un día de clase.");
    onSave({ ...values, yearId: Number(values.yearId), name: values.name.trim() });
  }

  return <div className="fixed inset-0 z-[200] grid place-items-center bg-[rgba(2,35,27,0.56)] p-0 backdrop-blur-[2px] sm:p-5" role="dialog" aria-modal="true" aria-labelledby="shift-dialog-title">
    <button type="button" className="absolute inset-0 cursor-default" aria-label="Cerrar formulario" onClick={onClose} />
    <form noValidate onSubmit={submit} className="relative flex h-full w-full flex-col overflow-hidden bg-white shadow-[0_24px_90px_rgba(1,36,27,0.26)] sm:h-auto sm:max-h-[calc(100vh-40px)] sm:max-w-[680px] sm:rounded-[12px]">
      <div className="grid h-1 shrink-0 grid-cols-[1.8fr_1fr_1fr]"><i className="bg-brand-800" /><i className="bg-[#f3bd24]" /><i className="bg-[#237db3]" /></div>
      <header className="flex items-start justify-between border-b border-line px-5 py-4 sm:px-7 sm:py-5"><div><h2 id="shift-dialog-title" className="m-0 font-sans text-[22px] font-bold leading-tight text-brand-950">{shift ? "Editar turno" : "Nuevo turno"}</h2><p className="mb-0 mt-1 text-[9px] text-muted">Define cuándo inicia, termina y qué días funciona.</p></div><button type="button" className="grid h-9 w-9 place-items-center rounded-full text-brand-900 hover:bg-brand-50" onClick={onClose} aria-label="Cerrar"><X className="h-5 w-5" /></button></header>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-7 sm:py-6">
        <section className="grid gap-4 border-b border-line pb-5"><div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-full bg-brand-50 text-brand-800"><Clock3 className="h-5 w-5" /></span><div><h3 className="m-0 font-sans text-[15px] font-bold text-brand-950">Información básica</h3><p className="mb-0 mt-0.5 text-[8px] text-muted">El nombre será el que se elija después en cada salón.</p></div></div><div className="grid gap-4 sm:grid-cols-2"><Field label="Año lectivo"><select className={INPUT} value={values.yearId} onChange={(event) => set("yearId", event.target.value)}><option value="">Seleccionar año</option>{availableYears.map((year) => <option key={year.id} value={year.id}>{year.name}</option>)}</select></Field><Field label="Nombre del turno"><input autoFocus maxLength="40" className={INPUT} value={values.name} onChange={(event) => set("name", event.target.value)} placeholder="Ej. Mañana" /></Field></div><div className="grid gap-4 sm:grid-cols-2"><Field label="Hora de ingreso"><input type="time" className={INPUT} value={values.startTime} onChange={(event) => set("startTime", event.target.value)} /></Field><Field label="Hora de salida"><input type="time" className={INPUT} value={values.endTime} onChange={(event) => set("endTime", event.target.value)} /></Field></div></section>

        <section className="pt-5"><div className="mb-4 flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-full bg-[#eff8fd] text-[#237db3]"><CalendarDays className="h-5 w-5" /></span><div><h3 className="m-0 font-sans text-[15px] font-bold text-brand-950">Días de clase</h3><p className="mb-0 mt-0.5 text-[8px] text-muted">Selecciona únicamente los días en que aplica este turno.</p></div></div><div className="grid grid-cols-4 gap-2 sm:grid-cols-7">{DAYS.map((day) => { const selected = values.weekdays.includes(day.id); return <button key={day.id} type="button" aria-pressed={selected} title={day.name} className={`min-h-[48px] rounded-[6px] border text-[9px] font-extrabold transition ${selected ? "border-[#237db3] bg-[#eff8fd] text-[#176d9f] shadow-[inset_0_-2px_0_#237db3]" : "border-line-strong bg-white text-muted hover:border-[#237db3]"}`} onClick={() => toggleDay(day.id)}>{day.short}</button>; })}</div></section>

        <section className="mt-5 flex items-center justify-between rounded-[8px] bg-[#f7faf8] p-4"><div><h3 className="m-0 font-sans text-[14px] font-bold text-brand-950">Turno activo</h3><p className="mb-0 mt-1 text-[8px] text-muted">Disponible para asignarlo a los salones.</p></div><button type="button" role="switch" aria-checked={values.active} aria-label="Turno activo" className={`relative h-7 w-12 rounded-full transition ${values.active ? "bg-brand-700" : "bg-[#b7c3bf]"}`} onClick={() => set("active", !values.active)}><span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition ${values.active ? "left-6" : "left-1"}`} /></button></section>

        {validation || requestError ? <div className="mt-4 flex items-start gap-2 rounded-[6px] border border-[#efb0ad] bg-[#fff6f5] p-3 text-[9px] font-semibold text-[#8f2924]" role="alert"><CircleAlert className="h-4 w-4 shrink-0" />{validation || requestError}</div> : null}
      </div>

      <footer className="flex min-h-[70px] shrink-0 items-center justify-end gap-2 border-t border-line bg-[#fbfcfb] px-5 sm:px-7"><button type="button" disabled={busy} className="min-h-10 rounded-[5px] border border-line-strong bg-white px-4 text-[10px] font-bold text-brand-900 hover:bg-brand-50" onClick={onClose}>Cancelar</button><button type="submit" disabled={busy} className="inline-flex min-h-10 items-center gap-2 rounded-[5px] bg-[#f3bd24] px-5 text-[10px] font-extrabold text-brand-950 hover:bg-[#ffd34f] disabled:opacity-50">{busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}{busy ? "Guardando…" : shift ? "Guardar cambios" : "Crear turno"}</button></footer>
    </form>
  </div>;
}
