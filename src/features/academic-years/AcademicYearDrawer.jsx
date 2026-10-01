import { CalendarDays, Check, CircleAlert, LoaderCircle, LockKeyhole, Save, X } from "lucide-react";
import { useEffect, useState } from "react";

const INPUT = "min-h-11 w-full rounded-[6px] border border-line-strong bg-white px-3 text-[11px] font-semibold text-ink outline-none transition focus:border-[#237db3] focus:shadow-[0_0_0_3px_rgba(35,125,179,0.12)] disabled:bg-[#f5f7f6] disabled:text-muted";
const STATUS_LABELS = { preparacion: "En preparación", activo: "Activo", cerrado: "Cerrado" };
const PERIODS = [
  { value: "bimestres", title: "4 bimestres", detail: "Dos por semestre", tone: "#16866e" },
  { value: "trimestres", title: "3 trimestres", detail: "Tres periodos", tone: "#237db3" },
  { value: "semestres", title: "2 semestres", detail: "Dos periodos", tone: "#d89e00" },
];

function initialValues(year) {
  return {
    id: year?.id || null,
    name: year?.name || "",
    startsOn: year?.startsOn || "",
    endsOn: year?.endsOn || "",
    periodSystem: year?.periodSystem || "bimestres",
  };
}

function Field({ label, children }) {
  return <label className="grid gap-1.5"><span className="text-[9px] font-extrabold text-[#46554f]">{label}</span>{children}</label>;
}

