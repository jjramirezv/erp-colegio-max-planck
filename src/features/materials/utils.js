// Rango Unicode de marcas diacríticas combinantes (U+0300 - U+036F), usado
// para despojar tildes tras normalizar a NFD. Definido con String.fromCharCode
// para evitar que un escape \u dentro de un literal de código termine
// interpretándose como el propio caracter al momento de generar este archivo.
const DIACRITICS_PATTERN = new RegExp(
  `[${String.fromCharCode(0x0300)}-${String.fromCharCode(0x036f)}]`,
  "g",
);

export function normalizedRole(role) {
  return String(role || "coordinador_academico")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(DIACRITICS_PATTERN, "")
    .replace(/\s+/g, "_");
}

export function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(DIACRITICS_PATTERN, "");
}

export function statusKey(status) {
  const value = normalizeText(status);
  if (value.includes("public")) return "published";
  if (value.includes("archiv")) return "archived";
  return "draft";
}

export function isPhysicalDelivery(delivery) {
  return normalizeText(delivery).includes("fisico");
}

export function isPurelyPhysicalDelivery(delivery) {
  const normalized = normalizeText(delivery).trim();
  return normalized === "fisico" || normalized === "physical";
}

export function sameSelection(left, right) {
  return String(left?.year || "") === String(right?.year || "")
    && String(left?.levelId || "") === String(right?.levelId || "")
    && String(left?.gradeId || "") === String(right?.gradeId || "")
    && String(left?.sectionId || "") === String(right?.sectionId || "")
    && String(left?.courseId || "") === String(right?.courseId || "");
}

export function distributionStatus(planned, delivered) {
  const plannedValue = Number(planned);
  const deliveredValue = Number(delivered);
  if (!Number.isFinite(deliveredValue) || deliveredValue <= 0) return "pending";
  if (Number.isFinite(plannedValue) && deliveredValue >= plannedValue) return "delivered";
  return "partial";
}

export function distributionStatusLabel(status) {
  if (status === "delivered") return "Entregado";
  if (status === "partial") return "Entrega parcial";
  return "Pendiente";
}

/**
 * Fecha corta numérica (dd/mm/aaaa), con hora opcional (dd/mm/aaaa hh:mm).
 * Es la más completa de las dos variantes que existían (tolera valores
 * vacíos/inválidos sin romper el render) y es la que usan la tabla, las
 * tarjetas y el inspector de materiales — vistas donde a veces se necesita
 * precisión de hora.
 */
export function formatDate(value, withTime = false) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("es-PE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  }).format(date);
}

/**
 * Fecha larga con mes abreviado en texto (ej. "20 may 2026"), fijada a la
 * zona horaria de Lima. Es el formato que ya usaba MaterialsFeature.jsx
 * únicamente para StudentMaterialsLibrary. Se conserva como función aparte
 * (en vez de fusionarla con formatDate) porque cambia el texto visible que
 * ven los estudiantes; unificarla habría alterado ese formato en producción.
 */
export function formatShortDate(value) {
  if (!value) return "Sin fecha";
  return new Intl.DateTimeFormat("es-PE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "America/Lima",
  }).format(new Date(value));
}

export function getInitialSelection(source) {
  const structure = source.academicStructure || [];
  const firstLevel = structure[0];
  const firstGrade = firstLevel?.grades?.[0];
  const firstSection = firstGrade?.sections?.[0];
  const firstCourse = firstSection?.courses?.[0];
  return {
    year: String(source.defaultSelection?.year || source.years?.[0] || new Date().getFullYear()),
    levelId: source.defaultSelection?.levelId || firstLevel?.id || "",
    gradeId: source.defaultSelection?.gradeId || firstGrade?.id || "",
    sectionId: source.defaultSelection?.sectionId || firstSection?.id || "",
    courseId: source.defaultSelection?.courseId ?? firstCourse?.id ?? "",
  };
}

export function selectionDetails(structure, selection) {
  const level = structure.find((item) => item.id === selection.levelId) || structure[0];
  const grade = level?.grades?.find((item) => item.id === selection.gradeId) || level?.grades?.[0];
  const section = grade?.sections?.find((item) => item.id === selection.sectionId) || grade?.sections?.[0];
  const course = section?.courses?.find((item) => item.id === selection.courseId);
  return { level, grade, section, course };
}
