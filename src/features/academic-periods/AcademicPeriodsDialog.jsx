import { CalendarRange, CircleAlert, LoaderCircle, Save, X } from "lucide-react";
import { useEffect, useState } from "react";

const INPUT = "min-h-11 w-full rounded-[6px] border border-line-strong bg-white px-3 text-[11px] font-semibold text-ink outline-none transition focus:border-[#237db3] focus:shadow-[0_0_0_3px_rgba(35,125,179,0.12)]";
const PERIOD_NAMES = {
  bimestres: ["Primer bimestre", "Segundo bimestre", "Tercer bimestre", "Cuarto bimestre"],
  trimestres: ["Primer trimestre", "Segundo trimestre", "Tercer trimestre"],
  semestres: ["Primer semestre", "Segundo semestre"],
};
const TONES = ["#07845f", "#237db3", "#d89e00", "#4a9b72"];

function dateToUtc(date) {
  const [year, month, day] = date.split("-").map(Number);
  return Date.UTC(year, month - 1, day);
}

function utcToDate(milliseconds) {
  return new Date(milliseconds).toISOString().slice(0, 10);
}

function suggestedPeriods(year) {
  const names = PERIOD_NAMES[year.periodSystem] || [];
  const firstDay = dateToUtc(year.startsOn);
  const lastDay = dateToUtc(year.endsOn);
  const day = 86400000;
  const totalDays = Math.floor((lastDay - firstDay) / day) + 1;
  return names.map((name, index) => {
    const startsAt = firstDay + Math.floor((totalDays * index) / names.length) * day;
    const endsAt = firstDay + Math.floor((totalDays * (index + 1)) / names.length) * day - day;
    return { name, startsOn: utcToDate(startsAt), endsOn: utcToDate(index === names.length - 1 ? lastDay : endsAt) };
  });
}

function initialPeriods(year, periods) {
  const expectedCount = PERIOD_NAMES[year.periodSystem]?.length || 0;
  if (periods.length === expectedCount) return periods.map(({ name, startsOn, endsOn }) => ({ name, startsOn, endsOn }));
  return suggestedPeriods(year);
}

function formatDate(date) {
  return new Intl.DateTimeFormat("es-PE", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(`${date}T12:00:00`)).replaceAll(".", "");
}

