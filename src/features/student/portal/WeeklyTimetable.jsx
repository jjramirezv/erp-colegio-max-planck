import { useMemo, useState } from "react";
import { Clock3, UserRound, X } from "lucide-react";
import { DAY_NAMES, DAY_SHORT, hhmm, limaNow, toMinutes } from "./theme";
import { Empty, Pill } from "./ui";

const HOUR = 68; // px por hora en la cuadrícula
const PAD = 14; // margen superior para ver la primera hora

// Reparte en carriles las clases que se cruzan el mismo día.
function layoutDay(rows) {
  const sorted = [...rows].sort((a, b) => toMinutes(a.start) - toMinutes(b.start));
  const placed = []; let cluster = []; let clusterEnd = -1;
  const flush = () => { const lanes = Math.max(...cluster.map((item) => item.lane)) + 1; cluster.forEach((item) => placed.push({ ...item, lanes })); cluster = []; };
  for (const row of sorted) {
    const start = toMinutes(row.start); const end = toMinutes(row.end);
    if (cluster.length && start >= clusterEnd) flush();
    const used = new Set(cluster.filter((item) => toMinutes(item.end) > start).map((item) => item.lane));
    let lane = 0; while (used.has(lane)) lane++;
    cluster.push({ ...row, lane }); clusterEnd = Math.max(clusterEnd, end);
  }
  if (cluster.length) flush();
  return placed;
}

