import { Building2, CircleAlert, LoaderCircle, Save, UserRoundCog, X } from "lucide-react";
import { useEffect, useState } from "react";

const INPUT = "min-h-11 w-full rounded-[6px] border border-line-strong bg-white px-3 text-[11px] font-semibold text-ink outline-none transition focus:border-[#237db3] focus:shadow-[0_0_0_3px_rgba(35,125,179,0.12)]";
const ROLE_LABELS = { direccion: "Alta Dirección", coordinador_academico: "Coordinación académica", administrativo: "Administración", docente: "Docente" };

function Field({ label, hint, children, wide = false }) {
  return <label className={`grid gap-1.5 ${wide ? "sm:col-span-2" : ""}`}><span className="text-[9px] font-extrabold text-[#46554f]">{label}</span>{children}{hint ? <small className="text-[8px] leading-relaxed text-muted">{hint}</small> : null}</label>;
}

export default function OrganizationDialog({ type, item, area, areas, people, busy, requestError, onClose, onSave }) {
  const isArea = type === "area";
  const editing = Boolean(item);
  const [values, setValues] = useState(isArea
    ? { id: item?.id || null, name: item?.name || "", description: item?.description || "", responsibleId: item?.responsibleId || "", active: item?.active ?? true }
    : { id: item?.id || null, areaId: item?.areaId || area?.id || "", name: item?.name || "", description: item?.description || "", profileId: item?.profileId || "", active: item?.active ?? true });
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
    if (!values.name.trim()) return setValidation(isArea ? "Escribe el nombre del área." : "Escribe el nombre del cargo.");
    if (!isArea && !values.areaId) return setValidation("Selecciona el área a la que pertenece el cargo.");
    onSave({ ...values, name: values.name.trim(), description: values.description.trim(), areaId: values.areaId ? Number(values.areaId) : undefined });
  }

  const title = isArea ? (editing ? "Editar área" : "Nueva área") : (editing ? "Editar cargo" : "Nuevo cargo");
  return <div className="fixed inset-0 z-[200] grid place-items-center bg-[rgba(2,35,27,0.56)] p-0 backdrop-blur-[2px] sm:p-5" role="dialog" aria-modal="true" aria-labelledby="organization-dialog-title">
    <button type="button" className="absolute inset-0 cursor-default" aria-label="Cerrar formulario" onClick={onClose} />
    <form noValidate onSubmit={submit} className="relative flex h-full w-full flex-col overflow-hidden bg-white shadow-[0_24px_90px_rgba(1,36,27,0.26)] sm:h-auto sm:max-h-[calc(100vh-40px)] sm:max-w-[700px] sm:rounded-[12px]">
      <div className="grid h-1 shrink-0 grid-cols-[1.8fr_1fr_1fr]"><i className="bg-brand-800" /><i className="bg-[#f3bd24]" /><i className="bg-[#237db3]" /></div>
      <header className="flex shrink-0 items-start justify-between border-b border-line px-5 py-5 sm:px-7"><div><h2 id="organization-dialog-title" className="m-0 font-sans text-[22px] font-bold text-brand-950">{title}</h2><p className="mb-0 mt-1 text-[9px] text-muted">{isArea ? "Organiza una unidad interna y define quién la coordina" : `Registra una función dentro de ${area?.name || "la institución"}`}</p></div><button type="button" className="grid h-9 w-9 place-items-center rounded-full text-brand-900 hover:bg-brand-50" onClick={onClose} aria-label="Cerrar"><X className="h-5 w-5" /></button></header>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-7 sm:py-6">
        <section className="mb-5 flex items-center gap-3 rounded-[8px] border border-[#b7d7ea] bg-[#f3f9fc] p-4"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white text-[#237db3]">{isArea ? <Building2 className="h-5 w-5" /> : <UserRoundCog className="h-5 w-5" />}</span><div><strong className="block text-[10px] text-brand-950">{isArea ? "Área institucional" : "Cargo institucional"}</strong><span className="text-[9px] text-muted">Esto describe la organización; no cambia los permisos de acceso al portal.</span></div></section>

        <div className="grid gap-4 sm:grid-cols-2">
          {!isArea ? <Field label="Área"><select className={INPUT} value={values.areaId} onChange={(event) => set("areaId", event.target.value)}><option value="">Seleccionar área</option>{areas.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}</select></Field> : null}
          <Field label={isArea ? "Nombre del área" : "Nombre del cargo"} wide={isArea}><input autoFocus maxLength="80" className={INPUT} placeholder={isArea ? "Ej. Dirección académica" : "Ej. Coordinador de Primaria"} value={values.name} onChange={(event) => set("name", event.target.value)} /></Field>
          <Field label={isArea ? "Responsable · opcional" : "Persona asignada · opcional"} hint={isArea ? "Puede quedar pendiente y asignarse más adelante." : "Déjalo vacante si aún no se ha designado a una persona."} wide={isArea}>
            <select className={INPUT} value={isArea ? values.responsibleId : values.profileId} onChange={(event) => set(isArea ? "responsibleId" : "profileId", event.target.value)}><option value="">{isArea ? "Sin responsable" : "Cargo vacante"}</option>{people.map((person) => <option key={person.id} value={person.id}>{person.name} · {ROLE_LABELS[person.role] || person.role}</option>)}</select>
          </Field>
          <Field label="Descripción breve · opcional" wide><textarea maxLength={isArea ? 240 : 200} rows="3" className={`${INPUT} resize-none py-3`} placeholder="Resume su función principal" value={values.description} onChange={(event) => set("description", event.target.value)} /></Field>
        </div>

        <section className="mt-5 flex items-center justify-between rounded-[8px] bg-[#f7faf8] p-4"><div><h3 className="m-0 font-sans text-[14px] font-bold text-brand-950">Registro activo</h3><p className="mb-0 mt-1 text-[8px] text-muted">Se mostrará dentro de la estructura vigente.</p></div><button type="button" role="switch" aria-checked={values.active} className={`relative h-7 w-12 rounded-full transition ${values.active ? "bg-brand-700" : "bg-[#b7c3bf]"}`} onClick={() => set("active", !values.active)}><span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition ${values.active ? "left-6" : "left-1"}`} /></button></section>
        {validation || requestError ? <div className="mt-4 flex gap-2 rounded-[6px] border border-[#efb0ad] bg-[#fff6f5] p-3 text-[9px] font-semibold text-[#8f2924]" role="alert"><CircleAlert className="h-4 w-4 shrink-0" />{validation || requestError}</div> : null}
      </div>

      <footer className="flex min-h-[70px] shrink-0 items-center justify-end gap-2 border-t border-line bg-[#fbfcfb] px-5 sm:px-7"><button type="button" disabled={busy} className="min-h-10 rounded-[5px] border border-line-strong bg-white px-4 text-[10px] font-bold text-brand-900 hover:bg-brand-50" onClick={onClose}>Cancelar</button><button type="submit" disabled={busy} className="inline-flex min-h-10 items-center gap-2 rounded-[5px] bg-[#f3bd24] px-5 text-[10px] font-extrabold text-brand-950 hover:bg-[#ffd34f] disabled:opacity-50">{busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}{busy ? "Guardando…" : editing ? "Guardar cambios" : isArea ? "Crear área" : "Crear cargo"}</button></footer>
    </form>
  </div>;
}
