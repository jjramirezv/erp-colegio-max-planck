import { CalendarDays, CircleAlert, LoaderCircle, Save, UserRound, X } from "lucide-react";
import { useEffect, useState } from "react";

const INPUT = "min-h-11 w-full rounded-[6px] border border-line-strong bg-white px-3 text-[11px] font-semibold text-ink outline-none transition focus:border-[#237db3] focus:shadow-[0_0_0_3px_rgba(35,125,179,0.12)]";

export default function TeacherAssignmentDialog({ target, year, teachers, assignment, busy, requestError, onClose, onSave }) {
  const [values, setValues] = useState({ teacherId: assignment?.teacherId || "", role: assignment?.role || "titular", startsOn: assignment?.startsOn || year.startsOn, endsOn: assignment?.endsOn || year.endsOn });
  const [validation, setValidation] = useState("");
  useEffect(() => {
    const previous = document.body.style.overflow; document.body.style.overflow = "hidden";
    const escape = (event) => { if (event.key === "Escape" && !busy) onClose(); };
    document.addEventListener("keydown", escape);
    return () => { document.body.style.overflow = previous; document.removeEventListener("keydown", escape); };
  }, [busy, onClose]);
  function submit(event) {
    event.preventDefault();
    if (!values.teacherId && !assignment) return setValidation("Selecciona un docente.");
    if (!values.startsOn || !values.endsOn || values.endsOn < values.startsOn) return setValidation("Revisa las fechas de vigencia.");
    if (values.startsOn < year.startsOn || values.endsOn > year.endsOn) return setValidation("Las fechas deben estar dentro del año lectivo.");
    onSave({ ...values, offeringId: target.kind === "course" ? target.id : null, sectionId: target.kind === "section" ? target.id : null });
  }
  return <div className="fixed inset-0 z-[200] grid place-items-center bg-[rgba(2,35,27,0.56)] p-0 backdrop-blur-[2px] sm:p-5" role="dialog" aria-modal="true" aria-labelledby="teacher-dialog-title">
    <button type="button" className="absolute inset-0 cursor-default" aria-label="Cerrar" onClick={onClose} />
    <form onSubmit={submit} className="relative flex h-full w-full flex-col overflow-hidden bg-white shadow-[0_24px_90px_rgba(1,36,27,0.26)] sm:h-auto sm:max-w-[650px] sm:rounded-[12px]">
      <div className="grid h-1 shrink-0 grid-cols-[1.8fr_1fr_1fr]"><i className="bg-brand-800" /><i className="bg-[#f3bd24]" /><i className="bg-[#237db3]" /></div>
      <header className="flex items-start justify-between border-b border-line px-5 py-5 sm:px-7"><div><h2 id="teacher-dialog-title" className="m-0 font-sans text-[22px] font-bold text-brand-950">{assignment ? "Cambiar asignación" : "Asignar docente"}</h2><p className="mb-0 mt-1 text-[9px] text-muted">{year.name}</p></div><button type="button" className="grid h-9 w-9 place-items-center rounded-full text-brand-900 hover:bg-brand-50" onClick={onClose}><X className="h-5 w-5" /></button></header>
      <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-7">
        <section className="mb-5 flex items-center gap-3 rounded-[8px] border border-[#b7d7ea] bg-[#f3f9fc] p-4"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white text-[#237db3]"><UserRound className="h-5 w-5" /></span><div><strong className="block font-sans text-[14px] text-brand-950">{target.title}</strong><span className="text-[9px] text-muted">{target.gradeName} · Salón {target.sectionName}{target.shift ? ` · ${target.shift}` : ""}</span></div></section>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-1.5 sm:col-span-2"><span className="text-[9px] font-extrabold text-[#46554f]">Docente</span><select className={INPUT} value={values.teacherId} onChange={(event) => { setValues({ ...values, teacherId: event.target.value }); setValidation(""); }}><option value="">{assignment ? "Sin docente · quitar asignación" : "Seleccionar docente"}</option>{teachers.map((teacher) => <option key={teacher.id} value={teacher.id}>{teacher.name}</option>)}</select></label>
          <label className="grid gap-1.5"><span className="text-[9px] font-extrabold text-[#46554f]">Función</span><select className={INPUT} value={values.role} onChange={(event) => setValues({ ...values, role: event.target.value })}><option value="titular">Titular</option><option value="apoyo">Apoyo</option><option value="reemplazo">Reemplazo</option></select></label>
          <div className="hidden items-end gap-2 text-[9px] text-muted sm:flex"><CalendarDays className="mb-3 h-4 w-4 text-[#d89e00]" /><span className="mb-3">Vigencia de la asignación</span></div>
          <label className="grid gap-1.5"><span className="text-[9px] font-extrabold text-[#46554f]">Desde</span><input type="date" min={year.startsOn} max={year.endsOn} className={INPUT} value={values.startsOn} onChange={(event) => setValues({ ...values, startsOn: event.target.value })} /></label>
          <label className="grid gap-1.5"><span className="text-[9px] font-extrabold text-[#46554f]">Hasta</span><input type="date" min={year.startsOn} max={year.endsOn} className={INPUT} value={values.endsOn} onChange={(event) => setValues({ ...values, endsOn: event.target.value })} /></label>
        </div>
        {validation || requestError ? <div className="mt-4 flex gap-2 rounded-[6px] border border-[#efb0ad] bg-[#fff6f5] p-3 text-[9px] font-semibold text-[#8f2924]" role="alert"><CircleAlert className="h-4 w-4 shrink-0" />{validation || requestError}</div> : null}
      </div>
      <footer className="flex min-h-[70px] items-center justify-end gap-2 border-t border-line bg-[#fbfcfb] px-5 sm:px-7"><button type="button" disabled={busy} className="min-h-10 rounded-[5px] border border-line-strong bg-white px-4 text-[10px] font-bold text-brand-900" onClick={onClose}>Cancelar</button><button type="submit" disabled={busy} className="inline-flex min-h-10 items-center gap-2 rounded-[5px] bg-[#f3bd24] px-5 text-[10px] font-extrabold text-brand-950 hover:bg-[#ffd34f] disabled:opacity-50">{busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}{busy ? "Guardando…" : !values.teacherId && assignment ? "Quitar asignación" : "Guardar asignación"}</button></footer>
    </form>
  </div>;
}
