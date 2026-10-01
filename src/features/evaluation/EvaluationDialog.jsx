import { Calculator, Check, CircleAlert, GraduationCap, ListChecks, LoaderCircle, Plus, Save, Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";

const INPUT = "min-h-11 w-full rounded-[6px] border border-line-strong bg-white px-3 text-[11px] font-semibold text-ink outline-none transition focus:border-[#237db3] focus:shadow-[0_0_0_3px_rgba(35,125,179,0.12)]";
const DEFAULT_LEVELS = [
  { code: "AD", name: "Logro destacado", satisfactory: true },
  { code: "A", name: "Logro esperado", satisfactory: true },
  { code: "B", name: "En proceso", satisfactory: false },
  { code: "C", name: "En inicio", satisfactory: false },
];

function initialValues(year, level, configuration) {
  return {
    yearId: year.id,
    levelId: level.id,
    scaleType: configuration?.scaleType || "cualitativa",
    finalCalculation: configuration?.finalCalculation || "ultimo_logro",
    minimum: configuration?.minimum ?? 0,
    maximum: configuration?.maximum ?? 20,
    passing: configuration?.passing ?? 11,
    decimals: configuration?.decimals ?? 0,
    achievementLevels: configuration?.achievementLevels?.length
      ? configuration.achievementLevels.map(({ code, name, satisfactory }) => ({ code, name, satisfactory }))
      : DEFAULT_LEVELS.map((item) => ({ ...item })),
  };
}

function Choice({ selected, icon: Icon, title, detail, tone, onClick }) {
  return <button type="button" aria-pressed={selected} className={`flex min-h-[82px] items-center gap-3 rounded-[8px] border p-3.5 text-left transition ${selected ? "border-[#237db3] bg-[#f1f8fc] shadow-[0_0_0_2px_rgba(35,125,179,0.08)]" : "border-line-strong bg-white hover:border-[#9fc8de]"}`} onClick={onClick}><span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white" style={{ color: tone }}><Icon className="h-5 w-5" /></span><span className="min-w-0 flex-1"><strong className="block text-[10px] text-brand-950">{title}</strong><small className="mt-0.5 block text-[8px] leading-relaxed text-muted">{detail}</small></span><span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border-2 ${selected ? "border-[#237db3] text-[#237db3]" : "border-[#cdd8d4]"}`}>{selected ? <Check className="h-3 w-3" strokeWidth={3} /> : null}</span></button>;
}

export default function EvaluationDialog({ year, level, configuration, busy, requestError, onClose, onSave }) {
  const [step, setStep] = useState(1);
  const [values, setValues] = useState(() => initialValues(year, level, configuration));
  const [validation, setValidation] = useState("");
  const set = (key, value) => { setValues((current) => ({ ...current, [key]: value })); setValidation(""); };

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

  function selectScale(scaleType) {
    setValues((current) => ({ ...current, scaleType, finalCalculation: scaleType === "cualitativa" ? "ultimo_logro" : "promedio_periodos" }));
    setValidation("");
  }

  function setAchievement(index, key, value) {
    setValues((current) => ({ ...current, achievementLevels: current.achievementLevels.map((item, position) => position === index ? { ...item, [key]: value } : item) }));
    setValidation("");
  }

  function addAchievement() {
    if (values.achievementLevels.length >= 8) return;
    set("achievementLevels", [...values.achievementLevels, { code: "", name: "", satisfactory: false }]);
  }

  function removeAchievement(index) {
    if (values.achievementLevels.length <= 2) return setValidation("La escala cualitativa necesita al menos dos niveles de logro.");
    set("achievementLevels", values.achievementLevels.filter((_, position) => position !== index));
  }

  function validateRules() {
    if (values.scaleType === "numerica") {
      const minimum = Number(values.minimum);
      const maximum = Number(values.maximum);
      const passing = Number(values.passing);
      if (![minimum, maximum, passing].every(Number.isFinite)) return "Completa todos los valores de la escala numérica.";
      if (maximum <= minimum) return "El valor máximo debe ser mayor que el mínimo.";
      if (passing < minimum || passing > maximum) return "La nota aprobatoria debe estar dentro de la escala.";
      return "";
    }
    if (values.achievementLevels.length < 2) return "Configura al menos dos niveles de logro.";
    const codes = new Set();
    for (const item of values.achievementLevels) {
      if (!item.code.trim() || !item.name.trim()) return "Completa el código y nombre de todos los niveles de logro.";
      const code = item.code.trim().toLocaleUpperCase("es-PE");
      if (codes.has(code)) return "Los códigos de logro no pueden repetirse.";
      codes.add(code);
    }
    return "";
  }

  function submit(event) {
    event.preventDefault();
    if (busy) return;
    if (step === 1) { setStep(2); setValidation(""); return; }
    const message = validateRules();
    if (message) return setValidation(message);
    onSave({ ...values, achievementLevels: values.achievementLevels.map((item) => ({ ...item, code: item.code.trim().toLocaleUpperCase("es-PE"), name: item.name.trim() })) });
  }

  return <div className="fixed inset-0 z-[200] grid place-items-center bg-[rgba(2,35,27,0.56)] p-0 backdrop-blur-[2px] sm:p-5" role="dialog" aria-modal="true" aria-labelledby="evaluation-dialog-title">
    <button type="button" className="absolute inset-0 cursor-default" aria-label="Cerrar formulario" onClick={onClose} />
    <form noValidate onSubmit={submit} className="relative flex h-full w-full flex-col overflow-hidden bg-white shadow-[0_24px_90px_rgba(1,36,27,0.26)] sm:max-h-[calc(100vh-40px)] sm:max-w-[760px] sm:rounded-[12px]">
      <div className="grid h-1 shrink-0 grid-cols-[1.8fr_1fr_1fr]"><i className="bg-brand-800" /><i className="bg-[#f3bd24]" /><i className="bg-[#237db3]" /></div>
      <header className="flex shrink-0 items-start justify-between border-b border-line px-5 py-4 sm:px-7 sm:py-5"><div><h2 id="evaluation-dialog-title" className="m-0 font-sans text-[22px] font-bold leading-tight text-brand-950">{configuration ? "Editar evaluación" : "Configurar evaluación"}</h2><p className="mb-0 mt-1 text-[9px] text-muted">{year.name} · {level.name}</p></div><button type="button" className="grid h-9 w-9 place-items-center rounded-full text-brand-900 hover:bg-brand-50" onClick={onClose} aria-label="Cerrar"><X className="h-5 w-5" /></button></header>

      <div className="shrink-0 border-b border-line bg-[#fbfcfb] px-5 py-4 sm:px-7"><div className="mx-auto flex max-w-[430px] items-start"><div className="grid flex-1 justify-items-center gap-1"><span className={`grid h-8 w-8 place-items-center rounded-full text-[10px] font-extrabold ${step >= 1 ? "bg-brand-800 text-white" : "bg-[#e7eeeb] text-muted"}`}>{step > 1 ? <Check className="h-4 w-4" /> : "1"}</span><small className="text-[8px] font-bold text-brand-950">Sistema</small></div><i className={`mt-4 h-[2px] w-[90px] ${step > 1 ? "bg-brand-700" : "bg-[#d9e3df]"}`} /><div className="grid flex-1 justify-items-center gap-1"><span className={`grid h-8 w-8 place-items-center rounded-full text-[10px] font-extrabold ${step === 2 ? "bg-[#237db3] text-white" : "bg-[#e7eeeb] text-muted"}`}>2</span><small className="text-[8px] font-bold text-brand-950">Escala</small></div></div></div>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-7 sm:py-6">
        {step === 1 ? <div className="grid gap-6"><section><div className="mb-3"><h3 className="m-0 font-sans text-[15px] font-bold text-brand-950">Tipo de escala</h3><p className="mb-0 mt-1 text-[8px] text-muted">Elige cómo se registrarán las calificaciones en este nivel.</p></div><div className="grid gap-3 sm:grid-cols-2"><Choice selected={values.scaleType === "cualitativa"} icon={ListChecks} title="Escala cualitativa" detail="Niveles como AD, A, B y C." tone="#07845f" onClick={() => selectScale("cualitativa")} /><Choice selected={values.scaleType === "numerica"} icon={Calculator} title="Escala numérica" detail="Notas dentro de un rango definido." tone="#237db3" onClick={() => selectScale("numerica")} /></div></section><section><div className="mb-3"><h3 className="m-0 font-sans text-[15px] font-bold text-brand-950">Resultado final</h3><p className="mb-0 mt-1 text-[8px] text-muted">Define cómo se consolidará el resultado de los periodos.</p></div><div className="grid gap-3 sm:grid-cols-2"><Choice selected={values.finalCalculation === "ultimo_logro"} icon={GraduationCap} title="Último logro alcanzado" detail="Conserva el nivel demostrado más reciente." tone="#d89e00" onClick={() => set("finalCalculation", "ultimo_logro")} /><Choice selected={values.finalCalculation === "promedio_periodos"} icon={Calculator} title="Promedio de periodos" detail="Calcula el promedio de los resultados." tone="#237db3" onClick={() => set("finalCalculation", "promedio_periodos")} /></div></section></div> : <div className="grid gap-5">{values.scaleType === "numerica" ? <section><div className="mb-4"><h3 className="m-0 font-sans text-[15px] font-bold text-brand-950">Rango numérico</h3><p className="mb-0 mt-1 text-[8px] text-muted">Establece los límites y la nota mínima aprobatoria.</p></div><div className="grid gap-4 sm:grid-cols-2"><label className="grid gap-1.5"><span className="text-[9px] font-extrabold text-[#46554f]">Valor mínimo</span><input type="number" step="0.01" className={INPUT} value={values.minimum} onChange={(event) => set("minimum", event.target.value)} /></label><label className="grid gap-1.5"><span className="text-[9px] font-extrabold text-[#46554f]">Valor máximo</span><input type="number" step="0.01" className={INPUT} value={values.maximum} onChange={(event) => set("maximum", event.target.value)} /></label><label className="grid gap-1.5"><span className="text-[9px] font-extrabold text-[#46554f]">Nota aprobatoria</span><input type="number" step="0.01" className={INPUT} value={values.passing} onChange={(event) => set("passing", event.target.value)} /></label><label className="grid gap-1.5"><span className="text-[9px] font-extrabold text-[#46554f]">Decimales permitidos</span><select className={INPUT} value={values.decimals} onChange={(event) => set("decimals", event.target.value)}><option value="0">Sin decimales</option><option value="1">1 decimal</option><option value="2">2 decimales</option></select></label></div></section> : <section><div className="mb-4 flex items-end justify-between gap-3"><div><h3 className="m-0 font-sans text-[15px] font-bold text-brand-950">Niveles de logro</h3><p className="mb-0 mt-1 text-[8px] text-muted">Ordénalos desde el logro más alto hasta el más bajo.</p></div><button type="button" disabled={values.achievementLevels.length >= 8} className="inline-flex min-h-9 items-center gap-1.5 rounded-[5px] border border-[#b7d7ea] bg-[#eff8fd] px-3 text-[9px] font-extrabold text-[#176d9f] disabled:opacity-40" onClick={addAchievement}><Plus className="h-3.5 w-3.5" />Agregar nivel</button></div><div className="grid gap-2">{values.achievementLevels.map((item, index) => <div key={index} className="grid gap-3 rounded-[8px] border border-line-strong bg-[#fbfcfb] p-3 sm:grid-cols-[46px_110px_1fr_130px_36px] sm:items-end"><span className="grid h-9 w-9 place-items-center rounded-full bg-brand-50 text-[10px] font-extrabold text-brand-800">{index + 1}</span><label className="grid gap-1.5"><span className="text-[8px] font-extrabold text-muted">Código</span><input maxLength="10" className={INPUT} value={item.code} onChange={(event) => setAchievement(index, "code", event.target.value)} /></label><label className="grid gap-1.5"><span className="text-[8px] font-extrabold text-muted">Descripción</span><input maxLength="60" className={INPUT} value={item.name} onChange={(event) => setAchievement(index, "name", event.target.value)} /></label><label className="flex min-h-11 items-center gap-2 text-[8px] font-bold text-[#46554f]"><input type="checkbox" checked={item.satisfactory} onChange={(event) => setAchievement(index, "satisfactory", event.target.checked)} />Satisfactorio</label><button type="button" className="grid h-9 w-9 place-items-center rounded-full text-[#a32d28] hover:bg-[#fff1f0] disabled:opacity-30" disabled={values.achievementLevels.length <= 2} onClick={() => removeAchievement(index)} aria-label={`Eliminar nivel ${index + 1}`}><Trash2 className="h-4 w-4" /></button></div>)}</div></section>}</div>}

        {validation || requestError ? <div className="mt-4 flex items-start gap-2 rounded-[6px] border border-[#efb0ad] bg-[#fff6f5] p-3 text-[9px] font-semibold text-[#8f2924]" role="alert"><CircleAlert className="h-4 w-4 shrink-0" />{validation || requestError}</div> : null}
      </div>

      <footer className="flex min-h-[70px] shrink-0 items-center justify-end gap-2 border-t border-line bg-[#fbfcfb] px-5 sm:px-7"><button type="button" disabled={busy} className="min-h-10 rounded-[5px] border border-line-strong bg-white px-4 text-[10px] font-bold text-brand-900 hover:bg-brand-50" onClick={step === 2 ? () => { setStep(1); setValidation(""); } : onClose}>{step === 2 ? "Volver" : "Cancelar"}</button><button type="submit" disabled={busy} className="inline-flex min-h-10 items-center gap-2 rounded-[5px] bg-[#f3bd24] px-5 text-[10px] font-extrabold text-brand-950 hover:bg-[#ffd34f] disabled:opacity-50">{busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : step === 2 ? <Save className="h-4 w-4" /> : null}{busy ? "Guardando…" : step === 1 ? "Continuar" : configuration ? "Guardar cambios" : "Guardar configuración"}</button></footer>
    </form>
  </div>;
}
