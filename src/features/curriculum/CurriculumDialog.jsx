import { BookOpen, CircleAlert, FolderOpen, LoaderCircle, Save, X } from "lucide-react";
import { useEffect, useState } from "react";

const INPUT = "min-h-11 w-full rounded-[6px] border border-line-strong bg-white px-3 text-[11px] font-semibold text-ink outline-none transition focus:border-[#237db3] focus:shadow-[0_0_0_3px_rgba(35,125,179,0.12)]";

function Field({ label, hint, children }) {
  return <label className="grid gap-1.5"><span className="text-[9px] font-extrabold text-[#46554f]">{label}</span>{children}{hint ? <small className="text-[8px] text-muted">{hint}</small> : null}</label>;
}

export default function CurriculumDialog({ initialMode, area, course, areas, context, busy, requestError, onClose, onSaveArea, onSaveCourse }) {
  const lockedMode = Boolean(area || course);
  const [mode, setMode] = useState(course ? "course" : area ? "area" : initialMode);
  const [values, setValues] = useState({ id: course?.id || area?.id || null, name: course?.name || area?.name || "", areaId: course?.areaId || areas.find((item) => item.active)?.id || "", weeklyHours: course?.weeklyHours || 4, active: course?.active ?? area?.active ?? true });
  const [validation, setValidation] = useState("");
  const set = (key, value) => { setValues((current) => ({ ...current, [key]: value })); setValidation(""); };

  useEffect(() => {
    function closeOnEscape(event) { if (event.key === "Escape" && !busy) onClose(); }
    document.addEventListener("keydown", closeOnEscape);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", closeOnEscape); document.body.style.overflow = previousOverflow; };
  }, [busy, onClose]);

  function changeMode(nextMode) {
    if (lockedMode || nextMode === mode) return;
    setMode(nextMode); setValidation("");
    setValues({ id: null, name: "", areaId: areas.find((item) => item.active)?.id || "", weeklyHours: 4, active: true });
  }

  function submit(event) {
    event.preventDefault();
    if (busy) return;
    if (!values.name.trim()) return setValidation(mode === "area" ? "Escribe el nombre del área curricular." : "Escribe el nombre del curso.");
    if (mode === "course") {
      if (!context.yearId || !context.gradeId) return setValidation("Selecciona un año y un grado antes de agregar el curso.");
      const hours = Number(values.weeklyHours);
      if (!Number.isInteger(hours) || hours < 1 || hours > 40) return setValidation("Las horas semanales deben estar entre 1 y 40.");
      return onSaveCourse({ ...values, name: values.name.trim(), areaId: values.areaId ? Number(values.areaId) : null, weeklyHours: hours, yearId: Number(context.yearId), gradeId: Number(context.gradeId) });
    }
    onSaveArea({ id: values.id, name: values.name.trim(), active: values.active });
  }

  return <div className="fixed inset-0 z-[200] grid place-items-center bg-[rgba(2,35,27,0.56)] p-0 backdrop-blur-[2px] sm:p-5" role="dialog" aria-modal="true" aria-labelledby="curriculum-dialog-title">
    <button type="button" className="absolute inset-0 cursor-default" aria-label="Cerrar formulario" onClick={onClose} />
    <form noValidate onSubmit={submit} className="relative flex h-full w-full flex-col overflow-hidden bg-white shadow-[0_24px_90px_rgba(1,36,27,0.26)] sm:h-auto sm:max-h-[calc(100vh-40px)] sm:max-w-[680px] sm:rounded-[12px]">
      <div className="grid h-1 shrink-0 grid-cols-[1.8fr_1fr_1fr]"><i className="bg-brand-800" /><i className="bg-[#f3bd24]" /><i className="bg-[#237db3]" /></div>
      <header className="flex items-start justify-between border-b border-line px-5 py-4 sm:px-7 sm:py-5"><div><h2 id="curriculum-dialog-title" className="m-0 font-sans text-[22px] font-bold leading-tight text-brand-950">{area ? "Editar área curricular" : course ? "Editar curso" : "Agregar contenido"}</h2><p className="mb-0 mt-1 text-[9px] text-muted">Organiza el plan de estudios sin repetir la estructura académica.</p></div><button type="button" className="grid h-9 w-9 place-items-center rounded-full text-brand-900 hover:bg-brand-50" onClick={onClose} aria-label="Cerrar"><X className="h-5 w-5" /></button></header>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-7 sm:py-6">
        {!lockedMode ? <div className="mb-6 grid gap-3 sm:grid-cols-2"><button type="button" aria-pressed={mode === "area"} className={`flex min-h-[84px] items-center gap-3 rounded-[8px] border p-4 text-left transition ${mode === "area" ? "border-brand-700 bg-brand-50 shadow-[inset_0_-2px_0_#08785b]" : "border-line-strong hover:border-brand-700"}`} onClick={() => changeMode("area")}><span className="grid h-10 w-10 place-items-center rounded-full bg-white text-brand-800"><FolderOpen className="h-5 w-5" /></span><span><strong className="block font-sans text-[14px] text-brand-950">Área curricular</strong><small className="text-[8px] text-muted">Crear una agrupación opcional.</small></span></button><button type="button" aria-pressed={mode === "course"} className={`flex min-h-[84px] items-center gap-3 rounded-[8px] border p-4 text-left transition ${mode === "course" ? "border-[#237db3] bg-[#eff8fd] shadow-[inset_0_-2px_0_#237db3]" : "border-line-strong hover:border-[#237db3]"}`} onClick={() => changeMode("course")}><span className="grid h-10 w-10 place-items-center rounded-full bg-white text-[#237db3]"><BookOpen className="h-5 w-5" /></span><span><strong className="block font-sans text-[14px] text-brand-950">Curso para este grado</strong><small className="text-[8px] text-muted">Directo o dentro de un área.</small></span></button></div> : null}

        {mode === "course" ? <><section className="mb-5 rounded-[8px] border border-[#b7d7ea] bg-[#f3f9fc] p-4"><span className="text-[8px] font-extrabold uppercase tracking-[0.08em] text-[#176d9f]">Contexto seleccionado</span><strong className="mt-1 block font-sans text-[14px] text-brand-950">{context.yearName} · {context.levelName} · {context.gradeName}</strong></section><section className="grid gap-4"><div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-full bg-[#eff8fd] text-[#237db3]"><BookOpen className="h-5 w-5" /></span><div><h3 className="m-0 font-sans text-[15px] font-bold text-brand-950">Curso del grado</h3><p className="mb-0 mt-0.5 text-[8px] text-muted">Se distribuirá automáticamente a todos sus salones.</p></div></div><Field label="Organización del curso" hint="Puedes dejarlo como curso directo o agruparlo dentro de un área."><select className={INPUT} value={values.areaId} onChange={(event) => set("areaId", event.target.value)}><option value="">Sin área · curso directo</option>{areas.filter((item) => item.active || String(item.id) === String(values.areaId)).map((item) => <option key={item.id} value={item.id}>Dentro de {item.name}</option>)}</select></Field><div className="grid gap-4 sm:grid-cols-[1fr_150px]"><Field label="Nombre del curso"><input autoFocus maxLength="100" className={INPUT} value={values.name} onChange={(event) => set("name", event.target.value)} placeholder="Ej. Comunicación" /></Field><Field label="Horas semanales"><input type="number" min="1" max="40" inputMode="numeric" className={INPUT} value={values.weeklyHours} onChange={(event) => set("weeklyHours", event.target.value)} /></Field></div></section></> : <section className="grid gap-5"><div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-full bg-brand-50 text-brand-800"><FolderOpen className="h-5 w-5" /></span><div><h3 className="m-0 font-sans text-[15px] font-bold text-brand-950">Área curricular</h3><p className="mb-0 mt-0.5 text-[8px] text-muted">Una misma área podrá organizar cursos de distintos grados.</p></div></div><Field label="Nombre del área"><input autoFocus maxLength="80" className={INPUT} value={values.name} onChange={(event) => set("name", event.target.value)} placeholder="Ej. Comunicación" /></Field></section>}

        <section className="mt-5 flex items-center justify-between rounded-[8px] bg-[#f7faf8] p-4"><div><h3 className="m-0 font-sans text-[14px] font-bold text-brand-950">{mode === "area" ? "Área activa" : "Curso activo"}</h3><p className="mb-0 mt-1 text-[8px] text-muted">Disponible para la gestión académica.</p></div><button type="button" role="switch" aria-checked={values.active} aria-label={mode === "area" ? "Área activa" : "Curso activo"} className={`relative h-7 w-12 rounded-full transition ${values.active ? "bg-brand-700" : "bg-[#b7c3bf]"}`} onClick={() => set("active", !values.active)}><span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition ${values.active ? "left-6" : "left-1"}`} /></button></section>
        {validation || requestError ? <div className="mt-4 flex items-start gap-2 rounded-[6px] border border-[#efb0ad] bg-[#fff6f5] p-3 text-[9px] font-semibold text-[#8f2924]" role="alert"><CircleAlert className="h-4 w-4 shrink-0" />{validation || requestError}</div> : null}
      </div>

      <footer className="flex min-h-[70px] shrink-0 items-center justify-end gap-2 border-t border-line bg-[#fbfcfb] px-5 sm:px-7"><button type="button" disabled={busy} className="min-h-10 rounded-[5px] border border-line-strong bg-white px-4 text-[10px] font-bold text-brand-900 hover:bg-brand-50" onClick={onClose}>Cancelar</button><button type="submit" disabled={busy} className="inline-flex min-h-10 items-center gap-2 rounded-[5px] bg-[#f3bd24] px-5 text-[10px] font-extrabold text-brand-950 hover:bg-[#ffd34f] disabled:opacity-50">{busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}{busy ? "Guardando…" : mode === "area" ? area ? "Guardar cambios" : "Guardar área" : course ? "Guardar cambios" : "Agregar curso"}</button></footer>
    </form>
  </div>;
}