function Detail({ item, onClose }) {
  if (!item) return null;
  return <div role="dialog" aria-label={`Detalle de ${item.course}`} className={`mt-4 flex flex-wrap items-center gap-4 rounded-[10px] border-l-[6px] ${item.tone.border} ${item.tone.soft} p-4`}>
    <div className="min-w-0 flex-1">
      <strong className={`block text-[16px] font-extrabold ${item.tone.text}`}>{item.course}</strong>
      <span className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-[#42524c]"><span className="inline-flex items-center gap-1.5"><Clock3 className="h-4 w-4" />{DAY_NAMES[item.day]} · {hhmm(item.start)} – {hhmm(item.end)}</span><span className="inline-flex items-center gap-1.5"><UserRound className="h-4 w-4" />{item.teachers || "Docente por asignar"}</span></span>
    </div>
    <button type="button" onClick={onClose} aria-label="Cerrar detalle" className="grid h-9 w-9 place-items-center rounded-full text-muted hover:bg-white"><X className="h-4 w-4" /></button>
  </div>;
}

export default function WeeklyTimetable({ schedule, palette }) {
  const now = limaNow();
  const [focus, setFocus] = useState(null);
  const [selected, setSelected] = useState(null);
  const days = useMemo(() => { const extra = [6, 7].filter((day) => schedule.some((row) => row.day === day)); return [1, 2, 3, 4, 5, ...extra]; }, [schedule]);
  const [mobileDay, setMobileDay] = useState(() => (days.includes(now.weekday) ? now.weekday : 1));
  const items = useMemo(() => schedule.map((row) => ({ ...row, tone: palette.get(row.course) })), [schedule, palette]);
  const courses = [...new Set(items.map((row) => row.course))].sort((a, b) => a.localeCompare(b, "es"));
  if (!items.length) return <Empty icon={Clock3} title="Horario sin publicar">Tu sección todavía no tiene un horario publicado. Cuando Coordinación lo registre, aparecerá aquí.</Empty>;

  const startHour = Math.floor(Math.min(...items.map((row) => toMinutes(row.start))) / 60);
  const endHour = Math.ceil(Math.max(...items.map((row) => toMinutes(row.end))) / 60);
  const hours = Array.from({ length: endHour - startHour }, (_, index) => startHour + index);
  const height = hours.length * HOUR + PAD * 2;
  const nowTop = ((now.minutes - startHour * 60) / 60) * HOUR + PAD;
  const showNow = days.includes(now.weekday) && nowTop >= PAD && nowTop <= height - PAD;
  const dim = (row) => focus && row.course !== focus;
  const open = (row) => setSelected(selected?.id === row.id ? null : row);
  const block = (row, style) => <button type="button" key={row.id} style={style} onClick={() => open(row)} aria-label={`${row.course}, ${DAY_NAMES[row.day]} de ${hhmm(row.start)} a ${hhmm(row.end)}`}
    className={`absolute flex flex-col items-start justify-start overflow-hidden rounded-[8px] border-l-4 ${row.tone.border} ${row.tone.block} px-2.5 py-1.5 text-left shadow-[0_2px_6px_rgba(7,54,42,0.08)] transition focus-visible:outline-2 focus-visible:outline-brand-700 ${dim(row) ? "opacity-25" : ""} ${selected?.id === row.id ? `ring-2 ${row.tone.ring}` : ""}`}>
    <span className={`block text-[10px] font-bold ${row.tone.text}`}>{hhmm(row.start)} – {hhmm(row.end)}</span>
    <strong className="block text-[12px] font-extrabold leading-tight text-[#14211d]">{row.course}</strong>
    <span className="block truncate text-[10.5px] text-[#4d5c57]">{row.teachers || "Docente por asignar"}</span>
  </button>;

  return <div>
    <div className="mb-4 flex flex-wrap items-center gap-2" aria-label="Cursos del horario">
      <Pill active={!focus} onClick={() => setFocus(null)}>Todos</Pill>
      {courses.map((course) => { const tone = palette.get(course); return <Pill key={course} active={focus === course} onClick={() => setFocus(focus === course ? null : course)}><i className={`h-2.5 w-2.5 rounded-full ${tone.bar}`} />{course}</Pill>; })}
    </div>

    <div className="hidden overflow-x-auto rounded-[10px] border border-line md:block">
      <div className="min-w-[760px]">
        <div className="grid border-b border-line bg-canvas" style={{ gridTemplateColumns: `64px repeat(${days.length}, minmax(0, 1fr))` }}>
          <span />
          {days.map((day) => <span key={day} className={`border-l border-line py-3 text-center text-[12px] font-extrabold uppercase tracking-[0.04em] ${day === now.weekday ? "bg-brand-900 text-white" : "text-[#42524c]"}`}>{DAY_NAMES[day]}{day === now.weekday ? <small className="block text-[10px] font-bold normal-case tracking-normal text-[#bfe3d6]">Hoy</small> : null}</span>)}
        </div>
        <div className="relative grid" style={{ gridTemplateColumns: `64px repeat(${days.length}, minmax(0, 1fr))`, height }}>
          <div className="relative">{hours.map((hour, index) => <span key={hour} className="absolute right-2 -translate-y-1/2 text-[11px] font-bold text-muted" style={{ top: index * HOUR + PAD }}>{`${String(hour).padStart(2, "0")}:00`}</span>)}</div>
          {days.map((day) => <div key={day} className={`relative border-l border-line ${day === now.weekday ? "bg-brand-50/60" : ""}`}>
            {hours.map((hour, index) => <i key={hour} className="absolute inset-x-0 border-t border-dashed border-line" style={{ top: index * HOUR + PAD }} />)}
            {layoutDay(items.filter((row) => row.day === day)).map((row) => {
              const top = ((toMinutes(row.start) - startHour * 60) / 60) * HOUR + PAD;
              const size = ((toMinutes(row.end) - toMinutes(row.start)) / 60) * HOUR;
              return block(row, { top: top + 2, height: Math.max(size - 4, 26), left: `calc(${(row.lane / row.lanes) * 100}% + 4px)`, width: `calc(${100 / row.lanes}% - 8px)` });
            })}
            {showNow && day === now.weekday ? <i aria-hidden="true" className="absolute inset-x-0 z-10 border-t-2 border-red before:absolute before:-left-1 before:-top-[5px] before:h-2 before:w-2 before:rounded-full before:bg-red" style={{ top: nowTop }} /> : null}
          </div>)}
        </div>
      </div>
    </div>

    <div className="md:hidden">
      <nav aria-label="Seleccionar día" className="mb-3 grid gap-1.5" style={{ gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))` }}>
        {days.map((day) => <button type="button" key={day} aria-pressed={mobileDay === day} onClick={() => setMobileDay(day)} className={`min-h-11 rounded-[8px] text-[12px] font-extrabold ${mobileDay === day ? "bg-brand-900 text-white" : "border border-line bg-white text-[#42524c]"}`}>{DAY_SHORT[day]}</button>)}
      </nav>
      <div className="grid gap-2">
        {items.filter((row) => row.day === mobileDay && !dim(row)).sort((a, b) => a.start.localeCompare(b.start)).map((row) => <button type="button" key={row.id} onClick={() => open(row)} className={`grid grid-cols-[62px_1fr] items-center gap-3 rounded-[10px] border-l-[5px] ${row.tone.border} ${row.tone.soft} p-3 text-left`}>
          <span className="text-[12px] font-extrabold text-[#14211d]">{hhmm(row.start)}<small className="block text-[11px] font-semibold text-muted">{hhmm(row.end)}</small></span>
          <span className="min-w-0"><strong className={`block text-[14px] ${row.tone.text}`}>{row.course}</strong><small className="block truncate text-[12px] text-[#4d5c57]">{row.teachers || "Docente por asignar"}</small></span>
        </button>)}
        {!items.some((row) => row.day === mobileDay && !dim(row)) ? <Empty>No hay clases programadas para este día.</Empty> : null}
      </div>
    </div>
    <Detail item={selected} onClose={() => setSelected(null)} />
  </div>;
}