export default function AcademicPeriodsDialog({ year, periods, busy, requestError, onClose, onSave }) {
  const [values, setValues] = useState(() => initialPeriods(year, periods));
  const [validation, setValidation] = useState("");

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

  function setPeriod(index, key, value) {
    setValues((current) => current.map((period, position) => position === index ? { ...period, [key]: value } : period));
    setValidation("");
  }

  function submit(event) {
    event.preventDefault();
    if (busy) return;
    let previousEnd = "";
    const names = new Set();
    for (let index = 0; index < values.length; index += 1) {
      const period = values[index];
      const cleanName = period.name.trim();
      if (!cleanName) return setValidation(`Escribe el nombre del periodo ${index + 1}.`);
      if (names.has(cleanName.toLocaleLowerCase("es-PE"))) return setValidation("Los periodos deben tener nombres diferentes.");
      names.add(cleanName.toLocaleLowerCase("es-PE"));
      if (!period.startsOn || !period.endsOn) return setValidation(`Completa las fechas de ${cleanName}.`);
      if (period.startsOn < year.startsOn || period.endsOn > year.endsOn) return setValidation(`${cleanName} debe estar dentro de las fechas del año lectivo.`);
      if (period.endsOn < period.startsOn) return setValidation(`La fecha final de ${cleanName} debe ser posterior a su inicio.`);
      if (previousEnd && period.startsOn <= previousEnd) return setValidation("Los periodos deben estar ordenados y no pueden superponerse.");
      previousEnd = period.endsOn;
    }
    onSave(values.map((period) => ({ ...period, name: period.name.trim() })));
  }

  return (
    <div className="fixed inset-0 z-[200] grid place-items-center bg-[rgba(2,35,27,0.56)] p-0 backdrop-blur-[2px] sm:p-5" role="dialog" aria-modal="true" aria-labelledby="academic-periods-dialog-title">
      <button type="button" className="absolute inset-0 cursor-default" aria-label="Cerrar formulario" onClick={onClose} />
      <form noValidate onSubmit={submit} className="relative flex h-full w-full flex-col overflow-hidden bg-white shadow-[0_24px_90px_rgba(1,36,27,0.26)] sm:max-h-[calc(100vh-40px)] sm:max-w-[760px] sm:rounded-[12px]">
        <div className="grid h-1 shrink-0 grid-cols-[1.8fr_1fr_1fr]"><i className="bg-brand-800" /><i className="bg-[#f3bd24]" /><i className="bg-[#237db3]" /></div>
        <header className="flex shrink-0 items-start justify-between border-b border-line px-5 py-4 sm:px-7 sm:py-5">
          <div><h2 id="academic-periods-dialog-title" className="m-0 font-sans text-[22px] font-bold leading-tight text-brand-950">{periods.length ? "Editar periodos académicos" : "Configurar periodos académicos"}</h2><p className="mb-0 mt-1 text-[9px] text-muted">{year.name} · {PERIOD_NAMES[year.periodSystem]?.length || 0} periodos</p></div>
          <button type="button" className="grid h-9 w-9 place-items-center rounded-full text-brand-900 hover:bg-brand-50" onClick={onClose} aria-label="Cerrar"><X className="h-5 w-5" /></button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-7 sm:py-6">
          <section className="mb-5 flex items-center gap-3 rounded-[8px] border border-[#b7d7ea] bg-[#f3f9fc] p-4 text-[#176d9f]">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white"><CalendarRange className="h-5 w-5" /></span>
            <div><strong className="block text-[10px]">Vigencia del año lectivo</strong><span className="mt-0.5 block text-[9px]">{formatDate(year.startsOn)} — {formatDate(year.endsOn)}</span></div>
          </section>

          <div className="grid gap-3">
            {values.map((period, index) => (
              <section key={index} className="overflow-hidden rounded-[8px] border border-line-strong bg-white">
                <div className="flex items-center gap-3 border-b border-line bg-[#fafcfb] px-4 py-3">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-[10px] font-extrabold text-white" style={{ backgroundColor: TONES[index] }}>{index + 1}</span>
                  <div className="min-w-0 flex-1"><strong className="block text-[10px] text-brand-950">Periodo {index + 1}</strong><small className="text-[8px] text-muted">Edita el nombre y su rango de fechas.</small></div>
                </div>
                <div className="grid gap-3 p-4 sm:grid-cols-[1.2fr_1fr_1fr]">
                  <label className="grid gap-1.5"><span className="text-[9px] font-extrabold text-[#46554f]">Nombre</span><input maxLength="60" className={INPUT} value={period.name} onChange={(event) => setPeriod(index, "name", event.target.value)} /></label>
                  <label className="grid gap-1.5"><span className="text-[9px] font-extrabold text-[#46554f]">Fecha de inicio</span><input type="date" min={year.startsOn} max={year.endsOn} className={INPUT} value={period.startsOn} onChange={(event) => setPeriod(index, "startsOn", event.target.value)} /></label>
                  <label className="grid gap-1.5"><span className="text-[9px] font-extrabold text-[#46554f]">Fecha de cierre</span><input type="date" min={year.startsOn} max={year.endsOn} className={INPUT} value={period.endsOn} onChange={(event) => setPeriod(index, "endsOn", event.target.value)} /></label>
                </div>
              </section>
            ))}
          </div>

          {validation || requestError ? <div className="mt-4 flex items-start gap-2 rounded-[6px] border border-[#efb0ad] bg-[#fff6f5] p-3 text-[9px] font-semibold text-[#8f2924]" role="alert"><CircleAlert className="h-4 w-4 shrink-0" />{validation || requestError}</div> : null}
        </div>

        <footer className="flex min-h-[70px] shrink-0 items-center justify-end gap-2 border-t border-line bg-[#fbfcfb] px-5 sm:px-7">
          <button type="button" disabled={busy} className="min-h-10 rounded-[5px] border border-line-strong bg-white px-4 text-[10px] font-bold text-brand-900 hover:bg-brand-50" onClick={onClose}>Cancelar</button>
          <button type="submit" disabled={busy} className="inline-flex min-h-10 items-center gap-2 rounded-[5px] bg-[#f3bd24] px-5 text-[10px] font-extrabold text-brand-950 hover:bg-[#ffd34f] disabled:opacity-50">{busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}{busy ? "Guardando…" : periods.length ? "Guardar cambios" : "Guardar periodos"}</button>
        </footer>
      </form>
    </div>
  );
}
