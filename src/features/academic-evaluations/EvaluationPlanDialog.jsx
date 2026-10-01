import { CalendarRange, Check, LoaderCircle, Sparkles, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { generateEvaluationPlan } from "./academicEvaluationsApi";

const INPUT = "min-h-11 w-full rounded-xl border border-[#b8ccc5] bg-white px-3 text-sm font-semibold text-[#20332b] outline-none focus:border-[#087a5b] focus:ring-2 focus:ring-[#087a5b]/10";
const DAYS = [[1, "Lunes"], [2, "Martes"], [3, "Miércoles"], [4, "Jueves"], [5, "Viernes"], [6, "Sábado"]];
const fmt = (value) => new Intl.DateTimeFormat("es-PE", { day: "2-digit", month: "short", timeZone: "UTC" }).format(new Date(`${value}T12:00:00Z`)).replace(".", "");
const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Lima" }).format(new Date());

function Toggle({ checked, onChange, title, children, tone }) {
  return <label className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition ${checked ? "border-[#087a5b] bg-[#f1faf6]" : "border-[#d3e0db] bg-white"}`}>
    <input type="checkbox" className="mt-1 h-4 w-4 accent-[#087a5b]" checked={checked} onChange={(event) => onChange(event.target.checked)} />
    <span className="min-w-0"><strong className="flex items-center gap-2 text-sm text-[#1b3027]"><i className={`h-2.5 w-2.5 rounded-full ${tone}`} />{title}</strong><small className="mt-1 block text-xs leading-5 text-[#6d7b75]">{children}</small></span>
  </label>;
}

export default function EvaluationPlanDialog({ yearId, level, section, periods, onClose, onDone }) {
  const [scope, setScope] = useState("school");
  const [periodIds, setPeriodIds] = useState(() => periods.filter((item) => item.endsOn >= today).map((item) => String(item.id)));
  const [weeklyDay, setWeeklyDay] = useState(5);
  const [weekly, setWeekly] = useState(true);
  const [midterm, setMidterm] = useState(true);
  const [final, setFinal] = useState(true);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const params = useMemo(() => ({ yearId, periodIds, levelId: scope === "level" ? level?.id : null, sectionId: scope === "section" ? section?.id : null, weeklyDay, weekly, midterm, final }), [yearId, periodIds, scope, level, section, weeklyDay, weekly, midterm, final]);
  const ready = periodIds.length > 0 && (weekly || midterm || final);

  useEffect(() => {
    if (!ready) { setPreview(null); return undefined; }
    let active = true; setLoading(true); setError("");
    const timer = setTimeout(() => {
      generateEvaluationPlan({ ...params, preview: true }).then((result) => { if (active) setPreview(result); }).catch((failure) => { if (active) setError(failure.message); }).finally(() => { if (active) setLoading(false); });
    }, 250);
    return () => { active = false; clearTimeout(timer); };
  }, [params, ready]);

  async function generate() {
    setBusy(true); setError("");
    try { const result = await generateEvaluationPlan({ ...params, preview: false }); onDone(result); }
    catch (failure) { setError(failure.message); setBusy(false); }
  }
  const togglePeriod = (id) => setPeriodIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);

  return <div className="fixed inset-0 z-[80] grid place-items-center bg-[#082c24]/65 p-3 backdrop-blur-[2px] sm:p-6" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onClose(); }}>
    <section role="dialog" aria-label="Plan de evaluaciones estándar" className="flex max-h-[92vh] w-full max-w-[920px] flex-col overflow-hidden rounded-2xl border border-[#b8ccc5] bg-white shadow-[0_28px_90px_rgba(4,39,30,.3)]">
      <header className="flex items-start justify-between gap-5 border-b border-[#dce7e2] px-5 py-5 sm:px-7">
        <div><h2 className="m-0 flex items-center gap-2 text-2xl font-extrabold tracking-[-.035em] text-[#14231e]"><Sparkles size={22} className="text-[#d49b00]" />Plan de evaluaciones estándar</h2><p className="mb-0 mt-1 text-sm text-[#6d7b75]">Programa de una vez las evaluaciones de cada curso. Los docentes solo registran las notas.</p></div>
        <button type="button" className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-[#b8ccc5] text-[#263a32] hover:bg-[#f2f8f5]" onClick={onClose} aria-label="Cerrar"><X size={20} /></button>
      </header>
      <div className="grid gap-6 overflow-y-auto px-5 py-6 sm:px-7">
        <section className="grid gap-3">
          <h3 className="m-0 text-base font-extrabold text-[#1b3027]">1. ¿Qué evaluaciones incluir?</h3>
          <div className="grid gap-3 md:grid-cols-3">
            <Toggle checked={weekly} onChange={setWeekly} title="Examen semanal" tone="bg-[#3b7ddd]">Uno por semana en cada curso, el día elegido.</Toggle>
            <Toggle checked={midterm} onChange={setMidterm} title="Semana de mitad de periodo" tone="bg-[#e0a100]">Una evaluación por curso en la semana central, el día que el curso tiene clase.</Toggle>
            <Toggle checked={final} onChange={setFinal} title="Semana final de periodo" tone="bg-[#d9468f]">Una evaluación por curso en la última semana del periodo.</Toggle>
          </div>
          {weekly ? <label className="grid max-w-xs gap-2"><span className="text-xs font-extrabold text-[#40524a]">Día del examen semanal</span><select className={INPUT} value={weeklyDay} onChange={(event) => setWeeklyDay(Number(event.target.value))}>{DAYS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label> : null}
        </section>
        <section className="grid gap-3 md:grid-cols-2">
          <div className="grid content-start gap-3">
            <h3 className="m-0 text-base font-extrabold text-[#1b3027]">2. Periodos</h3>
            <div className="grid gap-2">{periods.map((period) => <label key={period.id} className="flex items-center gap-3 rounded-xl border border-[#d3e0db] px-4 py-3 text-sm"><input type="checkbox" className="h-4 w-4 accent-[#087a5b]" checked={periodIds.includes(String(period.id))} onChange={() => togglePeriod(String(period.id))} /><strong className="text-[#1b3027]">{period.name}</strong><small className="ml-auto text-[#6d7b75]">{fmt(period.startsOn)} – {fmt(period.endsOn)}</small></label>)}</div>
          </div>
          <div className="grid content-start gap-3">
            <h3 className="m-0 text-base font-extrabold text-[#1b3027]">3. ¿Para quiénes?</h3>
            <div className="grid gap-2">
              {[["school", "Todo el colegio", "Todos los cursos del año lectivo"], ["level", `Solo ${level?.name || "el nivel"}`, "Todos los grados y salones de este nivel"], ["section", `Solo el salón seleccionado`, section ? `Sección ${section.name}` : "Selecciona un salón en la pantalla"]].map(([value, title, text]) => <label key={value} className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-sm ${scope === value ? "border-[#087a5b] bg-[#f1faf6]" : "border-[#d3e0db]"}`}><input type="radio" name="scope" className="mt-1 accent-[#087a5b]" checked={scope === value} disabled={(value === "level" && !level) || (value === "section" && !section)} onChange={() => setScope(value)} /><span><strong className="block text-[#1b3027]">{title}</strong><small className="text-[#6d7b75]">{text}</small></span></label>)}
            </div>
          </div>
        </section>
        <section className="grid gap-3">
          <h3 className="m-0 text-base font-extrabold text-[#1b3027]">4. Vista previa</h3>
          {error ? <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-800">{error}</div> : null}
          {!ready ? <p className="m-0 text-sm text-[#6d7b75]">Elige al menos un periodo y un tipo de evaluación.</p> : loading && !preview ? <p className="m-0 flex items-center gap-2 text-sm text-[#6d7b75]"><LoaderCircle size={16} className="animate-spin" />Calculando…</p> : preview ? <>
            <div className="grid gap-3 sm:grid-cols-3">
              {[["Cursos", preview.courses], ["Evaluaciones nuevas", preview.toCreate], ["Ya existentes (no se duplican)", preview.existing]].map(([label, value]) => <div key={label} className="rounded-xl border border-[#d3e0db] bg-[#f7faf9] p-4"><strong className="block text-2xl font-extrabold text-[#14231e]">{value}</strong><small className="text-xs font-bold text-[#6d7b75]">{label}</small></div>)}
            </div>
            {preview.calendar.map((period) => <article key={period.periodId} className="rounded-xl border border-[#d3e0db] p-4">
              <strong className="flex items-center gap-2 text-sm text-[#1b3027]"><CalendarRange size={16} className="text-[#087a5b]" />{period.period} <small className="font-semibold text-[#6d7b75]">{fmt(period.startsOn)} – {fmt(period.endsOn)}</small></strong>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {period.weekly.map((date, index) => <span key={date} className="rounded-full bg-[#eaf2ff] px-2.5 py-1 text-xs font-bold text-[#1d4d9c]">Semanal {index + 1} · {fmt(date)}</span>)}
                {period.midWeek ? <span className="rounded-full bg-[#fff1cc] px-2.5 py-1 text-xs font-bold text-[#7a5200]">Mitad · {fmt(period.midWeek.from)} – {fmt(period.midWeek.to)}</span> : null}
                {period.finalWeek ? <span className="rounded-full bg-[#fbdbea] px-2.5 py-1 text-xs font-bold text-[#9b1d5c]">Final · {fmt(period.finalWeek.from)} – {fmt(period.finalWeek.to)}</span> : null}
              </div>
            </article>)}
            <p className="m-0 text-xs leading-5 text-[#6d7b75]">Se crean como “Programadas” y visibles para estudiantes. Si hay un feriado, edita o archiva esa evaluación desde la lista.</p>
          </> : null}
        </section>
      </div>
      <footer className="flex items-center justify-between gap-3 border-t border-[#dce7e2] px-5 py-4 sm:px-7">
        <button type="button" className="min-h-11 px-3 text-sm font-extrabold text-[#62726b]" onClick={onClose} disabled={busy}>Cancelar</button>
        <button type="button" disabled={busy || loading || !preview?.toCreate} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#087a5b] px-6 text-sm font-extrabold text-white hover:bg-[#07684e] disabled:opacity-50" onClick={generate}>{busy ? <LoaderCircle size={17} className="animate-spin" /> : <Check size={17} />}{busy ? "Generando…" : `Generar ${preview?.toCreate || 0} evaluaciones`}</button>
      </footer>
    </section>
  </div>;
}
