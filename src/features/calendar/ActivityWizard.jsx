import { CalendarDays, Check, ChevronLeft, ChevronRight, Clock3, MapPin, Users, X } from "lucide-react";
import { useState } from "react";
import { activityToForm, AUDIENCE_ROLES, EVENT_TYPES, longDateLabel } from "./calendarUtils";

const STEPS = ["Actividad", "Fecha y hora", "Destinatarios", "Revisar"];
const INPUT = "min-h-11 w-full rounded-[5px] border border-line-strong bg-white px-3 text-[12px] font-semibold text-ink outline-none focus:border-brand-800 focus:shadow-[0_0_0_3px_rgba(4,120,87,0.10)]";

function Field({ label, children, wide = false }) {
  return <label className={`grid gap-1.5 ${wide ? "md:col-span-2" : ""}`}><span className="text-[10px] font-bold text-muted">{label}</span>{children}</label>;
}

function Stepper({ step }) {
  return (
    <ol className="relative grid min-w-0 grid-cols-4 before:absolute before:left-[12.5%] before:right-[12.5%] before:top-[15px] before:h-px before:bg-line-strong">
      {STEPS.map((label, index) => {
        const number = index + 1;
        const complete = number < step;
        const active = number === step;
        return (
          <li key={label} className="relative z-[1] grid min-w-0 justify-items-center gap-2 text-center">
            <span className={`grid h-[31px] w-[31px] place-items-center rounded-full border text-[10px] font-black ${complete ? "border-brand-800 bg-brand-800 text-white" : active ? "border-2 border-brand-800 bg-white text-brand-900" : "border-line-strong bg-[#dce4e1] text-muted"}`}>{complete ? <Check className="h-4 w-4" /> : number}</span>
            <span className={`max-w-full break-words text-[8px] font-bold leading-tight sm:text-[10px] ${active || complete ? "text-brand-900" : "text-muted"}`}>{label}</span>
          </li>
        );
      })}
    </ol>
  );
}

