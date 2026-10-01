export const EVENT_TYPES = {
  academico: { label: "Académico", dot: "bg-[#07805f]", text: "text-[#07664e]", surface: "border-[#9fcfbe] bg-[#f3faf7]" },
  civico: { label: "Cívico", dot: "bg-[#e1a20a]", text: "text-[#a56500]", surface: "border-[#edd18c] bg-[#fffaf0]" },
  comunidad: { label: "Comunidad", dot: "bg-[#7158c8]", text: "text-[#5d47b3]", surface: "border-[#c9c0ed] bg-[#f8f6ff]" },
  aniversario: { label: "Aniversario", dot: "bg-[#4b87dc]", text: "text-[#326dbf]", surface: "border-[#b5d0f3] bg-[#f4f8fe]" },
};

export const AUDIENCE_ROLES = [
  ["docente", "Docentes"],
  ["estudiante", "Estudiantes"],
  ["familia", "Familias"],
  ["administrativo", "Administración"],
];

const dateKeyFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Lima", year: "numeric", month: "2-digit", day: "2-digit",
});
const timeFormatter = new Intl.DateTimeFormat("es-PE", {
  timeZone: "America/Lima", hour: "2-digit", minute: "2-digit", hour12: true,
});

export function dateKey(value = new Date()) {
  return dateKeyFormatter.format(value instanceof Date ? value : new Date(value));
}

export function timeValue(value) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "America/Lima", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(new Date(value));
  const get = (type) => parts.find((part) => part.type === type)?.value || "00";
  return `${get("hour")}:${get("minute")}`;
}

export function monthLabel(cursor) {
  const label = new Intl.DateTimeFormat("es-PE", { month: "long", year: "numeric" }).format(cursor);
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function longDateLabel(value) {
  const label = new Intl.DateTimeFormat("es-PE", {
    timeZone: "America/Lima", weekday: "long", day: "numeric", month: "long", year: "numeric",
  }).format(new Date(`${value}T12:00:00-05:00`));
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function shortTimeLabel(activity) {
  return activity.allDay ? "Todo el día" : timeFormatter.format(new Date(activity.startsAt));
}

export function rangeForMonth(cursor) {
  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const start = `${year}-${String(month + 1).padStart(2, "0")}-01T00:00:00-05:00`;
  const next = new Date(year, month + 1, 1);
  const end = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}-01T00:00:00-05:00`;
  return { startsAt: start, endsAt: end };
}

export function buildMonthCells(cursor) {
  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const mondayOffset = (new Date(year, month, 1).getDay() + 6) % 7;
  return Array.from({ length: 42 }, (_, index) => {
    const value = new Date(year, month, index - mondayOffset + 1, 12);
    return { value, key: dateKey(value), day: value.getDate(), currentMonth: value.getMonth() === month };
  });
}

export function activityToForm(activity, fallbackDate, responsible = "") {
  if (!activity) {
    return {
      id: null, title: "", description: "", type: "academico", status: "draft",
      startDate: fallbackDate, startTime: "09:00", endDate: fallbackDate, endTime: "10:00",
      allDay: false, location: "", responsible, audienceRoles: [],
    };
  }
  return {
    id: activity.id,
    title: activity.title,
    description: activity.description,
    type: activity.type,
    status: activity.status,
    startDate: dateKey(activity.startsAt),
    startTime: timeValue(activity.startsAt),
    endDate: dateKey(activity.endsAt),
    endTime: timeValue(activity.endsAt),
    allDay: activity.allDay,
    location: activity.location,
    responsible: activity.responsible,
    audienceRoles: activity.audienceAll ? [] : activity.audienceRoles,
  };
}

export function audienceLabel(activity) {
  if (activity.audienceAll || !activity.audienceRoles?.length) return "Toda la comunidad";
  const labels = new Map(AUDIENCE_ROLES);
  return activity.audienceRoles.map((role) => labels.get(role) || role).join(", ");
}
