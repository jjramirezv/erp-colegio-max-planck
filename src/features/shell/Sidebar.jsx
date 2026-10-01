import { useEffect, useState } from "react";
import {
  BarChart3, BookOpen, Building2, CalendarCheck2, CalendarDays, ChevronDown,
  CircleUserRound, ClipboardList, CreditCard, FileCheck2, FileText, GraduationCap,
  Home, LayoutDashboard, LockKeyhole, Megaphone, Settings, ShieldCheck,
  UserRoundCheck, Users, X,
} from "lucide-react";
import { academicNavigationGroups, directionNavigationGroups } from "../../data";
import Brand from "./Brand";

const iconMap = { Inicio: Home, Calendario: CalendarDays, Administración: Building2, "Gestión académica": BookOpen, Auditoría: ShieldCheck, Docentes: UserRoundCheck, Estudiantes: GraduationCap, Familias: Users, Usuarios: CircleUserRound, Configuración: Settings, Matrículas: FileText, Tesorería: CreditCard, Asistencia: UserRoundCheck, Comunicados: Megaphone, "Mis cursos": BookOpen, Materiales: FileText, Biblioteca: BookOpen, Calificaciones: FileText, Tutoría: Users, Horario: CalendarDays, Tareas: BookOpen, "Mis hijos": Users, Pagos: CreditCard };
const groupIcons = {
  "Panel docente": LayoutDashboard,
  "Trabajo en aula": BookOpen,
  Institución: Building2,
  "Organización académica": GraduationCap,
  Planificación: CalendarDays,
  Sistema: Settings,
  "Panel académico": LayoutDashboard,
  Matrícula: ClipboardList,
  "Carga académica": BookOpen,
  Asistencia: CalendarCheck2,
  Evaluación: FileCheck2,
  Resultados: BarChart3,
};

const teacherNavigationGroups = [
  { label: "Panel docente", items: [{ id: "Inicio", label: "Resumen", ready: true }, { id: "Mis cursos", label: "Mis cursos y secciones", ready: true }] },
  { label: "Trabajo en aula", items: [{ id: "Asistencia", label: "Registro de asistencia", ready: true }, { id: "Calificaciones", label: "Calificaciones", ready: true }, { id: "Materiales", label: "Materiales de clase", ready: true }] },
  { label: "Planificación", items: [{ id: "Calendario", label: "Calendario institucional", ready: true }, { id: "Comunicados", label: "Comunicados", ready: true }] },
];

function GroupedNavigation({ groups, modules, active, onSelect, openAll = false, showAll = false, ariaLabel }) {
  const activeGroup = groups.find((group) => group.items.some((item) => item.id === active))?.label;
  const [openGroups, setOpenGroups] = useState(() => new Set(openAll ? groups.map((group) => group.label) : [activeGroup || groups[0]?.label]));

  useEffect(() => {
    if (!activeGroup) return;
    setOpenGroups((current) => new Set([...current, activeGroup]));
  }, [activeGroup]);

  function toggle(label) {
    setOpenGroups((current) => {
      const next = new Set(current);
      next.has(label) ? next.delete(label) : next.add(label);
      return next;
    });
  }

  return (
    <nav className="mt-7 min-h-0 flex-1 overflow-y-auto pr-1 [scrollbar-color:#4d8b78_transparent] [scrollbar-width:thin]" aria-label={ariaLabel}>
      {groups.map((group) => {
        const Icon = groupIcons[group.label] || FileText;
        const open = openGroups.has(group.label);
        const items = showAll ? group.items : group.items.filter((item) => modules.includes(item.id));
        if (!items.length) return null;
        return (
          <section key={group.label} className="border-b border-white/10 py-2 last:border-b-0">
            <button className="flex w-full items-center gap-3 rounded-[5px] px-3 py-2.5 text-left text-[11px] font-extrabold text-white hover:bg-white/5" onClick={() => toggle(group.label)} aria-expanded={open}>
              <Icon className="h-[17px] w-[17px] text-[#f3bd24]" />
              <span className="min-w-0 flex-1">{group.label}</span>
              <ChevronDown className={`h-3.5 w-3.5 transition ${open ? "rotate-180" : ""}`} />
            </button>
            {open ? (
              <div className="ml-[20px] border-l border-white/15 pl-2">
                {items.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    disabled={!item.ready}
                    title={item.ready ? item.id : "Se habilitará en una siguiente etapa"}
                    className={`my-0.5 flex w-full items-start gap-2 rounded-[5px] px-3 py-2.5 text-left text-[10px] leading-snug transition ${active === item.id ? "bg-[#14765e] font-bold text-white shadow-[inset_3px_0_0_#f3bd24]" : item.ready ? "text-[#d7ebe4] hover:bg-white/7 hover:text-white" : "cursor-not-allowed text-[#84ad9f]"}`}
                    onClick={() => item.ready && onSelect(item.id)}
                  >
                    <span className={`mt-[5px] h-1.5 w-1.5 flex-none rounded-full ${active === item.id ? "bg-[#f3bd24]" : item.ready ? "bg-[#61aeda]" : "bg-[#638d80]"}`} />
                    <span className="min-w-0 flex-1">{item.label}</span>
                    {!item.ready ? <LockKeyhole className="mt-0.5 h-3 w-3 flex-none opacity-70" /> : null}
                  </button>
                ))}
              </div>
            ) : null}
          </section>
        );
      })}
    </nav>
  );
}

