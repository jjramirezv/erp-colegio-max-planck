import { BookOpenCheck, CircleAlert, FileText, HandCoins, LoaderCircle, Save, Shapes, X } from "lucide-react";
import { useEffect, useState } from "react";

const INPUT = "min-h-11 w-full rounded-[6px] border border-line-strong bg-white px-3 text-[11px] font-semibold text-ink outline-none transition focus:border-[#237db3] focus:shadow-[0_0_0_3px_rgba(35,125,179,0.12)]";
const CATEGORIES = [
  { id: "academico", label: "Académico", description: "Matrícula, traslado o recuperación", icon: BookOpenCheck, colors: "border-[#a9d6c5] bg-[#f1faf6] text-brand-800" },
  { id: "financiero", label: "Financiero", description: "Pensión, mora u otro cobro", icon: HandCoins, colors: "border-[#f0d27b] bg-[#fff8df] text-[#946c00]" },
  { id: "documentario", label: "Documentario", description: "Constancia, certificado o duplicado", icon: FileText, colors: "border-[#acd2e8] bg-[#eff8fd] text-[#176d9f]" },
  { id: "servicio", label: "Servicio", description: "Movilidad, comedor o taller", icon: Shapes, colors: "border-[#c8c3e8] bg-[#f5f3ff] text-[#51489a]" },
];

