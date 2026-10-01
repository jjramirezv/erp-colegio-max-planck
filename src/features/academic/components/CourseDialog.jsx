import { useState } from "react";
import { LoaderCircle, Save, X } from "lucide-react";
import { PRIMARY_BUTTON_CLASS, SECONDARY_BUTTON_CLASS } from "../constants";

const INPUT_CLASS =
  "min-h-[39px] w-full border border-[#c4d5cf] px-2.5 text-[11px] font-semibold text-ink outline-none focus:border-brand-800 focus:shadow-[0_0_0_2px_rgba(10,115,88,0.12)]";

export default function CourseDialog({ value, onClose, onSubmit, busy }) {
  const editing = value.mode === "edit";
  const [form, setForm] = useState({
    code: value.code || "",
    subjectName: value.subjectName || "",
    displayName: value.displayName || "",
    weeklyHours: value.weeklyHours || "",
  });

  function change(event) {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  }

  function submit(event) {
    event.preventDefault();
    onSubmit({ ...value, ...form });
  }

  return (
    <div
      className="fixed inset-0 z-[1200] flex items-end justify-center bg-[rgba(5,28,22,0.54)] p-0 sm:items-center sm:p-[18px]"
      role="presentation"
      onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onClose(); }}
    >
      <section
        className="max-h-[92vh] w-full overflow-auto border border-[#31594e] bg-surface shadow-[0_22px_65px_rgba(0,34,25,0.22)] sm:w-[min(500px,100%)]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="academic-course-title"
      >
        <header className="flex min-h-[72px] items-center justify-between gap-4 border-b border-line bg-[#f5f9f7] px-[17px] py-3.5">
          <div className="grid gap-1">
            <small className="text-[8px] font-black tracking-[0.12em] text-brand-800">{editing ? "EDITAR OFERTA" : "NUEVO CURSO"}</small>
            <h2 id="academic-course-title" className="m-0 font-sans text-lg font-extrabold">{editing ? "Ajustar curso" : "Agregar curso a la sección"}</h2>
          </div>
          <button type="button" onClick={onClose} disabled={busy} aria-label="Cerrar" className="grid h-8 w-8 cursor-pointer place-items-center border border-[#b7c9c2] bg-surface text-brand-900">
            <X className="h-4 w-4" />
          </button>
        </header>
        <form onSubmit={submit} className="grid gap-3.5 p-[18px]">
          {!editing ? (
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-[120px_1fr]">
              <label className="grid gap-1.5">
                <span className="text-[9px] font-extrabold text-[#3f544d]">Código</span>
                <input name="code" value={form.code} onChange={change} placeholder="Ej. MAT" required maxLength={20} autoFocus className={INPUT_CLASS} />
              </label>
              <label className="grid gap-1.5">
                <span className="text-[9px] font-extrabold text-[#3f544d]">Asignatura</span>
                <input name="subjectName" value={form.subjectName} onChange={change} placeholder="Ej. Matemática" required maxLength={100} className={INPUT_CLASS} />
              </label>
            </div>
          ) : (
            <div className="flex items-center gap-2.5 border border-line bg-[#f5f8f7] p-2.5">
              <span className="bg-brand-900 px-[7px] py-[5px] text-[8px] font-black text-white">{value.code}</span>
              <strong className="text-[11px]">{value.subjectName}</strong>
            </div>
          )}
          <label className="grid gap-1.5">
            <span className="text-[9px] font-extrabold text-[#3f544d]">Nombre visible <small className="font-medium text-muted">(opcional)</small></span>
            <input name="displayName" value={form.displayName} onChange={change} placeholder="Usa el nombre de la asignatura si queda vacío" maxLength={120} className={INPUT_CLASS} />
          </label>
          <label className="grid gap-1.5">
            <span className="text-[9px] font-extrabold text-[#3f544d]">Horas por semana</span>
            <input name="weeklyHours" value={form.weeklyHours} onChange={change} type="number" min="1" max="40" placeholder="Ej. 5" className={INPUT_CLASS} />
          </label>
          <p className="m-0 border-l-[3px] border-gold bg-amber-soft px-2.5 py-2 text-[9px] leading-relaxed text-amber-ink">
            Si el código ya existe, se reutilizará la asignatura del catálogo; no se crearán duplicados.
          </p>
          <footer className="flex justify-end gap-2 pt-0.5">
            <button type="button" onClick={onClose} disabled={busy} className={SECONDARY_BUTTON_CLASS}>Cancelar</button>
            <button type="submit" disabled={busy} className={PRIMARY_BUTTON_CLASS}>
              {busy ? <LoaderCircle className="h-[15px] w-[15px] animate-spin motion-reduce:animate-none" /> : <Save className="h-[15px] w-[15px]" />}
              {editing ? "Guardar cambios" : "Crear curso"}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}