function StandardNavigation({ modules, active, onSelect }) {
  return (
    <nav aria-label="Menú del portal" className="mt-7 grid min-h-0 gap-1 overflow-y-auto">
      {modules.map((item) => {
        const Icon = iconMap[item] || FileText;
        return (
          <button key={item} className={`flex items-center gap-[14px] rounded-md border-0 bg-transparent px-[15px] py-[13px] text-left text-[#d7ebe4] hover:bg-[#07805f] hover:text-white ${active === item ? "bg-[#07805f] text-white" : ""}`} onClick={() => onSelect(item)}>
            <Icon size={19} /><span>{item}</span>
          </button>
        );
      })}
    </nav>
  );
}

export default function Sidebar({ user, modules, active, onSelect, open, onClose, identity }) {
  return (
    <>
      <aside
        className="fixed left-0 top-0 z-50 flex h-screen w-[240px] translate-x-[var(--sidebar-shift)] flex-col bg-brand-900 px-3 pb-[18px] pt-[26px] text-white transition-transform duration-[250ms] md:sticky md:translate-x-0"
        style={{ "--sidebar-shift": open ? "0" : "-100%" }}
      >
        <div className="flex items-center justify-between px-3 md:block"><Brand inverse identity={identity} /><button className="block text-white md:hidden" onClick={onClose}><X /></button></div>
        {user.role === "direccion" ? (
          <GroupedNavigation groups={directionNavigationGroups} modules={modules} active={active} onSelect={onSelect} openAll ariaLabel="Configuración institucional" />
        ) : user.role === "coordinador_academico" ? (
          <GroupedNavigation groups={academicNavigationGroups} modules={modules} active={active} onSelect={onSelect} showAll ariaLabel="Gestión académica" />
        ) : user.role === "docente" ? (
          <GroupedNavigation groups={teacherNavigationGroups} modules={modules} active={active} onSelect={onSelect} openAll ariaLabel="Portal docente" />
        ) : (
          <StandardNavigation modules={modules} active={active} onSelect={onSelect} />
        )}
        <div className="mt-4 border-t border-white/10 pt-4 text-center text-[#b9dacf]">
          <div className="flex items-center justify-center gap-3 text-left">
            <span className="grid h-10 w-10 place-content-center rounded-full bg-[#0d684f] font-display text-[11px] font-extrabold text-[#f3bd24]">MP</span>
            <small className="max-w-[135px] text-[8px] leading-[1.6] tracking-[0.12em]">{(identity?.displayName || "Colegio Max Planck").toUpperCase()}<br />HUANCAYO, PERÚ</small>
          </div>
        </div>
      </aside>
      {open ? <button aria-label="Cerrar menú" className="fixed inset-0 z-40 border-0 bg-[#001d1699] md:hidden" onClick={onClose} /> : null}
    </>
  );
}
