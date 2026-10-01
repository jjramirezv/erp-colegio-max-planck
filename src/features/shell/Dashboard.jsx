import { ShieldCheck, Users } from "lucide-react";
import { roles } from "../../data";
import Agenda from "./Agenda";
import Attendance from "./Attendance";
import Communications from "./Communications";
import Activity from "./Activity";
import QuickActions from "./QuickActions";
import DirectionDashboard from "../direction/DirectionDashboard";
import AcademicDashboard from "../academic-dashboard/AcademicDashboard";

export default function Dashboard({ user, onNavigate }) {
  if (user.role === "direccion") return <DirectionDashboard user={user} onNavigate={onNavigate} />;
  if (user.role === "coordinador_academico") return <AcademicDashboard user={user} onNavigate={onNavigate} />;

  const roleStats = user.role === "docente"
    ? [["5", "Cursos asignados"], ["148", "Estudiantes"], ["92%", "Asistencia"], ["12", "Tareas pendientes"]]
    : user.role === "estudiante"
    ? [["8", "Cursos activos"], ["94%", "Asistencia"], ["16.8", "Promedio"], ["3", "Tareas pendientes"]]
    : user.role === "familia"
    ? [["2", "Estudiantes"], ["96%", "Asistencia"], ["4", "Comunicados"], ["S/ 0", "Saldo pendiente"]]
    : [["1,248", "Estudiantes"], ["98", "Docentes"], ["1,102", "Familias"], ["42", "Aulas"]];
  return (
    <>
      <div className="mb-6 flex items-start justify-between gap-[15px]">
        <div>
          <h1 className="m-0 font-display text-[27px] font-bold tracking-[-0.04em]">Buenos días, {user.name.split(" ")[0]}</h1>
          <p className="my-[5px] text-sm text-muted">Resumen institucional</p>
        </div>
        <span className="flex items-center gap-[9px] rounded-lg bg-brand-100 px-[17px] py-[13px] font-semibold text-brand-900 max-md:px-[11px] max-md:text-[0]">
          <ShieldCheck className="max-md:w-5" size={18} />{roles[user.role]}
        </span>
      </div>
      <section className="mb-5 grid grid-cols-2 border border-line bg-white md:grid-cols-4">
        {roleStats.map(([value, label], index) => (
          <div
            key={label}
            className={`flex items-center gap-4 p-4 md:p-6 border-line ${index > 0 ? "md:border-l" : ""} ${
              index === 2 ? "border-t md:border-t-0 md:border-l" : index === 3 ? "border-t md:border-t-0" : ""
            }`}
          >
            <span className="hidden h-[54px] w-[54px] place-items-center rounded-full bg-brand-100 text-brand-900 md:grid"><Users size={22} /></span>
            <p className="m-0 grid">
              <small className="text-[11px] text-muted">{label}</small>
              <strong className="my-[3px] font-display text-2xl font-bold text-brand-900 md:text-[25px]">{value}</strong>
              <span className="text-[11px] text-muted">Información actualizada</span>
            </p>
          </div>
        ))}
      </section>
      <div className="grid grid-cols-1 items-start gap-[14px] md:grid-cols-2 lg:grid-cols-[1.05fr_1.1fr_1.05fr]">
        <Agenda />
        <Attendance />
        <Communications />
        <Activity />
        <QuickActions role={user.role} onNavigate={onNavigate} />
      </div>
    </>
  );
}
