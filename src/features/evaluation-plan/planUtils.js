// Utilidades del plan de evaluaciones compartidas por estudiante, docente y coordinación.

export const KINDS = {
  weekly: { label: "Semanal", chip: "bg-[#eaf2ff] text-[#1d4d9c] border-[#b9d0f5]", dot: "bg-[#3b7ddd]" },
  mid: { label: "Mitad", chip: "bg-[#fff1cc] text-[#7a5200] border-[#f0d58a]", dot: "bg-[#e0a100]" },
  final: { label: "Final", chip: "bg-[#fbdbea] text-[#9b1d5c] border-[#f0b3d0]", dot: "bg-[#d9468f]" },
  other: { label: "Otra", chip: "bg-[#eef2f0] text-[#42524c] border-[#cfd9d5]", dot: "bg-[#7b8a85]" },
};

// Tipo y etiqueta corta de columna: S1…S7, Mitad, Final o abreviatura del título.
export function evaluationKind(title = "") {
  const weekly = title.match(/^examen semanal\s*(\d+)/i);
  if (weekly) return { key: "weekly", short: `S${weekly[1]}`, order: Number(weekly[1]) };
  if (/^evaluaci[oó]n de mitad/i.test(title)) return { key: "mid", short: "Mitad", order: 100 };
  if (/^evaluaci[oó]n final/i.test(title)) return { key: "final", short: "Final", order: 200 };
  return { key: "other", short: title.split(/\s+/).slice(0, 2).join(" "), order: 150 };
}

export const limaToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Lima" }).format(new Date());
export const dayMonth = (date) => date ? new Intl.DateTimeFormat("es-PE", { day: "2-digit", month: "short", timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`)).replace(".", "") : "";
export const weekdayDate = (date) => date ? new Intl.DateTimeFormat("es-PE", { weekday: "short", day: "2-digit", month: "short", timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`)).replaceAll(".", "") : "";

// Periodo en curso: el que contiene hoy según las fechas de sus evaluaciones; si no, el último ya iniciado.
export function currentPeriod(evaluations, today = limaToday()) {
  const ranges = new Map();
  for (const item of evaluations) {
    if (!item.date) continue;
    const range = ranges.get(item.period) || { from: item.date, to: item.date };
    ranges.set(item.period, { from: item.date < range.from ? item.date : range.from, to: item.date > range.to ? item.date : range.to });
  }
  const sorted = [...ranges.entries()].sort((a, b) => a[1].from.localeCompare(b[1].from));
  return (sorted.find(([, range]) => range.from <= today && today <= range.to) || [...sorted].reverse().find(([, range]) => range.from <= today) || sorted[0] || [evaluations[0]?.period])[0] || "";
}

export function periodsInOrder(evaluations) {
  const first = new Map();
  for (const item of evaluations) if (!first.has(item.period) || (item.date && item.date < first.get(item.period))) first.set(item.period, item.date || "9999");
  return [...first.entries()].sort((a, b) => a[1].localeCompare(b[1])).map(([period]) => period);
}

// Columnas únicas (S1, S2, …, Mitad, Final) de un conjunto de evaluaciones.
export function columnsOf(evaluations) {
  const map = new Map();
  for (const item of evaluations) {
    const kind = evaluationKind(item.title);
    const current = map.get(kind.short);
    if (!current || (item.date && item.date < current.date)) map.set(kind.short, { ...kind, date: item.date, title: item.title });
  }
  return [...map.values()].sort((a, b) => (a.date || "").localeCompare(b.date || "") || a.order - b.order);
}

export function numericAverage(values) {
  const valid = values.filter((value) => value != null && value !== "" && !Number.isNaN(Number(value))).map(Number);
  return valid.length ? Math.round((valid.reduce((sum, value) => sum + value, 0) / valid.length) * 10) / 10 : null;
}

export function gradeClass(grade, passing = 11) {
  if (grade == null || grade === "") return "";
  const value = String(grade).trim().toUpperCase(); const number = Number(value);
  if (!Number.isNaN(number)) return number >= 14 ? "bg-[#dcf5e6] text-[#146c43]" : number >= passing ? "bg-[#fff1cc] text-[#7a5200]" : "bg-[#ffe1e1] text-[#a1231f]";
  return ["AD", "A"].includes(value) ? "bg-[#dcf5e6] text-[#146c43]" : value === "B" ? "bg-[#fff1cc] text-[#7a5200]" : value === "C" ? "bg-[#ffe1e1] text-[#a1231f]" : "bg-brand-100 text-brand-900";
}
