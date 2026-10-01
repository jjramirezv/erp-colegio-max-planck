import { useState } from "react";
import { BellRing, Check, LoaderCircle, Send, X } from "lucide-react";

export const AUDIENCES = [["estudiante", "Estudiantes"], ["familia", "Familias"], ["docente", "Docentes"]];
const INPUT = "min-h-11 w-full rounded-[8px] border border-line-strong bg-white px-3 text-[14px] text-ink outline-none focus:border-brand-800 focus:ring-2 focus:ring-brand-100";
const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Lima" }).format(new Date());
const plusDays = (date, days) => { const next = new Date(`${date}T12:00:00Z`); next.setUTCDate(next.getUTCDate() + days); return next.toISOString().slice(0, 10); };

// Formulario único para Dirección, Coordinación y docentes. sections: [{ id, label }].
export default function AnnouncementEditor({ announcement, manager, sections, busy, error, onClose, onSave }) {
  const start = today();
  const [values, setValues] = useState(() => ({
    id: announcement?.id || null,
    title: announcement?.title || "",
    body: announcement?.body || "",
    audience: announcement?.audience || (manager ? ["estudiante", "familia"] : ["estudiante", "familia"]),
    scope: announcement?.sectionId || !manager ? "section" : "school",
    sectionId: String(announcement?.sectionId || (!manager ? sections[0]?.id || "" : "")),
    featured: Boolean(announcement?.featured),
    featuredFrom: announcement?.featuredFrom || start,
    featuredTo: announcement?.featuredTo || plusDays(start, 3),
  }));
  const [localError, setLocalError] = useState("");
  const set = (patch) => { setValues((current) => ({ ...current, ...patch })); setLocalError(""); };
  const options = manager ? AUDIENCES : AUDIENCES.slice(0, 2);
  const toggle = (value) => set({ audience: values.audience.includes(value) ? values.audience.filter((item) => item !== value) : [...values.audience, value] });

  function submit(publish) {
    if (!values.title.trim()) return setLocalError("Escribe un título corto.");
    if (!values.body.trim()) return setLocalError("Escribe el mensaje.");
    if (!values.audience.length) return setLocalError("Elige para quién es el comunicado.");
    if (values.scope === "section" && !values.sectionId) return setLocalError("Elige el salón.");
    if (values.featured && (!values.featuredFrom || !values.featuredTo || values.featuredTo < values.featuredFrom)) return setLocalError("Revisa las fechas del aviso.");
    onSave({ ...values, title: values.title.trim(), body: values.body.trim(), sectionId: values.scope === "section" ? values.sectionId : null, featured: manager && values.featured, publish });
  }

  return <div className="fixed inset-0 z-[90] grid place-items-center bg-[#082c24]/60 p-3 sm:p-6" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onClose(); }}>
    <section role="dialog" aria-label={announcement ? "Editar comunicado" : "Nuevo comunicado"} className="flex max-h-[94vh] w-full max-w-[720px] flex-col overflow-hidden rounded-[14px] bg-white shadow-[0_28px_90px_rgba(4,39,30,.3)]">
      <header className="flex items-start justify-between gap-4 border-b border-line px-5 py-4 sm:px-6">
        <div><h2 className="m-0 text-[22px] font-extrabold tracking-[-0.03em] text-brand-950">{announcement ? "Editar comunicado" : "Nuevo comunicado"}</h2><p className="m-0 mt-1 text-[13px] text-muted">{manager ? "Llega a toda la comunidad o a un salón." : "Llega a los estudiantes y familias de tu salón."}</p></div>
        <button type="button" aria-label="Cerrar" className="grid h-10 w-10 place-items-center rounded-full text-muted hover:bg-canvas" onClick={onClose} disabled={busy}><X size={20} /></button>
      </header>
      <div className="grid gap-5 overflow-y-auto px-5 py-5 sm:px-6">
        <label className="grid gap-2 text-[13px] font-bold text-[#33423d]">Título<input className={INPUT} maxLength={160} placeholder="Ej. No habrá clases el lunes 28" value={values.title} onChange={(event) => set({ title: event.target.value })} /></label>
        <label className="grid gap-2 text-[13px] font-bold text-[#33423d]">Mensaje<textarea className={`${INPUT} min-h-32 resize-y py-3`} maxLength={10000} placeholder="Escribe el aviso de forma clara y breve." value={values.body} onChange={(event) => set({ body: event.target.value })} /></label>
        <fieldset className="m-0 grid gap-2 border-0 p-0"><legend className="mb-2 text-[13px] font-bold text-[#33423d]">¿Para quién?</legend>
          <div className="flex flex-wrap gap-2">{options.map(([value, label]) => { const active = values.audience.includes(value); return <button key={value} type="button" aria-pressed={active} onClick={() => toggle(value)} className={`inline-flex min-h-10 items-center gap-2 rounded-full border px-4 text-[13px] font-bold ${active ? "border-brand-900 bg-brand-900 text-white" : "border-line-strong bg-white text-[#42524c]"}`}>{active ? <Check size={15} /> : null}{label}</button>; })}</div>
        </fieldset>
        <fieldset className="m-0 grid gap-2 border-0 p-0"><legend className="mb-2 text-[13px] font-bold text-[#33423d]">¿Dónde?</legend>
          {manager ? <div className="flex flex-wrap gap-2">{[["school", "Todo el colegio"], ["section", "Un salón"]].map(([value, label]) => <button key={value} type="button" aria-pressed={values.scope === value} onClick={() => set({ scope: value })} className={`min-h-10 rounded-full border px-4 text-[13px] font-bold ${values.scope === value ? "border-brand-900 bg-brand-50 text-brand-900" : "border-line-strong bg-white text-[#42524c]"}`}>{label}</button>)}</div> : null}
          {values.scope === "section" ? <select aria-label="Salón" className={INPUT} value={values.sectionId} onChange={(event) => set({ sectionId: event.target.value })}><option value="">Elige un salón</option>{sections.map((section) => <option key={section.id} value={section.id}>{section.label}</option>)}</select> : null}
        </fieldset>
        {manager ? <section className={`grid gap-3 rounded-[12px] border p-4 ${values.featured ? "border-[#f0c24b] bg-[#fffaf0]" : "border-line"}`}>
          <label className="flex cursor-pointer items-start gap-3"><input type="checkbox" className="mt-1 h-4 w-4 accent-[#047857]" checked={values.featured} onChange={(event) => set({ featured: event.target.checked })} /><span><strong className="flex items-center gap-2 text-[14px] text-brand-950"><BellRing size={16} className="text-[#b07c00]" />Mostrar como aviso al ingresar</strong><small className="text-[12px] text-muted">Aparece en una ventana cuando el estudiante, la familia o el docente entra al portal, hasta que pulse “Entendido”.</small></span></label>
          {values.featured ? <>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="grid gap-1 text-[12px] font-bold text-[#33423d]">Desde<input type="date" className={INPUT} value={values.featuredFrom} onChange={(event) => set({ featuredFrom: event.target.value })} /></label>
              <label className="grid gap-1 text-[12px] font-bold text-[#33423d]">Hasta<input type="date" className={INPUT} min={values.featuredFrom} value={values.featuredTo} onChange={(event) => set({ featuredTo: event.target.value })} /></label>
            </div>
            <div aria-label="Vista previa del aviso" className="rounded-[12px] border border-line bg-white p-4 shadow-sm"><small className="text-[11px] font-extrabold uppercase tracking-[0.06em] text-[#b07c00]">Vista previa</small><strong className="mt-1 block text-[16px] text-brand-950">{values.title || "Título del aviso"}</strong><p className="m-0 mt-1 line-clamp-3 whitespace-pre-wrap text-[13px] text-[#42524c]">{values.body || "Aquí se mostrará tu mensaje."}</p></div>
          </> : null}
        </section> : null}
        {localError || error ? <div role="alert" className="rounded-[8px] border border-[#efb0ad] bg-[#fff6f5] px-4 py-3 text-[13px] font-semibold text-[#8f2924]">{localError || error}</div> : null}
      </div>
      <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-line bg-canvas px-5 py-4 sm:px-6">
        <button type="button" className="min-h-11 px-3 text-[13px] font-bold text-muted" onClick={onClose} disabled={busy}>Cancelar</button>
        {!announcement?.published ? <button type="button" disabled={busy} onClick={() => submit(false)} className="min-h-11 rounded-[8px] border border-line-strong bg-white px-4 text-[13px] font-bold text-brand-900 hover:bg-brand-50">Guardar borrador</button> : null}
        <button type="button" disabled={busy} onClick={() => submit(true)} className="inline-flex min-h-11 items-center gap-2 rounded-[8px] bg-brand-900 px-5 text-[13px] font-bold text-white hover:bg-brand-800 disabled:opacity-50">{busy ? <LoaderCircle size={16} className="animate-spin" /> : <Send size={16} />}{announcement?.published ? "Guardar cambios" : "Publicar"}</button>
      </footer>
    </section>
  </div>;
}
