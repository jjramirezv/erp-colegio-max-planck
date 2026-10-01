import { BookOpen, CircleDollarSign, Clock3, Download, FileCheck2, GraduationCap, Megaphone, UserRoundCheck, Users } from "lucide-react";
import { roles } from "../../data";
import PageHeading from "../../components/PageHeading";
import DataTable from "./DataTable";
import { courses, payments, students } from "./data/seed";

export default function OperationalModule({ module, user }) {
  const content = {
    Asistencia: { icon: UserRoundCheck, title: "Control de asistencia", desc: "Registro diario y seguimiento de tardanzas", stats: [["92%", "Asistencia del día"], ["62", "Tardanzas"], ["38", "Ausencias"]], rows: students },
    Horario: { icon: Clock3, title: "Horario semanal", desc: "Clases, aulas y docentes asignados", stats: [["8", "Cursos"], ["32 h", "Horas semanales"], ["A-204", "Aula principal"]], rows: courses },
    Tareas: { icon: BookOpen, title: "Tareas y entregas", desc: "Actividades académicas organizadas por fecha", stats: [["4", "Pendientes"], ["12", "Completadas"], ["1", "Proyecto grupal"]], rows: courses },
    Pagos: { icon: CircleDollarSign, title: "Pagos y pensiones", desc: "Estado de cuenta, vencimientos y comprobantes", stats: [["S/ 0", "Saldo vencido"], ["S/ 620", "Próxima pensión"], ["5", "Comprobantes"]], rows: payments },
    Comunicados: { icon: Megaphone, title: "Comunicados", desc: "Información oficial de la institución", stats: [["4", "Nuevos"], ["18", "Leídos"], ["2", "Requieren firma"]], rows: [["20 ago", "Evaluación bimestral", "Dirección académica", "Secundaria", "Nuevo"], ["18 ago", "Reunión de familias", "Tutoría", "3.° Primaria", "Leído"], ["17 ago", "Taller socioemocional", "Psicología", "Secundaria", "Nuevo"]] },
    Tutoría: { icon: Users, title: "Tutoría y acompañamiento", desc: "Seguimiento académico y socioemocional", stats: [["32", "Estudiantes"], ["5", "Entrevistas"], ["3", "Alertas abiertas"]], rows: students },
    Configuración: { icon: FileCheck2, title: "Configuración institucional", desc: "Año escolar, periodos y parámetros generales", stats: [["2026", "Año académico"], ["2.°", "Bimestre actual"], ["42", "Secciones activas"]], rows: [["Año académico", "2026", "Activo"], ["Periodo actual", "Segundo bimestre", "Activo"], ["Escala de calificación", "0 a 20", "Activo"]] },
  }[module] || { icon: GraduationCap, title: module, desc: "Información académica del portal", stats: [], rows: courses };
  const Icon = content.icon;
  return (
    <>
      <PageHeading
        title={content.title}
        description={content.desc}
        action={
          <button className="flex h-[42px] items-center justify-center gap-2 border-0 bg-brand-900 px-[18px] text-sm font-bold text-white hover:bg-[#07664e] max-md:w-[42px] max-md:px-0">
            <Download size={17} /><span className="max-md:hidden">Descargar reporte</span>
          </button>
        }
      />
      <div className="mb-[18px] grid grid-cols-[55px_1fr] border border-line bg-white md:grid-cols-[75px_repeat(3,1fr)]">
        <span className="grid place-items-center bg-brand-900 text-white"><Icon size={25} /></span>
        {content.stats.map(([v, l]) => (
          <div key={l} className="grid gap-1 border-l border-line p-[15px] md:p-[22px]">
            <strong className="font-display text-2xl font-bold text-brand-900">{v}</strong>
            <small className="text-muted">{l}</small>
          </div>
        ))}
      </div>
      <section className="border border-line bg-white">
        <div className="flex items-center justify-between border-b border-line p-4">
          <h2 className="m-0 font-display text-sm font-bold text-brand-900">Detalle actualizado</h2>
          <span className="bg-brand-100 px-[9px] py-[6px] text-[10px] text-brand-900">{roles[user.role]}</span>
        </div>
        <DataTable columns={Array.from({ length: Math.max(...content.rows.map((r) => r.length)) }, (_, i) => ["Código / fecha", "Detalle", "Responsable", "Información", "Estado", "Dato"][i])} rows={content.rows} />
      </section>
    </>
  );
}
