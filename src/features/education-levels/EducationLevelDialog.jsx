import { BookOpen, Check, CircleAlert, Layers3, LoaderCircle, Save, X } from "lucide-react";
import { useEffect, useState } from "react";

const INPUT = "min-h-11 w-full rounded-[6px] border border-line-strong bg-white px-3 text-[11px] font-semibold text-ink outline-none transition focus:border-[#237db3] focus:shadow-[0_0_0_3px_rgba(35,125,179,0.12)]";
const SCOPES = [
  { value: "section", title: "Por aula o sección", detail: "Ideal para Inicial", icon: Layers3, tone: "#047857" },
  { value: "course", title: "Por curso", detail: "Ideal para Primaria y Secundaria", icon: BookOpen, tone: "#237db3" },
];

function initialValues(level) {
  return {
    id: level?.id || null,
    name: level?.name || "",
    order: level?.order || "",
    materialScope: level?.materialScope || "course",
    active: level?.active ?? true,
  };
}

export default function EducationLevelDialog({ level, busy, requestError, onClose, onSave }) {
  const [values, setValues] = useState(() => initialValues(level));
  const [validation, setValidation] = useState("");
  const set = (key, value) => {
    setValues((current) => ({ ...current, [key]: value }));
    setValidation("");
  };

  useEffect(() => {
    function closeOnEscape(event) { if (event.key === "Escape" && !busy) onClose(); }
    document.addEventListener("keydown", closeOnEscape);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", closeOnEscape);
      document.body.style.overflow = previousOverflow;
    };
  }, [busy, onClose]);

  function submit(event) {
    event.preventDefault();
    if (busy) return;
    if (!values.name.trim()) return setValidation("Escribe el nombre del nivel educativo.");
    const numericOrder = Number(values.order);
    if (!Number.isInteger(numericOrder) || numericOrder <= 0 || numericOrder > 32767) return setValidation("El orden debe ser un número entero mayor que cero.");
    setValidation("");
    onSave({ ...values, name: values.name.trim(), order: numericOrder });
  }

  return (
    <div className="fixed inset-0 z-[200] grid place-items-center bg-[rgba(2,35,27,0.56)] p-0 backdrop-blur-[2px] sm:p-5" role="dialog" aria-modal="true" aria-labelledby="education-level-dialog-title">
      <button type="button" className="absolute inset-0 cursor-default" aria-label="Cerrar formulario" onClick={onClose} />
      <form noValidate onSubmit={submit} className="relative flex h-full w-full flex-col overflow-hidden bg-white shadow-[0_24px_90px_rgba(1,36,27,0.26)] sm:h-auto sm:max-h-[calc(100vh-40px)] sm:max-w-[640px] sm:rounded-[12px]">
        <div className="grid h-1 shrink-0 grid-cols-[1.8fr_1fr_1fr]"><i className="bg-brand-800" /><i className="bg-[#f3bd24]" /><i className="bg-[#237db3]" /></div>
        <header className="flex min-h-[76px] shrink-0 items-start justify-between border-b border-line px-5 py-4 sm:px-7 sm:py-5">
          <div><h2 id="education-level-dialog-title" className="m-0 font-sans text-[22px] font-bold leading-tight text-brand-950">{level ? "Editar nivel educativo" : "Nuevo nivel educativo"}</h2><p className="mb-0 mt-1 text-[9px] text-muted">Define cómo se organizará dentro del colegio.</p></div>
          <button type="button" className="grid h-9 w-9 place-items-center rounded-full text-brand-900 hover:bg-brand-50" onClick={onClose} aria-label="Cerrar"><X className="h-5 w-5" /></button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-7 sm:py-6">
          <div className="grid gap-5">
            <label className="grid gap-1.5"><span className="text-[9px] font-extrabold text-[#46554f]">Nombre del nivel</span><input autoFocus maxLength="60" className={INPUT} value={values.name} onChange={(event) => set("name", event.target.value)} placeholder="Ej. Educación Primaria" /></label>
            <label className="grid gap-1.5 sm:max-w-[230px]"><span className="text-[9px] font-extrabold text-[#46554f]">Orden de presentación</span><input type="number" min="1" max="32767" inputMode="numeric" className={INPUT} value={values.order} onChange={(event) => set("order", event.target.value)} placeholder="Ej. 1" /><small className="text-[8px] text-muted">Determina dónde aparecerá en las listas.</small></label>

            <fieldset className="grid gap-2">
              <legend className="mb-1 text-[9px] font-extrabold text-[#46554f]">Distribución de materiales</legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {SCOPES.map(({ value, title, detail, icon: Icon, tone }) => {
                  const selected = values.materialScope === value;
                  return <label key={value} className={`flex min-h-[78px] cursor-pointer items-center gap-3 rounded-[7px] border px-3.5 py-3 transition ${selected ? "border-[#237db3] bg-[#f1f8fc] shadow-[0_0_0_2px_rgba(35,125,179,0.08)]" : "border-line-strong hover:border-[#9fc8de]"}`}><input className="sr-only" type="radio" name="materialScope" value={value} checked={selected} onChange={(event) => set("materialScope", event.target.value)} /><span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white" style={{ color: tone }}><Icon className="h-4 w-4" /></span><span className="min-w-0 flex-1"><strong className="block text-[10px] text-brand-950">{title}</strong><small className="mt-0.5 block text-[8px] leading-relaxed text-muted">{detail}</small></span><span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border-2 ${selected ? "border-brand-700 text-brand-700" : "border-[#cdd8d4]"}`}>{selected ? <Check className="h-3 w-3" strokeWidth={3} /> : null}</span></label>;
                })}
              </div>
            </fieldset>

            <div className="flex items-center justify-between rounded-[7px] border border-line-strong px-4 py-3">
              <div><strong className="block text-[10px] text-brand-950">Nivel habilitado</strong><small className="mt-0.5 block text-[8px] text-muted">Podrá utilizarse al configurar grados y secciones.</small></div>
              <button type="button" role="switch" aria-checked={values.active} aria-label="Nivel habilitado" className={`relative h-6 w-11 rounded-full transition ${values.active ? "bg-brand-700" : "bg-[#b7c3bf]"}`} onClick={() => set("active", !values.active)}><span className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow transition ${values.active ? "left-6" : "left-1"}`} /></button>
            </div>
          </div>

          {validation || requestError ? <div className="mt-4 flex items-start gap-2 rounded-[6px] border border-[#efb0ad] bg-[#fff6f5] p-3 text-[9px] font-semibold text-[#8f2924]" role="alert"><CircleAlert className="h-4 w-4 shrink-0" />{validation || requestError}</div> : null}
        </div>

        <footer className="flex min-h-[70px] shrink-0 items-center justify-end gap-2 border-t border-line bg-[#fbfcfb] px-5 sm:px-7">
          <button type="button" disabled={busy} className="min-h-10 rounded-[5px] border border-line-strong bg-white px-5 text-[10px] font-bold text-brand-900 hover:bg-brand-50" onClick={onClose}>Cancelar</button>
          <button type="submit" disabled={busy} className="inline-flex min-h-10 items-center gap-2 rounded-[5px] bg-[#f3bd24] px-5 text-[10px] font-extrabold text-brand-950 hover:bg-[#ffd34f] disabled:opacity-50">{busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}{busy ? "Guardando…" : level ? "Guardar cambios" : "Crear nivel"}</button>
        </footer>
      </form>
    </div>
  );
}
