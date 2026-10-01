import { Clock3 } from "lucide-react";
import Panel from "./Panel";

export default function Agenda() {
  const events = [
    ["20", "Reunión de coordinación directiva", "09:00 – 10:30"],
    ["21", "Evaluación bimestral – Secundaria", "Todo el día"],
    ["22", "Reunión de padres – 3.° Primaria", "16:00 – 17:30"],
    ["24", "Taller de capacitación docente", "14:30 – 17:00"],
  ];
  return (
    <Panel title="Calendario académico" action="Ver calendario" className="lg:row-span-2">
      <div>
        {events.map(([day, title, time], index) => (
          <article key={day} className="grid min-h-[92px] grid-cols-[55px_12px_1fr] items-center border-b border-line px-4 py-3 last:border-b-0">
            <time className="grid">
              <strong className="text-[25px]">{day}</strong>
              <small className="text-[10px]">MAY</small>
            </time>
            <i className={`h-[9px] w-[9px] rounded-full ${index % 2 === 1 ? "bg-brand-800" : "bg-amber"}`} />
            <p className="m-0 grid gap-[9px]">
              <strong className="text-xs">{title}</strong>
              <span className="flex items-center gap-[5px] text-[11px] text-muted"><Clock3 size={14} />{time}</span>
            </p>
          </article>
        ))}
      </div>
    </Panel>
  );
}