export default function AcademicYearDrawer({ mode, year, busy, requestError, onClose, onSave }) {
  const readOnly = mode === "view";
  const [values, setValues] = useState(() => initialValues(year));
  const [validation, setValidation] = useState("");
  const set = (key, value) => {
    setValues((current) => ({ ...current, [key]: value }));
    setValidation("");
  };

  useEffect(() => {
    function closeOnEscape(event) {
      if (event.key === "Escape" && !busy) onClose();
    }
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
    if (readOnly || busy) return;
    if (!values.name.trim()) return setValidation("Escribe el nombre del año lectivo.");
    if (!values.startsOn || !values.endsOn) return setValidation("Completa las fechas de inicio y cierre.");
    if (values.endsOn < values.startsOn) return setValidation("La fecha de cierre debe ser posterior a la fecha de inicio.");
    setValidation("");
    onSave({ ...values, name: values.name.trim() });
  }

  const title = mode === "create" ? "Nuevo año lectivo" : mode === "edit" ? "Editar año lectivo" : `Año lectivo ${year?.name}`;

  return (
    <div className="fixed inset-0 z-[200] grid place-items-center bg-[rgba(2,35,27,0.56)] p-0 backdrop-blur-[2px] sm:p-5" role="dialog" aria-modal="true" aria-labelledby="academic-year-modal-title">
      <button type="button" className="absolute inset-0 cursor-default" aria-label="Cerrar formulario" onClick={onClose} />
      <form noValidate onSubmit={submit} className="relative flex h-full w-full flex-col overflow-hidden bg-white shadow-[0_24px_90px_rgba(1,36,27,0.26)] sm:h-auto sm:max-h-[calc(100vh-40px)] sm:max-w-[680px] sm:rounded-[12px]">
        <div className="grid h-1 shrink-0 grid-cols-[1.8fr_1fr_1fr]"><i className="bg-brand-800" /><i className="bg-[#f3bd24]" /><i className="bg-[#237db3]" /></div>
        <header className="flex min-h-[76px] shrink-0 items-start justify-between border-b border-line px-5 py-4 sm:px-7 sm:py-5">
          <div>
            <h2 id="academic-year-modal-title" className="m-0 font-sans text-[22px] font-bold leading-tight tracking-[-0.015em] text-brand-950">{title}</h2>
            <p className="mb-0 mt-1 text-[9px] text-muted">{readOnly ? "Consulta la configuración registrada." : "Completa la vigencia y su división académica."}</p>
          </div>
          <button type="button" className="grid h-9 w-9 place-items-center rounded-full text-brand-900 hover:bg-brand-50" onClick={onClose} aria-label="Cerrar"><X className="h-5 w-5" /></button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-7 sm:py-6">
          <div className="mb-5 flex items-center gap-3 rounded-[7px] border border-[#b7d7ea] bg-[#f1f8fc] px-4 py-3 text-[#176d9f]">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white"><CalendarDays className="h-4 w-4" /></span>
            <p className="m-0 text-[9px] leading-relaxed"><strong className="block text-[10px] text-[#114f74]">{readOnly ? `Estado: ${STATUS_LABELS[year?.status] || "En preparación"}` : "Se guardará en preparación"}</strong>{readOnly ? "Este registro forma parte de la gestión académica." : "Podrás revisarlo antes de activarlo."}</p>
          </div>

          <div className="grid gap-5">
            <Field label="Nombre del año"><input autoFocus={!readOnly} disabled={readOnly} maxLength="40" className={INPUT} value={values.name} onChange={(event) => set("name", event.target.value)} placeholder="Ej. Año lectivo 2027" /></Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Fecha de inicio"><input disabled={readOnly} type="date" className={INPUT} value={values.startsOn} onChange={(event) => set("startsOn", event.target.value)} /></Field>
              <Field label="Fecha de cierre"><input disabled={readOnly} type="date" min={values.startsOn} className={INPUT} value={values.endsOn} onChange={(event) => set("endsOn", event.target.value)} /></Field>
            </div>

            <fieldset className="grid gap-2" disabled={readOnly}>
              <legend className="mb-1 text-[9px] font-extrabold text-[#46554f]">Organización académica</legend>
              <div className="grid gap-2 sm:grid-cols-3">
                {PERIODS.map((period) => {
                  const selected = values.periodSystem === period.value;
                  return (
                    <label key={period.value} className={`relative flex min-h-[68px] cursor-pointer items-center gap-3 rounded-[7px] border px-3 py-2.5 transition ${selected ? "border-[#237db3] bg-[#f1f8fc] shadow-[0_0_0_2px_rgba(35,125,179,0.08)]" : "border-line-strong bg-white hover:border-[#9fc8de]"} ${readOnly ? "cursor-default" : ""}`}>
                      <input className="sr-only" type="radio" name="periodSystem" value={period.value} checked={selected} onChange={(event) => set("periodSystem", event.target.value)} />
                      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full border-2 bg-white" style={{ borderColor: selected ? period.tone : "#cdd8d4", color: period.tone }}>{selected ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : null}</span>
                      <span><strong className="block text-[10px] text-brand-950">{period.title}</strong><small className="mt-0.5 block text-[8px] text-muted">{period.detail}</small></span>
                    </label>
                  );
                })}
              </div>
            </fieldset>
          </div>

          {!readOnly ? <div className="mt-5 flex items-start gap-2.5 rounded-[7px] border border-[#edd99b] bg-[#fffaf0] px-4 py-3 text-[9px] leading-relaxed text-[#6e5520]"><LockKeyhole className="mt-0.5 h-3.5 w-3.5 shrink-0" /><span><strong className="font-extrabold">Una sola vigencia activa.</strong> La activación se realiza después y requiere confirmación.</span></div> : null}

          {validation || requestError ? <div className="mt-4 flex items-start gap-2 rounded-[6px] border border-[#efb0ad] bg-[#fff6f5] p-3 text-[9px] font-semibold text-[#8f2924]" role="alert"><CircleAlert className="h-4 w-4 shrink-0" />{validation || requestError}</div> : null}
        </div>

        <footer className="flex min-h-[70px] shrink-0 items-center justify-end gap-2 border-t border-line bg-[#fbfcfb] px-5 sm:px-7">
          <button type="button" disabled={busy} className="min-h-10 rounded-[5px] border border-line-strong bg-white px-5 text-[10px] font-bold text-brand-900 hover:bg-brand-50" onClick={onClose}>{readOnly ? "Cerrar" : "Cancelar"}</button>
          {!readOnly ? <button type="submit" disabled={busy} className="inline-flex min-h-10 items-center gap-2 rounded-[5px] bg-[#f3bd24] px-5 text-[10px] font-extrabold text-brand-950 hover:bg-[#ffd34f] disabled:opacity-50">{busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}{busy ? "Guardando…" : values.id ? "Guardar cambios" : "Crear año lectivo"}</button> : null}
        </footer>
      </form>
    </div>
  );
}
