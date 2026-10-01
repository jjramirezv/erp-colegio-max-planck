import { CircleAlert, FileSignature, Hash, LoaderCircle, Save, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

const INPUT = "min-h-11 w-full rounded-[6px] border border-line-strong bg-white px-3 text-[11px] font-semibold text-ink outline-none transition focus:border-[#237db3] focus:shadow-[0_0_0_3px_rgba(35,125,179,0.12)]";

export function formatCorrelative(series, number, digits) {
  const safeSeries = String(series || "SERIE").trim().toUpperCase() || "SERIE";
  const safeNumber = Math.max(1, Number(number) || 1);
  return `${safeSeries}-${String(safeNumber).padStart(Math.max(3, Number(digits) || 6), "0")}`;
}

function Field({ label, hint, children }) {
  return <label className="grid gap-1.5"><span className="text-[9px] font-extrabold text-[#46554f]">{label}</span>{children}{hint ? <small className="text-[8px] leading-relaxed text-muted">{hint}</small> : null}</label>;
}

export default function DocumentDialog({ document, busy, requestError, onClose, onSave }) {
  const [values, setValues] = useState({ id: document?.id || null, name: document?.name || "", series: document?.series || "", nextNumber: document?.nextNumber || 1, digits: document?.digits || 6, active: document?.active ?? true });
  const [validation, setValidation] = useState("");
  const preview = useMemo(() => formatCorrelative(values.series, values.nextNumber, values.digits), [values.series, values.nextNumber, values.digits]);
  const set = (key, value) => { setValues((current) => ({ ...current, [key]: value })); setValidation(""); };

  useEffect(() => {
    const previous = globalThis.document.body.style.overflow; globalThis.document.body.style.overflow = "hidden";
    const escape = (event) => { if (event.key === "Escape" && !busy) onClose(); };
    globalThis.document.addEventListener("keydown", escape);
    return () => { globalThis.document.body.style.overflow = previous; globalThis.document.removeEventListener("keydown", escape); };
  }, [busy, onClose]);

  function submit(event) {
    event.preventDefault();
    if (!values.name.trim()) return setValidation("Escribe el nombre del documento.");
    if (!/^[A-Z0-9][A-Z0-9-]{0,11}$/.test(values.series)) return setValidation("La serie debe usar entre 1 y 12 letras, números o guiones.");
    if (Number(values.nextNumber) < 1) return setValidation("El próximo número debe ser mayor que cero.");
    if (Number(values.digits) < 3 || Number(values.digits) > 10) return setValidation("Selecciona entre 3 y 10 dígitos.");
    if (document && Number(values.nextNumber) < document.nextNumber) return setValidation("No puedes retroceder el correlativo actual.");
    onSave({ ...values, name: values.name.trim(), nextNumber: Number(values.nextNumber), digits: Number(values.digits) });
  }

  return <div className="fixed inset-0 z-[200] grid place-items-center bg-[rgba(2,35,27,0.56)] p-0 backdrop-blur-[2px] sm:p-5" role="dialog" aria-modal="true" aria-labelledby="document-dialog-title">
    <button type="button" className="absolute inset-0 cursor-default" aria-label="Cerrar formulario" onClick={onClose} />
    <form noValidate onSubmit={submit} className="relative flex h-full w-full flex-col overflow-hidden bg-white shadow-[0_24px_90px_rgba(1,36,27,0.26)] sm:h-auto sm:max-h-[calc(100vh-40px)] sm:max-w-[700px] sm:rounded-[12px]">
      <div className="grid h-1 shrink-0 grid-cols-[1.8fr_1fr_1fr]"><i className="bg-brand-800" /><i className="bg-[#f3bd24]" /><i className="bg-[#237db3]" /></div>
      <header className="flex shrink-0 items-start justify-between border-b border-line px-5 py-5 sm:px-7"><div><h2 id="document-dialog-title" className="m-0 font-sans text-[22px] font-bold text-brand-950">{document ? "Editar documento" : "Nuevo documento"}</h2><p className="mb-0 mt-1 text-[9px] text-muted">Configura su identificación y numeración automática</p></div><button type="button" className="grid h-9 w-9 place-items-center rounded-full text-brand-900 hover:bg-brand-50" onClick={onClose} aria-label="Cerrar"><X className="h-5 w-5" /></button></header>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-7 sm:py-6">
        <section className="border-b border-line pb-5"><div className="mb-4 flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-full bg-brand-50 text-brand-800"><FileSignature className="h-5 w-5" /></span><div><h3 className="m-0 font-sans text-[15px] font-bold text-brand-950">Identificación</h3><p className="mb-0 mt-0.5 text-[8px] text-muted">El nombre describe el documento; la serie lo diferencia.</p></div></div><div className="grid gap-4 sm:grid-cols-[1fr_180px]"><Field label="Nombre del documento"><input autoFocus maxLength="90" className={INPUT} placeholder="Ej. Constancia de estudios" value={values.name} onChange={(event) => set("name", event.target.value)} /></Field><Field label="Serie" hint="Letras, números o guiones."><input maxLength="12" className={`${INPUT} uppercase`} placeholder="CONST" value={values.series} onChange={(event) => set("series", event.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, ""))} /></Field></div></section>

        <section className="pt-5"><div className="mb-4 flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-full bg-[#eff8fd] text-[#237db3]"><Hash className="h-5 w-5" /></span><div><h3 className="m-0 font-sans text-[15px] font-bold text-brand-950">Correlativo</h3><p className="mb-0 mt-0.5 text-[8px] text-muted">El sistema avanzará este número después de cada emisión.</p></div></div><div className="grid gap-4 sm:grid-cols-2"><Field label="Próximo número" hint={document ? `No puede ser menor que ${document.nextNumber}.` : "Normalmente comienza en 1."}><input type="number" min={document?.nextNumber || 1} step="1" className={INPUT} value={values.nextNumber} onChange={(event) => set("nextNumber", event.target.value)} /></Field><Field label="Cantidad de dígitos"><select className={INPUT} value={values.digits} onChange={(event) => set("digits", Number(event.target.value))}>{[3, 4, 5, 6, 7, 8, 9, 10].map((digits) => <option key={digits} value={digits}>{digits} dígitos</option>)}</select></Field></div><div className="mt-4 overflow-hidden rounded-[8px] border border-[#f0d27b] bg-[#fffaf0]"><div className="h-1 bg-gradient-to-r from-brand-700 via-[#f3bd24] to-[#237db3]" /><div className="flex flex-wrap items-center justify-between gap-3 p-4"><div><span className="block text-[8px] font-extrabold uppercase tracking-[0.08em] text-[#7b672e]">Vista previa</span><strong className="mt-1 block font-sans text-[20px] tracking-[0.04em] text-brand-950">{preview}</strong></div><p className="m-0 max-w-[260px] text-[8px] leading-relaxed text-muted">Este será el identificador del próximo documento emitido.</p></div></div></section>

        <section className="mt-5 flex items-center justify-between rounded-[8px] bg-[#f7faf8] p-4"><div><h3 className="m-0 font-sans text-[14px] font-bold text-brand-950">Documento activo</h3><p className="mb-0 mt-1 text-[8px] text-muted">Disponible para futuras emisiones.</p></div><button type="button" role="switch" aria-checked={values.active} aria-label="Documento activo" className={`relative h-7 w-12 rounded-full transition ${values.active ? "bg-brand-700" : "bg-[#b7c3bf]"}`} onClick={() => set("active", !values.active)}><span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition ${values.active ? "left-6" : "left-1"}`} /></button></section>
        {validation || requestError ? <div className="mt-4 flex gap-2 rounded-[6px] border border-[#efb0ad] bg-[#fff6f5] p-3 text-[9px] font-semibold text-[#8f2924]" role="alert"><CircleAlert className="h-4 w-4 shrink-0" />{validation || requestError}</div> : null}
      </div>
      <footer className="flex min-h-[70px] shrink-0 items-center justify-end gap-2 border-t border-line bg-[#fbfcfb] px-5 sm:px-7"><button type="button" disabled={busy} className="min-h-10 rounded-[5px] border border-line-strong bg-white px-4 text-[10px] font-bold text-brand-900 hover:bg-brand-50" onClick={onClose}>Cancelar</button><button type="submit" disabled={busy} className="inline-flex min-h-10 items-center gap-2 rounded-[5px] bg-[#f3bd24] px-5 text-[10px] font-extrabold text-brand-950 hover:bg-[#ffd34f] disabled:opacity-50">{busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}{busy ? "Guardando…" : document ? "Guardar cambios" : "Crear documento"}</button></footer>
    </form>
  </div>;
}
