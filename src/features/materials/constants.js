export const EMPTY_ARRAY = Object.freeze([]);

export const FULL_ACCESS_ROLES = new Set([
  "direccion",
  "alta_direccion",
  "coordinacion",
  "coordinacion_academica",
  "coordinador_academico",
  "admin",
  "administrador",
]);

export const DISTRIBUTION_MANAGER_ROLES = new Set([
  "direccion",
  "alta_direccion",
  "coordinacion",
  "coordinacion_academica",
  "coordinador_academico",
]);

export const TEACHER_ROLES = new Set(["docente", "teacher"]);

/**
 * Paleta Tailwind centralizada para los badges de estado.
 * `statusKey()` (utils.js) produce las claves draft/published/archived que
 * consumen StatusBadge, MaterialTable, MaterialCards y MaterialInspector.
 * Cada entrada trae dos variantes: `chip` (badge con fondo/borde, uso normal)
 * y `text` (solo color de texto, usada por StatusBadge en modo `plain` dentro
 * del historial de versiones del inspector, donde el diseño original quita
 * el fondo/borde pero conserva el mismo color por estado).
 */
export const STATUS_BADGE_STYLES = {
  published: { chip: "border-brand-700/40 bg-brand-100 text-brand-800", text: "text-brand-800" },
  draft: { chip: "border-amber/40 bg-amber-soft text-amber-ink", text: "text-amber-ink" },
  archived: { chip: "border-line-strong bg-canvas text-muted", text: "text-muted" },
};

/**
 * Paleta Tailwind centralizada para el estado de reparto físico.
 * `distributionStatus()` (utils.js) produce pending/partial/delivered,
 * consumidos por MaterialInspector y DistributionDialog.
 */
export const DELIVERY_STATUS_STYLES = {
  pending: "border-line-strong bg-canvas text-muted",
  partial: "border-amber/40 bg-amber-soft text-amber-ink",
  delivered: "border-brand-700/40 bg-brand-100 text-brand-800",
};
