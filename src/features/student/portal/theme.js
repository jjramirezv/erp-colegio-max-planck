// Paleta por curso compartida por Inicio, Mis cursos, Horario, Calificaciones y Materiales.
// Clases completas (no concatenadas) para que Tailwind las genere.
export const COURSE_TONES = [
  { key: "blue", soft: "bg-[#eaf2ff]", block: "bg-[#dbe8ff] hover:bg-[#cfe0ff]", border: "border-[#7aa7f0]", bar: "bg-[#3b7ddd]", text: "text-[#1d4d9c]", ring: "ring-[#3b7ddd]" },
  { key: "green", soft: "bg-[#e8f7ee]", block: "bg-[#d6f2e1] hover:bg-[#c7ecd6]", border: "border-[#6cc596]", bar: "bg-[#22a06b]", text: "text-[#146c43]", ring: "ring-[#22a06b]" },
  { key: "amber", soft: "bg-[#fff6dc]", block: "bg-[#ffedba] hover:bg-[#ffe6a3]", border: "border-[#f0c24b]", bar: "bg-[#e0a100]", text: "text-[#7a5200]", ring: "ring-[#e0a100]" },
  { key: "pink", soft: "bg-[#fdecf4]", block: "bg-[#fbdbea] hover:bg-[#f8cde1]", border: "border-[#ec8fbd]", bar: "bg-[#d9468f]", text: "text-[#9b1d5c]", ring: "ring-[#d9468f]" },
  { key: "cyan", soft: "bg-[#e6f8fa]", block: "bg-[#d2f1f5] hover:bg-[#c1eaf0]", border: "border-[#5fc6d2]", bar: "bg-[#139bab]", text: "text-[#0b6671]", ring: "ring-[#139bab]" },
  { key: "violet", soft: "bg-[#f3eeff]", block: "bg-[#e6ddff] hover:bg-[#dcd0ff]", border: "border-[#a98bf0]", bar: "bg-[#7c55e0]", text: "text-[#5530a8]", ring: "ring-[#7c55e0]" },
  { key: "coral", soft: "bg-[#fff0eb]", block: "bg-[#ffdcd1] hover:bg-[#ffd0c1]", border: "border-[#f39a83]", bar: "bg-[#e8613f]", text: "text-[#9c3218]", ring: "ring-[#e8613f]" },
  { key: "teal", soft: "bg-[#eaf4f0]", block: "bg-[#d8ebe3] hover:bg-[#cae3d9]", border: "border-[#84b3a1]", bar: "bg-[#3f8a70]", text: "text-[#1f5a47]", ring: "ring-[#3f8a70]" },
];

function hash(text) {
  let value = 0;
  for (const char of text) value = (value * 31 + char.codePointAt(0)) >>> 0;
  return value;
}

// Cada curso toma el color que le corresponde por su nombre; si ya está ocupado, el siguiente libre.
// Así un curso conserva su color aunque otra vista tenga cursos adicionales.
export function coursePalette(names) {
  const unique = [...new Set(names)].sort((a, b) => hash(a) % COURSE_TONES.length - hash(b) % COURSE_TONES.length || a.localeCompare(b, "es"));
  const used = new Set(); const palette = new Map();
  for (const name of unique) {
    let slot = hash(name) % COURSE_TONES.length;
    for (let tries = 0; used.has(slot) && tries < COURSE_TONES.length; tries++) slot = (slot + 1) % COURSE_TONES.length;
    used.add(slot); if (used.size >= COURSE_TONES.length) used.clear();
    palette.set(name, COURSE_TONES[slot]);
  }
  return palette;
}

export const DAY_NAMES = ["", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
export const DAY_SHORT = ["", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
export const toMinutes = (time) => { const [h, m] = time.split(":").map(Number); return h * 60 + m; };
export const hhmm = (time) => time.slice(0, 5);

export function limaNow() {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: "America/Lima", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date()).map(({ type, value }) => [type, value]));
  const date = `${parts.year}-${parts.month}-${parts.day}`;
  return { date, weekday: new Date(`${date}T12:00:00`).getDay() || 7, minutes: Number(parts.hour) * 60 + Number(parts.minute) };
}

export const longDate = (date) => { const text = new Date(`${date}T12:00:00`).toLocaleDateString("es-PE", { weekday: "long", day: "numeric", month: "long" }); return text.charAt(0).toUpperCase() + text.slice(1); };
