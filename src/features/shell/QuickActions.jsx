import { Plus } from "lucide-react";
import Panel from "./Panel";

export default function QuickActions({ role, onNavigate }) {
  const actions = role === "direccion"
    ? [["Gestionar usuarios", "Usuarios"], ["Gestionar materiales", "Materiales"], ["Crear evento", "Calendario"], ["Generar informe", "Administración"]]
    : role === "coordinador_academico"
    ? [["Cursos y matrículas", "Gestión académica"], ["Gestionar materiales", "Materiales"], ["Revisar auditoría", "Auditoría"], ["Crear actividad", "Calendario"]]
    : [["Ver mi horario", "Horario"], ["Revisar comunicados", "Comunicados"], ["Consultar asistencia", "Asistencia"], ["Ver calificaciones", "Calificaciones"]];
  return (
    <Panel title="Acciones rápidas">
      <div className="grid grid-cols-2 gap-2 p-[14px]">
        {actions.map(([label, target]) => (
          <button
            key={label}
            className="flex items-center gap-[7px] border border-line bg-white px-2 py-[13px] text-[10px] font-bold text-brand-900 hover:bg-brand-100"
            onClick={() => onNavigate(target)}
          >
            <Plus size={16} />{label}
          </button>
        ))}
      </div>
    </Panel>
  );
}
