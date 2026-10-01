import { BookOpenCheck, History, UsersRound } from "lucide-react";

export const EMPTY_WORKSPACE = {
  years: [], levels: [], grades: [], sections: [], subjects: [], offerings: [],
  assignments: [], enrollments: [], profiles: [], audit: [],
};

export const TABS = [
  { id: "cursos", label: "Cursos y docentes", icon: BookOpenCheck },
  { id: "matriculas", label: "Matrículas", icon: UsersRound },
  { id: "auditoria", label: "Auditoría", icon: History },
];

export const ACTION_LABELS = {
  created: "Creado", updated: "Actualizado", published: "Publicado",
  archived: "Archivado", distributed: "Distribuido", deleted: "Eliminado",
};

export const ENTITY_LABELS = {
  learning_materials: "Material", material_versions: "Versión",
  material_releases: "Publicación", material_targets: "Destino",
  physical_distributions: "Entrega física", course_offerings: "Curso",
  teaching_assignments: "Asignación", student_enrollments: "Matrícula",
};

// Estilos Tailwind compartidos entre paneles para evitar duplicar strings largos.
export const PRIMARY_BUTTON_CLASS =
  "inline-flex min-h-[38px] items-center justify-center gap-1.5 border border-brand-900 bg-brand-900 px-3.5 text-[10px] font-extrabold text-white hover:bg-[#064a3a] disabled:cursor-not-allowed disabled:opacity-55";

export const SECONDARY_BUTTON_CLASS =
  "inline-flex min-h-[38px] items-center justify-center gap-1.5 border border-brand-900 bg-surface px-3.5 text-[10px] font-extrabold text-brand-900 disabled:cursor-not-allowed disabled:opacity-55";

export const COUNT_BADGE_CLASS =
  "grid min-w-[92px] justify-items-center border-l-[3px] border-gold bg-amber-soft px-3 py-2 text-[9px] text-muted";

export const PANEL_CLASS = "min-h-[360px] border border-[#9eb7ae] border-t-0 bg-surface";

export const SELECT_CLASS =
  "min-h-[34px] w-full border border-[#c7d7d1] bg-surface px-2.5 pr-7 text-[11px] font-bold text-ink outline-none focus:border-brand-800 focus:shadow-[0_0_0_2px_rgba(10,115,88,0.12)]";

export const ICON_ACTION_CLASS =
  "grid h-[34px] w-[34px] place-items-center border border-[#aac0b8] bg-surface text-brand-900 disabled:cursor-not-allowed disabled:opacity-45";