export default function ActivityWizard({ activity, initialDate, user, busy, onClose, onSave }) {
  const [step, setStep] = useState(1);
  const [values, setValues] = useState(() => activityToForm(activity, initialDate, user?.name || ""));
  const [error, setError] = useState("");
  const set = (key, value) => setValues((current) => ({ ...current, [key]: value }));

  function validate(currentStep) {
    if (currentStep === 1 && !values.title.trim()) return "Escribe el nombre de la actividad.";
    if (currentStep === 2) {
      if (!values.startDate || !values.endDate) return "Completa las fechas de inicio y fin.";
      const start = `${values.startDate}T${values.allDay ? "00:00" : values.startTime}`;
      const end = `${values.endDate}T${values.allDay ? "23:59" : values.endTime}`;
      if (end < start) return "La fecha y hora de fin deben ser posteriores al inicio.";
    }
    if (currentStep === 3 && !values.responsible.trim()) return "Indica quién es responsable de la actividad.";
    return "";
  }

  function next() {
    const validation = validate(step);
    if (validation) return setError(validation);
    setError("");
    setStep((current) => Math.min(4, current + 1));
  }

  function toggleRole(role) {
    set("audienceRoles", values.audienceRoles.includes(role) ? values.audienceRoles.filter((item) => item !== role) : [...values.audienceRoles, role]);
  }

  async function submit(status) {
    const validation = validate(1) || validate(2) || validate(3);
    if (validation) return setError(validation);
    await onSave({ ...values, status });
  }

  return (
    <div className="fixed inset-0 z-[200] grid place-items-center bg-[rgba(2,35,27,0.62)] p-0 sm:p-5" role="dialog" aria-modal="true" aria-labelledby="activity-wizard-title">
      <section className="flex h-full min-w-0 w-full max-w-full flex-col overflow-hidden bg-white sm:h-auto sm:max-h-[calc(100vh-40px)] sm:max-w-[720px] sm:rounded-[9px] sm:border sm:border-line-strong sm:shadow-[0_28px_80px_rgba(0,30,22,0.28)]">
        <header className="flex min-h-[64px] items-center justify-between border-b border-line px-5 sm:px-6">
          <h2 id="activity-wizard-title" className="m-0 font-sans text-[19px] font-extrabold tracking-[-0.03em] text-brand-950">{activity ? "Editar actividad" : "Nueva actividad"}</h2>
          <button type="button" className="grid h-9 w-9 place-items-center rounded-full text-brand-900 hover:bg-brand-50" onClick={onClose} aria-label="Cerrar"><X className="h-5 w-5" /></button>
        </header>
        <div className="border-b border-line px-4 py-4 sm:px-8 sm:py-5"><Stepper step={step} /></div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:min-h-[330px] sm:px-8 sm:py-6">
          {step === 1 ? (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="md:col-span-2"><h3 className="m-0 font-sans text-[17px] font-extrabold">Información de la actividad</h3><p className="mb-0 mt-1 text-[10px] text-muted">Define qué sucederá y cómo se identificará en el calendario.</p></div>
              <Field label="Nombre de la actividad" wide><input autoFocus className={INPUT} value={values.title} onChange={(event) => set("title", event.target.value)} placeholder="Ej. Reunión de padres" /></Field>
              <Field label="Tipo"><select className={INPUT} value={values.type} onChange={(event) => set("type", event.target.value)}>{Object.entries(EVENT_TYPES).map(([key, item]) => <option key={key} value={key}>{item.label}</option>)}</select></Field>
              <Field label="Descripción"><input className={INPUT} value={values.description} onChange={(event) => set("description", event.target.value)} placeholder="Detalle breve (opcional)" /></Field>
            </div>
          ) : null}

          {step === 2 ? (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="md:col-span-2"><h3 className="m-0 font-sans text-[17px] font-extrabold">Fecha y hora</h3><p className="mb-0 mt-1 text-[10px] text-muted">Indica cuándo inicia y termina.</p></div>
              <Field label="Fecha de inicio"><input type="date" className={INPUT} value={values.startDate} onChange={(event) => set("startDate", event.target.value)} /></Field>
              <Field label="Hora de inicio"><input type="time" className={INPUT} disabled={values.allDay} value={values.startTime} onChange={(event) => set("startTime", event.target.value)} /></Field>
              <Field label="Fecha de fin"><input type="date" min={values.startDate} className={INPUT} value={values.endDate} onChange={(event) => set("endDate", event.target.value)} /></Field>
              <Field label="Hora de fin"><input type="time" className={INPUT} disabled={values.allDay} value={values.endTime} onChange={(event) => set("endTime", event.target.value)} /></Field>
              <label className="flex items-center justify-between rounded-[6px] border border-line bg-[#f8faf9] p-4 md:col-span-2"><span><strong className="block text-[11px]">Todo el día</strong><small className="text-[9px] text-muted">La actividad no mostrará una hora específica.</small></span><input type="checkbox" className="h-5 w-5 accent-brand-800" checked={values.allDay} onChange={(event) => set("allDay", event.target.checked)} /></label>
            </div>
          ) : null}

          {step === 3 ? (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="md:col-span-2"><h3 className="m-0 font-sans text-[17px] font-extrabold">Destinatarios</h3><p className="mb-0 mt-1 text-[10px] text-muted">Selecciona quién podrá ver esta actividad publicada.</p></div>
              <div className="grid gap-2 md:col-span-2 sm:grid-cols-2">
                <button type="button" className={`flex min-h-11 items-center gap-3 rounded-[5px] border px-3 text-left text-[10px] font-bold ${!values.audienceRoles.length ? "border-brand-800 bg-brand-50 text-brand-900" : "border-line-strong bg-white text-muted"}`} onClick={() => set("audienceRoles", [])}><span className={`grid h-5 w-5 place-items-center rounded-full border ${!values.audienceRoles.length ? "border-brand-800 bg-brand-800 text-white" : "border-line-strong"}`}>{!values.audienceRoles.length ? <Check className="h-3 w-3" /> : null}</span>Toda la comunidad</button>
                {AUDIENCE_ROLES.map(([role, label]) => <button key={role} type="button" className={`flex min-h-11 items-center gap-3 rounded-[5px] border px-3 text-left text-[10px] font-bold ${values.audienceRoles.includes(role) ? "border-brand-800 bg-brand-50 text-brand-900" : "border-line-strong bg-white text-muted"}`} onClick={() => toggleRole(role)}><span className={`grid h-5 w-5 place-items-center rounded-full border ${values.audienceRoles.includes(role) ? "border-brand-800 bg-brand-800 text-white" : "border-line-strong"}`}>{values.audienceRoles.includes(role) ? <Check className="h-3 w-3" /> : null}</span>{label}</button>)}
              </div>
              <Field label="Lugar"><input className={INPUT} value={values.location} onChange={(event) => set("location", event.target.value)} placeholder="Ej. Patio central" /></Field>
              <Field label="Responsable"><input className={INPUT} value={values.responsible} onChange={(event) => set("responsible", event.target.value)} placeholder="Nombre o área responsable" /></Field>
            </div>
          ) : null}

          {step === 4 ? (
            <div className="grid gap-4">
              <div><h3 className="m-0 font-sans text-[17px] font-extrabold">Revisar actividad</h3><p className="mb-0 mt-1 text-[10px] text-muted">Comprueba los datos antes de publicar.</p></div>
              <div className="grid gap-4 rounded-[7px] border border-line-strong bg-[#f8faf9] p-5 sm:grid-cols-[48px_1fr]">
                <span className="grid h-12 w-12 place-items-center rounded-full bg-brand-100 text-brand-900"><CalendarDays className="h-5 w-5" /></span>
                <div><small className={`font-black uppercase ${EVENT_TYPES[values.type].text}`}>{EVENT_TYPES[values.type].label}</small><h4 className="mb-1 mt-1 font-sans text-[18px] font-extrabold">{values.title}</h4><p className="m-0 text-[10px] leading-relaxed text-muted">{values.description || "Sin descripción adicional."}</p></div>
                <div className="grid gap-3 text-[10px] sm:col-start-2 sm:grid-cols-3"><span className="flex gap-2"><Clock3 className="h-4 w-4 text-muted" />{longDateLabel(values.startDate)}{values.allDay ? " · Todo el día" : ` · ${values.startTime}`}</span><span className="flex gap-2"><MapPin className="h-4 w-4 text-muted" />{values.location || "Sin lugar"}</span><span className="flex gap-2"><Users className="h-4 w-4 text-muted" />{values.audienceRoles.length ? `${values.audienceRoles.length} grupo(s)` : "Toda la comunidad"}</span></div>
              </div>
            </div>
          ) : null}

          {error ? <p className="mt-4 rounded-[5px] border border-[#efb0ad] bg-red-soft p-3 text-[10px] font-semibold text-[#9f2525]" role="alert">{error}</p> : null}
        </div>

        <footer className="flex min-h-[72px] min-w-0 flex-wrap items-center justify-between gap-3 border-t border-line px-5 sm:px-8">
          <button type="button" className="inline-flex min-h-10 items-center gap-1.5 rounded-[5px] border border-line-strong bg-white px-4 text-[10px] font-bold text-brand-900 disabled:opacity-40" disabled={step === 1 || busy} onClick={() => { setError(""); setStep((current) => current - 1); }}><ChevronLeft className="h-4 w-4" />Atrás</button>
          {step < 4 ? <button type="button" className="inline-flex min-h-10 items-center gap-1.5 rounded-[5px] bg-brand-900 px-5 text-[10px] font-extrabold text-white hover:bg-brand-950" onClick={next}>Continuar<ChevronRight className="h-4 w-4" /></button> : <div className="flex gap-2">{values.status !== "published" ? <button type="button" disabled={busy} className="min-h-10 rounded-[5px] border border-brand-900 bg-white px-4 text-[10px] font-bold text-brand-900 disabled:opacity-50" onClick={() => submit("draft")}>Guardar borrador</button> : null}<button type="button" disabled={busy} className="min-h-10 rounded-[5px] bg-brand-900 px-5 text-[10px] font-extrabold text-white disabled:opacity-50" onClick={() => submit("published")}>{busy ? "Guardando…" : values.status === "published" ? "Guardar cambios" : "Publicar actividad"}</button></div>}
        </footer>
      </section>
    </div>
  );
}
