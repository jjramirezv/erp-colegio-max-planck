export const HEADERS = ["dni", "nombres", "apellidos", "correo", "clave", "nivel", "grado", "seccion"];
// Columnas opcionales del apoderado: crean o vinculan su cuenta de familia.
export const GUARDIAN_HEADERS = ["dni_apoderado", "nombre_apoderado", "parentesco"];
const RELATIONS = { madre: "madre", mama: "madre", padre: "padre", papa: "padre", apoderado: "apoderado", apoderada: "apoderado", tutor: "apoderado", tutora: "apoderado", otro: "otro", otra: "otro" };
const normalize = (text) => String(text).trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
export function parseCSV(input, { classroomInFile = true } = {}) {
  const text = input.replace(/^\uFEFF/, "");
  const delimiter = text.split(/\r?\n/, 1)[0].includes(";") ? ";" : ",";
  const records = []; let row = []; let cell = ""; let quoted = false; let closed = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (char === '"') { quoted = false; closed = true; }
      else cell += char;
    } else if (char === '"') {
      if (cell || closed) throw new Error("Comillas inválidas en el CSV.");
      quoted = true;
    } else if (char === delimiter || char === "\n" || char === "\r") {
      row.push(cell); cell = ""; closed = false;
      if (char !== delimiter) { if (row.some((value) => value.trim())) records.push(row); row = []; if (char === "\r" && text[i + 1] === "\n") i++; }
    } else {
      if (closed && char.trim()) throw new Error("Hay texto fuera de las comillas.");
      if (!closed) cell += char;
    }
  }
  if (quoted) throw new Error("Falta cerrar una celda entre comillas.");
  row.push(cell); if (row.some((value) => value.trim())) records.push(row);
  if (records.length < 2) throw new Error("Agrega al menos un estudiante debajo de los encabezados.");
  if (records.length > 3001) throw new Error("El máximo es 3000 estudiantes por archivo.");
  const headers = records.shift().map(normalize);
  const required = classroomInFile ? HEADERS : HEADERS.slice(0, 5);
  if (new Set(headers).size !== headers.length || required.some((key) => !headers.includes(key)) || headers.some((key) => !HEADERS.includes(key) && !GUARDIAN_HEADERS.includes(key))) throw new Error(`Usa los encabezados de la plantilla: ${required.join(", ")}. Opcionales: ${GUARDIAN_HEADERS.join(", ")}.`);
  return records.map((values, index) => {
    if (values.length !== headers.length) throw new Error(`Fila ${index + 2}: cantidad de columnas incorrecta.`);
    return { ...Object.fromEntries(headers.map((key, i) => [key, values[i].trim()])), row: index + 2 };
  });
}
export function prepareRows(records, sections, yearId) {
  const dniCounts = new Map(); const emailCounts = new Map();
  const rows = records.map((item) => {
    const email = (item.correo || `${item.dni}@estudiantes.maxplanck.edu.pe`).toLowerCase();
    dniCounts.set(item.dni, (dniCounts.get(item.dni) || 0) + 1); emailCounts.set(email, (emailCounts.get(email) || 0) + 1);
    return { row: item.row, importId: crypto.randomUUID(), dni: item.dni, name: `${item.nombres} ${item.apellidos}`.trim(), email, password: item.clave || item.dni, level: item.nivel, grade: item.grado, section: item.seccion, hasNames: Boolean(item.nombres && item.apellidos),
      parentDni: (item.dni_apoderado || "").trim(), parentName: (item.nombre_apoderado || "").trim(), parentRelationRaw: (item.parentesco || "").trim(),
      parentRelation: RELATIONS[normalize(item.parentesco || "apoderado")] || "", parentEmail: item.dni_apoderado ? `${item.dni_apoderado.trim()}@familias.maxplanck.edu.pe` : "" };
  });
  return rows.map((row) => {
    const errors = [];
    if (!/^\d{8}$/.test(row.dni)) errors.push("DNI: 8 dígitos (usa formato texto en Excel)");
    if (!row.hasNames || row.name.length < 3 || row.name.length > 160) errors.push("Completa nombres y apellidos");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email)) errors.push("Correo inválido");
    if (row.password.length < 8 || row.password.length > 72) errors.push("Clave: entre 8 y 72 caracteres");
    if (/^[=+@\-\t\r]/.test(row.password)) errors.push("La clave no puede comenzar con =, +, - o @ para exportarla a Excel");
    if (dniCounts.get(row.dni) > 1) errors.push("DNI repetido en el archivo");
    if (emailCounts.get(row.email) > 1) errors.push("Correo repetido en el archivo");
    const matches = sections.filter((s) => String(s.yearId) === String(yearId) && [s.level, s.grade, s.section].every((v, i) => v.trim().toLowerCase() === [row.level, row.grade, row.section][i].trim().toLowerCase()));
    if (matches.length !== 1) errors.push("Nivel, grado o sección no coincide con un salón activo");
    if (row.parentDni || row.parentName) {
      if (!/^\d{8}$/.test(row.parentDni)) errors.push("DNI del apoderado: 8 dígitos");
      if (row.parentName.length < 3) errors.push("Escribe el nombre del apoderado");
      if (row.parentDni === row.dni) errors.push("El DNI del apoderado no puede ser el del estudiante");
      if (!row.parentRelation) errors.push("Parentesco: madre, padre, apoderado u otro");
    }
    return { ...row, status: errors.length ? "invalid" : "pending", message: errors.join(". ") };
  });
}
export function toCSV(rows) {
  const escape = (value) => {
    const text = String(value ?? "");
    return '"' + (/^[=+@\-\t\r]/.test(text) ? "'" + text : text).replaceAll('"', '""') + '"';
  };
  return "\uFEFF" + rows.map((row) => row.map(escape).join(";")).join("\r\n");
}
export function downloadCSV(name, rows) {
  const url = URL.createObjectURL(new Blob([toCSV(rows)], { type: "text/csv;charset=utf-8" }));
  const anchor = document.createElement("a"); anchor.href = url; anchor.download = name; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
