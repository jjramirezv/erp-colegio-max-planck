import Panel from "./Panel";

export default function Activity() {
  const rows = [
    ["08:45", "Informe académico generado", "E. Vargas"],
    ["08:15", "Registro de asistencia masiva", "J. Pérez"],
    ["Ayer", "Comunicación enviada a familias", "C. Rojas"],
    ["Ayer", "Notas bimestrales publicadas", "A. López"],
  ];
  return (
    <Panel title="Actividad reciente" className="overflow-auto">
      <div className="min-w-[450px]">
        <div className="grid grid-cols-[70px_1fr_95px] gap-[10px] border-b border-line px-4 py-3 text-[11px] font-bold text-brand-900">
          <span>Hora</span><span>Actividad</span><span>Usuario</span>
        </div>
        {rows.map((r) => (
          <div key={r.join()} className="grid grid-cols-[70px_1fr_95px] gap-[10px] border-b border-line px-4 py-3 text-[11px]">
            {r.map((c) => <span key={c}>{c}</span>)}
          </div>
        ))}
      </div>
    </Panel>
  );
}