export default function InstitutionalConceptDialog({ concept, busy, requestError, onClose, onSave }) {
  const [values, setValues] = useState({ id: concept?.id || null, name: concept?.name || "", category: concept?.category || "academico", description: concept?.description || "", active: concept?.active ?? true });
  const [validation, setValidation] = useState("");
  const set = (key, value) => { setValues((current) => ({ ...current, [key]: value })); setValidation(""); };

  useEffect(() => {
    const previous = document.body.style.overflow; document.body.style.overflow = "hidden";
    const escape = (event) => { if (event.key === "Escape" && !busy) onClose(); };
    document.addEventListener("keydown", escape);
    return () => { document.body.style.overflow = previous; document.removeEventListener("keydown", escape); };
  }, [busy, onClose]);

  function submit(event) {
    event.preventDefault();
    if (!values.name.trim()) return setValidation("Escribe el nombre del concepto.");
    onSave({ ...values, name: values.name.trim(), description: values.description.trim() });
  }

  return <div className="fixed inset-0 z-[200] grid place-items-center bg-[rgba(2,35,27,0.56)] p-0 backdrop-blur-[2px] sm:p-5" role="dialog" aria-modal="true" aria-labelledby="concept-dialog-title">
    <button type="button" className="absolute inset-0 cursor-default" aria-label="Cerrar formulario" onClick={onClose} />
    <form noValidate onSubmit={submit} className="relative flex h-full w-full flex-col overflow-hidden bg-white shadow-[0_24px_90px_rgba(1,36,27,0.26)] sm:h-auto sm:max-h-[calc(100vh-40px)] sm:max-w-[720px] sm:rounded-[12px]">
      <div className="grid h-1 shrink-0 grid-cols-[1.8fr_1fr_1fr]"><i className="bg-brand-800" /><i className="bg-[#f3bd24]" /><i className="bg-[#237db3]" /></div>
      <header className="flex shrink-0 items-start justify-between border-b border-line px-5 py-5 sm:px-7"><div><h2 id="concept-dialog-title" className="m-0 font-sans text-[22px] font-bold text-brand-950">{concept ? "Editar concepto" : "Nuevo concepto"}</h2><p className="mb-0 mt-1 text-[9px] text-muted">Crea una denominación que podrá reutilizarse en otros módulos</p></div><button type="button" className="grid h-9 w-9 place-items-center rounded-full text-brand-900 hover:bg-brand-50" onClick={onClose} aria-label="Cerrar"><X className="h-5 w-5" /></button></header>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-7 sm:py-6">
        <section className="border-b border-line pb-5"><h3 className="mb-1 mt-0 font-sans text-[15px] font-bold text-brand-950">1. Identificación</h3><p className="mb-4 mt-0 text-[8px] text-muted">Usa un nombre breve y reconocible para el personal.</p><label className="grid gap-1.5"><span className="text-[9px] font-extrabold text-[#46554f]">Nombre del concepto</span><input autoFocus maxLength="90" className={INPUT} placeholder="Ej. Constancia de estudios" value={values.name} onChange={(event) => set("name", event.target.value)} /></label></section>

        <section className="border-b border-line py-5"><h3 className="mb-1 mt-0 font-sans text-[15px] font-bold text-brand-950">2. Categoría</h3><p className="mb-4 mt-0 text-[8px] text-muted">Indica en qué tipo de proceso se utilizará.</p><div className="grid gap-2 sm:grid-cols-2">{CATEGORIES.map((category) => { const Icon = category.icon; const selected = values.category === category.id; return <button key={category.id} type="button" aria-pressed={selected} className={`flex min-h-[70px] items-center gap-3 rounded-[7px] border p-3 text-left transition ${selected ? `${category.colors} shadow-[inset_0_-2px_0_currentColor]` : "border-line-strong bg-white text-[#4f5d58] hover:border-[#9cc8df]"}`} onClick={() => set("category", category.id)}><Icon className="h-5 w-5 shrink-0" /><span><strong className="block text-[10px]">{category.label}</strong><small className="mt-0.5 block text-[8px] leading-relaxed opacity-75">{category.description}</small></span></button>; })}</div></section>

        <section className="pt-5"><h3 className="mb-1 mt-0 font-sans text-[15px] font-bold text-brand-950">3. Detalle</h3><p className="mb-4 mt-0 text-[8px] text-muted">La descripción es opcional y solo sirve como referencia interna.</p><label className="grid gap-1.5"><span className="text-[9px] font-extrabold text-[#46554f]">Descripción breve · opcional</span><textarea maxLength="240" rows="3" className={`${INPUT} resize-none py-3`} placeholder="Explica cuándo debe utilizarse" value={values.description} onChange={(event) => set("description", event.target.value)} /></label><div className="mt-4 flex items-center justify-between rounded-[8px] bg-[#f7faf8] p-4"><div><h4 className="m-0 font-sans text-[14px] font-bold text-brand-950">Concepto activo</h4><p className="mb-0 mt-1 text-[8px] text-muted">Estará disponible para futuras operaciones.</p></div><button type="button" role="switch" aria-checked={values.active} aria-label="Concepto activo" className={`relative h-7 w-12 rounded-full transition ${values.active ? "bg-brand-700" : "bg-[#b7c3bf]"}`} onClick={() => set("active", !values.active)}><span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition ${values.active ? "left-6" : "left-1"}`} /></button></div></section>

        {validation || requestError ? <div className="mt-4 flex gap-2 rounded-[6px] border border-[#efb0ad] bg-[#fff6f5] p-3 text-[9px] font-semibold text-[#8f2924]" role="alert"><CircleAlert className="h-4 w-4 shrink-0" />{validation || requestError}</div> : null}
      </div>
      <footer className="flex min-h-[70px] shrink-0 items-center justify-end gap-2 border-t border-line bg-[#fbfcfb] px-5 sm:px-7"><button type="button" disabled={busy} className="min-h-10 rounded-[5px] border border-line-strong bg-white px-4 text-[10px] font-bold text-brand-900 hover:bg-brand-50" onClick={onClose}>Cancelar</button><button type="submit" disabled={busy} className="inline-flex min-h-10 items-center gap-2 rounded-[5px] bg-[#f3bd24] px-5 text-[10px] font-extrabold text-brand-950 hover:bg-[#ffd34f] disabled:opacity-50">{busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}{busy ? "Guardando…" : concept ? "Guardar cambios" : "Crear concepto"}</button></footer>
    </form>
  </div>;
}
