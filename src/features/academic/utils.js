import { TABS } from "./constants";

export function normalizeTab(value) {
  return TABS.some((tab) => tab.id === value) ? value : "cursos";
}

export function idEquals(left, right) {
  return String(left ?? "") === String(right ?? "");
}

export function localDate() {
  const parts = new Intl.DateTimeFormat("es-PE", {
    timeZone: "America/Lima",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

export function formatDate(value, withTime = false) {
  if (!value) return "—";
  try {
    const parsedValue = /^\d{4}-\d{2}-\d{2}$/.test(String(value)) ? `${value}T12:00:00-05:00` : value;
    return new Intl.DateTimeFormat("es-PE", withTime
      ? { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "America/Lima" }
      : { day: "2-digit", month: "short", year: "numeric", timeZone: "America/Lima" })
      .format(new Date(parsedValue));
  } catch {
    return value;
  }
}

export function shortDetails(details) {
  const entries = Object.entries(details || {}).filter(([, value]) => value !== null && value !== "").slice(0, 3);
  if (!entries.length) return "Sin detalles adicionales";
  return entries.map(([key, value]) => {
    const text = typeof value === "object" ? JSON.stringify(value) : String(value);
    return `${key.replaceAll("_", " ")}: ${text.slice(0, 70)}`;
  }).join(" · ");
}
